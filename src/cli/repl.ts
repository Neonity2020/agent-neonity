import * as readline from "node:readline";
import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import type { Agent } from "../agent/agent.js";
import type { McpManager } from "../mcp/manager.js";
import { ProviderRouter } from "../provider/router.js";
import { createStreamCallbacks } from "./stream.js";
import {
  loadHistory,
  saveHistory,
  listSessions,
  saveSession,
  loadSession,
  deleteSession,
} from "./session.js";

const SLASH_COMMANDS = [
  "/exit",
  "/quit",
  "/help",
  "/clear",
  "/save",
  "/load",
  "/sessions",
  "/delsession",
  "/skills",
  "/skill",
  "/memory",
  "/model",
  "/provider",
  "/router",
  "/router-reset",
  "/cost",
  "/context",
  "/mcp",
];

export async function startRepl(agent: Agent, mcpManager?: McpManager): Promise<void> {
  const historyLines = loadHistory();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green("> "),
    history: [...historyLines],
    completer,
    terminal: true,
  });

  // Save history on each new line
  rl.on("history", (history: string[]) => {
    saveHistory(history);
  });

  const autosaveMessages = loadSession("autosave");
  if (autosaveMessages && autosaveMessages.length > 0) {
    const answer = await new Promise<string>((resolve) => {
      rl.question(chalk.yellow("? Found an auto-saved session from your last run. Resume? [Y/n] "), resolve);
    });
    if (answer.trim().toLowerCase() !== "n") {
      agent.loadHistory(autosaveMessages);
      console.log(chalk.dim(`✓ Resumed session (${autosaveMessages.length} messages).\n`));
    } else {
      deleteSession("autosave");
      console.log(chalk.dim(`✓ Started a new session.\n`));
    }
  }

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    // Handle slash commands
    if (input.startsWith("/")) {
      const handled = await handleCommand(input, agent, rl, mcpManager);
      if (handled) {
        saveSession("autosave", agent.getHistory());
        rl.prompt();
        return;
      }
      // Unknown command — fall through and send to agent
    }

    const callbacks = createStreamCallbacks();

    try {
      await agent.run(input, callbacks);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(chalk.red(`\nError: ${message}\n`));
    } finally {
      saveSession("autosave", agent.getHistory());
    }

    process.stdout.write("\n");
    rl.prompt();
  });

  rl.on("close", () => {
    process.stdout.write(chalk.dim("\nGoodbye.\n"));
    process.exit(0);
  });
}

/**
 * Handle slash commands. Returns true if the command was recognized.
 */
