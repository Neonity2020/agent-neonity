import chalk from "chalk";

/**
 * Minimal streaming markdown renderer for terminal output.
 *
 * Uses a line-buffered state machine that detects:
 * - Fenced code blocks (```)
 * - Inline code (`...`)
 * - Bold (**...**)
 * - Headers (# ...)
 * - Unordered lists (- ... or * ...)
 * - Blockquotes (> ...)
 * - Horizontal rules (---, ***)
 *
 * Call feed() with incoming text, and it calls onLine for each
 * completed output line.  Call flush() when the stream ends.
 */

type LineHandler = (line: string) => void;

interface MarkdownState {
  buffer: string;
  inFence: boolean;
  fenceLang: string;
  fenceContent: string;
}

export class MarkdownRenderer {
  private state: MarkdownState = {
    buffer: "",
    inFence: false,
    fenceLang: "",
    fenceContent: "",
  };

  /**
   * Feed a chunk of text.  Complete lines are emitted via onLine.
   */
  feed(chunk: string, onLine: LineHandler): void {
    this.state.buffer += chunk;

    // Process complete lines
    let newlineIdx: number;
    while ((newlineIdx = this.state.buffer.indexOf("\n")) !== -1) {
      const line = this.state.buffer.slice(0, newlineIdx);
      this.state.buffer = this.state.buffer.slice(newlineIdx + 1);
      this.processLine(line, onLine);
    }
  }

  /**
   * Flush any remaining buffered content.
   */
  flush(onLine: LineHandler): void {
    if (this.state.inFence) {
      // Unclosed fence — render as code
      onLine(chalk.blue("│ ") + this.state.fenceContent);
      this.state.fenceContent = "";
      this.state.inFence = false;
    }
    if (this.state.buffer.length > 0) {
      this.processLine(this.state.buffer, onLine);
      this.state.buffer = "";
    }
  }

  private processLine(raw: string, onLine: LineHandler): void {
    // Fenced code block
    const fenceMatch = raw.match(/^(\s*)(```)(\w*)\s*$/);
    if (fenceMatch && !this.state.inFence) {
      // Opening fence
      this.state.inFence = true;
      this.state.fenceLang = fenceMatch[3] || "";
      this.state.fenceContent = "";
      const header = this.state.fenceLang
        ? chalk.dim(`  [${this.state.fenceLang}]`)
        : "";
      onLine(chalk.blue("┌─") + header);
      return;
    }

    if (fenceMatch && this.state.inFence) {
      // Closing fence
      this.state.inFence = false;
      // Render accumulated code
      const lines = this.state.fenceContent.split("\n");
      for (const l of lines) {
        onLine(chalk.blue("│ ") + chalk.dim(l));
      }
      onLine(chalk.blue("└─"));
      this.state.fenceContent = "";
      return;
    }

    if (this.state.inFence) {
      // Inside a code block — accumulate
      this.state.fenceContent +=
        (this.state.fenceContent ? "\n" : "") + raw;
      return;
    }

    // Not in a fence — render the line
    onLine(this.renderLine(raw));
  }

  private renderLine(line: string): string {
    // Horizontal rule
    if (/^\s*[-*]{3,}\s*$/.test(line)) {
      return chalk.dim("─".repeat(process.stdout.columns || 80));
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      if (level === 1) return chalk.bold.underline(text);
      if (level === 2) return chalk.bold(text);
      return chalk.bold(chalk.dim(text));
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const quoteText = line.replace(/^>\s?/, "");
      return chalk.dim("│ ") + chalk.italic(quoteText);
    }

    // Unordered list
    const listMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (listMatch) {
      const indent = listMatch[1];
      const text = listMatch[2];
      return indent + chalk.cyan("•") + " " + this.renderInline(text);
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (olMatch) {
      const indent = olMatch[1];
      const text = olMatch[2];
      return indent + chalk.cyan("○") + " " + this.renderInline(text);
    }

    // Default — render inline markup
    return this.renderInline(line);
  }

  private renderInline(text: string): string {
    // Bold **text** or __text__
    let result = text.replace(
      /\*\*(.+?)\*\*|__(.+?)__/g,
      (_m, b1, b2) => chalk.bold(b1 ?? b2)
    );

    // Italic *text* or _text_ (but not part of **)
    result = result.replace(
      /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g,
      (_m, i1) => chalk.italic(i1)
    );
    result = result.replace(
      /(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g,
      (_m, i1) => chalk.italic(i1)
    );

    // Inline code `text`
    result = result.replace(
      /`([^`]+)`/g,
      (_m, code) => chalk.bgBlack.white(` ${code} `)
    );

    // Strikethrough ~~text~~
    result = result.replace(
      /~~(.+?)~~/g,
      (_m, s) => chalk.strikethrough(s)
    );

    return result;
  }
}

/**
 * Convenience: render a complete markdown string to terminal.
 */
export function renderMarkdown(md: string): string {
  const renderer = new MarkdownRenderer();
  const lines: string[] = [];
  renderer.feed(md, (line) => lines.push(line));
  renderer.flush((line) => lines.push(line));
  return lines.join("\n");
}
