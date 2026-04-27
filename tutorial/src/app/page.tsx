import Link from "next/link";
import { chapters } from "@/lib/chapters";
import { CodeBlock } from "@/components/code-block";

const heroCode = `#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { createProvider } from "./provider/factory.js";
import { Agent } from "./agent/agent.js";
import { startRepl } from "./cli/repl.js";

async function main() {
  const config = loadConfig();
  const provider = createProvider(
    config.providerType,
    config.provider
  );
  const agent = new Agent(config, provider, registry);
  console.log(
    \`neonity v0.1.0 | provider: \${provider.name}\`
  );
  await startRepl(agent);
}
main().catch(console.error);`;

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-4xl">⚡</span>
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Neonity
          </h1>
        </div>
        <p className="text-lg text-slate-400 max-w-2xl">
          A progressive tutorial on building a{" "}
          <strong className="text-cyan-400">multi-provider AI coding agent</strong>{" "}
          from scratch in TypeScript. Inspired by Claude Code, powered by
          your choice of LLM.
        </p>

        <div className="flex gap-3 mt-6">
          <Link
            href="/chapters/01-intro"
            className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            Start Tutorial →
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            View Source
          </a>
        </div>
      </header>

      {/* Code preview */}
      <div className="mb-12">
        <CodeBlock code={heroCode} lang="typescript" filename="src/index.ts" />
      </div>

      {/* Features grid */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-white mb-6">
          What You&apos;ll Build
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              emoji: "🔌",
              title: "Multi-Provider",
              desc: "Anthropic, OpenAI, Gemini, DeepSeek — one interface, four backends with streaming support.",
            },
            {
              emoji: "🔧",
              title: "Tool System",
              desc: "Bash execution, file read/write/edit — extensible tool architecture with schema validation.",
            },
            {
              emoji: "🔄",
              title: "ReAct Loop",
              desc: "Reasoning + Acting agent pattern with configurable iteration limits and error handling.",
            },
            {
              emoji: "🖥️",
              title: "Terminal CLI",
              desc: "Readline-based REPL with streaming output, markdown rendering, and session persistence.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="p-5 rounded-lg border border-slate-800 bg-slate-900/50"
            >
              <span className="text-2xl">{f.emoji}</span>
              <h3 className="font-semibold text-white mt-2">{f.title}</h3>
              <p className="text-sm text-slate-400 mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Chapter index */}
      <section>
        <h2 className="text-xl font-bold text-white mb-4">Chapters</h2>
        <div className="space-y-0.5">
          {chapters.map((ch) => (
            <Link
              key={ch.slug}
              href={`/chapters/${ch.slug}`}
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800/50 transition-colors group"
            >
              <span className="text-xs font-mono text-slate-600 w-6">
                {String(ch.order).padStart(2, "0")}
              </span>
              <div>
                <span className="text-sm font-medium text-slate-200 group-hover:text-cyan-400 transition-colors">
                  {ch.title}
                </span>
                <p className="text-xs text-slate-600 mt-0.5">
                  {ch.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-16 pt-6 border-t border-slate-800 text-xs text-slate-600">
        <p>
          Neonity Tutorial — Built with Next.js 16, React 19, Tailwind CSS v4,
          and Shiki for syntax highlighting.
        </p>
      </footer>
    </div>
  );
}
