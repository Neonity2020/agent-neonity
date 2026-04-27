import "dotenv/config.js";
import type { ProviderConfig } from "./types.js";
import type { CostTier } from "./provider/router.js";

export type ProviderType = "anthropic" | "openai" | "gemini" | "deepseek";

// ── Single-provider config (legacy / non-router mode) ──────

export interface AppConfig {
  providerType: ProviderType;
  provider: ProviderConfig;
  maxIterations: number;
  workingDirectory?: string;
}

// ── Router config ───────────────────────────────────────────

export interface TieredProviderConfig {
  providerType: ProviderType;
  provider: ProviderConfig;
  /** Human-readable label for logs (e.g., "DeepSeek V3") */
  label: string;
}

export interface RouterAppConfig {
  /** Per-tier provider configurations (at most one per tier currently) */
  tiers: Partial<Record<CostTier, TieredProviderConfig>>;
  maxIterations: number;
  workingDirectory?: string;
  /** Whether to log routing decisions */
  verbose?: boolean;
  /** Whether to track per-provider response times */
  trackLatency?: boolean;
  /** Whether to track cumulative token usage and cost */
  trackBudget?: boolean;
  /** Complexity score threshold (0–1) that triggers premium routing */
  complexityScoreThreshold?: number;
  /** Total character count above which we consider the task complex */
  complexThreshold?: number;
  /** Message count above which we consider the task complex */
  turnThreshold?: number;
  /** Minimum character count for short-circuit cheap routing */
  cheapCharLimit?: number;
  /** Consecutive failures before circuit breaker opens */
  circuitFailureThreshold?: number;
  /** Circuit breaker cooldown in ms */
  circuitCooldownMs?: number;
}

export type UnifiedAppConfig =
  | { mode: "single"; config: AppConfig }
  | { mode: "router"; config: RouterAppConfig };

// ── Defaults ────────────────────────────────────────────────

const DEFAULT_MODELS: Record<ProviderType, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4.1",
  gemini: "gemini-2.5-flash",
  deepseek: "deepseek-v4-pro",
};

const CHEAP_DEFAULT_MODELS: Record<ProviderType, string> = {
  anthropic: "claude-haiku-3-5-20241022",
  openai: "gpt-4.1-nano",
  gemini: "gemini-2.5-flash",
  deepseek: "deepseek-v4-pro",
};

const PREMIUM_DEFAULT_MODELS: Record<ProviderType, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4.1",
  gemini: "gemini-2.5-pro",
  deepseek: "deepseek-v4-pro",
};

const ALL_PROVIDERS: ProviderType[] = ["anthropic", "openai", "gemini", "deepseek"];

// ── Load ────────────────────────────────────────────────────

export function loadConfig(): UnifiedAppConfig {
  const routerMode = process.env.ROUTER_MODE === "true";

  if (routerMode) {
    try {
      return { mode: "router", config: loadRouterConfig() };
    } catch {
      process.stderr.write(
        "[neonity] Router mode misconfigured, falling back to single-provider mode.\n"
      );
    }
  }
  return { mode: "single", config: loadSingleConfig() };
}

// ── Single-provider mode ────────────────────────────────────

function loadSingleConfig(): AppConfig {
  const preferred = (process.env.DEFAULT_PROVIDER ?? "deepseek") as ProviderType;
  const providerType = resolveProvider(preferred);
  if (!providerType) {
    throw new Error(
      "No API key found. Set at least one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, or DEEPSEEK_API_KEY."
    );
  }

  const apiKey = getApiKey(providerType)!;
  const model =
    process.env[`${providerType.toUpperCase()}_MODEL`] ??
    DEFAULT_MODELS[providerType];

  const provider: ProviderConfig = buildProviderConfig(providerType, apiKey, model);

  return {
    providerType,
    provider,
    maxIterations: parseInt(process.env.MAX_ITERATIONS ?? "50", 10),
    workingDirectory: process.env.WORKING_DIRECTORY,
  };
}

// ── Router mode ─────────────────────────────────────────────

