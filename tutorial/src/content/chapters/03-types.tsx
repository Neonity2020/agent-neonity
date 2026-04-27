import { CodeBlock } from "@/components/code-block";

export default function Chapter() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          The Type System Philosophy
        </h2>
        <p className="text-slate-300 leading-relaxed">
          Instead of coupling the agent to any specific LLM provider&apos;s type
          system, Neonity defines its own provider-agnostic content block types.
          Each provider adapter then translates between its native format and
          Neonity&apos;s neutral representation. This is the key insight that makes
          multi-provider support clean.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">Content Blocks</h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          A conversation is made of messages, and each message contains content
          blocks. The four block types cover everything an AI agent needs:
        </p>
        <CodeBlock
          filename="src/types.ts (excerpt)"
          code={`export interface TextContent {
  type: "text";
  text: string;
}

export interface ToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface ReasoningContent {
  type: "reasoning";
  text: string;
}

export type ContentBlock =
  | TextContent
  | ToolUseContent
  | ToolResultContent
  | ReasoningContent;`}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          {[
            {
              type: "TextContent",
              use: "Plain text from the LLM — reasoning, explanations, answers.",
            },
            {
              type: "ToolUseContent",
              use: "The LLM requests a tool invocation with parsed input.",
            },
            {
              type: "ToolResultContent",
              use: "The result of running a tool, fed back to the LLM.",
            },
            {
              type: "ReasoningContent",
              use: "Chain-of-thought reasoning (used by DeepSeek R1 and similar).",
            },
          ].map((b) => (
            <div
              key={b.type}
              className="p-3 rounded border border-slate-800 bg-slate-900/50"
            >
              <code className="text-xs text-cyan-400 font-mono">{b.type}</code>
              <p className="text-sm text-slate-400 mt-1">{b.use}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">Messages</h2>
        <CodeBlock
          filename="src/types.ts (excerpt)"
          code={`export interface Message {
  role: "user" | "assistant";
  content: ContentBlock[];
}`}
        />
        <p className="text-slate-300 leading-relaxed mt-4">
          Messages are deliberately simple—just a role and content blocks. The
          agent maintains a growing{" "}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm text-cyan-400">
            history: Message[]
          </code>{" "}
          array that is passed to the LLM on each turn.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          The Provider Interface
        </h2>
        <CodeBlock
          filename="src/types.ts (excerpt)"
          code={`export interface ProviderConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature?: number;
  baseURL?: string;
}

export interface StreamCallbacks {
  onTextDelta?: (text: string) => void;
  onToolUseStart?: (id: string, name: string) => void;
  onToolUseDelta?: (id: string, partialJson: string) => void;
  onComplete?: (response: ProviderResponse) => void;
}

export interface ProviderResponse {
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "error";
  content: ContentBlock[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface Provider {
  readonly name: string;
  chat(
    messages: Message[],
    tools: ToolDefinition[],
    callbacks?: StreamCallbacks,
    systemPrompt?: string
  ): Promise<ProviderResponse>;
}`}
        />
        <p className="text-slate-300 leading-relaxed mt-4">
          The <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm text-cyan-400">Provider</code>{" "}
          interface is the contract every LLM adapter must fulfill. It accepts
          messages, tool definitions, optional streaming callbacks, and a system
          prompt, and returns a unified response.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">Tool Definitions</h2>
        <CodeBlock
          filename="src/types.ts (excerpt)"
          code={`export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ToolDefinition["inputSchema"];
  execute(input: Record<string, unknown>): Promise<string>;
}`}
        />
        <p className="text-slate-300 leading-relaxed mt-4">
          Tools are defined with JSON Schema for their inputs. The{" "}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm text-cyan-400">Tool</code>{" "}
          interface is implemented by each concrete tool, and{" "}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm text-cyan-400">ToolDefinition</code>{" "}
          is what gets sent to the LLM as part of the API request.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">Agent Config</h2>
        <CodeBlock
          filename="src/types.ts (excerpt)"
          code={`export interface AgentConfig {
  provider: ProviderConfig;
  systemPrompt: string;
  maxIterations: number;
  workingDirectory?: string;
}`}
        />
      </section>
    </div>
  );
}
