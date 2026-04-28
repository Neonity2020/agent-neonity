# neonity

**Your AI-powered coding assistant, right in your terminal.**

[中文文档](README.zh-CN.md)

neonity is a versatile AI agent harness designed to streamline your development workflow. It integrates with multiple large language models (LLMs) and provides a powerful set of tools and skills to help you write, debug, and understand code more efficiently.

**v0.1.0** · Node.js ≥ 20 · TypeScript

## Quick Start

Get started with neonity in a few simple steps:

1.  **Configure Environment**:
    ```bash
    cp .env.example .env
    # Open .env and add your LLM API keys (e.g., ANTHROPIC_API_KEY, OPENAI_API_KEY).
    # Choose your preferred default provider.
    ```
2.  **Install Dependencies**:
    ```bash
    pnpm install
    ```
3.  **Build and Run**:
    ```bash
    pnpm build
    pnpm start
    ```
    Or, for development (no build step required):
    ```bash
    pnpm start:dev
    ```

## Features

neonity comes packed with features to supercharge your coding workflow:

-   **Multi-Provider LLM Support** — Seamlessly integrate with leading LLMs: Anthropic Claude, OpenAI GPT, Google Gemini, DeepSeek, MiniMax, and GLM (Zhipu). neonity intelligently detects available API keys and automatically configures providers.
-   **Interactive Model Switching** — Switch providers and models on the fly with `/model` (interactive menu with arrow-key navigation) or `/model <id>` for direct switching. No restart needed.
-   **Intelligent Smart Router** — Optimize costs and enhance reliability with an advanced multi-provider router. It leverages cost tiers, keyword-based complexity analysis, circuit breakers, and exponential backoff to intelligently route your queries.
-   **Adaptive REACT Agent Loop** — Experience a robust tool-calling agent loop where the LLM reasons, executes tools, observes results, and iteratively refines its approach to solve complex problems.
-   **Rich Streaming Output** — Enjoy a delightful terminal experience with real-time Markdown rendering, including syntax-highlighted code blocks, rich text formatting, lists, blockquotes, and headings.
-   **Extensible Skill System** — Augment the agent's capabilities with runtime-togglable skill modules. Activate skills like `code-reviewer` or `hn-top` with simple slash commands, and their state persists across sessions.
-   **Persistent Session Management** — Save, load, list, and delete your coding sessions. Pick up exactly where you left off.
-   **Long-term Memory** — Store project knowledge, user preferences, and technical solutions that persist across sessions. The agent can add, search, and retrieve memories to maintain context over time.
-   **Smart Tab Completion** — Intelligent tab completion for slash commands (`/`) and file paths (triggered by `/` or `~`).
-   **Context Window Management** — Automatically handles long conversations that exceed LLM context limits with truncation or summarization strategies.
-   **Web Search** — Optional web search tool supporting multiple providers (SerpAPI, Tavily, Exa, DuckDuckGo) for real-time information retrieval.

## Providers

neonity offers flexible integration with multiple leading LLM providers. Simply set your API keys in `.env`, and neonity will automatically detect and utilize the available providers.

| Provider   | Environment Variable | Default Model                |
|------------|----------------------|------------------------------|
| Anthropic  | `ANTHROPIC_API_KEY`  | `claude-sonnet-4-20250514`   |
| OpenAI     | `OPENAI_API_KEY`     | `gpt-4.1`                    |
| Google     | `GEMINI_API_KEY`     | `gemini-2.5-flash`           |
| DeepSeek   | `DEEPSEEK_API_KEY`   | `deepseek-v4-pro`            |
| MiniMax    | `MINIMAX_API_KEY`    | `MiniMax-M2.7`               |
| GLM (Zhipu)| `GLM_API_KEY`        | `GLM-5.1`                    |

**Configuration Tips:**

-   Set `DEFAULT_PROVIDER` in your `.env` to specify your preferred LLM. If that provider's API key is not available, neonity intelligently falls back to the next available provider.
-   Override the default model for any provider using `ANTHROPIC_MODEL`, `OPENAI_MODEL`, `GEMINI_MODEL`, `DEEPSEEK_MODEL`, `MINIMAX_MODEL`, or `GLM_MODEL`.
-   Switch providers and models at runtime with `/model` (interactive) or `/provider <name> [model]` (direct).