function loadRouterConfig(): RouterAppConfig {
  const tiers: Partial<Record<CostTier, TieredProviderConfig>> = {};

  // Cheap tier
  const cheapCfg = loadTierConfig("cheap", CHEAP_DEFAULT_MODELS);
  if (cheapCfg) tiers.cheap = cheapCfg;

  // Standard tier
  const stdCfg = loadTierConfig("standard", DEFAULT_MODELS);
  if (stdCfg) tiers.standard = stdCfg;

  // Premium tier
  const premCfg = loadTierConfig("premium", PREMIUM_DEFAULT_MODELS);
  if (premCfg) tiers.premium = premCfg;

  if (Object.keys(tiers).length === 0) {
    throw new Error(
      "Router mode enabled but no tiered providers configured. " +
        "Set at least one of: CHEAP_PROVIDER, STANDARD_PROVIDER, or PREMIUM_PROVIDER."
    );
  }

  const complexityScore = process.env.ROUTER_COMPLEXITY_THRESHOLD
    ? parseFloat(process.env.ROUTER_COMPLEXITY_THRESHOLD)
    : undefined;
  const complexThreshold = process.env.ROUTER_COMPLEX_THRESHOLD
    ? parseInt(process.env.ROUTER_COMPLEX_THRESHOLD, 10)
    : undefined;
  const turnThreshold = process.env.ROUTER_TURN_THRESHOLD
    ? parseInt(process.env.ROUTER_TURN_THRESHOLD, 10)
    : undefined;
  const cheapCharLimit = process.env.ROUTER_CHEAP_CHAR_LIMIT
    ? parseInt(process.env.ROUTER_CHEAP_CHAR_LIMIT, 10)
    : undefined;
  const circuitThreshold = process.env.ROUTER_CIRCUIT_THRESHOLD
    ? parseInt(process.env.ROUTER_CIRCUIT_THRESHOLD, 10)
    : undefined;
  const circuitCooldown = process.env.ROUTER_CIRCUIT_COOLDOWN
    ? parseInt(process.env.ROUTER_CIRCUIT_COOLDOWN, 10)
    : undefined;

  return {
    tiers,
    maxIterations: parseInt(process.env.MAX_ITERATIONS ?? "50", 10),
    workingDirectory: process.env.WORKING_DIRECTORY,
    verbose: process.env.ROUTER_VERBOSE === "true",
    trackLatency: process.env.ROUTER_TRACK_LATENCY === "true",
    trackBudget: process.env.ROUTER_TRACK_BUDGET === "true",
    ...(complexityScore !== undefined && { complexityScoreThreshold: complexityScore }),
    ...(complexThreshold !== undefined && { complexThreshold }),
    ...(turnThreshold !== undefined && { turnThreshold }),
    ...(cheapCharLimit !== undefined && { cheapCharLimit }),
    ...(circuitThreshold !== undefined && { circuitFailureThreshold: circuitThreshold }),
    ...(circuitCooldown !== undefined && { circuitCooldownMs: circuitCooldown }),
  };
}

function loadTierConfig(
  tier: Capitalize<CostTier> | CostTier,
  defaultModels: Record<ProviderType, string>
): TieredProviderConfig | undefined {
  const envPrefix = tier.toUpperCase();
  const envProvider = process.env[`${envPrefix}_PROVIDER`] as ProviderType | undefined;

  if (!envProvider) return undefined;

  const apiKey = getApiKey(envProvider);
  if (!apiKey) return undefined;

  const model =
    process.env[`${envPrefix}_MODEL`] ?? defaultModels[envProvider];

  const label =
    process.env[`${envPrefix}_LABEL`] ?? `${envProvider} / ${model}`;

  return {
    providerType: envProvider,
    provider: buildProviderConfig(envProvider, apiKey, model),
    label,
  };
}

// ── Helpers ─────────────────────────────────────────────────

function buildProviderConfig(
  providerType: ProviderType,
  apiKey: string,
  model: string
): ProviderConfig {
  return {
    apiKey,
    model,
    maxTokens: parseInt(process.env.MAX_TOKENS ?? "4096", 10),
    temperature: process.env.TEMPERATURE
      ? parseFloat(process.env.TEMPERATURE)
      : undefined,
    ...(providerType === "deepseek" && {
      baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    }),
  };
}

function resolveProvider(preferred: ProviderType): ProviderType | undefined {
  if (getApiKey(preferred)) return preferred;
  for (const p of ALL_PROVIDERS) {
    if (p !== preferred && getApiKey(p)) return p;
  }
  return undefined;
}

function getApiKey(providerType: ProviderType): string | undefined {
  switch (providerType) {
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY;
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "gemini":
      return process.env.GEMINI_API_KEY;
    case "deepseek":
      return process.env.DEEPSEEK_API_KEY;
  }
}

