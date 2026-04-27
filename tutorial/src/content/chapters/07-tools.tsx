import { CodeBlock } from "@/components/code-block";

export default function Chapter() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-bold text-white mb-3">ToolRegistry</h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          The registry stores tools by name and provides two key operations:
          getting definitions to send to the LLM, and executing a tool by name
          at runtime.
        </p>
        <CodeBlock
          filename="src/tool/tool.ts"
          code={`import type { Tool, ToolDefinition } from "../types.js";

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  getDefinitions(): ToolDefinition[] {
    return [...this.tools.values()].map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  async execute(
    name: string,
    input: Record<string, unknown>
  ): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      return \`Error: Unknown tool "\${name}"\`;
    }
    try {
      return await tool.execute(input);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      return \`Error: \${message}\`;
    }
  }
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Bash Tool
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          Runs shell commands with a 30-second timeout and 1MB output buffer.
        </p>
        <CodeBlock
          filename="src/tool/bash-tool.ts"
          code={`import { execSync } from "node:child_process";

export class BashTool implements Tool {
  readonly name = "bash";
  readonly description =
    "Execute a shell command and return its output.";

  readonly inputSchema = {
    type: "object" as const,
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
        maxBuffer: 1024 * 1024, // 1 MB
      });
      return result || "(no output)";
    } catch (err) {
      const e = err as { status?: number; stderr?: string };
      return \`Exit code \${e.status}:\n\${e.stderr}\`;
    }
  }
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">Read Tool</h2>
        <CodeBlock
          filename="src/tool/read-tool.ts"
          code={`import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export class ReadTool implements Tool {
  readonly name = "read";
  readonly description =
    "Read the contents of a file at the given absolute path.";
  readonly inputSchema = {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string",
        description: "The absolute path to the file to read",
      },
    },
    required: ["file_path"],
  };

  async execute(input: Record<string, unknown>): Promise<string> {
    const filePath = resolve(input.file_path as string);
    try {
      return readFileSync(filePath, "utf-8");
    } catch (err) {
      return \`Error: \${err instanceof Error ? err.message : err}\`;
    }
  }
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">Write Tool</h2>
        <CodeBlock
          filename="src/tool/write-tool.ts"
          code={`import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

export class WriteTool implements Tool {
  readonly name = "write";
  readonly description =
    "Write content to a file. Creates the file and " +
    "any parent directories if they don't exist.";
  readonly inputSchema = {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string",
        description: "The absolute path to the file to write",
      },
      content: {
        type: "string",
        description: "The content to write to the file",
      },
    },
    required: ["file_path", "content"],
  };

  async execute(input: Record<string, unknown>): Promise<string> {
    const filePath = resolve(input.file_path as string);
    const content = input.content as string;
    try {
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, content, "utf-8");
      return \`Successfully wrote to \${filePath}\`;
    } catch (err) {
      return \`Error: \${err instanceof Error ? err.message : err}\`;
    }
  }
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Edit Tool — Exact String Replacement
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          The edit tool finds an exact string in a file and replaces it—but only
          if the string appears exactly once. This prevents accidental damage
          from ambiguous matches.
        </p>
        <CodeBlock
          filename="src/tool/edit-tool.ts"
          code={`import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export class EditTool implements Tool {
  readonly name = "edit";
  readonly description =
    "Perform an exact string replacement in a file. " +
    "The old_string must match exactly once in the file.";
  readonly inputSchema = {
    type: "object" as const,
    properties: {
      file_path: { type: "string" },
      old_string: { type: "string" },
      new_string: { type: "string" },
    },
    required: ["file_path", "old_string", "new_string"],
  };

  async execute(input: Record<string, unknown>): Promise<string> {
    const filePath = resolve(input.file_path as string);
    const oldString = input.old_string as string;
    const newString = input.new_string as string;

    const content = readFileSync(filePath, "utf-8");

    const count = content.split(oldString).length - 1;
    if (count === 0) return "Error: old_string not found";
    if (count > 1) return "Error: old_string appears multiple times";

    const newContent = content.replace(oldString, newString);
    writeFileSync(filePath, newContent, "utf-8");
    return \`Successfully edited \${filePath}\`;
  }
}`}
        />
      </section>
    </div>
  );
}