async function handleCommand(
  input: string,
  agent: Agent,
  rl: readline.Interface,
  mcpManager?: McpManager
): Promise<boolean> {
  const parts = input.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const arg = parts.slice(1).join(" ");

  switch (cmd) {
    case "/exit":
    case "/quit":
      rl.close();
      return true;

    case "/help":
      printHelp();
      return true;

    case "/clear":
      agent.clearHistory();
      console.log(chalk.dim("✓ Conversation history cleared."));
      return true;

    case "/save": {
      if (!arg) {
        console.log(chalk.yellow("Usage: /save <name>"));
        return true;
      }
      saveSession(arg, agent.getHistory());
      console.log(chalk.dim(`✓ Session saved as "${arg}"`));
      return true;
    }

    case "/load": {
      if (!arg) {
        console.log(chalk.yellow("Usage: /load <name>"));
        return true;
      }
      const messages = loadSession(arg);
      if (messages) {
        agent.loadHistory(messages);
        console.log(
          chalk.dim(`✓ Session "${arg}" loaded (${messages.length} messages)`)
        );
      } else {
        console.log(chalk.red(`Session "${arg}" not found.`));
      }
      return true;
    }

    case "/sessions": {
      const sessions = listSessions();
      if (sessions.length === 0) {
        console.log(chalk.dim("No saved sessions."));
      } else {
        console.log(chalk.bold("Saved sessions:"));
        for (const s of sessions) {
          console.log(chalk.dim(`  • ${s}`));
        }
      }
      return true;
    }

    case "/delsession": {
      if (!arg) {
        console.log(chalk.yellow("Usage: /delsession <name>"));
        return true;
      }
      if (deleteSession(arg)) {
        console.log(chalk.dim(`✓ Session "${arg}" deleted.`));
      } else {
        console.log(chalk.red(`Session "${arg}" not found.`));
      }
      return true;
    }

    case "/skills": {
      const skillRegistry = agent.getSkillRegistry();
      const skills = skillRegistry.list();
      if (skills.length === 0) {
        console.log(chalk.dim("No skills registered."));
      } else {
        console.log(chalk.bold("\nSkills:"));
        for (const s of skills) {
          const icon = s.active ? chalk.green("●") : chalk.dim("○");
          const name = s.active
            ? chalk.cyan(s.name)
            : chalk.dim(s.name);
          console.log(
            `  ${icon} ${name} ${chalk.dim("—")} ${chalk.dim(s.description)}`
          );
        }
        console.log(
          chalk.dim("\nUse /skill <name> to toggle a skill on/off.\n")
        );
      }
      return true;
    }

    case "/skill": {
      if (!arg) {
        console.log(chalk.yellow("Usage: /skill <name>  — toggle a skill"));
        console.log(chalk.dim("Use /skills to see available skills."));
        return true;
      }
      const skillRegistry = agent.getSkillRegistry();
      const result = skillRegistry.toggle(arg);
      if (result === null) {
        console.log(chalk.red(`Skill "${arg}" not found.`));
        console.log(chalk.dim("Use /skills to see available skills."));
      } else if (result) {
        console.log(
          chalk.green(`✓ Skill "${arg}" activated.`)
        );
        console.log(
          chalk.dim("The agent's system prompt has been updated.")
        );
      } else {
        console.log(
          chalk.dim(`✓ Skill "${arg}" deactivated.`)
        );
      }
      return true;
    }

    case "/router": {
      const provider = agent.getProvider();
      if (!(provider instanceof ProviderRouter)) {
        console.log(chalk.dim("Router mode is not active."));
        console.log(chalk.dim("Set ROUTER_MODE=true in .env to enable."));
        return true;
      }

      console.log(chalk.bold("\nRouter Status"));
      console.log(chalk.dim(provider.getInfo()));

      // Circuit breaker status
      const circuits = provider.getCircuitStatus();
      const openCircuits = Array.from(circuits.entries()).filter(
        ([, s]) => s.isOpen
      );
      if (circuits.size > 0) {
        console.log(chalk.bold("\nCircuit Breakers:"));
        for (const [label, state] of circuits) {
          const icon = state.isOpen ? chalk.red("✗ OPEN") : chalk.green("✓ CLOSED");
          console.log(
            `  ${icon} ${chalk.dim(label)} (failures: ${state.consecutiveFailures})`
          );
        }
        if (openCircuits.length > 0) {
          console.log(
            chalk.dim(`\nUse /router-reset [name] to reset circuits.`)
          );
        }
      }

      // Latency stats
      const latencies = provider.getAllLatencyStats();
      if (latencies.size > 0) {
        console.log(chalk.bold("\nLatency:"));
        for (const [label, stats] of latencies) {
          const errColor = stats.errorRate > 0 ? chalk.yellow : chalk.green;
          console.log(
            `  ${chalk.dim(label)}: avg=${stats.avgMs}ms p95=${stats.p95Ms}ms err=${errColor(stats.errorRate * 100 + "%")} n=${stats.sampleCount}`
          );
        }
      }

      console.log("");
      return true;
    }

    case "/router-reset": {
      const provider = agent.getProvider();
      if (!(provider instanceof ProviderRouter)) {
        console.log(chalk.dim("Router mode is not active."));
        return true;
      }

      if (arg) {
        provider.resetCircuit(arg);
        console.log(chalk.green(`✓ Circuit "${arg}" reset.`));
      } else {
        provider.resetAllCircuits();
        console.log(chalk.green(`✓ All circuits reset.`));
      }
      return true;
    }

    case "/cost": {
      const provider = agent.getProvider();
      if (!(provider instanceof ProviderRouter)) {
        console.log(chalk.dim("Router mode is not active."));
        console.log(chalk.dim("Set ROUTER_MODE=true in .env and ROUTER_TRACK_BUDGET=true to track costs."));
        return true;
      }

      const budget = provider.getBudget();
      const totalTokens = budget.inputTokens + budget.outputTokens;
      if (totalTokens === 0) {
        console.log(chalk.dim("No token usage tracked yet. Set ROUTER_TRACK_BUDGET=true to enable."));
      } else {
        console.log(chalk.bold("\nToken Budget:"));
        console.log(`  Input:  ${budget.inputTokens.toLocaleString()} tokens`);
        console.log(`  Output: ${budget.outputTokens.toLocaleString()} tokens`);
        console.log(`  Total:  ${totalTokens.toLocaleString()} tokens`);
        console.log(`  Cost:   ~${budget.estimatedCost.toFixed(4)}`);
        console.log(chalk.dim("\n  (Approximate — based on published model pricing)"));
      }
      console.log("");
      return true;
    }

    case "/context": {
      const est = agent.getContextStatus();
      const pct = ((est.totalTokens / est.contextWindow) * 100).toFixed(1);
      const bar = est.isOverBudget
        ? chalk.red(`${pct}%`)
        : parseFloat(pct) > 75
          ? chalk.yellow(`${pct}%`)
          : chalk.green(`${pct}%`);
      console.log(chalk.bold("\nContext Window:"));
      console.log(`  Window:    ${est.contextWindow.toLocaleString()} tokens`);
      console.log(`  Reserved:  ${est.reservedForOutput.toLocaleString()} tokens (output)`);
      console.log(`  System:    ${est.systemPromptTokens.toLocaleString()} tokens`);
      console.log(`  Tools:     ${est.toolDefinitionTokens.toLocaleString()} tokens`);
      console.log(`  Messages:  ${est.messageTokens.toLocaleString()} tokens`);
      console.log(`  Total:     ${est.totalTokens.toLocaleString()} tokens (${bar})`);
      if (est.isOverBudget) {
        console.log(chalk.yellow("  ⚠ Over budget — context will be managed on next turn."));
      }
      console.log("");
      return true;
    }

    case "/mcp": {
      if (!mcpManager) {
        console.log(chalk.dim("MCP manager is not initialized."));
        return true;
      }

      if (arg === "reload") {
        console.log(chalk.dim("Reloading MCP servers..."));
        await mcpManager.reload();
        console.log(chalk.green("✓ MCP servers reloaded."));
      }

      const statuses = mcpManager.getStatuses();
      if (statuses.length === 0) {
        console.log(chalk.dim("No MCP servers configured (or config missing/empty)."));
        console.log(chalk.dim("Add an mcp_servers.json file to your .neonity/ folder."));
        return true;
      }

      console.log(chalk.bold("\nMCP Servers:"));
      for (const s of statuses) {
        let icon = chalk.yellow("○");
        let statusStr: string = s.status;
        if (s.status === "connected") {
          icon = chalk.green("●");
        } else if (s.status === "failed") {
          icon = chalk.red("✗");
          statusStr = `${s.status} (${s.error})`;
        }
        console.log(`  ${icon} ${chalk.cyan(s.name)} [${statusStr}] — ${s.toolsCount} tools`);
      }
      console.log(chalk.dim("\nUse /mcp reload to reconnect to MCP servers.\n"));
      return true;
    }

    case "/model": {
      // 无参数 → 统一交互菜单
      if (!arg) {
        await interactiveModelSelect(agent, rl);
        return true;
      }

      // /model list — 静态列表
      if (arg === "list" || arg === "ls") {
        const models = agent.getAvailableModels();
        const currentModel = agent.getModel();
        const isRouter = agent.isRouterMode();

        console.log(chalk.bold("\nAvailable Models:"));
        for (const m of models) {
          const isActive = !isRouter && m.id === currentModel;
          const icon = isActive ? chalk.green("●") : chalk.dim("○");
          const name = isActive ? chalk.cyan(m.id) : chalk.white(m.id);
          const label = m.label !== m.id ? ` — ${m.label}` : "";
          const tier = m.tier ? ` [${m.tier}]` : "";
          console.log(`  ${icon} ${name}${label}${tier}`);
        }
        if (isRouter) {
          console.log(chalk.dim("\n  Router mode active. Use /model <id> to pin a specific model (exits router)."));
        } else {
          console.log(chalk.dim("\nUse /model <id> to switch directly, or /model for interactive menu."));
        }
        console.log("");
        return true;
      }

      // /model <id> — 直接切换
      const wasRouter = agent.isRouterMode();
      const success = await agent.switchModel(arg);
      if (success) {
        if (wasRouter) {
          console.log(chalk.green(`✓ Pinned to ${agent.getProviderName()} / ${arg} (router disabled)`));
        } else {
          console.log(chalk.green(`✓ Model switched to ${arg}`));
        }
      } else {
        console.log(chalk.red(`✗ Failed to switch model to ${arg}`));
        const available = agent.getAvailableModels().map(m => m.id);
        if (available.length > 0 && available.length <= 10) {
          console.log(chalk.dim(`Available: ${available.join(", ")}`));
        } else {
          console.log(chalk.dim("Use /model list to see available models."));
        }
      }
      return true;
    }

    case "/provider": {
      // 无参数 → 统一交互菜单（同 /model）
      if (!arg) {
        await interactiveModelSelect(agent, rl);
        return true;
      }

      // /provider list — 静态列表
      if (arg === "list" || arg === "ls") {
        await interactiveModelSelect(agent, rl);
        return true;
      }

      // /provider <name> [model] — 直接切换
      const provParts = arg.split(/\s+/);
      const provArg = provParts[0];
      const modelArg = provParts.slice(1).join(" ");
      const provSuccess = await agent.switchProvider(provArg, modelArg || undefined);
      if (provSuccess) {
        const modelName = modelArg ? ` (model: ${modelArg})` : "";
        console.log(chalk.green(`✓ Provider switched to ${provArg}${modelName}`));
      } else {
        console.log(chalk.red(`✗ Failed to switch provider to ${provArg}`));
        console.log(chalk.dim("Check that the provider is valid and has an API key configured."));
      }
      return true;
    }

    case "/memory": {
      const memoryManager = agent.getMemoryManager();
      if (!memoryManager) {
        console.log(chalk.dim("Memory system is not available."));
        return true;
      }

      // Parse memory subcommand
      const memParts = arg.split(/\s+/);
      const memCmd = memParts[0]?.toLowerCase();

      if (!memCmd || memCmd === "list" || memCmd === "ls") {
        // List all memories
        const entries = memoryManager.getAll();
        if (entries.length === 0) {
          console.log(chalk.dim("No memories stored. Use the 'memory' tool to add memories."));
        } else {
          console.log(chalk.bold(`\nMemories (${entries.length}):`));
          for (const entry of entries) {
            const icon = entry.confidence > 0.7 ? chalk.green("●") : chalk.yellow("○");
            console.log(`  ${icon} [${entry.category}] ${chalk.dim(entry.id)}`);
            console.log(`    ${entry.content.slice(0, 80)}${entry.content.length > 80 ? "..." : ""}`);
          }
        }
        console.log("");
        return true;
      }

      if (memCmd === "stats") {
        const stats = memoryManager.getStats();
        console.log(chalk.bold("\nMemory Statistics:"));
        console.log(`  Total: ${stats.totalEntries}`);
        console.log(`  - project: ${stats.byCategory.project}`);
        console.log(`  - preference: ${stats.byCategory.preference}`);
        console.log(`  - knowledge: ${stats.byCategory.knowledge}`);
        console.log(`  - context: ${stats.byCategory.context}`);
        console.log(`  - pattern: ${stats.byCategory.pattern}`);
        console.log(`  Last updated: ${stats.lastUpdated || "never"}`);
        console.log("");
        return true;
      }

      if (memCmd === "add") {
        // /memory add <category> <content>
        const category = memParts[1] as import("../memory/memory.js").MemoryCategory;
        const content = memParts.slice(2).join(" ");
        if (!category || !content) {
          console.log(chalk.yellow("Usage: /memory add <category> <content>"));
          console.log(chalk.dim("Categories: project, preference, knowledge, context, pattern"));
          return true;
        }
        const entry = await memoryManager.add(content, category);
        console.log(chalk.green(`✓ Memory added: ${entry.id}`));
        return true;
      }

      if (memCmd === "search" || memCmd === "find") {
        const query = memParts.slice(1).join(" ");
        if (!query) {
          console.log(chalk.yellow("Usage: /memory search <query>"));
          return true;
        }
        const results = memoryManager.search(query);
        if (results.length === 0) {
          console.log(chalk.dim("No memories found."));
        } else {
          console.log(chalk.bold(`\nFound ${results.length} memory(ies):\n`));
          for (const entry of results) {
            console.log(`  [${entry.category}] ${entry.content}`);
            console.log("");
          }
        }
        return true;
      }

      if (memCmd === "clear") {
        // This would need a separate delete all method
        console.log(chalk.dim("Use /memory search + tool to delete individual memories."));
        return true;
      }

      // Show help for memory commands
      console.log(chalk.bold("\nMemory Commands:"));
      console.log(chalk.dim("  /memory              List all memories"));
      console.log(chalk.dim("  /memory list         List all memories"));
      console.log(chalk.dim("  /memory stats        Show memory statistics"));
      console.log(chalk.dim("  /memory add <cat> <content>  Add a memory"));
      console.log(chalk.dim("  /memory search <query>      Search memories"));
      console.log(chalk.dim("\nCategories: project, preference, knowledge, context, pattern"));
      console.log(chalk.dim("\nThe agent can also use the 'memory' tool to manage memories.\n"));
      return true;
    }

    default:
      return false;
  }
}

