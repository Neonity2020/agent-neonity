# neonity

A mini Claude Code agent harness — an AI coding assistant that runs in your terminal.

**v0.1.0** · Node.js ≥ 20 · TypeScript

## Quick Start

```bash
cp .env.example .env
# Edit .env — set at least one API key and pick a provider
pnpm install
pnpm build
pnpm start

# Or run directly from source (no build step):
pnpm start:dev
```

## Features

- **Multi-Provider** — Anthropic Claude, OpenAI GPT, Google Gemini, DeepSeek. Auto-detects from available API keys.
- **Smart Router** — Intelligent multi-provider routing with cost tiers, keyword-based complexity analysis, circuit breakers, exponential backoff, and token budget tracking.
- **REACT Agent Loop** — Standard tool-calling loop: the LLM reasons, invokes tools, observes results, and reasons again.
- **Streaming Output** — Markdown rendering in the terminal with syntax-highlighted code blocks, bold, italic, strikethrough, lists, blockquotes, headings, and more.
- **Skill System** — Runtime-togglable capability modules that augment the agent's system prompt. Toggle with `/skill <name>`. State persists across restarts.
- **Session Management** — Save, load, list, and delete named sessions with `/save`, `/load`, `/sessions`, `/delsession`.
- **Tab Completion** — Slash commands (`/`) and file paths (triggered by `/` or `~` in input).

## Providers

| Provider   | Env Variable         | Default Model              |
|-----------|---------------------|----------------------------|
| Anthropic | `ANTHROPIC_API_KEY` | `claude-sonnet-4-20250514` |
| OpenAI    | `OPENAI_API_KEY`    | `gpt-4.1`                  |
| Gemini    | `GEMINI_API_KEY`    | `gemini-2.5-flash`         |
| DeepSeek  | `DEEPSEEK_API_KEY`  | `deepseek-v4-pro`          |

DeepSeek also supports reasoning tokens (`reasoning_content`) for its thinking models.

Set `DEFAULT_PROVIDER` in `.env` to pick your preferred provider. If that one has no key, neonity falls back to the first available.

Override the model with `ANTHROPIC_MODEL`, `OPENAI_MODEL`, `GEMINI_MODEL`, or `DEEPSEEK_MODEL`.

## Smart Router

Enable router mode by setting `ROUTER_MODE=true` in `.env`. The router distributes queries across multiple providers organized in cost tiers:

### Tiers

| Tier       | Purpose | Typical use |
|-----------|---------|-------------|
| `cheap`    | Simple, low-stakes queries | "What does git status do?", "List files" |
| `standard` | Everyday coding tasks | Moderate complexity, default for most queries |
| `premium`  | Complex, high-stakes tasks | Refactoring, debugging, security audits |

### Complexity Analysis

The cost-optimized strategy analyzes each query for complexity signals:

- **Keyword heuristics** — Detects patterns like `refactor`, `debug`, `security`, `performance`, `architecture`, `migrate`, `concurrency`, large code blocks, etc.
- **Conversation context** — Multi-turn conversations and prior tool usage automatically escalate to premium.
- **Length thresholds** — Very short single-message queries route to cheap; very long queries route to premium.

### Resilience Features

- **Circuit Breaker** — After 3 consecutive failures (configurable), a provider is temporarily disabled for 30s. Automatically retries with a half-open trial after the cooldown expires.
- **Exponential Backoff** — Retries within a tier use exponential backoff (1s → 2s → 4s...) with random jitter to avoid thundering herd.
- **Cross-Tier Fallback** — If all providers in one tier fail, the router falls back to the next tier in order (cheap → standard → premium).
- **Intra-Tier Failover** — Multiple providers per tier are supported with round-robin load balancing.

### Monitoring

Use slash commands to inspect router state at runtime:

```
> /router          # Show routing strategy, circuit breakers, latency stats
> /router-reset    # Reset all circuit breakers (or specify a provider label)
> /cost            # Show cumulative token usage and estimated cost
```

