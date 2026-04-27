import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { Tool, ToolDefinition } from "../types.js";

const NEONITY_DIR = path.join(os.homedir(), ".neonity");
const SKILL_STATE_FILE = path.join(NEONITY_DIR, "skills.json");

/**
 * A Skill is a composable capability module that augments
 * the agent's system prompt and optionally provides additional tools.
 *
 * Skills can be activated/deactivated at runtime via slash commands.
 * State is persisted to ~/.neonity/skills.json across restarts.
 */
export interface Skill {
  /** Unique identifier (used for slash commands) */
  readonly name: string;
  /** Human-readable description shown in listings */
  readonly description: string;
  /** Prompt snippet appended to the system prompt when active.
   *  Keep this focused — it's injected into a limited context window. */
  readonly systemPrompt: string;
  /** Optional additional tools this skill enables */
  readonly tools?: Tool[];
  /** Whether this skill is active by default at startup */
  readonly defaultActive?: boolean;
}

export class SkillRegistry {
  private skills = new Map<string, Skill>();
  private activeSkills = new Set<string>();

  /** Register a skill. Restores persisted state if available. */
  register(skill: Skill): void {
    this.skills.set(skill.name, skill);
    if (skill.defaultActive) {
      this.activeSkills.add(skill.name);
    }
  }

  /**
   * Load previously persisted skill states.
   * Called once after all skills are registered.
   * Persisted state takes precedence over defaultActive.
   */
  loadState(): void {
    try {
      if (!fs.existsSync(SKILL_STATE_FILE)) return;
      const data = JSON.parse(fs.readFileSync(SKILL_STATE_FILE, "utf-8"));
      if (!Array.isArray(data.active)) return;

      // Only restore names that correspond to registered skills
      for (const name of data.active) {
        if (this.skills.has(name)) {
          this.activeSkills.add(name);
        }
      }
    } catch {
      // Corrupt file — ignore and use defaults
    }
  }

  /** Persist current active skill names to disk. */
  saveState(): void {
    try {
      fs.mkdirSync(NEONITY_DIR, { recursive: true });
      fs.writeFileSync(
        SKILL_STATE_FILE,
        JSON.stringify({ active: [...this.activeSkills] }, null, 2),
        "utf-8"
      );
    } catch {
      // Non-critical — best effort
    }
  }

  /** Activate a skill by name. Returns false if not found. */
  activate(name: string): boolean {
    if (!this.skills.has(name)) return false;
    this.activeSkills.add(name);
    this.saveState();
    return true;
  }

  /** Deactivate a skill by name. Returns false if not found. */
  deactivate(name: string): boolean {
    if (!this.skills.has(name)) return false;
    this.activeSkills.delete(name);
    this.saveState();
    return true;
  }

  /** Toggle a skill on/off. Returns the new state (true = active). */
  toggle(name: string): boolean | null {
    if (!this.skills.has(name)) return null;
    if (this.activeSkills.has(name)) {
      this.activeSkills.delete(name);
    } else {
      this.activeSkills.add(name);
    }
    this.saveState();
    return this.activeSkills.has(name);
  }

  /** Check if a skill is currently active. */
  isActive(name: string): boolean {
    return this.activeSkills.has(name);
  }

  /** Get all registered skills (with their active status). */
  list(): Array<{ name: string; description: string; active: boolean }> {
    return [...this.skills.values()].map((s) => ({
      name: s.name,
      description: s.description,
      active: this.activeSkills.has(s.name),
    }));
  }

  /** Get the combined system prompt snippet for all active skills. */
  getActivePrompt(): string {
    const prompts: string[] = [];
    for (const name of this.activeSkills) {
      const skill = this.skills.get(name);
      if (skill) {
        prompts.push(`## Active Skill: ${skill.name}\n${skill.systemPrompt}`);
      }
    }
    return prompts.join("\n\n");
  }

  /** Get all tool definitions from active skills + base registry. */
  getToolDefinitions(baseTools: ToolDefinition[]): ToolDefinition[] {
    const defs = [...baseTools];
    for (const name of this.activeSkills) {
      const skill = this.skills.get(name);
      if (skill?.tools) {
        for (const tool of skill.tools) {
          defs.push({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          });
        }
      }
    }
    return defs;
  }

  /** Execute a tool that belongs to an active skill. Returns null if not a skill tool. */
  async executeSkillTool(
    name: string,
    input: Record<string, unknown>
  ): Promise<string | null> {
    for (const skillName of this.activeSkills) {
      const skill = this.skills.get(skillName);
      if (!skill?.tools) continue;
      const tool = skill.tools.find((t) => t.name === name);
      if (tool) {
        return tool.execute(input);
      }
    }
    return null;
  }
}