function printHelp(): void {
  console.log(
    chalk.bold("\nNeonity Commands:") +
      "\n" +
      chalk.dim("  /exit, /quit    Exit Neonity\n") +
      chalk.dim("  /help           Show this help\n") +
      chalk.dim("  /clear          Clear conversation history\n") +
      chalk.dim("  /save <name>    Save session\n") +
      chalk.dim("  /load <name>    Load a saved session\n") +
      chalk.dim("  /sessions       List saved sessions\n") +
      chalk.dim("  /delsession <n> Delete a session\n") +
      chalk.dim("  /skills         List available skills\n") +
      chalk.dim("  /skill <name>   Toggle a skill on/off\n") +
      chalk.dim("  /memory         List/search memories\n") +
      chalk.dim("  /model          List available models\n") +
      chalk.dim("  /model <id>     Switch to a different model\n") +
      chalk.dim("  /provider       Select provider interactively (↑↓ + Enter)\n") +
      chalk.dim("  /provider <n>   Switch provider directly (e.g. /provider glm)\n") +
      chalk.dim("  /router         Show router status (circuits, latency, budget)\n") +
      chalk.dim("  /router-reset   Reset circuit breakers (optional: <name>)\n") +
      chalk.dim("  /cost           Show cumulative token usage & cost\n") +
      chalk.dim("  /context        Show context window usage\n") +
      chalk.dim("  /mcp            Show MCP server status and loaded tools\n") +
      "\n" +
      chalk.dim("Anything else is sent to the AI agent.\n")
  );
}

