import { CodeBlock } from "@/components/code-block";

export default function Chapter() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Configuration Loading
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          The config module reads environment variables (via dotenv), determines
          which LLM provider to use, and builds an AppConfig object that drives
          the entire application.
        </p>

        <CodeBlock
          filename="src/config.ts"
          code={`import "dotenv/config.js";
import type { ProviderConfig } from "./types.js";

export type ProviderType = "anthropic" | "openai" | "gemini" | "deepseek";

export interface AppConfig {
  providerType: ProviderType;
  provider: ProviderConfig;
  maxIterations: number;
  workingDirectory?: string;
}

const DEFAULT_MODELS: Record<ProviderType, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4.1",
  gemini: "gemini-2.5-flash",
  deepseek: "deepseek-v4-pro",
};

const ALL_PROVIDERS: ProviderType[] = [
  "anthropic", "openai", "gemini", "deepseek"
];`}
        />

        <p className="text-slate-300 leading-relaxed mt-4">
          The <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm text-cyan-400">ProviderType</code>{" "}
          literal union ensures compile-time safety—you can never pass an
          unknown provider name. The{" "}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm text-cyan-400">DEFAULT_MODELS</code>{" "}
          map provides sensible defaults for each provider.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Smart Provider Resolution
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          The resolver tries the user&apos;s preferred provider first. If no API key
          is set, it falls back to any other provider that has a key configured.
        </p>

        <CodeBlock
          filename="src/config.ts (excerpt)"
          code={`export function loadConfig(): AppConfig {
  const preferred = (
    process.env.DEFAULT_PROVIDER ?? "deepseek"
  ) as ProviderType;
  const providerType = resolveProvider(preferred);
  if (!providerType) {
    throw new Error(
      "No API key found. Set at least one of: " +
      "ANTHROPIC_API_KEY, OPENAI_API_KEY, " +
      "GEMINI_API_KEY, or DEEPSEEK_API_KEY."
    );
  }

  const apiKey = getApiKey(providerType)!;
  const model =
    process.env[\`\${providerType.toUpperCase()}_MODEL\`] ??
    DEFAULT_MODELS[providerType];

  const provider: ProviderConfig = {
    apiKey,
    model,
    maxTokens: parseInt(
      process.env.MAX_TOKENS ?? "4096", 10
    ),
    temperature: process.env.TEMPERATURE
      ? parseFloat(process.env.TEMPERATURE)
      : undefined,
    ...(providerType === "deepseek" && {
      baseURL:
        process.env.DEEPSEEK_BASE_URL ??
        "https://api.deepseek.com",
    }),
  };

  return {
    providerType,
    provider,
    maxIterations: parseInt(
      process.env.MAX_ITERATIONS ?? "50", 10
    ),
    workingDirectory: process.env.WORKING_DIRECTORY,
  };
}

function resolveProvider(
  preferred: ProviderType
): ProviderType | undefined {
  if (getApiKey(preferred)) return preferred;
  for (const p of ALL_PROVIDERS) {
    if (p !== preferred && getApiKey(p)) return p;
  }
  return undefined;
}

function getApiKey(
  providerType: ProviderType
): string | undefined {
  switch (providerType) {
    case "anthropic": return process.env.ANTHROPIC_API_KEY;
    case "openai":    return process.env.OPENAI_API_KEY;
    case "gemini":    return process.env.GEMINI_API_KEY;
    case "deepseek":  return process.env.DEEPSEEK_API_KEY;
  }
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">Key Details</h2>
        <ul className="space-y-3 text-slate-300">
          <li className="flex items-start gap-2">
            <span className="text-cyan-400 mt-1">•</span>
            <span>
              <strong>Spread operator for baseURL:</strong> DeepSeek gets a
              baseURL property spread into the config only when it&apos;s the
              selected provider. This avoids polluting other providers&apos; configs.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400 mt-1">•</span>
            <span>
              <strong>Model override:</strong> Users can override the default
              model via environment variables like{" "}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-xs">ANTHROPIC_MODEL</code>.
              The dynamic key lookup{" "}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-xs">{"process.env[`${providerType.toUpperCase()}_MODEL`]"}</code>{" "}
              makes this work for all four providers with a single line.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400 mt-1">•</span>
            <span>
              <strong>Fallback chain:</strong> If you set{" "}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-xs">DEFAULT_PROVIDER=anthropic</code>{" "}
              but only have a DeepSeek key, the agent silently uses DeepSeek.
              This makes development seamless.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
