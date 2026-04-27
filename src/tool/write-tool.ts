import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { Tool } from "../types.js";

export class WriteTool implements Tool {
  readonly name = "write";
  readonly description =
    "Write content to a file. Creates the file and any parent directories if they don't exist.";
  readonly inputSchema: Tool["inputSchema"] = {
    type: "object",
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
      return `Successfully wrote ${Buffer.byteLength(content)} bytes to ${filePath}`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `Error: ${message}`;
    }
  }
}