## Smart Router

Enable the intelligent router by setting `ROUTER_MODE=true` in your `.env`. The Smart Router dynamically distributes your queries across multiple LLM providers, optimizing for cost, performance, and reliability.

### Cost Tiers

The router categorizes queries into different cost tiers:

| Tier       | Purpose                               | Typical Use Cases                                      |
|------------|---------------------------------------|--------------------------------------------------------|
| `cheap`    | Simple, low-stakes queries            | Quick lookups, single-file reads, short questions       |
| `standard` | Everyday coding tasks                 | Moderate complexity, default for most interactive queries |
| `premium`  | Complex, high-stakes tasks            | Refactoring, deep debugging, security audits, architecture |

### Resilience Features

-   **Circuit Breaker** — Temporarily disables failing providers after consecutive failures, with automatic half-open recovery.
-   **Exponential Backoff** — Retries with increasing delay (1s base, 30s cap) and jitter.
-   **Cross-Tier Fallback** — Falls back through tiers (`cheap` → `standard` → `premium`) when a tier is exhausted.
-   **Real-time Monitoring** — Use `/router`, `/router-reset`, and `/cost` to monitor status and expenses.

### Router Configuration

| Variable                       | Description                                                     | Default   |
|--------------------------------|-----------------------------------------------------------------|-----------|
| `CHEAP_PROVIDER` / `CHEAP_MODEL` | Provider and model for the `cheap` tier                        | —         |
| `STANDARD_PROVIDER` / `STANDARD_MODEL` | Provider and model for the `standard` tier             | —         |
| `PREMIUM_PROVIDER` / `PREMIUM_MODEL` | Provider and model for the `premium` tier                  | —         |
| `ROUTER_COMPLEXITY_THRESHOLD`  | Keyword complexity score (0–1) that triggers premium routing    | `0.5`     |
| `ROUTER_CIRCUIT_THRESHOLD`     | Consecutive failures before circuit opens                        | `3`       |
| `ROUTER_CIRCUIT_COOLDOWN`      | Circuit breaker cooldown in ms                                   | `30000`   |
| `ROUTER_TRACK_LATENCY`         | Track per-provider response times                                | `false`   |
| `ROUTER_TRACK_BUDGET`          | Track cumulative token usage and cost                            | `false`   |

## Context Window Management

As conversations grow, they can exceed the LLM's context window limit. neonity automatically detects this and applies a configurable strategy:

| Strategy          | Description                                                                 |
|-------------------|-----------------------------------------------------------------------------|
| `truncation`      | **(Default)** Drops the oldest message groups, preserving recent context.    |
| `summarization`   | Summarizes older segments into a compact form. Falls back to truncation on failure. |

| Variable                     | Description                                                      | Default      |
|------------------------------|------------------------------------------------------------------|--------------|
| `CONTEXT_STRATEGY`           | Strategy to use: `truncation` or `summarization`                 | `truncation` |
| `CONTEXT_RESERVE_RATIO`      | Fraction of the context window reserved for output tokens        | `0.25`       |
| `CONTEXT_PRESERVE_GROUPS`    | Number of recent message groups always preserved                 | `4`          |
| `CONTEXT_WINDOW_SIZE`        | Override the auto-detected context window size (in tokens)       | Auto         |

## Built-in Tools

| Tool          | Description                                                                              |
|---------------|------------------------------------------------------------------------------------------|
| `bash`        | Execute shell commands within a 30-second timeout.                                       |
| `read`        | Read the entire content of a specified file.                                             |
| `write`       | Create or overwrite a file. Automatically creates parent directories.                    |
| `edit`        | Perform an exact string replacement within a file.                                       |
| `memory`      | Store and retrieve persistent long-term memories across sessions.                         |
| `web-search`  | Search the web via configurable providers (SerpAPI, Tavily, Exa, DuckDuckGo).             |

## Built-in Skills

Skills are runtime-togglable modules that enhance the agent's capabilities. Toggle with `/skill <name>`:

