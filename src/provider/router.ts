import type {
  Message,
  Provider,
  ProviderResponse,
  StreamCallbacks,
  ToolDefinition,
} from "../types.js";

// ── Cost Tiers ──────────────────────────────────────────────

/** Logical cost/quality tier for a provider. */
export type CostTier = "cheap" | "standard" | "premium";

/** Ordered fallback: if a tier fails, try the next one in this sequence. */
export const TIER_FALLBACK_ORDER: CostTier[] = ["cheap", "standard", "premium"];

// ── Routed Provider ─────────────────────────────────────────

/** A provider registered in the router with metadata for strategy selection. */
export interface RoutedProviderEntry {
  provider: Provider;
  tier: CostTier;
  /** Human-readable label shown in logs (e.g., "DeepSeek V3") */
  label: string;
}

// ── Circuit Breaker ─────────────────────────────────────────

/**
 * Circuit breaker state for a single provider.
 * After `failureThreshold` consecutive failures, the circuit opens
 * and the provider is skipped for `cooldownMs` milliseconds.
 */
interface CircuitState {
  consecutiveFailures: number;
  lastFailureTime: number;
  isOpen: boolean;
  openedAt: number;
}

const DEFAULT_CIRCUIT_CONFIG = {
  /** Number of consecutive failures before opening the circuit. */
  failureThreshold: 3,
  /** Milliseconds to wait before attempting a recovery call. */
  cooldownMs: 30_000,
  /** Maximum time the circuit can stay open before forcing a retry. */
  maxCooldownMs: 300_000,
};

// ── Latency Tracker ─────────────────────────────────────────

interface LatencyEntry {
  timestamp: number;
  durationMs: number;
  success: boolean;
}

const LATENCY_WINDOW_SIZE = 20;

// ── Token Budget ────────────────────────────────────────────

/** Cumulative token usage across all routed calls. */
export interface TokenBudget {
  inputTokens: number;
  outputTokens: number;
  /** Approximate cost in USD (rough estimates). */
  estimatedCost: number;
}

// ── Routing Strategy ────────────────────────────────────────

/**
 * Pluggable routing strategy. Given the conversation context, returns
 * the preferred cost tier to handle this turn.
 */
export interface RouterStrategy {
  readonly name: string;

  /**
   * Inspect conversation state and return the ideal tier.
   * Called before each chat() invocation.
   */
  selectTier(messages: Message[], tools: ToolDefinition[]): CostTier;
}

// ── Keyword-based Complexity Analyzer ───────────────────────

/**
 * Keywords and patterns that suggest a task needs a premium model.
 * These are common in software engineering prompts.
 */