Enable `ROUTER_TRACK_LATENCY=true` to record per-provider response times (avg, p95, error rate). Enable `ROUTER_TRACK_BUDGET=true` to track cumulative token usage with approximate cost estimation.

### Configuration

See `.env.example` for all router configuration options including complexity thresholds, circuit breaker tuning, and latency/budget tracking toggles.

## Built-in Tools

| Tool    | Description |
|---------|-------------|
| `bash`  | Execute shell commands with a 30s timeout |
| `read`  | Read file contents |
| `write` | Create or overwrite a file (creates parent dirs) |
| `edit`  | Exact string replacement in a file |

## Built-in Skills

Skills are off by default. Toggle them at runtime — state is persisted to `~/.neonity/skills.json`.

```
> /skills                      # List all skills
> /skill code-reviewer         # Turn on code reviewer
> /skill code-reviewer         # Turn it off again
```

| Skill             | Description |
|-------------------|-------------|
| `code-reviewer`   | Systematic review for bugs, security, performance, and style |
| `test-writer`     | Generate unit/integration tests with proper mocking and coverage |
| `git-committer`   | Create conventional commits with semantic messages and scopes |
| `doc-writer`      | Generate API docs, README files, and inline JSDoc/TSDoc comments |

## Architecture

```
src/
├── index.ts              Entry point — wires everything together
├── config.ts             Env-driven config loading (single + router modes)
├── types.ts              Core type definitions (ContentBlock, Provider, Tool, etc.)
├── agent/
│   ├── agent.ts          REACT loop agent with tool orchestration
│   └── system-prompt.ts  Builds the agent's system prompt
├── provider/
│   ├── provider.ts       Re-exports
│   ├── factory.ts        Provider factory + router builder
│   ├── router.ts         Smart router: tiers, circuit breaker, latency, budget
│   ├── anthropic.ts      Anthropic Messages API adapter
│   ├── openai-provider.ts OpenAI Chat Completions + DeepSeek reasoning
│   ├── deepseek-provider.ts DeepSeek native API adapter
│   └── gemini.ts         Google Gemini adapter
├── tool/
│   ├── tool.ts           Tool registry
│   ├── bash-tool.ts      Shell execution
│   ├── read-tool.ts      File reading
│   ├── write-tool.ts     File writing
│   └── edit-tool.ts      Exact-string file editing
├── skill/
│   ├── skill.ts          Skill interface + registry (toggle, list, prompt aggregation)
│   └── builtin/
│       ├── code-reviewer.ts
│       ├── test-writer.ts
│       ├── git-committer.ts
│       └── doc-writer.ts
└── cli/
    ├── repl.ts           Readline REPL with slash commands & tab completion
    ├── stream.ts         Streaming output callbacks
    ├── display.ts        Content block display helpers
    ├── markdown.ts       Line-buffered terminal markdown renderer
    └── session.ts        Session persistence (~/.neonity/sessions/)
```

### Data Flow

```
User Input → REPL → Agent.run() → Router.selectTier() → Provider.chat() → LLM API
                         ↑              ↑                        ↓
                         |     Tool.execute() ←── tool_use response
                         |         ↓
                         +─── tool_result ←──────────────┘
```

### Router Internals

```
chat(messages) → Strategy.selectTier(messages) → preferred tier
                   ↓
           Circuit check → skip open-circuit providers
                   ↓
           Round-robin pick within tier
                   ↓
           Provider.chat() → success? → track latency + budget → return
                   ↓ fail
           Exponential backoff → try next in tier
                   ↓ all fail
           Cross-tier fallback → next tier
                   ↓ all tiers exhausted
           Throw error with all failure details
```

### Provider Abstraction

All providers implement a single `Provider` interface that accepts a unified `Message[]` array and optional streaming callbacks. Each adapter translates between the internal `ContentBlock` format and the provider's native API shape.

The `ProviderRouter` also implements `Provider`, making it a drop-in replacement for a single provider — the agent doesn't need to know whether it's talking to one model or a routed pool.

### Skill Architecture

