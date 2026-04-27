import chalk from "chalk";
import type { StreamCallbacks } from "../types.js";
import { MarkdownRenderer } from "./markdown.js";

/** Maximum characters to show for a tool result before truncation */
const TOOL_RESULT_PREVIEW = 300;

/** Tool names that typically produce verbose output — show results collapsed */
const VERBOSE_TOOLS = new Set(["bash", "read", "memory"]);

/** Tool names that produce structured data — always show full content */
const STRUCTURED_TOOLS = new Set(["hn-top", "web-search"]);

function truncate(str: string, maxLen: number): string {
  const oneLine = str.replace(/\n/g, " ");
  if (oneLine.length <= maxLen) return oneLine;
  return oneLine.slice(0, maxLen) + "...";
}

function isJson(str: string): boolean {
  const trimmed = str.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

export function createStreamCallbacks(): StreamCallbacks {
  const renderer = new MarkdownRenderer();
  let hasOutput = false;
  let inTool = false;
  let toolResults: string[] = [];

  const emitLine = (line: string) => {
    process.stdout.write(line + "\n");
    hasOutput = true;
  };

  const flushToolResults = () => {
    if (toolResults.length === 0) return;

    // Try to render the first result as markdown (for structured data)
    const first = toolResults[0];
    if (toolResults.length === 1 && !first.includes("\n")) {
      // Single-line result — show inline
      emitLine(chalk.dim("  → " + truncate(first, TOOL_RESULT_PREVIEW)));
    } else if (toolResults.every((r) => !r.includes("\n"))) {
      // Multiple single-line results — show as compact list
      emitLine(chalk.dim("  → " + toolResults.slice(0, 3).join(", ")));
      if (toolResults.length > 3) {
        emitLine(chalk.dim(`    ... +${toolResults.length - 3} more`));
      }
    } else {
      // Multi-line output — render the first few lines as markdown
      const preview = toolResults.slice(0, 10).join("\n");
      const tempRenderer = new MarkdownRenderer();
      const lines: string[] = [];
      tempRenderer.feed(preview, (line) => lines.push(line));
      tempRenderer.flush((line) => lines.push(line));
      emitLine(chalk.dim("  ┌─ output ─┐"));
      for (const line of lines.slice(0, 15)) {
        emitLine(chalk.blue("  │ ") + chalk.dim(line));
      }
      if (lines.length > 15) {
        emitLine(chalk.dim(`  │ ... +${lines.length - 15} lines`));
      }
      emitLine(chalk.dim("  └──────────┘"));
    }

    toolResults = [];
  };

  return {
    onTextDelta(text: string) {
      // Flush any buffered tool results before new text
      if (inTool && toolResults.length > 0) {
        flushToolResults();
        inTool = false;
      }
      // Feed text into the streaming markdown renderer
      renderer.feed(text, emitLine);
    },
    onToolUseStart(_id: string, name: string) {
      // Flush any buffered markdown before tool output
      renderer.flush(emitLine);
      // Flush previous tool results if any
      if (toolResults.length > 0) {
        flushToolResults();
      }
      process.stdout.write(chalk.cyan(`\n⟳ ${name}`));
      inTool = true;
    },
    onToolUseDelta(id: string, partialJson: string) {
      // Don't stream partial tool arguments for cleanliness
      // (kept for interface compatibility)
    },
    onToolResult(id: string, result: string) {
      // Collect tool results to display after the tool name
      toolResults.push(result);
    },
    onComplete() {
      // Flush any remaining tool results
      if (inTool && toolResults.length > 0) {
        flushToolResults();
        inTool = false;
      }
      // Flush remaining markdown buffer
      renderer.flush(emitLine);
      if (!hasOutput) {
        process.stdout.write("\n");
      }
      process.stdout.write("\n");
    },
  };
}
