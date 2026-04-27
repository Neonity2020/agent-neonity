import chalk from "chalk";
import type { StreamCallbacks } from "../types.js";
import { MarkdownRenderer } from "./markdown.js";

export function createStreamCallbacks(): StreamCallbacks {
  const renderer = new MarkdownRenderer();
  let hasOutput = false;

  const emitLine = (line: string) => {
    process.stdout.write(line + "\n");
    hasOutput = true;
  };

  return {
    onTextDelta(text: string) {
      // Feed text into the streaming markdown renderer
      renderer.feed(text, emitLine);
    },
    onToolUseStart(_id: string, name: string) {
      // Flush any buffered markdown before tool output
      renderer.flush(emitLine);
      process.stdout.write(chalk.cyan(`\n[${name}] `));
    },
    onToolUseDelta() {
      // Don't stream partial tool arguments for cleanliness
    },
    onComplete() {
      // Flush remaining markdown buffer
      renderer.flush(emitLine);
      if (!hasOutput) {
        process.stdout.write("\n");
      }
      process.stdout.write("\n");
    },
  };
}
