import * as readline from "node:readline";
import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import type { Agent } from "../agent/agent.js";
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
  "/router",
  "/router-reset",
  "/cost",
  "/context",
];

export async function startRepl(agent: Agent): Promise<void> {
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

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    // Handle slash commands
    if (input.startsWith("/")) {
      const handled = await handleCommand(input, agent, rl);
      if (handled) {
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
  rl: readline.Interface
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
      chalk.dim("  /router         Show router status (circuits, latency, budget)\n") +
      chalk.dim("  /router-reset   Reset circuit breakers (optional: <name>)\n") +
      chalk.dim("  /cost           Show cumulative token usage & cost\n") +
      chalk.dim("  /context        Show context window usage\n") +
      "\n" +
      chalk.dim("Anything else is sent to the AI agent.\n")
  );
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
