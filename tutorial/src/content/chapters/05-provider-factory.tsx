import { CodeBlock } from "@/components/code-block";

export default function Chapter() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          The Factory Pattern
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          The factory pattern lets us select the right provider implementation
          at runtime without the rest of the codebase knowing which LLM is being
          used. The caller just passes a{" "}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm text-cyan-400">ProviderType</code>{" "}
          and a{" "}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm text-cyan-400">ProviderConfig</code>,
          and receives back a{" "}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm text-cyan-400">Provider</code>{" "}
          that implements the common interface.
        </p>
        <CodeBlock
          filename="src/provider/factory.ts"
          code={`import type { Provider, ProviderConfig } from "../types.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai-provider.js";
import { GeminiProvider } from "./gemini.js";
import { DeepSeekProvider } from "./deepseek-provider.js";
import type { ProviderType } from "../config.js";

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
      // DeepSeek has both OpenAI-compatible mode and
      // a native adapter for reasoning_content support
      return new DeepSeekProvider(config);
    default:
      throw new Error(
        \`Unknown provider type: \${providerType}\`
      );
  }
}`}
        />
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 mt-4">
          <p className="text-sm text-cyan-300">
            <strong>Key insight:</strong> DeepSeek now has its own native
            adapter that handles{" "}
            <code className="bg-cyan-500/20 px-1 py-0.5 rounded text-xs">reasoning_content</code>{" "}
            (chain-of-thought from DeepSeek R1/V3 models). This is surfaced as
            ReasoningContent blocks in Neonity&apos;s neutral format, giving users
            visibility into the model&apos;s thinking process.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          The Provider Interface (Recap)
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          Every provider implements this contract. The{" "}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm text-cyan-400">chat</code>{" "}
          method is the heart of the system—it takes the conversation history,
          tool definitions, optional streaming callbacks, and a system prompt,
          then returns a unified response.
        </p>
        <CodeBlock
          filename="src/types.ts (Provider interface)"
          code={`export interface Provider {
  readonly name: string;
  chat(
    messages: Message[],
    tools: ToolDefinition[],
    callbacks?: StreamCallbacks,
    systemPrompt?: string
  ): Promise<ProviderResponse>;
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Why Not a Class Hierarchy?
        </h2>
        <p className="text-slate-300 leading-relaxed">
          A common alternative would be an abstract base class with shared
          conversion logic. Neonity deliberately avoids this because:
        </p>
        <ul className="space-y-2 text-slate-400 mt-3">
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            <span>
              Each provider has fundamentally different message and tool
              formats—forcing them into a shared base would require awkward
              abstractions.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            <span>
              The interface is only 4 methods/fields—small enough that
              duplication is cheaper than the wrong abstraction.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            <span>
              A new provider can be added by creating one file and adding one
              case to the factory switch. No base class to understand.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