Skills are pure system-prompt augmentations. When toggled on, their `systemPrompt` is appended to the agent's main prompt under an `## Active Skill` heading. Skills can optionally contribute additional `Tool` instances through the registry. Active skill state is persisted to `~/.neonity/skills.json`.

## Slash Commands

| Command              | Action |
|---------------------|--------|
| `/help`             | Show help |
| `/exit`, `/quit`    | Exit neonity |
| `/clear`            | Clear conversation history |
| `/save <name>`      | Save current session |
| `/load <name>`      | Load a saved session |
| `/sessions`         | List saved sessions |
| `/delsession <n>`   | Delete a session |
| `/skills`           | List all skills and their status |
| `/skill <name>`     | Toggle a skill on/off |
| `/router`           | Show router status (strategy, circuits, latency, budget) |
| `/router-reset [n]` | Reset circuit breakers (all or specific provider label) |
| `/cost`             | Show cumulative token usage and estimated cost |

## Configuration (`.env`)

### Single-Provider Mode

| Variable              | Description                          | Default                |
|-----------------------|--------------------------------------|------------------------|
| `DEFAULT_PROVIDER`    | Preferred provider                   | `deepseek`             |
| `ANTHROPIC_API_KEY`   | Anthropic API key                    | —                      |
| `OPENAI_API_KEY`      | OpenAI API key                       | —                      |
| `GEMINI_API_KEY`      | Google Gemini API key                | —                      |
| `DEEPSEEK_API_KEY`    | DeepSeek API key                     | —                      |
| `DEEPSEEK_BASE_URL`   | DeepSeek base URL override           | `https://api.deepseek.com` |

### Router Mode (`ROUTER_MODE=true`)

| Variable                    | Description                                | Default |
|-----------------------------|--------------------------------------------|---------|
| `ROUTER_MODE`               | Enable smart router                        | `false` |
| `ROUTER_VERBOSE`            | Log routing decisions to stderr            | `false` |
| `ROUTER_TRACK_LATENCY`      | Record per-provider response times         | `false` |
| `ROUTER_TRACK_BUDGET`       | Track cumulative token usage & cost        | `false` |
| `CHEAP_PROVIDER`            | Provider for cheap tier                    | —       |
| `CHEAP_MODEL`               | Model for cheap tier                       | auto    |
| `CHEAP_LABEL`               | Custom label for cheap provider            | auto    |
| `STANDARD_PROVIDER`         | Provider for standard tier                 | —       |
| `STANDARD_MODEL`            | Model for standard tier                    | auto    |
| `PREMIUM_PROVIDER`          | Provider for premium tier                  | —       |
| `PREMIUM_MODEL`             | Model for premium tier                     | auto    |

### Strategy Tuning (all optional, router mode)

| Variable                       | Description                                     | Default |
|--------------------------------|-------------------------------------------------|---------|
| `ROUTER_COMPLEXITY_THRESHOLD`  | Keyword complexity score (0–1) for premium      | `0.5`   |
| `ROUTER_COMPLEX_THRESHOLD`     | Total char count threshold for premium          | `3000`  |
| `ROUTER_TURN_THRESHOLD`        | Message count threshold for premium             | `5`     |
| `ROUTER_CHEAP_CHAR_LIMIT`      | Max chars for cheap short-circuit               | `500`   |
| `ROUTER_CIRCUIT_THRESHOLD`     | Consecutive failures before circuit opens       | `3`     |
| `ROUTER_CIRCUIT_COOLDOWN`      | Circuit cooldown in ms                          | `30000` |

### Global Settings

| Variable              | Description                          | Default                |
|-----------------------|--------------------------------------|------------------------|
| `MAX_TOKENS`          | Max output tokens per turn           | `4096`                 |
| `MAX_ITERATIONS`      | Max REACT loop iterations            | `50`                   |
| `TEMPERATURE`         | LLM temperature                      | (provider default)     |
| `WORKING_DIRECTORY`   | Working directory override           | `process.cwd()`        |

## License

MIT
