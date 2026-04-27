import { CodeBlock } from "@/components/code-block";

export default function Chapter() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-bold text-white mb-3">Overview</h2>
        <p className="text-slate-300 leading-relaxed">
          The UX enhancements make Neonity feel like a polished tool rather than
          a raw script. Four features work together:
        </p>
        <ul className="space-y-2 text-slate-300 mt-3">
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            <span><strong>Markdown rendering</strong> — stream LLM output through a terminal-aware renderer</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            <span><strong>Session persistence</strong> — save and restore conversations</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            <span><strong>Command history</strong> — cross-session REPL history</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            <span><strong>Tab completion</strong> — slash commands and file paths</span>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          1. Streaming Markdown Renderer
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          The renderer uses a line-buffered state machine. It detects fenced
          code blocks, headings, lists, blockquotes, and inline formatting—all
          without buffering the entire response.
        </p>
        <CodeBlock
          filename="src/cli/markdown.ts (excerpt)"
          code={`export class MarkdownRenderer {
  private state = {
    buffer: "",
    inFence: false,
    fenceLang: "",
    fenceContent: "",
  };

  feed(chunk: string, onLine: LineHandler): void {
    this.state.buffer += chunk;
    let newlineIdx: number;
    while ((newlineIdx = this.state.buffer.indexOf("\\n")) !== -1) {
      const line = this.state.buffer.slice(0, newlineIdx);
      this.state.buffer = this.state.buffer.slice(newlineIdx + 1);
      this.processLine(line, onLine);
    }
  }

  private processLine(raw: string, onLine: LineHandler): void {
    const fenceMatch = raw.match(/^(\s*)(\`\`\`)(\\w*)\\s*$/);

    if (fenceMatch && !this.state.inFence) {
      // Opening fence
      this.state.inFence = true;
      this.state.fenceLang = fenceMatch[3] || "";
      const header = this.state.fenceLang
        ? chalk.dim(\`  [\${this.state.fenceLang}]\`)
        : "";
      onLine(chalk.blue("┌─") + header);
      return;
    }

    if (fenceMatch && this.state.inFence) {
      // Closing fence — render accumulated code
      this.state.inFence = false;
      const lines = this.state.fenceContent.split("\\n");
      for (const l of lines) {
        onLine(chalk.blue("│ ") + chalk.dim(l));
      }
      onLine(chalk.blue("└─"));
      return;
    }

    if (this.state.inFence) {
      this.state.fenceContent +=
        (this.state.fenceContent ? "\\n" : "") + raw;
      return;
    }

    onLine(this.renderLine(raw));
  }

  private renderLine(line: string): string {
    // Heading detection
    const h = line.match(/^(#{1,6})\\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = h[2];
      if (level === 1) return chalk.bold.underline(text);
      if (level === 2) return chalk.bold(text);
      return chalk.bold(chalk.dim(text));
    }
    // Blockquote, lists, inline formatting...
    return this.renderInline(line);
  }

  private renderInline(text: string): string {
    // **bold**, \`code\`, *italic*, ~~strikethrough~~
    return text
      .replace(/\\*\\*(.+?)\\*\\*/g, (_, b) => chalk.bold(b))
      .replace(/\`([^\`]+)\`/g, (_, c) =>
        chalk.bgBlack.white(\` \${c} \`))
      .replace(/~~(.+?)~~/g, (_, s) => chalk.strikethrough(s));
  }
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          2. Session Persistence
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          Sessions are stored as JSON files in{" "}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm text-cyan-400">~/.neonity/sessions/</code>.
          Each file contains the session name, timestamps, and the full message
          history.
        </p>
        <CodeBlock
          filename="src/cli/session.ts (excerpt)"
          code={`const NEONITY_DIR = path.join(os.homedir(), ".neonity");
const SESSIONS_DIR = path.join(NEONITY_DIR, "sessions");
const HISTORY_FILE = path.join(NEONITY_DIR, "history");

export function saveSession(
  name: string,
  messages: Message[]
): void {
  const filePath = path.join(SESSIONS_DIR, \`\${name}.json\`);
  const session: Session = {
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages,
  };
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
}

export function loadSession(name: string): Message[] | null {
  const filePath = path.join(SESSIONS_DIR, \`\${name}.json\`);
  if (fs.existsSync(filePath)) {
    const session = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return session.messages;
  }
  return null;
}

export function listSessions(): string[] {
  return fs.readdirSync(SESSIONS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\\.json$/, ""));
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          3. Command History
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          Node&apos;s readline supports history natively. We load the history file on
          startup and save on every new line via the{" "}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm text-cyan-400">history</code>{" "}
          event.
        </p>
        <CodeBlock
          filename="src/cli/session.ts (excerpt)"
          code={`export function loadHistory(): string[] {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return fs.readFileSync(HISTORY_FILE, "utf-8")
        .split("\\n")
        .filter((l) => l.trim().length > 0);
    }
  } catch {}
  return [];
}

export function saveHistory(lines: string[]): void {
  try {
    // Keep last 1000 entries
    const trimmed = lines.slice(-1000);
    fs.writeFileSync(HISTORY_FILE, trimmed.join("\\n") + "\\n");
  } catch {}
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          4. Tab Completion
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          The completer handles two cases: slash commands (like{" "}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm text-cyan-400">/save</code>,
          {" "}<code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm text-cyan-400">/load</code>)
          and file system paths.
        </p>
        <CodeBlock
          filename="src/cli/repl.ts (excerpt)"
          code={`const SLASH_COMMANDS = [
  "/exit", "/quit", "/help", "/clear",
  "/save", "/load", "/sessions", "/delsession",
];

function completer(line: string): [string[], string] {
  // If line starts with /, complete slash commands
  if (line.startsWith("/")) {
    const hits = SLASH_COMMANDS.filter(
      (cmd) => cmd.startsWith(line)
    );
    return [hits.length > 0 ? hits : SLASH_COMMANDS, line];
  }

  // Try file path completion on the last token
  const tokens = line.split(/\\s+/);
  const lastToken = tokens[tokens.length - 1] ?? "";
  if (lastToken.includes("/") || lastToken.includes("~")) {
    return [completePath(lastToken), line];
  }

  return [[], line];
}

function completePath(partial: string): string[] {
  const expanded = partial.startsWith("~")
    ? partial.replace(/^~/, process.env.HOME ?? "/Users")
    : partial;
  const dir = path.dirname(expanded) || ".";
  const base = path.basename(expanded);
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.name.startsWith(base))
    .map((e) =>
      e.isDirectory()
        ? path.join(dir, e.name) + "/"
        : path.join(dir, e.name)
    );
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Putting It All Together
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          These four features combine to create a polished terminal experience:
        </p>
        <ul className="space-y-3 text-slate-400">
          <li className="flex items-start gap-2">
            <span className="text-cyan-400 mt-1">•</span>
            <span>
              Code blocks from the LLM render with proper borders and dimmed
              text
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400 mt-1">•</span>
            <span>
              Sessions can be saved mid-task and resumed later
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400 mt-1">•</span>
            <span>
              Command history persists across restarts
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400 mt-1">•</span>
            <span>
              Tab completion speeds up typing paths and commands
            </span>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          What&apos;s Next?
        </h2>
        <p className="text-slate-300 leading-relaxed">
          You&apos;ve now seen how a production-style AI coding agent is built from
          the ground up. From here, you could extend Neonity with:
        </p>
        <ul className="space-y-2 text-slate-400 mt-3">
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            <span>MCP (Model Context Protocol) support for standardized tool servers</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            <span>Grep/file-search tool for codebase exploration</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            <span>Multi-turn conversation branching</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            <span>GUI mode with Electron or Tauri</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            <span>Git integration for automated commits</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