/**
 * 统一的交互式 Provider + Model 选择菜单。
 * - 单 provider 模式：先选 provider，再选 model
 * - Router 模式：提示 router 状态，直接选 model（选择即退出 router）
 * Esc 随时可退出。
 *
 * Readline 在整个交互期间暂停，所有文字输入被屏蔽，
 * 只有 ↑↓/Enter/Esc/Ctrl-C 生效。退出后自动恢复 readline。
 */
async function interactiveModelSelect(agent: Agent, rl: readline.Interface): Promise<void> {
  const isRouter = agent.isRouterMode();
  const currentProvider = agent.getProviderName();
  const currentModel = agent.getModel();

  // ---- 通用终端工具 ----
  const clearLines = (n: number) => {
    for (let i = 0; i < n; i++) {
      process.stdout.write("\x1B[1A\x1B[2K");
    }
  };

  type NavItem = { id: string; label: string; detail?: string };

  /**
   * 通用箭头键选择器。返回选中项的 index，-1 表示取消。
   * 仅管理 raw mode；readline 由外层统一暂停/恢复。
   */
  function selectFromList(
    title: string,
    items: NavItem[],
    defaultIndex: number,
    activeId: string
  ): Promise<number> {
    let idx = defaultIndex;
    let drawnLines = 0;

    const render = () => {
      // 清除上一次绘制的所有行
      clearLines(drawnLines);

      const lines: string[] = [];
      lines.push("");
      lines.push(chalk.bold(`  ${title}`));
      lines.push("");

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const selected = i === idx;
        const active = it.id === activeId;
        const detail = it.detail ? `  ${chalk.dim(it.detail)}` : "";

        if (selected) {
          const name = active
            ? chalk.cyan(`● ${it.id}`)
            : chalk.white(`○ ${it.id}`);
          lines.push(`  ${chalk.bgBlue.white("▶ ")}${name}  ${chalk.dim("—")} ${chalk.dim(it.label)}${detail}`);
        } else {
          const icon = active ? chalk.green("●") : chalk.dim("○");
          const name = active ? chalk.cyan(it.id) : chalk.dim(it.id);
          lines.push(`    ${icon} ${name}  ${chalk.dim("—")} ${chalk.dim(it.label)}${detail}`);
        }
      }

      lines.push("");
      lines.push(chalk.dim("  ↑↓ Navigate  |  Enter Confirm  |  Esc Cancel"));
      lines.push("");

      drawnLines = lines.length;
      process.stdout.write(lines.join("\n") + "\n");
    };

    render();

    return new Promise((resolve) => {
      const onKeypress = (_char: string, key: { name: string; ctrl?: boolean }) => {
        // Ctrl-C → cancel
        if (key.ctrl && _char === "c") {
          cleanup();
          clearLines(drawnLines);
          console.log(chalk.dim("Cancelled.\n"));
          resolve(-1);
          return;
        }
        switch (key.name) {
          case "up":
          case "k":
            idx = (idx - 1 + items.length) % items.length;
            render();
            break;
          case "down":
          case "j":
            idx = (idx + 1) % items.length;
            render();
            break;
          case "return":
          case "enter":
            cleanup();
            clearLines(drawnLines);
            resolve(idx);
            break;
          case "escape":
            cleanup();
            clearLines(drawnLines);
            console.log(chalk.dim("Cancelled.\n"));
            resolve(-1);
            break;
          default:
            // 屏蔽所有其他按键（文字输入等）
            break;
        }
      };

      const cleanup = () => {
        process.stdin.removeListener("keypress", onKeypress);
        process.stdin.setRawMode?.(false);
      };

      process.stdin.setRawMode?.(true);
      process.stdin.resume();
      process.stdin.on("keypress", onKeypress);
    });
  }

  // ── 暂停 readline 并移除其 keypress 监听器，防止 ↑↓ 触发历史搜索 ──
  rl.pause();
  const savedKeypressListeners = process.stdin.listeners("keypress").slice();
  process.stdin.removeAllListeners("keypress");

  try {
    // ---- Router 模式：直接选择 model，选完退出 router ----
    if (isRouter) {
      console.log(chalk.yellow("  Router mode active. Selecting a model will pin to that provider."));

      const models = agent.getAvailableModels();
      const modelItems: NavItem[] = models.map(m => ({
        id: m.id,
        label: m.label !== m.id ? m.label : m.id,
        detail: m.tier ? `[${m.tier}]` : undefined,
      }));

      let defaultModelIdx = modelItems.findIndex(m => m.id === currentModel);
      if (defaultModelIdx === -1) defaultModelIdx = 0;

      const modelIdx = await selectFromList(
        "Select Model (exits router)",
        modelItems,
        defaultModelIdx,
        ""
      );
      if (modelIdx === -1) return;

      const selectedModel = modelItems[modelIdx];
      const ok = await agent.switchModel(selectedModel.id);
      if (ok) {
        console.log(chalk.green(`✓ Pinned to ${agent.getProviderName()} / ${selectedModel.id} (router disabled)\n`));
      } else {
        console.log(chalk.red(`✗ Failed to switch to ${selectedModel.id}\n`));
      }
      return;
    }

    // ---- 单 provider 模式：先选 provider，再选 model ----
    const { getApiKey } = await import("../config.js");
    const allProviders: NavItem[] = [
      { id: "anthropic", label: "Anthropic (Claude)" },
      { id: "openai", label: "OpenAI (GPT)" },
      { id: "gemini", label: "Google Gemini" },
      { id: "deepseek", label: "DeepSeek" },
      { id: "minimax", label: "MiniMax" },
      { id: "glm", label: "GLM (Zhipu)" },
    ].map(p => ({
      ...p,
      detail: getApiKey(p.id as Parameters<typeof getApiKey>[0]) ? chalk.green("key ✓") : chalk.red("key ✗"),
    }));

    let defaultIdx = allProviders.findIndex(p => p.id === currentProvider);
    if (defaultIdx === -1) defaultIdx = 0;

    // ---- 第一步：选择 provider ----
    const provIdx = await selectFromList(
      "Select Provider",
      allProviders,
      defaultIdx,
      currentProvider
    );
    if (provIdx === -1) return;

    const selectedProv = allProviders[provIdx];

    // 如果选的不是当前 provider，先切换
    if (selectedProv.id !== currentProvider) {
      const ok = await agent.switchProvider(selectedProv.id);
      if (!ok) {
        console.log(chalk.red(`✗ Failed to switch provider to ${selectedProv.id}`));
        console.log(chalk.dim("Check that the provider has an API key configured.\n"));
        return;
      }
      console.log(chalk.green(`✓ Provider switched to ${selectedProv.id}`));
    }

    // ---- 第二步：选择 model ----
    const models = agent.getAvailableModels();
    if (models.length <= 1) {
      const m = models[0];
      console.log(chalk.green(`  model: ${m.id}\n`));
      return;
    }

    const modelItems: NavItem[] = models.map(m => ({
      id: m.id,
      label: m.label !== m.id ? m.label : m.id,
      detail: m.tier ? `[${m.tier}]` : undefined,
    }));

    const newCurrentModel = agent.getModel();
    let defaultModelIdx = modelItems.findIndex(m => m.id === newCurrentModel);
    if (defaultModelIdx === -1) defaultModelIdx = 0;

    const modelIdx = await selectFromList(
      `Select Model (${selectedProv.id})`,
      modelItems,
      defaultModelIdx,
      newCurrentModel
    );
    if (modelIdx === -1) {
      console.log(chalk.green(`  model: ${agent.getModel()}\n`));
      return;
    }

    const selectedModel = modelItems[modelIdx];
    const ok = await agent.switchModel(selectedModel.id);
    if (ok) {
      console.log(chalk.green(`✓ Provider: ${selectedProv.id} | Model: ${selectedModel.id}\n`));
    } else {
      console.log(chalk.red(`✗ Failed to switch model to ${selectedModel.id}\n`));
    }
  } finally {
    // ── 恢复 readline 的 keypress 监听器并重新激活 ──
    for (const listener of savedKeypressListeners) {
      process.stdin.on("keypress", listener as (...args: unknown[]) => void);
    }
    // 恢复 raw mode（readline 终端模式需要 raw mode 做字符编辑和回显控制）
    process.stdin.setRawMode?.(true);
    rl.resume();
  }
}

/**
 * Tab-completer: completes slash commands and file paths.
 */
function completer(line: string): [string[], string] {
  // If line starts with /, complete slash commands
  if (line.startsWith("/")) {
    const hits = SLASH_COMMANDS.filter((cmd) => cmd.startsWith(line));
    return [hits.length > 0 ? hits : SLASH_COMMANDS, line];
  }

  // Try file path completion on the last token
  const tokens = line.split(/\s+/);
  const lastToken = tokens[tokens.length - 1] ?? "";

  // Only do path completion if the token looks like a path
  if (lastToken.includes("/") || lastToken.includes("~")) {
    return [completePath(lastToken), line];
  }

  // No completions
  return [[], line];
}

function completePath(partial: string): string[] {
  try {
    // Expand ~ to home directory
    const expanded = partial.startsWith("~")
      ? partial.replace(/^~/, process.env.HOME ?? "/Users")
      : partial;

    const dir = path.dirname(expanded) || ".";
    const base = path.basename(expanded);

    if (!fs.existsSync(dir)) return [];

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const matches: string[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith(base)) {
        const full = path.join(dir, entry.name);
        matches.push(
          entry.isDirectory() ? full + "/" : full
        );
      }
    }

    return matches;
  } catch {
    return [];
  }
}