| Skill             | Description                                                  |
|-------------------|--------------------------------------------------------------|
| `code-reviewer`   | Systematic code reviews focusing on bugs, security, and performance. |
| `test-writer`     | Generate unit and integration tests with proper coverage.     |
| `git-committer`   | Create conventional commits with semantic messages.           |
| `git-pusher`      | Automate git push workflows.                                  |
| `doc-writer`      | Generate API documentation, READMEs, and inline comments.     |
| `hn-top`          | Fetch and display top Hacker News stories.                    |

## Slash Commands

| Command                   | Action                                                         |
|---------------------------|----------------------------------------------------------------|
| `/help`                   | Display available slash commands.                              |
| `/exit`, `/quit`          | Terminate neonity.                                             |
| `/clear`                  | Clear conversation history.                                    |
| `/model`                  | Interactive provider + model selection (arrow keys + Enter).   |
| `/model list`             | List available models for the current provider.                |
| `/model <id>`             | Switch to a specific model directly.                           |
| `/provider`               | Interactive provider selection (same as `/model`).             |
| `/provider <name> [model]`| Switch provider directly (e.g., `/provider glm GLM-4.7`).     |
| `/skills`                 | List all skills and their activation status.                   |
| `/skill <name>`           | Toggle a skill on or off.                                      |
| `/memory`                 | List, search, and manage persistent memories.                  |
| `/router`                 | Display router status, circuit breakers, and latency stats.    |
| `/router-reset [provider]`| Reset circuit breakers.                                        |
| `/cost`                   | Show cumulative token usage and estimated cost.                |
| `/context`                | Show context window usage.                                     |
| `/save <name>`            | Save the current session.                                      |
| `/load <name>`            | Load a previously saved session.                               |
| `/sessions`               | List saved sessions.                                           |
| `/delsession <name>`      | Delete a saved session.                                        |

## Architecture

```
src/
├── index.ts              # Entry point
├── config.ts             # Environment-driven configuration (single + router modes)
├── types.ts              # Core types (ContentBlock, Provider, Tool, etc.)
├── agent/
│   ├── agent.ts          # REACT agent loop with tool orchestration
│   ├── system-prompt.ts  # Dynamic system prompt builder
│   └── context-manager.ts # Context window management
├── memory/
│   ├── memory.ts         # Long-term memory with markdown persistence
│   └── memory-tool.ts    # Memory tool for agent use
├── provider/
│   ├── factory.ts        # Provider instantiation and router construction
│   ├── router.ts         # Smart Router: tiers, circuit breakers, monitoring
│   ├── anthropic.ts      # Anthropic Messages API adapter
│   ├── openai-provider.ts # OpenAI Chat Completions adapter
│   ├── gemini.ts         # Google Gemini adapter
│   ├── deepseek-provider.ts # DeepSeek native API adapter (with reasoning_content)
│   ├── minimax.ts        # MiniMax API adapter
│   └── glm-provider.ts   # GLM (Zhipu) API adapter
├── tool/
│   ├── tool.ts           # Tool registry
│   ├── bash-tool.ts      # Shell command execution
│   ├── read-tool.ts      # File reading
│   ├── write-tool.ts     # File writing
│   ├── edit-tool.ts      # String replacement editing
│   ├── web-search-tool.ts # Web search (SerpAPI, Tavily, Exa, DuckDuckGo)
│   └── hn-tool.ts        # Hacker News tool
├── skill/
│   ├── skill.ts          # Skill interface and registry
│   └── builtin/          # Built-in skills
└── cli/
    ├── repl.ts           # Readline REPL, slash commands, interactive menus
    ├── stream.ts         # Streaming output callbacks
    ├── markdown.ts       # Terminal Markdown renderer
    └── session.ts        # Session persistence
```

### Data Flow

1.  **User Input** → REPL → Agent.run()
2.  **ContextManager** estimates tokens, applies truncation/summarization if needed
3.  **Router** (if enabled) selects optimal tier → Provider.chat()
4.  **Provider** communicates with LLM API → returns response
5.  If response contains `tool_use` → Tool.execute() → result fed back to agent
6.  Loop continues until `end_turn` or max iterations

## License

MIT
