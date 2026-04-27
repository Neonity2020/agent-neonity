import chalk from "chalk";
import type { ContentBlock } from "../types.js";

export function displayContentBlocks(blocks: ContentBlock[]): void {
  for (const block of blocks) {
    switch (block.type) {
      case "text":
        process.stdout.write(block.text);
        break;
      case "tool_use":
        process.stdout.write(
          chalk.cyan(`\n[${block.name}]`) +
            chalk.dim(` ${truncate(JSON.stringify(block.input), 100)}\n`)
        );
        break;
      case "tool_result":
        process.stdout.write(
          chalk.dim(`  -> ${truncate(block.content, 200)}\n`)
        );
        break;
    }
  }
}

function truncate(str: string, maxLen: number): string {
  const oneLine = str.replace(/\n/g, "\\n");
  if (oneLine.length <= maxLen) return oneLine;
  return oneLine.slice(0, maxLen) + "...";
}

export function displayError(message: string): void {
  process.stderr.write(chalk.red(`Error: ${message}\n`));
}

export function displayInfo(message: string): void {
  process.stdout.write(chalk.yellow(`${message}\n`));
}