const COMPLEX_KEYWORDS: ReadonlyArray<{
  pattern: RegExp;
  weight: number;
  label: string;
}> = [
  { pattern: /\b(refactor|rewrite|redesign|overhaul)\b/i, weight: 0.9, label: "refactor" },
  { pattern: /\b(debug|troubleshoot|diagnose|bug|issue|error|fix\s+(the|this|a)\s+(bug|error|issue))\b/i, weight: 0.8, label: "debug" },
  { pattern: /\b(implement|build|create|develop|add)\s+(a|the|new|full|complete|entire)\b/i, weight: 0.7, label: "implement" },
  { pattern: /\b(explain|how\s+(does|do|should|would|can|to)|why\s+(is|does|would|should))\b/i, weight: 0.3, label: "explain" },
  { pattern: /\b(security|vulnerability|auth|authentication|authorization|encrypt|XSS|SQL\s*injection|CSRF)\b/i, weight: 0.9, label: "security" },
  { pattern: /\b(performance|optimize|slow|latency|bottleneck|profiling)\b/i, weight: 0.8, label: "performance" },
  { pattern: /\b(architecture|design\s+pattern|system\s+design|microservice)\b/i, weight: 0.85, label: "architecture" },
  { pattern: /\b(review|audit|analyze|assess)\s+(the|this|my|our|code|file|project|module)\b/i, weight: 0.7, label: "review" },
  { pattern: /\b(migrate|upgrade|downgrade|bump)\b/i, weight: 0.75, label: "migrate" },
  { pattern: /\b(test|spec|TDD|unit\s*test|integration\s*test|e2e\s*test)\b/i, weight: 0.6, label: "test" },
  { pattern: /```[\s\S]*```|`[^`]{200,}`/, weight: 0.8, label: "large_code_block" },
  { pattern: /\b(concurrency|parallel|async|thread|deadlock|race\s*condition)\b/i, weight: 0.85, label: "concurrency" },
];

/**
 * Scores text for complexity on a 0–1 scale using keyword heuristics.
 * Returns both the score and a list of signals that matched.
 */
export function analyzeComplexity(text: string): {
  score: number;
  signals: string[];
} {
  if (!text || text.trim().length === 0) {
    return { score: 0, signals: [] };
  }

  const signals: string[] = [];
  let totalWeight = 0;

  for (const { pattern, weight, label } of COMPLEX_KEYWORDS) {
    if (pattern.test(text)) {
      signals.push(label);
      totalWeight += weight;
    }
  }

  // Clamp to 0–1 range; diminishing returns for multiple signals
  const score = Math.min(1, totalWeight / (1 + totalWeight * 0.5));

  return { score: Math.round(score * 100) / 100, signals };
}

// ── Built-in Strategies ─────────────────────────────────────

export interface CostOptimizedOptions {
  /** Total character count above which we consider the task complex. */
  complexThreshold?: number;
  /** Message count above which we consider the task complex. */
  turnThreshold?: number;
  /** Complexity score threshold (0–1) that triggers premium routing. */
  complexityScoreThreshold?: number;
  /** Minimum character count for short-circuit cheap routing. */
  cheapCharLimit?: number;
}

/**
 * Estimates task complexity from conversation signals and routes
 * simple queries to cheap models, complex work to premium models.
 *
 * Heuristics (configurable via constructor):
 *  - Short single message with no tool history → cheap
 *  - High keyword complexity score → premium
 *  - Multi-turn conversation or active tool use → premium
 *  - Everything else → standard
 */
export class CostOptimizedStrategy implements RouterStrategy {
  readonly name = "cost-optimized";

  private complexThreshold: number;
  private turnThreshold: number;
  private complexityScoreThreshold: number;
  private cheapCharLimit: number;

  constructor(options: CostOptimizedOptions = {}) {
    this.complexThreshold = options.complexThreshold ?? 3000;
    this.turnThreshold = options.turnThreshold ?? 5;
    this.complexityScoreThreshold = options.complexityScoreThreshold ?? 0.5;
    this.cheapCharLimit = options.cheapCharLimit ?? 500;
  }

  selectTier(messages: Message[], _tools: ToolDefinition[]): CostTier {
    const userText = this.extractLatestUserText(messages);

    // 1. Single short message with no tool history → cheap
    if (messages.length === 1) {
      const msg = messages[0];
      const totalChars = this.countChars(msg);
      if (totalChars < this.cheapCharLimit) return "cheap";
    }

    // 2. Keyword-based complexity analysis on latest user input
    const complexityResult = analyzeComplexity(userText);
    if (complexityResult.score >= this.complexityScoreThreshold) {
      return "premium";
    }

    // 3. Multi-turn or tool-heavy → premium
    const totalChars = messages.reduce((sum, m) => sum + this.countChars(m), 0);
    const hasToolUse = messages.some((m) =>
      m.content.some((b) => b.type === "tool_use" || b.type === "tool_result")
    );

    if (messages.length >= this.turnThreshold || totalChars > this.complexThreshold || hasToolUse) {
      return "premium";
    }

    return "standard";
  }

  /** Extract the text of the last user message for complexity analysis. */
  private extractLatestUserText(messages: Message[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        return messages[i].content
          .filter((b) => b.type === "text")
          .map((b) => (b as { text: string }).text)
          .join("\n");
      }
    }
    return "";
  }

  private countChars(msg: Message): number {
    return msg.content.reduce((sum, b) => {
      if (b.type === "text") return sum + (b as { text: string }).text.length;
      if (b.type === "tool_result") return sum + (b as { content: string }).content.length;
      return sum;
    }, 0);
  }
}

/** Always routes to a fixed tier — useful as a fallback or for testing. */
export class FixedTierStrategy implements RouterStrategy {
  readonly name: string;

  constructor(private tier: CostTier, name?: string) {
    this.name = name ?? `fixed-${tier}`;
  }

  selectTier(): CostTier {
    return this.tier;
  }
}

// ── Provider Router ─────────────────────────────────────────

export interface RouterConfig {
  /** Providers grouped by tier. Multiple providers per tier for failover. */
  providers: Map<CostTier, RoutedProviderEntry[]>;
  /** Routing strategy to select the initial tier. */
  strategy: RouterStrategy;
  /** Tier fallback order when the selected tier has no provider or all fail. */
  fallbackOrder?: CostTier[];
  /** Whether to log routing decisions to stderr. */
  verbose?: boolean;
  /** Circuit breaker configuration. */
  circuitBreaker?: Partial<typeof DEFAULT_CIRCUIT_CONFIG>;
  /** Whether to track and report response times. */
  trackLatency?: boolean;
  /** Whether to track cumulative token budget. */
  trackBudget?: boolean;
  /** Approximate cost per 1M tokens (input/output), used for budget tracking. */
  costRates?: Record<string, { input: number; output: number }>;
}

/**
 * Implements the `Provider` interface by routing each `chat()` call to the
 * best-fit underlying provider. Supports:
 *
 *  - Pluggable routing strategies (cost-optimized, fixed-tier, custom)
 *  - Per-tier provider pools for horizontal failover
 *  - Cross-tier fallback when a tier is exhausted or unavailable
 *  - Circuit breaker: temporarily disables providers after consecutive failures
 *  - Exponential backoff on retry
 *  - Response time tracking per provider
 *  - Cumulative token budget tracking
 */
export class ProviderRouter implements Provider {
  readonly name = "router";

  private config: RouterConfig;
  private tierRoundRobin = new Map<CostTier, number>();

  /** Circuit breaker state per provider label. */
  private circuits = new Map<string, CircuitState>();

  /** Latency tracking per provider label. */
  private latencyLogs = new Map<string, LatencyEntry[]>();

  /** Cumulative token budget. */
  private budget: TokenBudget = { inputTokens: 0, outputTokens: 0, estimatedCost: 0 };

  /** Resolved circuit breaker config. */
  private cbConfig: typeof DEFAULT_CIRCUIT_CONFIG;

  constructor(config: RouterConfig) {
    this.config = config;
    this.cbConfig = { ...DEFAULT_CIRCUIT_CONFIG, ...config.circuitBreaker };
  }

  async chat(
    messages: Message[],
    tools: ToolDefinition[],
    callbacks?: StreamCallbacks,
    systemPrompt?: string
  ): Promise<ProviderResponse> {
    const fallbackOrder = this.config.fallbackOrder ?? TIER_FALLBACK_ORDER;

    // 1. Strategy selects the preferred tier
    const preferredTier = this.config.strategy.selectTier(messages, tools);
    this.log(`[strategy] tier=${preferredTier} (${this.config.strategy.name})`);

    // 2. Build search order: preferred tier first, then remaining fallback tiers
    const searchOrder = [
      preferredTier,
      ...fallbackOrder.filter((t) => t !== preferredTier),
    ];

    const errors: string[] = [];

    for (const tier of searchOrder) {
      const entries = this.config.providers.get(tier);
      if (!entries || entries.length === 0) {
        this.log(`  [${tier}] no providers configured, skip`);
        continue;
      }

      // Filter out providers with open circuits
      const healthy = entries.filter((e) => !this.isCircuitOpen(e.label));
      if (healthy.length < entries.length) {
        this.log(`  [${tier}] ${entries.length - healthy.length}/${entries.length} circuit-open`);
      }
      if (healthy.length === 0) {
        this.log(`  [${tier}] no healthy providers, fallback`);
        continue;
      }

      // Round-robin within healthy providers
      const idx = this.tierRoundRobin.get(tier) ?? 0;
      this.tierRoundRobin.set(tier, (idx + 1) % healthy.length);

      const entry = healthy[idx];

      try {
        const startedAt = Date.now();
        const response = await entry.provider.chat(messages, tools, callbacks, systemPrompt);
        const elapsed = Date.now() - startedAt;

        this.onSuccess(entry.label, elapsed);
        this.trackUsage(response, entry.label);
        if (this.config.trackLatency) {
          this.log(`  ✓ [${tier}] ${entry.label} — ${elapsed}ms`);
        }
        return response;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.onFailure(entry.label);
        this.log(`✗ [${tier}] ${entry.label}: ${msg}`);
        errors.push(`[${tier}] ${entry.label}: ${msg}`);

        // Try remaining healthy providers in this tier with exponential backoff
        let retryIdx = 0;
        for (let i = 0; i < healthy.length; i++) {
          if (i === idx) continue;
          const alt = healthy[i];
          if (this.isCircuitOpen(alt.label)) continue;

          const delay = this.exponentialBackoff(retryIdx);
          if (delay > 0) {
            this.log(`  ⏳ backoff ${delay}ms...`);
            await this.sleep(delay);
          }
          retryIdx++;

          try {
            const startedAt = Date.now();
            const response = await alt.provider.chat(messages, tools, callbacks, systemPrompt);
            const elapsed = Date.now() - startedAt;

            this.onSuccess(alt.label, elapsed);
            this.trackUsage(response, alt.label);
            if (this.config.trackLatency) {
              this.log(`  ✓ [${tier}] ${alt.label} — ${elapsed}ms`);
            }
            return response;
          } catch (err2) {
            const msg2 = err2 instanceof Error ? err2.message : String(err2);
            this.onFailure(alt.label);
            errors.push(`[${tier}] ${alt.label}: ${msg2}`);
          }
        }
      }
    }

    throw new Error(
      `All providers exhausted. Errors:\n${errors.map((e) => `  • ${e}`).join("\n")}`
    );
  }

  // ── Circuit Breaker ─────────────────────────────────────

  /** Check if the circuit is open for a given provider label. */
  private isCircuitOpen(label: string): boolean {
    const state = this.circuits.get(label);
    if (!state || !state.isOpen) return false;

    const now = Date.now();
    const openDuration = now - state.openedAt;

    // If cooldown has expired, allow one recovery attempt (half-open)
    if (openDuration >= this.cbConfig.cooldownMs) {
      this.log(`  [circuit] ${label} half-open, allowing trial`);
      state.isOpen = false;
      return false;
    }

    return true;
  }

  /** Record a successful call — reset circuit breaker. */
  private onSuccess(label: string, durationMs: number): void {
    const circuit = this.circuits.get(label);
    if (circuit) {
      circuit.consecutiveFailures = 0;
      circuit.isOpen = false;
    }
    if (this.config.trackLatency) {
      this.recordLatency(label, durationMs, true);
    }
  }

  /** Record a failed call — increment circuit breaker counter. */
  private onFailure(label: string): void {
    let circuit = this.circuits.get(label);
    if (!circuit) {
      circuit = { consecutiveFailures: 0, lastFailureTime: 0, isOpen: false, openedAt: 0 };
      this.circuits.set(label, circuit);
    }

    circuit.consecutiveFailures++;
    circuit.lastFailureTime = Date.now();

    if (circuit.consecutiveFailures >= this.cbConfig.failureThreshold && !circuit.isOpen) {
      circuit.isOpen = true;
      circuit.openedAt = Date.now();
      this.log(`  [circuit] ${label} OPEN (${circuit.consecutiveFailures} consecutive failures)`);
    }

    if (this.config.trackLatency) {
      this.recordLatency(label, 0, false);
    }
  }

  // ── Exponential Backoff ─────────────────────────────────

  /**
   * Calculate exponential backoff delay.
   * Base: 1s, cap: 30s, with jitter.
   */
  private exponentialBackoff(attempt: number): number {
    if (attempt <= 0) return 0;
    const base = 1000; // 1 second
    const cap = 30_000; // 30 seconds
    const delay = Math.min(cap, base * Math.pow(2, attempt - 1));
    const jitter = Math.random() * delay * 0.3; // ±15% jitter
    return Math.round(delay + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ── Latency Tracking ────────────────────────────────────

  private recordLatency(label: string, durationMs: number, success: boolean): void {
    let log = this.latencyLogs.get(label);
    if (!log) {
      log = [];
      this.latencyLogs.set(label, log);
    }

    log.push({ timestamp: Date.now(), durationMs, success });

    // Maintain sliding window
    if (log.length > LATENCY_WINDOW_SIZE) {
      log.splice(0, log.length - LATENCY_WINDOW_SIZE);
    }
  }

  /** Get latency stats for a specific provider. */
  getLatencyStats(label: string): {
    avgMs: number;
    p95Ms: number;
    errorRate: number;
    sampleCount: number;
  } | null {
    const log = this.latencyLogs.get(label);
    if (!log || log.length === 0) return null;

    const successes = log.filter((e) => e.success);
    const errors = log.length - successes.length;
    const errorRate = Math.round((errors / log.length) * 100) / 100;

    const durations = successes.map((e) => e.durationMs).sort((a, b) => a - b);
    if (durations.length === 0) {
      return { avgMs: 0, p95Ms: 0, errorRate, sampleCount: log.length };
    }

    const avg = Math.round(durations.reduce((s, d) => s + d, 0) / durations.length);
    const p95Idx = Math.ceil(durations.length * 0.95) - 1;
    const p95 = durations[p95Idx];

    return {
      avgMs: avg,
      p95Ms: p95,
      errorRate,
      sampleCount: log.length,
    };
  }

  /** Get all latency stats keyed by provider label. */
  getAllLatencyStats(): Map<string, {
    avgMs: number;
    p95Ms: number;
    errorRate: number;
    sampleCount: number;
  }> {
    const result = new Map<string, {
      avgMs: number;
      p95Ms: number;
      errorRate: number;
      sampleCount: number;
    }>();
    for (const label of this.latencyLogs.keys()) {
      const stats = this.getLatencyStats(label);
      if (stats) result.set(label, stats);
    }
    return result;
  }

  // ── Token Budget Tracking ───────────────────────────────

  /** Approximate cost per 1M tokens for popular models. */
  private static DEFAULT_COST_RATES: Record<string, { input: number; output: number }> = {
    // Anthropic (per 1M tokens, USD)
    "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
    "claude-haiku-3-5-20241022": { input: 0.8, output: 4.0 },
    // OpenAI (per 1M tokens, USD)
    "gpt-4.1": { input: 10.0, output: 30.0 },
    "gpt-4.1-nano": { input: 0.1, output: 0.4 },
    // DeepSeek (per 1M tokens, USD)
    "deepseek-v4-pro": { input: 0.27, output: 1.1 },
    // Gemini (per 1M tokens, USD)
    "gemini-2.5-flash": { input: 0.15, output: 0.6 },
    "gemini-2.5-pro": { input: 1.25, output: 5.0 },
  };

  private trackUsage(response: ProviderResponse, label: string): void {
    if (!this.config.trackBudget) return;

    if (response.usage) {
      this.budget.inputTokens += response.usage.inputTokens;
      this.budget.outputTokens += response.usage.outputTokens;

      // Estimate cost
      const rates = this.config.costRates ?? ProviderRouter.DEFAULT_COST_RATES;
      const modelKey = Object.keys(rates).find((k) => label.includes(k));
      if (modelKey) {
        const rate = rates[modelKey];
        this.budget.estimatedCost +=
          (response.usage.inputTokens / 1_000_000) * rate.input +
          (response.usage.outputTokens / 1_000_000) * rate.output;
      }
    }
  }

  /** Get current token budget summary. */
  getBudget(): TokenBudget {
    return { ...this.budget };
  }

  /** Reset the token budget to zero. */
  resetBudget(): void {
    this.budget = { inputTokens: 0, outputTokens: 0, estimatedCost: 0 };
  }

  // ── Circuit Breaker Status ──────────────────────────────

  /** Get circuit breaker status for all providers. */
  getCircuitStatus(): Map<string, { isOpen: boolean; consecutiveFailures: number }> {
    const result = new Map<string, { isOpen: boolean; consecutiveFailures: number }>();
    for (const [label, state] of this.circuits) {
      result.set(label, {
        isOpen: state.isOpen,
        consecutiveFailures: state.consecutiveFailures,
      });
    }
    return result;
  }

  /** Manually reset circuit breaker for a provider. */
  resetCircuit(label: string): void {
    this.circuits.delete(label);
    this.log(`  [circuit] ${label} manually reset`);
  }

  /** Manually reset all circuit breakers. */
  resetAllCircuits(): void {
    this.circuits.clear();
    this.log(`  [circuit] all circuits reset`);
  }

  // ── Info ────────────────────────────────────────────────

  /** Get a summary of configured providers per tier. */
  getInfo(): string {
    const lines: string[] = [`strategy: ${this.config.strategy.name}`];
    for (const tier of TIER_FALLBACK_ORDER) {
      const entries = this.config.providers.get(tier);
      if (entries?.length) {
        lines.push(`  ${tier}: ${entries.map((e) => e.label).join(", ")}`);
      }
    }

    if (this.config.trackBudget) {
      const b = this.budget;
      lines.push(`budget: ${b.inputTokens + b.outputTokens} tokens, ~${b.estimatedCost.toFixed(4)}`);
    }

    return lines.join("\n");
  }

  // ── Internal Helpers ────────────────────────────────────

  private log(message: string): void {
    if (this.config.verbose) {
      process.stderr.write(`[router] ${message}\n`);
    }
  }
}
