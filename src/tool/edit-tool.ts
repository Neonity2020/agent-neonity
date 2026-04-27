import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Tool } from "../types.js";

export class EditTool implements Tool {
  readonly name = "edit";
  readonly description =
    "Perform an exact string replacement in a file. The old_string must match exactly once in the file.";
  readonly inputSchema: Tool["inputSchema"] = {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "The absolute path to the file to edit",
      },
      old_string: {
        type: "string",
        description: "The exact string to find and replace",
      },
      new_string: {
        type: "string",
        description: "The string to replace old_string with",
      },
    },
    required: ["file_path", "old_string", "new_string"],
  };

  async execute(input: Record<string, unknown>): Promise<string> {
    const filePath = resolve(input.file_path as string);
    const oldString = input.old_string as string;
    const newString = input.new_string as string;

    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `Error: ${message}`;
    }

    const count = content.split(oldString).length - 1;
    if (count === 0) {
      return `Error: old_string not found in ${filePath}`;
    }
    if (count > 1) {
      return `Error: old_string appears ${count} times in ${filePath}, expected exactly 1`;
    }

    const newContent = content.replace(oldString, newString);
    writeFileSync(filePath, newContent, "utf-8");
    return `Successfully edited ${filePath}`;
  }
}
