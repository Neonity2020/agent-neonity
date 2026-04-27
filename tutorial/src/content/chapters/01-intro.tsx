export default function Chapter() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-bold text-white mb-3">What is Neonity?</h2>
        <p className="text-slate-300 leading-relaxed">
          Neonity is a <strong className="text-cyan-400">mini Claude Code agent</strong>{" "}
          that runs in your terminal. It connects to multiple LLM providers
          (Anthropic Claude, OpenAI GPT, Google Gemini, and DeepSeek) through a
          unified interface, and gives the AI access to real tools—running shell
          commands, reading and editing files.
        </p>
        <p className="text-slate-300 leading-relaxed mt-3">
          Think of it as your CLI pair programmer: you describe what you want,
          and Neonity reasons about the task, uses tools to inspect and modify
          your codebase, and iterates until the job is done.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Architecture at a Glance
        </h2>
        <pre className="text-xs text-slate-400 bg-slate-900 p-4 rounded-lg overflow-x-auto leading-relaxed">
{`┌──────────────────────────────────────────────────┐
│                    index.ts                       │
│         (entry point, wiring everything)          │
└────────┬──────────────────────────────┬──────────┘
         │                              │
    ┌────▼─────┐                  ┌─────▼──────┐
    │  config   │                  │    CLI     │
    │  .env →   │                  │  repl.ts   │
    │  AppConfig│                  │  stream.ts │
    └────┬─────┘                  │  display.ts │
         │                              │
    ┌────▼──────────────────────────────▼──────┐
    │               Agent                       │
    │         (ReAct loop controller)           │
    │   history[] → reactLoop() → tool calls    │
    └────┬──────────────────────────┬──────────┘
         │                          │
    ┌────▼─────┐              ┌─────▼──────┐
    │ Provider  │              │   Tools    │
    │ Factory   │              │ Registry   │
    │ ┌───────┐ │              │ ┌────────┐ │
    │ │Anthrop│ │              │ │ bash   │ │
    │ │OpenAI │ │              │ │ read   │ │
    │ │Gemini │ │              │ │ write  │ │
    │ │DeepSk │ │              │ │ edit   │ │
    │ └───────┘ │              │ └────────┘ │
    └──────────┘              └────────────┘`}
        </pre>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">Tech Stack</h2>
        <ul className="space-y-2 text-slate-300">
          <li className="flex items-start gap-2">
            <span className="text-cyan-400 mt-1">•</span>
            <span>
              <strong>TypeScript 5.8</strong> — strict mode, ES2022 target,
              Node16 modules
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400 mt-1">•</span>
            <span>
              <strong>Node.js ≥ 20</strong> — leverages native ESM,
              structuredClone, readline
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400 mt-1">•</span>
            <span>
              <strong>Provider SDKs</strong> — @anthropic-ai/sdk, openai,
              @google/genai (DeepSeek via OpenAI compatibility)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400 mt-1">•</span>
            <span>
              <strong>Chalk</strong> — terminal text styling
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400 mt-1">•</span>
            <span>
              <strong>dotenv</strong> — environment variable loading
            </span>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Key Design Decisions
        </h2>
        <ol className="space-y-4 text-slate-300 list-decimal list-inside marker:text-cyan-400">
          <li className="leading-relaxed">
            <strong>Provider-agnostic content blocks.</strong> Neonity defines
            its own ContentBlock union type (TextContent, ToolUseContent,
            ToolResultContent, ReasoningContent) and each provider adapter
            converts between the provider&apos;s native format and Neonity&apos;s
            neutral format.
          </li>
          <li className="leading-relaxed">
            <strong>ReAct agent loop.</strong> The agent follows the
            Reasoning + Acting pattern: the LLM responds with either a final
            answer or a tool call, the agent executes the tool, feeds the result
            back, and repeats.
          </li>
          <li className="leading-relaxed">
            <strong>Streaming-first.</strong> Every provider adapter supports
            streaming via a unified StreamCallbacks interface, giving the user
            real-time text output.
          </li>
          <li className="leading-relaxed">
            <strong>DeepSeek = OpenAI.</strong> DeepSeek&apos;s API is OpenAI-compatible,
            so the DeepSeek configuration reuses the OpenAI provider class—just
            with a different baseURL and model name.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">How to Follow</h2>
        <p className="text-slate-300 leading-relaxed">
          Each chapter builds on the previous one. You can read them in order to
          understand how a production-style AI agent goes from an idea to a
          working CLI tool. Every code snippet is taken directly from the
          working Neonity source code—nothing is fabricated.
        </p>
      </section>
    </div>
  );
}
