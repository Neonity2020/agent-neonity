import type { Provider, ProviderConfig } from "../types.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai-provider.js";
import { GeminiProvider } from "./gemini.js";
import { DeepSeekProvider } from "./deepseek-provider.js";
import { MinimaxProvider } from "./minimax.js";
import { GLMProvider } from "./glm-provider.js";
import type { ProviderType } from "../config.js";
import {
  ProviderRouter,
  CostOptimizedStrategy,
  type CostTier,
  type RouterConfig,
  type RoutedProviderEntry,
  type CostOptimizedOptions,
} from "./router.js";
import type { RouterAppConfig } from "../config.js";

// ── Single Provider ─────────────────────────────────────────

export function createProvider(
  providerType: ProviderType,
  config: ProviderConfig
): Provider {
  switch (providerType) {
    case "anthropic":
      return new AnthropicProvider(config);
    case "openai":
      return new OpenAIProvider(config);
    case "gemini":
      return new GeminiProvider(config);
    case "deepseek":
      return new DeepSeekProvider(config);
    case "minimax":
      return new MinimaxProvider(config);
    case "glm":
      return new GLMProvider(config);
    default:
      throw new Error(`Unknown provider type: ${providerType}`);
  }
}

// ── Router ──────────────────────────────────────────────────

/**
 * Build a ProviderRouter from tiered config.
 *
 * Example config (in .env):
 *   ROUTER_MODE=true
 *   CHEAP_PROVIDER=deepseek
 *   STANDARD_PROVIDER=openai
 *   PREMIUM_PROVIDER=anthropic
 *
 * New options (optional):
 *   ROUTER_TRACK_LATENCY=true   — record per-provider response times
 *   ROUTER_TRACK_BUDGET=true    — track cumulative token usage & cost
 *   ROUTER_COMPLEXITY_THRESHOLD=0.5  — keyword complexity threshold (0–1)
 *   ROUTER_CIRCUIT_THRESHOLD=3  — consecutive failures before circuit opens
 *   ROUTER_CIRCUIT_COOLDOWN=30000 — circuit cooldown in ms
 */
export function createRouter(config: RouterAppConfig): ProviderRouter {
  const providers = new Map<CostTier, RoutedProviderEntry[]>();

  for (const [tier, tierCfg] of Object.entries(config.tiers)) {
    const t = tier as CostTier;
    if (!tierCfg) continue;

    const provider = createProvider(tierCfg.providerType, tierCfg.provider);
    providers.set(t, [
      {
        provider,
        tier: t,
        label: tierCfg.label,
      },
    ]);
  }

  // Build strategy options from config
  const strategyOptions: CostOptimizedOptions = {};
  if (config.complexityScoreThreshold !== undefined) {
    strategyOptions.complexityScoreThreshold = config.complexityScoreThreshold;
  }
  if (config.complexThreshold !== undefined) {
    strategyOptions.complexThreshold = config.complexThreshold;
  }
  if (config.turnThreshold !== undefined) {
    strategyOptions.turnThreshold = config.turnThreshold;
  }
  if (config.cheapCharLimit !== undefined) {
    strategyOptions.cheapCharLimit = config.cheapCharLimit;
  }

  const strategy = new CostOptimizedStrategy(strategyOptions);

  // Circuit breaker config
  const circuitBreaker: Partial<{ failureThreshold: number; cooldownMs: number; maxCooldownMs: number }> = {};
  if (config.circuitFailureThreshold !== undefined) {
    circuitBreaker.failureThreshold = config.circuitFailureThreshold;
  }
  if (config.circuitCooldownMs !== undefined) {
    circuitBreaker.cooldownMs = config.circuitCooldownMs;
  }

  const routerConfig: RouterConfig = {
    providers,
    strategy,
    verbose: config.verbose,
    trackLatency: config.trackLatency,
    trackBudget: config.trackBudget,
    ...(Object.keys(circuitBreaker).length > 0 && { circuitBreaker }),
  };

  return new ProviderRouter(routerConfig);
}
