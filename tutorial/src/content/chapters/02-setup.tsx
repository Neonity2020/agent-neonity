import { CodeBlock } from "@/components/code-block";

export default function Chapter() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-bold text-white mb-3">package.json</h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          Neonity is a Node.js CLI application. The{" "}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm text-cyan-400">
            package.json
          </code>{" "}
          sets up the ESM module system, the CLI entry point, and the
          dependencies for each LLM provider.
        </p>
        <CodeBlock
          filename="package.json"
          lang="json"
          code={`{
  "name": "neonity",
  "version": "0.1.0",
  "type": "module",
  "description": "A mini Claude Code agent harness",
  "main": "dist/index.js",
  "bin": {
    "neonity": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "start:dev": "tsx src/index.ts"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.91.0",
    "@google/genai": "^1.50.0",
    "chalk": "^5.6.0",
    "dotenv": "^17.4.0",
    "openai": "^6.34.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.8.0"
  }
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">TypeScript Configuration</h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          Strict mode is essential for an agent that executes tool calls
          autonomously. We target ES2022 for modern features and use Node16
          module resolution.
        </p>
        <CodeBlock
          filename="tsconfig.json"
          lang="json"
          code={`{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}`}
        />
        <p className="text-slate-300 leading-relaxed mt-4">
          Key choices:
        </p>
        <ul className="space-y-2 text-slate-400 mt-2">
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            <span>
              <strong>declaration + sourceMap</strong> — helpful when debugging
              the compiled output
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            <span>
              <strong>Node16</strong> — native ESM with{" "}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-xs">.js</code>{" "}
              extensions in imports
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            <span>
              <strong>skipLibCheck</strong> — avoids type conflicts between
              provider SDKs
            </span>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Environment Variables
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          Neonity supports four providers. You configure which one to use via{" "}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm text-cyan-400">
            .env
          </code>{" "}
          — set the API key for your provider of choice and optionally override
          the model name.
        </p>
        <CodeBlock
          filename=".env.example"
          lang="bash"
          code={`# Provider selection: anthropic | openai | gemini | deepseek
DEFAULT_PROVIDER=deepseek

# API Keys (set the one(s) you need)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
DEEPSEEK_API_KEY=

# Model overrides (optional)
# ANTHROPIC_MODEL=claude-sonnet-4-20250514
# OPENAI_MODEL=gpt-4.1
# GEMINI_MODEL=gemini-2.5-flash
# DEEPSEEK_MODEL=deepseek-v4-pro

# DeepSeek base URL (optional)
# DEEPSEEK_BASE_URL=https://api.deepseek.com`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">Project Structure</h2>
        <pre className="text-xs text-slate-400 bg-slate-900 p-4 rounded-lg overflow-x-auto leading-relaxed">
{`src/
  agent/
    agent.ts              # ReAct loop
    system-prompt.ts      # System prompt builder
  cli/
    display.ts            # Output formatting
    markdown.ts           # Streaming markdown renderer
    repl.ts               # Readline REPL
    session.ts            # Session persistence
    stream.ts             # Streaming callbacks
  provider/
    anthropic.ts          # Anthropic adapter
    factory.ts            # Provider factory
    gemini.ts             # Gemini adapter
    openai-provider.ts    # OpenAI + DeepSeek adapter
    provider.ts           # Type re-exports
  tool/
    bash-tool.ts          # Shell command execution
    edit-tool.ts          # Exact string replacement
    read-tool.ts          # File reading
    tool.ts               # ToolRegistry
    write-tool.ts         # File writing
  config.ts               # Configuration loader
  index.ts                # Entry point
  types.ts                # Core type definitions`}
        </pre>
      </section>
    </div>
  );
}
