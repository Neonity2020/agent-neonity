import { CodeBlock } from "@/components/code-block";

export default function Chapter() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Why a Smart Router?
        </h2>
        <p className="text-slate-300 leading-relaxed">
          When you have access to multiple LLM providers, you can optimize for
          both cost and capability. Simple queries don&apos;t need a premium model,
          and complex refactoring tasks shouldn&apos;t be sent to a lightweight model.
          The Smart Router implements this optimization with cost tiers,
          complexity analysis, and robust resilience features.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Cost Tiers
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          Providers are grouped into three cost tiers. Each tier maps to a
          different quality/cost tradeoff:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {[
            {
              tier: "cheap",
              color: "green",
              desc: 'Simple lookups: "What does git status do?", listing files, quick documentation checks.',
            },
            {
              tier: "standard",
              color: "cyan",
              desc: "Everyday coding tasks, moderate complexity, default for most interactive queries.",
            },
            {
              tier: "premium",
              color: "purple",
              desc: "Refactoring large codebases, deep debugging, security audits, architecture decisions.",
            },
          ].map((t) => (
            <div
              key={t.tier}
              className="p-4 rounded border border-slate-800 bg-slate-900/50"
            >
              <code className={`text-xs text-${t.color}-400 font-mono uppercase`}>
                {t.tier}
              </code>
              <p className="text-sm text-slate-400 mt-2">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Complexity Analysis
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          The router uses a multi-signal strategy to determine which tier should
          handle a query:
        </p>
        <CodeBlock
          filename="src/provider/router.ts (excerpt)"
          code={`export type CostTier = "cheap" | "standard" | "premium";

interface ComplexitySignals {
  /** Keyword-based complexity score (0-1) */
  keywordScore: number;
  /** Total character count across all messages */
  totalChars: number;
  /** Number of conversation turns */
  turnCount: number;
  /** Whether tools have been used in this conversation */
  hasToolUsage: boolean;
}

const PREMIUM_KEYWORDS: readonly { word: string; weight: number }[] = [
  { word: "refactor", weight: 0.8 },
  { word: "debug", weight: 0.7 },
  { word: "security", weight: 0.9 },
  { word: "performance", weight: 0.6 },
  { word: "architecture", weight: 0.9 },
  { word: "migrate", weight: 0.8 },
  { word: "concurrency", weight: 0.7 },
  { word: "optimize", weight: 0.6 },
  { word: "audit", weight: 0.9 },
  { word: "vulnerability", weight: 0.95 },
];

function analyzeComplexity(
  messages: Message[],
  thresholds: RouterThresholds
): ComplexitySignals {
  const allText = messages
    .flatMap((m) => m.content)
    .filter((b) => b.type === "text")
    .map((b) => (b as TextContent).text)
    .join(" ");

  let keywordScore = 0;
  for (const { word, weight } of PREMIUM_KEYWORDS) {
    if (allText.toLowerCase().includes(word)) {
      keywordScore = Math.max(keywordScore, weight);
    }
  }

  const hasToolUsage = messages.some(
    (m) => m.content.some((b) => b.type === "tool_use")
  );

  return {
    keywordScore,
    totalChars: allText.length,
    turnCount: messages.length,
    hasToolUsage,
  };
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Tier Selection Logic
        </h2>
        <CodeBlock
          filename="src/provider/router.ts (selectTier)"
          code={`function selectTier(
  signals: ComplexitySignals,
  thresholds: RouterThresholds
): CostTier {
  // Short messages with no tool history → cheap
  if (
    signals.totalChars < thresholds.cheapCharLimit &&
    !signals.hasToolUsage &&
    signals.turnCount <= 2
  ) {
    return "cheap";
  }

  // High complexity signals → premium
  if (
    signals.keywordScore >= thresholds.complexityScoreThreshold ||
    signals.totalChars >= thresholds.complexThreshold ||
    signals.turnCount >= thresholds.turnThreshold ||
    signals.hasToolUsage
  ) {
    return "premium";
  }

  // Default → standard
  return "standard";
}`}
        />
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 mt-4">
          <p className="text-sm text-cyan-300">
            <strong>Key insight:</strong> The router escalates to premium
            aggressively — any tool usage or multi-turn conversation
            automatically moves to the highest tier. This is intentional: once a
            task requires tools, the LLM needs maximum capability to execute
            correctly.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Circuit Breaker
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          The circuit breaker prevents cascading failures by temporarily
          disabling a provider after consecutive errors. After a cooldown
          period, a &quot;half-open&quot; trial attempt is made to check if the provider
          has recovered.
        </p>
        <CodeBlock
          filename="src/provider/router.ts (circuit breaker)"
          code={`interface CircuitState {
  failures: number;
  lastFailureTime: number;
  state: "closed" | "open" | "half-open";
}

class CircuitBreaker {
  private circuits = new Map<string, CircuitState>();

  constructor(
    private threshold: number,   // failures before opening
    private cooldownMs: number   // ms before half-open trial
  ) {}

  canExecute(label: string): boolean {
    const circuit = this.circuits.get(label);
    if (!circuit || circuit.state === "closed") return true;

    if (circuit.state === "open") {
      const elapsed = Date.now() - circuit.lastFailureTime;
      if (elapsed >= this.cooldownMs) {
        circuit.state = "half-open";
        return true; // allow one trial
      }
      return false;
    }

    // half-open: allow the trial
    return true;
  }

  recordSuccess(label: string): void {
    this.circuits.set(label, {
      failures: 0,
      lastFailureTime: 0,
      state: "closed",
    });
  }

  recordFailure(label: string): void {
    const circuit = this.circuits.get(label) ?? {
      failures: 0,
      lastFailureTime: 0,
      state: "closed" as const,
    };
    circuit.failures++;
    circuit.lastFailureTime = Date.now();
    if (circuit.failures >= this.threshold) {
      circuit.state = "open";
    }
    this.circuits.set(label, circuit);
  }
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Putting It All Together: The Router
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          The <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm text-cyan-400">ProviderRouter</code>{" "}
          implements the{" "}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm text-cyan-400">Provider</code>{" "}
          interface — the agent treats it as just another provider. Internally it
          performs tier selection, circuit checking, round-robin load balancing,
          exponential backoff, and cross-tier fallback.
        </p>
        <CodeBlock
          filename="src/provider/router.ts (ProviderRouter)"
          code={`export class ProviderRouter implements Provider {
  readonly name = "router";
  private tiers: Map<CostTier, TieredProvider[]>;
  private circuitBreaker: CircuitBreaker;
  private complexityAnalyzer: ComplexityAnalyzer;

  async chat(
    messages: Message[],
    tools: ToolDefinition[],
    callbacks?: StreamCallbacks,
    systemPrompt?: string
  ): Promise<ProviderResponse> {
    const tier = this.complexityAnalyzer.selectTier(messages);

    // Try tiers in order: preferred → fallback
    const tierOrder = this.getTierOrder(tier);

    const errors: string[] = [];
    for (const currentTier of tierOrder) {
      const providers = this.tiers.get(currentTier) ?? [];

      // Try each provider in the tier with exponential backoff
      for (let attempt = 0; attempt < providers.length; attempt++) {
        const provider = this.pickProvider(
          providers, currentTier
        );
        if (!this.circuitBreaker.canExecute(provider.label)) {
          continue;
        }

        try {
          const response = await provider.instance.chat(
            messages, tools, callbacks, systemPrompt
          );
          this.circuitBreaker.recordSuccess(provider.label);
          return response;
        } catch (err) {
          this.circuitBreaker.recordFailure(provider.label);
          errors.push(\`\${provider.label}: \${err}\`);
          // Exponential backoff
          await this.backoff(attempt);
        }
      }
    }

    throw new Error(
      \`All providers exhausted. Errors:\\n\${errors.join("\\n")}\`
    );
  }

  private getTierOrder(preferred: CostTier): CostTier[] {
    const all: CostTier[] = ["cheap", "standard", "premium"];
    const idx = all.indexOf(preferred);
    // preferred → higher tiers → lower tiers
    return [
      ...all.slice(idx),
      ...all.slice(0, idx).reverse(),
    ];
  }

  private async backoff(attempt: number): Promise<void> {
    const delay = Math.min(
      1000 * Math.pow(2, attempt) + Math.random() * 1000,
      30000
    );
    await new Promise((r) => setTimeout(r, delay));
  }
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Resilience Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            {
              feature: "Circuit Breaker",
              desc: "After 3 consecutive failures, a provider is disabled for 30s. A half-open trial verifies recovery before full re-activation.",
            },
            {
              feature: "Exponential Backoff",
              desc: "Retries within a tier use jittered exponential backoff (1s → 2s → 4s → max 30s) to prevent overwhelming APIs during transient issues.",
            },
            {
              feature: "Cross-Tier Fallback",
              desc: "If all providers in a tier fail, the router escalates to the next tier (cheap → standard → premium) to ensure the query is always attempted.",
            },
            {
              feature: "Round-Robin Load Balancing",
              desc: "Multiple providers per tier are load-balanced using round-robin, distributing requests and providing redundancy.",
            },
          ].map((f) => (
            <div
              key={f.feature}
              className="p-4 rounded border border-slate-800 bg-slate-900/50"
            >
              <h3 className="text-sm font-semibold text-white">{f.feature}</h3>
              <p className="text-sm text-slate-400 mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
