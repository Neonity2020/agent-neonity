#!/usr/bin/env node

import type { Provider } from "./types.js";
import { loadConfig } from "./config.js";
import { createProvider, createRouter } from "./provider/factory.js";
import { Agent } from "./agent/agent.js";
import { ToolRegistry } from "./tool/tool.js";
import { SkillRegistry } from "./skill/skill.js";
import { BashTool } from "./tool/bash-tool.js";
import { ReadTool } from "./tool/read-tool.js";
import { WriteTool } from "./tool/write-tool.js";
import { EditTool } from "./tool/edit-tool.js";
import { buildSystemPrompt } from "./agent/system-prompt.js";
import { startRepl } from "./cli/repl.js";

// Built-in skills
import { codeReviewerSkill } from "./skill/builtin/code-reviewer.js";
import { testWriterSkill } from "./skill/builtin/test-writer.js";
import { gitCommitterSkill } from "./skill/builtin/git-committer.js";
import { docWriterSkill } from "./skill/builtin/doc-writer.js";

async function main() {
  const unified = loadConfig();
  const workingDirectory = unified.config.workingDirectory ?? process.cwd();

  // --- Provider (single or router) ---
  let provider: Provider;
  let providerModel: string;

  if (unified.mode === "router") {
    const router = createRouter(unified.config);
    provider = router;
    providerModel = "";
  } else {
    const single = createProvider(
      unified.config.providerType,
      unified.config.provider
    );
    provider = single;
    providerModel = unified.config.provider.model;
  }

  // --- Tool registry ---
  const toolRegistry = new ToolRegistry();
  toolRegistry.register(new BashTool(workingDirectory));
  toolRegistry.register(new ReadTool());
  toolRegistry.register(new WriteTool());
  toolRegistry.register(new EditTool());

  // --- Skill registry ---
  const skillRegistry = new SkillRegistry();
  skillRegistry.register(codeReviewerSkill);
  skillRegistry.register(testWriterSkill);
  skillRegistry.register(gitCommitterSkill);
  skillRegistry.register(docWriterSkill);
  skillRegistry.loadState();

  const maxIterations = unified.config.maxIterations;

  // --- Startup banner ---
  console.log(`neonity v0.1.0`);
  if (unified.mode === "router") {
    const router = provider as ReturnType<typeof createRouter>;
    console.log(`mode: router`);
    console.log(router.getInfo());
  } else {
    console.log(
      `provider: ${provider.name} | model: ${providerModel}`
    );
  }

  // --- REPL ---
  const systemPrompt = buildSystemPrompt({
    workingDirectory,
    platform: process.platform,
    tools: skillRegistry.getToolDefinitions(
      toolRegistry.getDefinitions()
    ),
    skillPrompt: skillRegistry.getActivePrompt() || undefined,
  });

  const providerConfig =
    unified.mode === "router"
      ? unified.config.tiers.standard?.provider ??
        unified.config.tiers.premium?.provider ??
        unified.config.tiers.cheap?.provider!
      : unified.config.provider;

  const agent = new Agent(
    {
      provider: providerConfig,
      systemPrompt,
      maxIterations,
      workingDirectory,
    },
    provider,
    toolRegistry,
    skillRegistry,
    workingDirectory
  );

  console.log(
    `Skills: ${skillRegistry.list().filter((s) => s.active).length} active / ${skillRegistry.list().length} available`
  );
  console.log("Type /help to see commands, /skills to list skills.\n");

  await startRepl(agent);
}

main().catch(console.error);
