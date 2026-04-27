import chalk from "chalk";

/**
 * Minimal streaming markdown renderer for terminal output.
 *
 * Uses a line-buffered state machine that detects:
 * - Fenced code blocks (```)
 * - Tables (| ... |)
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

/** A parsed table cell with alignment info. */
interface TableCell {
  text: string;
  align: "left" | "center" | "right";
}

/** A parsed table row (header, separator, or data). */
interface TableRow {
  cells: TableCell[];
  isSeparator: boolean;
}

interface MarkdownState {
  buffer: string;
  inFence: boolean;
  fenceLang: string;
  fenceContent: string;
  /** Whether we are currently buffering table lines. */
  inTable: boolean;
  /** Raw lines of the current table being buffered. */
  tableLines: string[];
}

export class MarkdownRenderer {
  private state: MarkdownState = {
    buffer: "",
    inFence: false,
    fenceLang: "",
    fenceContent: "",
    inTable: false,
    tableLines: [],
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
    // Flush any buffered table
    if (this.state.inTable) {
      this.flushTable(onLine);
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
      // Flush any buffered table before starting a fence
      if (this.state.inTable) this.flushTable(onLine);
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

    // Table detection (only outside fences)
    if (this.isTableRow(raw)) {
      if (!this.state.inTable) {
        this.state.inTable = true;
        this.state.tableLines = [];
      }
      this.state.tableLines.push(raw);
      return;
    }

    // Non-table line while inTable → flush the table first
    if (this.state.inTable) {
      this.flushTable(onLine);
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

    // Markdown links [text](url) - extract text and append URL as plain text for terminal clickability
    // This allows Cmd+Click to open the URL in the default browser (macOS terminal support)
    result = result.replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      (_m, linkText, url) => {
        // Render as: linkText ↗ https://url.com
        // - linkText is underlined for visual reference
        // - External link indicator (↗) and URL are rendered with blue underline
        // - The URL itself is the clickable part (terminal detects http/https URLs)
        const external = chalk.blue(" ↗");
        const clickableUrl = chalk.blue.underline(url);
        return chalk.underline(linkText) + external + " " + clickableUrl;
      }
    );

    return result;
  }

  // ── Table rendering ─────────────────────────────────────

  /** Check if a line is a markdown table row. */
  private isTableRow(line: string): boolean {
    // Must have at least one | at both start and end
    return /^\s*\|.+\|\s*$/.test(line.trim());
  }

  /** Parse a table row into cells with alignment info. */
  private parseRow(line: string): TableRow {
    const trimmed = line.trim();
    // Remove leading and trailing |
    const inner = trimmed.replace(/^\|/, "").replace(/\|$/, "");
    // Split by | — be careful with \| escaping
    const rawCells = inner.split(/\|/);
    const cells: TableCell[] = [];

    // Check if this is a separator row (e.g. |---|---|)
    const isSeparator = rawCells.every((c) => /^:?-{3,}:?$/.test(c.trim()));

    if (isSeparator) {
      for (const c of rawCells) {
        const s = c.trim();
        const left = s.startsWith(":");
        const right = s.endsWith(":");
        cells.push({
          text: "",
          align: left && right ? "center" : right ? "right" : "left",
        });
      }
    } else {
      for (const c of rawCells) {
        cells.push({ text: c.trim(), align: "left" });
      }
    }

    return { cells, isSeparator };
  }

  /** Render a buffered table and emit lines. */
  private flushTable(onLine: LineHandler): void {
    const rawLines = this.state.tableLines;
    this.state.inTable = false;
    this.state.tableLines = [];

    if (rawLines.length === 0) return;

    // Parse all rows
    const rows = rawLines.map((l) => this.parseRow(l));
    const separators = rows.filter((r) => r.isSeparator);
    const dataRows = rows.filter((r) => !r.isSeparator);

    // Determine header: rows before the first separator
    let headerRows: TableRow[] = [];
    let bodyRows: TableRow[] = dataRows;

    if (separators.length > 0) {
      const firstSepIdx = rows.indexOf(separators[0]);
      headerRows = rows
        .slice(0, firstSepIdx)
        .filter((r) => !r.isSeparator);
      bodyRows = rows
        .slice(firstSepIdx + 1)
        .filter((r) => !r.isSeparator);
    }

    // Merge alignment from separator into header and body cells
    if (separators.length > 0) {
      const sepCells = separators[0].cells;
      const applyAlign = (row: TableRow) => {
        for (let i = 0; i < row.cells.length && i < sepCells.length; i++) {
          row.cells[i].align = sepCells[i].align;
        }
      };
      for (const r of headerRows) applyAlign(r);
      for (const r of bodyRows) applyAlign(r);
    }

    // Calculate column widths
    const allCells = [...headerRows, ...bodyRows].flatMap((r) => r.cells);
    const colCount = Math.max(
      1,
      ...rows.map((r) => r.cells.length)
    );
    const colWidths: number[] = Array(colCount).fill(3); // min width 3

    for (const row of [...headerRows, ...bodyRows]) {
      for (let i = 0; i < row.cells.length; i++) {
        colWidths[i] = Math.max(
          colWidths[i],
          this.stripMarkup(row.cells[i].text).length + 2 // padding
        );
      }
    }

    // Terminal width limit
    const termWidth = process.stdout.columns || 80;
    const totalMin =
      colWidths.reduce((s, w) => s + w, 0) + colCount + 1; // +1 for leading border
    
    // Only scale down if we actually exceed terminal width
    if (totalMin > termWidth && colCount > 1) {
      // Scale down proportionally
      const excess = totalMin - termWidth;
      const reducible = colWidths.filter((w) => w > 5);
      if (reducible.length > 0) {
        const perCol = Math.ceil(excess / reducible.length);
        for (let i = 0; i < colWidths.length; i++) {
          if (colWidths[i] > 5) {
            colWidths[i] = Math.max(5, colWidths[i] - perCol);
          }
        }
      }
    }
    
    // Ensure all widths are positive
    for (let i = 0; i < colWidths.length; i++) {
      colWidths[i] = Math.max(1, colWidths[i]);
    }

    // Render top border
    const topBorder = this.renderBorder(colWidths, "┌", "┬", "┐");
    const sepBorder = this.renderBorder(colWidths, "├", "┼", "┤");
    const botBorder = this.renderBorder(colWidths, "└", "┴", "┘");

    // Emit
    if (headerRows.length > 0 || bodyRows.length > 0) {
      onLine(chalk.dim(topBorder));
    }

    for (const row of headerRows) {
      onLine(this.renderDataRow(colWidths, row, true));
    }
    if (headerRows.length > 0 && bodyRows.length > 0) {
      onLine(chalk.dim(sepBorder));
    }
    for (const row of bodyRows) {
      onLine(this.renderDataRow(colWidths, row, false));
    }
    if (headerRows.length > 0 || bodyRows.length > 0) {
      onLine(chalk.dim(botBorder));
    }
  }

  /** Render a table border line. */
  private renderBorder(
    widths: number[],
    left: string,
    mid: string,
    right: string
  ): string {
    return (
      left +
      widths.map((w) => "─".repeat(w)).join(mid) +
      right
    );
  }

  /** Render a single table data row. */
  private renderDataRow(
    widths: number[],
    row: TableRow,
    isHeader: boolean
  ): string {
    const cells = row.cells;
    const parts: string[] = [];

    for (let i = 0; i < widths.length; i++) {
      const width = widths[i];
      const cell = i < cells.length ? cells[i] : { text: "", align: "left" as const };
      const rawText = this.stripMarkup(cell.text);
      // Ensure padTotal is non-negative to prevent "Invalid count value" in String.repeat
      const padTotal = Math.max(0, width - rawText.length);
      const padLeft =
        cell.align === "center"
          ? Math.floor(padTotal / 2)
          : cell.align === "right"
            ? padTotal
            : 0;
      const padRight = padTotal - padLeft;
      const padded = " ".repeat(padLeft) + rawText + " ".repeat(padRight);

      if (isHeader) {
        parts.push(chalk.bold(padded));
      } else {
        parts.push(padded);
      }
    }

    return chalk.dim("│") + parts.join(chalk.dim("│")) + chalk.dim("│");
  }

  /** Strip markdown formatting to calculate visual width. */
  private stripMarkup(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/_(.+?)_/g, "$1")
      .replace(/`(.+?)`/g, "$1")
      .replace(/~~(.+?)~~/g, "$1");
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
