import { CodeBlock } from "@/components/code-block";

export default function Chapter() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          The Entry Point
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          The index file wires everything together: load config, create the
          provider, register tools, build the system prompt, create the agent,
          and start the REPL.
        </p>
        <CodeBlock
          filename="src/index.ts"
          code={`#!/usr/bin/env node

import { loadConfig } from "./config.js";
import { createProvider, createRouter } from "./provider/factory.js";
import { Agent } from "./agent/agent.js";
import { ToolRegistry } from "./tool/tool.js";
import { SkillRegistry } from "./skill/skill.js";
import { BashTool } from "./tool/bash-tool.js";
import { ReadTool } from "./tool/read-tool.js";
import { WriteTool } from "./tool/write-tool.js";
import { EditTool } from "./tool/edit-tool.js";
import { CodeReviewerSkill } from "./skill/builtin/code-reviewer.js";
import { TestWriterSkill } from "./skill/builtin/test-writer.js";
import { GitCommitterSkill } from "./skill/builtin/git-committer.js";
import { DocWriterSkill } from "./skill/builtin/doc-writer.js";
import { buildSystemPrompt } from "./agent/system-prompt.js";
import { startRepl } from "./cli/repl.js";

async function main() {
  const unified = loadConfig();

  const provider = unified.mode === "router"
    ? createRouter(unified.config)
    : createProvider(
        unified.config.providerType,
        unified.config.provider
      );

  const workingDirectory =
    unified.mode === "single"
      ? unified.config.workingDirectory ?? process.cwd()
      : unified.config.workingDirectory ?? process.cwd();

  const registry = new ToolRegistry();
  registry.register(new BashTool(workingDirectory));
  registry.register(new ReadTool());
  registry.register(new WriteTool());
  registry.register(new EditTool());

  const skills = new SkillRegistry(registry);
  skills.register(new CodeReviewerSkill());
  skills.register(new TestWriterSkill());
  skills.register(new GitCommitterSkill());
  skills.register(new DocWriterSkill());
  skills.loadState(); // restore persisted skill state

  const agent = new Agent(
    unified.mode === "single"
      ? {
          provider: unified.config.provider,
          maxIterations: unified.config.maxIterations,
          workingDirectory,
        }
      : {
          provider: {  /* router as provider */ },
          maxIterations: unified.config.maxIterations,
          workingDirectory,
        },
    provider,
    registry,
    skills,
    workingDirectory,
    unified.contextManager,
  );

  console.log(
    \`neonity v0.1.0 | mode: \${unified.mode}\`
  );
  console.log("Type /help for commands.\\n");

  await startRepl(agent);
}

main().catch(console.error);`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">Streaming Callbacks</h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          The stream module creates callbacks that feed text through the
          Markdown renderer and handle tool-use announcements with colors.
        </p>
        <CodeBlock
          filename="src/cli/stream.ts"
          code={`import chalk from "chalk";
import type { StreamCallbacks } from "../types.js";
import { MarkdownRenderer } from "./markdown.js";

export function createStreamCallbacks(): StreamCallbacks {
  const renderer = new MarkdownRenderer();
  let hasOutput = false;

  const emitLine = (line: string) => {
    process.stdout.write(line + "\\n");
    hasOutput = true;
  };

  return {
    onTextDelta(text: string) {
      // Feed text into the streaming markdown renderer
      renderer.feed(text, emitLine);
    },
    onToolUseStart(_id: string, name: string) {
      renderer.flush(emitLine);
      process.stdout.write(chalk.cyan(\`\\n[\${name}] \`));
    },
    onToolUseDelta() {
      // Don't stream partial tool arguments
    },
    onComplete() {
      renderer.flush(emitLine);
      if (!hasOutput) process.stdout.write("\\n");
      process.stdout.write("\\n");
    },
  };
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          System Prompt Builder
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          The system prompt is built dynamically based on the current
          environment: working directory, platform, and available tools.
        </p>
        <CodeBlock
          filename="src/agent/system-prompt.ts"
          code={`export interface SystemPromptContext {
  workingDirectory: string;
  platform: string;
  tools: ToolDefinition[];
}

export function buildSystemPrompt(
  ctx: SystemPromptContext
): string {
  const toolDescriptions = ctx.tools
    .map((t) => \`- **\${t.name}**: \${t.description}\`)
    .join("\\n");

  return \`You are an AI coding assistant running in a terminal.
You help users with software engineering tasks.

## Environment
- Working directory: \${ctx.workingDirectory}
- Platform: \${ctx.platform}

## Available Tools
\${toolDescriptions}

## Instructions
- Use tools to accomplish tasks.
- Show your reasoning in text before taking actions.
- Be direct and concise. Avoid unnecessary preamble.
- When editing files, use the edit tool with exact string matching.
- When creating new files, use the write tool.
- If a task is ambiguous, ask the user for clarification.
- Report errors clearly and suggest solutions.\`;
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">REPL</h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          The REPL uses Node&apos;s readline module for line-by-line interaction. It
          supports slash commands, history persistence, and tab completion.
        </p>
        <CodeBlock
          filename="src/cli/repl.ts (excerpt)"
          code={`export async function startRepl(agent: Agent) {
  const historyLines = loadHistory();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green("> "),
    history: [...historyLines],
    completer,
    terminal: true,
  });

  rl.on("history", (history: string[]) => {
    saveHistory(history);
  });

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }

    // Handle slash commands
    if (input.startsWith("/")) {
      await handleCommand(input, agent, rl);
      rl.prompt();
      return;
    }

    const callbacks = createStreamCallbacks();
    try {
      await agent.run(input, callbacks);
    } catch (err) {
      process.stderr.write(
        chalk.red(\`\\nError: \${err.message}\\n\`)
      );
    }
    process.stdout.write("\\n");
    rl.prompt();
  });

  rl.on("close", () => {
    process.stdout.write(chalk.dim("\\nGoodbye.\\n"));
    process.exit(0);
  });
}`}
        />
      </section>
    </div>
  );
}
