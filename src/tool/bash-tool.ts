import { execSync } from "node:child_process";
import type { Tool } from "../types.js";

export class BashTool implements Tool {
  readonly name = "bash";
  readonly description =
    "Execute a shell command and return its output. Use for running build tools, tests, git commands, etc.";
  readonly inputSchema: Tool["inputSchema"] = {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The shell command to execute",
      },
      description: {
        type: "string",
        description: "Brief description of what this command does",
      },
    },
    required: ["command", "description"],
  };

  constructor(private workingDirectory?: string) {}

  async execute(input: Record<string, unknown>): Promise<string> {
    const command = input.command as string;
    try {
      const result = execSync(command, {
        timeout: 30_000,
        cwd: this.workingDirectory,
        encoding: "utf-8",
        maxBuffer: 1024 * 1024,
      });
      return result || "(no output)";
    } catch (err: unknown) {
      const e = err as { status?: number; stderr?: string | Buffer };
      const stderr =
        typeof e.stderr === "string"
          ? e.stderr
          : e.stderr?.toString("utf-8") ?? "";
      return `Exit code ${e.status ?? "unknown"}:\n${stderr}`;
    }
  }
}
