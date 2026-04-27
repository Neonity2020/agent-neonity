import { CodeBlock } from "@/components/code-block";

export default function Chapter() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          What Are Skills?
        </h2>
        <p className="text-slate-300 leading-relaxed">
          Skills are runtime-togglable modules that augment the agent&apos;s
          capabilities by injecting specialized instructions into its system
          prompt. Think of them as &quot;agent plugins&quot; — each one teaches the LLM how
          to perform a specific type of task exceptionally well. Skills are off
          by default, and their state persists across sessions via{" "}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm text-cyan-400">~/.neonity/skills.json</code>.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          The Skill Interface
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          Every skill implements a simple interface: a name, a description for
          the user, and a system prompt fragment that gets appended to the
          agent&apos;s main prompt when active. Skills can optionally provide
          additional tools.
        </p>
        <CodeBlock
          filename="src/skill/skill.ts (excerpt)"
          code={`import type { Tool, ToolDefinition } from "../types.js";

export interface Skill {
  /** Unique identifier, e.g. "code-reviewer" */
  readonly name: string;
  /** Human-readable description for /skills listing */
  readonly description: string;
  /** Prompt fragment appended to the system prompt when active */
  readonly systemPrompt: string;
  /** Optional: extra tools this skill contributes */
  readonly tools?: Tool[];
}

export class SkillRegistry {
  private skills = new Map<string, Skill>();
  private activeSkills = new Set<string>();
  private toolRegistry: ToolRegistry;

  constructor(toolRegistry: ToolRegistry) {
    this.toolRegistry = toolRegistry;
  }

  register(skill: Skill): void {
    this.skills.set(skill.name, skill);
  }

  toggle(name: string): boolean {
    if (this.activeSkills.has(name)) {
      this.activeSkills.delete(name);
      return false; // now inactive
    }
    this.activeSkills.add(name);
    // Register skill-specific tools
    const skill = this.skills.get(name);
    if (skill?.tools) {
      for (const tool of skill.tools) {
        this.toolRegistry.register(tool);
      }
    }
    return true; // now active
  }

  isActive(name: string): boolean {
    return this.activeSkills.has(name);
  }

  /** Aggregate prompt from all active skills */
  getActivePrompt(): string {
    const prompts: string[] = [];
    for (const name of this.activeSkills) {
      const skill = this.skills.get(name);
      if (skill) {
        prompts.push(
          \`## Active Skill: \${skill.name}\\n\${skill.systemPrompt}\`
        );
      }
    }
    return prompts.join("\\n\\n");
  }

  /** Get all tool definitions including skill-provided ones */
  getToolDefinitions(
    baseTools: ToolDefinition[]
  ): ToolDefinition[] {
    return baseTools; // skill tools already registered
  }

  /** List all skills with their active status */
  list(): { name: string; description: string; active: boolean }[] {
    return [...this.skills.values()].map((s) => ({
      name: s.name,
      description: s.description,
      active: this.activeSkills.has(s.name),
    }));
  }
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Example: Code Reviewer Skill
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          When activated, this skill teaches the agent to perform systematic
          code reviews — checking for bugs, security issues, performance
          problems, and style violations.
        </p>
        <CodeBlock
          filename="src/skill/builtin/code-reviewer.ts"
          code={`import type { Skill } from "../skill.js";

export class CodeReviewerSkill implements Skill {
  readonly name = "code-reviewer";
  readonly description =
    "Provides systematic code reviews, focusing on bugs, " +
    "security vulnerabilities, performance optimizations, " +
    "and adherence to style guides.";

  readonly systemPrompt = \`You are a code reviewer. When reviewing code:
1. **Bugs**: Identify logic errors, null/undefined issues,
   race conditions, and incorrect assumptions.
2. **Security**: Flag injection risks, hardcoded secrets,
   missing input validation, and unsafe dependencies.
3. **Performance**: Note O(n²) patterns, unnecessary
   allocations, missing caching, and blocking I/O.
4. **Style**: Check naming conventions, consistent patterns,
   and adherence to the project's existing code style.

For each issue, provide:
- The file path and line range
- The severity (critical / high / medium / low)
- A clear description of the problem
- A suggested fix with a code example\`;
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Persistence: Loading & Saving Skill State
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          Skill state is persisted to a JSON file so active skills survive
          restarts. The state is loaded on startup and saved whenever a skill is
          toggled.
        </p>
        <CodeBlock
          filename="src/skill/skill.ts (persistence)"
          code={`import { readFileSync, writeFileSync, existsSync,
  mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const SKILLS_FILE = join(homedir(), ".neonity", "skills.json");

// Inside SkillRegistry:

loadState(): void {
  try {
    if (existsSync(SKILLS_FILE)) {
      const data = JSON.parse(
        readFileSync(SKILLS_FILE, "utf-8")
      );
      for (const name of data.activeSkills ?? []) {
        if (this.skills.has(name)) {
          this.toggle(name);
        }
      }
    }
  } catch {
    // Corrupted state — start fresh
  }
}

private saveState(): void {
  try {
    mkdirSync(join(homedir(), ".neonity"),
      { recursive: true });
    writeFileSync(
      SKILLS_FILE,
      JSON.stringify({
        activeSkills: [...this.activeSkills],
      }, null, 2)
    );
  } catch {
    // Silently fail — non-critical
  }
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Built-in Skills
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Skill</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">What It Does</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              <tr className="border-b border-slate-800/50">
                <td className="py-2 px-3">
                  <code className="text-cyan-400 text-xs">code-reviewer</code>
                </td>
                <td className="py-2 px-3 text-sm">Systematic code reviews: bugs, security, performance, style</td>
              </tr>
              <tr className="border-b border-slate-800/50">
                <td className="py-2 px-3">
                  <code className="text-cyan-400 text-xs">test-writer</code>
                </td>
                <td className="py-2 px-3 text-sm">Generates unit/integration tests with proper mocking and coverage</td>
              </tr>
              <tr className="border-b border-slate-800/50">
                <td className="py-2 px-3">
                  <code className="text-cyan-400 text-xs">git-committer</code>
                </td>
                <td className="py-2 px-3 text-sm">Creates Conventional Commits with semantic messages and scopes</td>
              </tr>
              <tr>
                <td className="py-2 px-3">
                  <code className="text-cyan-400 text-xs">doc-writer</code>
                </td>
                <td className="py-2 px-3 text-sm">Generates API docs, README files, and inline JSDoc/TSDoc comments</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          How Skills Fit Into the System Prompt
        </h2>
        <p className="text-slate-300 leading-relaxed">
          When a skill is active, its prompt is injected under an{" "}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm text-cyan-400">## Active Skill</code>{" "}
          heading in the agent&apos;s system prompt. The agent builds the prompt
          dynamically at the start of each REACT loop iteration:
        </p>
        <ul className="space-y-2 text-slate-400 mt-3">
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            <span>
              The base prompt describes the environment and general agent
              behavior
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            <span>
              Skill prompts are appended, overriding and specializing the
              agent&apos;s default behavior
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            <span>
              Multiple active skills combine — their prompts are concatenated
              with clear section headers
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
