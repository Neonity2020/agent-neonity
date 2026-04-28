import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Tool } from "../types.js";

export class ReadTool implements Tool {
  readonly name = "read";
  readonly description =
    "Read the contents of a file at the given absolute path.";
  readonly inputSchema: Tool["inputSchema"] = {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "The absolute path to the file to read",
      },
    },
    required: ["file_path"],
  };

  async execute(input: Record<string, unknown>): Promise<string> {
    const rawPath = input.file_path;
    if (typeof rawPath !== "string" || !rawPath) return "Error: file_path is required";
    const filePath = resolve(rawPath);
    try {
      return readFileSync(filePath, "utf-8");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `Error: ${message}`;
    }
  }
}
