# neonity

**Your AI-powered coding assistant, right in your terminal.**

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

-   **Multi-Provider LLM Support** — Seamlessly integrate with leading LLMs like Anthropic Claude, OpenAI GPT, Google Gemini, and DeepSeek. neonity intelligently detects available API keys and automatically configures providers.
-   **Intelligent Smart Router** — Optimize costs and enhance reliability with an advanced multi-provider router. It leverages cost tiers, keyword-based complexity analysis, circuit breakers, and exponential backoff to intelligently route your queries.
-   **Adaptive REACT Agent Loop** — Experience a robust tool-calling agent loop where the LLM reasons, executes tools, observes results, and iteratively refines its approach to solve complex problems.
-   **Rich Streaming Output** — Enjoy a delightful terminal experience with real-time Markdown rendering, including syntax-highlighted code blocks, rich text formatting (bold, italic, strikethrough), lists, blockquotes, and headings.
-   **Extensible Skill System** — Augment the agent's capabilities with runtime-togglable skill modules. Activate skills like `code-reviewer` or `test-writer` with simple slash commands (`/skill <name>`), and their state persists across sessions.
-   **Persistent Session Management** — Save, load, list, and delete your coding sessions. Pick up exactly where you left off, ensuring continuity and convenience.
-   **Long-term Memory** — Store project knowledge, user preferences, and technical solutions that persist across sessions in `.neonity/memory.md`. The agent can add, search, and retrieve memories to maintain context over time.
-   **Smart Tab Completion** — Boost your productivity with intelligent tab completion for slash commands (`/`) and file paths (triggered by `/` or `~`).
-   **Context Window Management** — Automatically handles long conversations that exceed LLM context limits. Choose between truncation (dropping oldest messages) or summarization (compressing earlier context) to keep your session running smoothly.

## Providers

neonity offers flexible integration with multiple leading LLM providers. Simply set your API keys in `.env`, and neonity will automatically detect and utilize the available providers.

| Provider   | Environment Variable | Default Model                |
|------------|----------------------|------------------------------|
| Anthropic  | `ANTHROPIC_API_KEY`  | `claude-sonnet-4-20250514`   |
| OpenAI     | `OPENAI_API_KEY`     | `gpt-4.1`                    |
| Google     | `GEMINI_API_KEY`     | `gemini-2.5-flash`           |
| DeepSeek   | `DEEPSEEK_API_KEY`   | `deepseek-v4-pro`            |

*Note: DeepSeek also supports `reasoning_content` for its thinking models when configured.*

**Configuration Tip:**

-   Set `DEFAULT_PROVIDER` in your `.env` to specify your preferred LLM. If that provider's API key is not available, neonity intelligently falls back to the next available provider.
-   Override the default model for any provider using `ANTHROPIC_MODEL`, `OPENAI_MODEL`, `GEMINI_MODEL`, or `DEEPSEEK_MODEL`.

## Smart Router

Enable the intelligent router by setting `ROUTER_MODE=true` in your `.env`. The Smart Router dynamically distributes your queries across multiple LLM providers, optimizing for cost, performance, and reliability.

### Cost Tiers

The router categorizes queries into different cost tiers, ensuring the most appropriate (and cost-effective) model is used for each task:

| Tier       | Purpose                               | Typical Use Cases                                      |
|------------|---------------------------------------|--------------------------------------------------------|
| `cheap`    | Simple, low-stakes queries            | "What does `git status` do?", "List files", quick lookups |
| `standard` | Everyday coding tasks                 | Moderate complexity, default for most interactive queries |
| `premium`  | Complex, high-stakes tasks            | Refactoring large codebases, deep debugging, security audits |

### Dynamic Complexity Analysis

The router employs a sophisticated strategy to analyze each query for complexity, ensuring optimal tier selection:

-   **Keyword Heuristics** — Detects specific keywords and phrases (e.g., `refactor`, `debug`, `security`, `performance`, `architecture`, `migrate`, `concurrency`, large code blocks) that signal higher complexity.
-   **Conversation Context** — Multi-turn conversations and prior tool usage automatically escalate the query to a higher-cost tier to maintain context and capability.
-   **Length Thresholds** — Very short, single-message queries are routed to cheaper models, while very long or detailed queries are directed to premium models.

### Robust Resilience Features

neonity's Smart Router is built for reliability and continuous operation:

-   **Circuit Breaker** — Automatically opens a circuit for a provider after a configurable number of consecutive failures (default: 3). This temporarily disables the failing provider for a set cooldown period (default: 30s) and attempts a "half-open" trial after cooldown. This prevents repeated failures and protects your budget.
-   **Exponential Backoff** — Retries within a tier use exponential backoff (starting at 1s, then 2s, 4s, etc.) with random jitter to prevent overwhelming LLM APIs during transient issues.
-   **Cross-Tier Fallback** — If all providers within a specific tier fail, the router intelligently falls back to the next available tier (e.g., `cheap` → `standard` → `premium`), ensuring your query is always attempted.
-   **Intra-Tier Failover** — Supports multiple providers per tier with intelligent round-robin load balancing, distributing requests and providing redundancy.

### Real-time Monitoring

Gain insights into router behavior and costs with these slash commands:

```bash
/router          # Display routing strategy, circuit breaker status, and latency statistics
/router-reset    # Reset all circuit breakers, or specify a provider label (e.g., /router-reset anthropic-cheap)
/cost            # Show cumulative token usage and estimated cost for the current session
```

-   Enable `ROUTER_TRACK_LATENCY=true` in `.env` to record per-provider response times (average, p95, error rate).
-   Enable `ROUTER_TRACK_BUDGET=true` to track cumulative token usage with approximate cost estimation, helping you manage expenses.

### Fine-grained Configuration

Refer to `.env.example` for a comprehensive list of router configuration options, including complexity thresholds, circuit breaker tuning, and latency/budget tracking toggles. This allows you to tailor the router's behavior to your specific needs and budget.

## Context Window Management

As conversations grow, they can exceed the LLM's context window limit. neonity automatically detects this and applies a configurable strategy to keep the conversation within bounds while preserving the most important context.

### Strategies

| Strategy          | Description                                                                 |
|-------------------|-----------------------------------------------------------------------------|
| `truncation`      | **(Default)** Drops the oldest message groups from the front of the conversation, preserving the most recent messages and a configurable number of recent message groups. |
| `summarization`   | Summarizes older conversation segments into a compact `[Context Summary]` message inserted at the front, preserving key decisions, file changes, errors, and task state. Falls back to truncation if the summary call fails. |

### How It Works

1.  **Token Estimation** — Before each LLM call, neonity estimates the total token usage (system prompt + tool definitions + conversation history) using character-based heuristics.
2.  **Budget Check** — A portion of the context window is reserved for output (`CONTEXT_RESERVE_RATIO`, default: 25%). If total tokens exceed the remaining budget, context management is triggered.
3.  **Message Grouping** — Messages are grouped into `(assistant tool_use → user tool_result)` pairs, which are treated as atomic units — they're preserved or dropped together.
4.  **Strategy Execution** — Depending on the configured strategy, neonity either truncates old groups or summarizes them into a compact form.

### Configuration

Refer to `.env.example` for the full list of context management options:

| Variable                     | Description                                                      | Default      |
|------------------------------|------------------------------------------------------------------|--------------|
| `CONTEXT_STRATEGY`           | Strategy to use: `truncation` or `summarization`                 | `truncation` |
| `CONTEXT_RESERVE_RATIO`      | Fraction of the context window reserved for output tokens        | `0.25`       |
| `CONTEXT_PRESERVE_GROUPS`    | Number of recent message groups always preserved                 | `4`          |
| `CONTEXT_WINDOW_SIZE`        | Override the auto-detected context window size (in tokens)       | Auto         |
| `CONTEXT_SUMMARIZATION_MODEL`| Model used for summarization calls (defaults to current provider) | —            |

## Built-in Tools

neonity empowers the AI agent with a core set of command-line tools, enabling it to interact with your environment:

| Tool     | Description                                                                              |
|----------|------------------------------------------------------------------------------------------|
| `bash`   | Execute arbitrary shell commands within a 30-second timeout. Useful for running build tools, tests, or inspecting the system. |
| `read`   | Read the entire content of a specified file. Essential for understanding existing code or logs. |
| `write`  | Create a new file or overwrite an existing one with provided content. Automatically creates parent directories if they don't exist. |
| `edit`   | Perform an exact string replacement within a file. Ensures precise modifications, useful for targeted code changes. |
| `memory` | Store and retrieve persistent long-term memories across sessions. Supports adding, searching, listing, and managing memories by category (project, preference, knowledge, context, pattern). |

## Built-in Skills

Skills are powerful, runtime-togglable modules that enhance the agent's capabilities by augmenting its system prompt. They are off by default, and their state is automatically persisted to `~/.neonity/skills.json`.

```bash
/skills                      # List all available skills and their current status
/skill code-reviewer         # Activate the code reviewer skill
/skill code-reviewer         # Deactivate the code reviewer skill
```

| Skill             | Description                                                  |
|-------------------|--------------------------------------------------------------|
| `code-reviewer`   | Provides systematic code reviews, focusing on bugs, security vulnerabilities, performance optimizations, and adherence to style guides. |
| `test-writer`     | Generates comprehensive unit and integration tests, ensuring proper mocking, test coverage, and adherence to testing best practices. |
| `git-committer`   | Assists in creating conventional commits with semantic messages, appropriate scopes, and adherence to your team's commit guidelines. |
| `doc-writer`      | Generates various forms of technical documentation, including API documentation (e.g., JSDoc/TSDoc with `@param`, `@returns`, `@throws`), README files, and inline code comments. |

## Architecture

neonity's architecture is modular and extensible, designed for clarity and maintainability. Here's a high-level overview of the project structure and data flow:

```
src/
├── index.ts              # Entry point: Orchestrates the core components
├── config.ts             # Manages environment-driven configurations for single and router modes
├── types.ts              # Defines core data structures (ContentBlock, Provider, Tool, etc.)
├── agent/
│   ├── agent.ts          # Implements the REACT agent loop with tool orchestration capabilities
│   ├── system-prompt.ts  # Dynamically constructs the agent's system prompt based on active skills
│   └── context-manager.ts # Manages context window limits with truncation and summarization strategies
├── memory/
│   ├── memory.ts         # Long-term memory system with markdown persistence
│   └── memory-tool.ts   # Memory tool for agent use
├── provider/
│   ├── provider.ts       # Re-exports provider interfaces and types
│   ├── factory.ts        # Handles provider instantiation and router construction
│   ├── router.ts         # Implements the Smart Router logic: tiers, circuit breakers, monitoring
│   ├── anthropic.ts      # Adapter for the Anthropic Messages API
│   ├── openai-provider.ts # Adapter for OpenAI Chat Completions API (including DeepSeek reasoning support)
│   ├── deepseek-provider.ts # Native API adapter for DeepSeek models
│   └── gemini.ts         # Adapter for the Google Gemini API
├── tool/
│   ├── tool.ts           # Tool registry and base tool interface
│   ├── bash-tool.ts      # Executes shell commands securely with timeouts
│   ├── read-tool.ts      # Reads file contents from the filesystem
│   ├── write-tool.ts     # Writes content to files, creating directories as needed
│   └── edit-tool.ts      # Performs precise string replacements within files
├── skill/
│   ├── skill.ts          # Skill interface, registry, and prompt aggregation logic
│   └── builtin/
│       ├── code-reviewer.ts   # Implements the code review skill
│       ├── test-writer.ts     # Implements the test writing skill
│       ├── git-committer.ts   # Implements the git committer skill
│       └── doc-writer.ts      # Implements the documentation writing skill
└── cli/
    ├── repl.ts           # Manages the Readline REPL, slash commands, and tab completion
    ├── stream.ts         # Handles streaming output callbacks for real-time interaction
    ├── display.ts        # Helper functions for displaying content blocks in the terminal
    ├── markdown.ts       # Line-buffered terminal Markdown renderer
    └── session.ts        # Manages session persistence (saving, loading, deleting sessions)
```

### Data Flow: How neonity Processes Your Requests

```mermaid
graph TD
    A[User Input] --> B(REPL);
    B --> C{Agent.run()};
    C --> D{Router.selectTier()};
    D --> E(Provider.chat());
    E --> F[LLM API];
    F -- tool_use response --> G{Tool.execute()};
    G --> H[tool_result];
    H --> C;
    E -. Tool.execute() initiated by LLM .- G;
```

**Explanation:**

1.  **User Input** enters the **REPL** (Readline Evaluate Print Loop).
2.  The **Agent.run()** method initiates the REACT loop. Before each LLM call, the **ContextManager** estimates token usage and may apply truncation or summarization to keep the conversation within the context window limit.
3.  If `ROUTER_MODE` is enabled, the **Router.selectTier()** strategically chooses the optimal LLM provider and model based on query complexity and configured tiers.
4.  The selected **Provider.chat()** method communicates with the external **LLM API**.
5.  If the LLM decides to use a tool, it returns a `tool_use` response.
6.  The **Tool.execute()** function is invoked, running the specified command (e.g., `bash`, `read`).
7.  The **tool_result** is observed by the agent, which then continues its reasoning process, potentially invoking more tools or generating a final response.

### Router Internals: A Deeper Look

```mermaid
graph TD
    A[chat(messages)] --> B{Strategy.selectTier(messages)};
    B --> C{Circuit check};
    C -- skip open-circuit providers --> B;
    C --> D{Round-robin pick within tier};
    D --> E{Provider.chat()};
    E -- success --> F[track latency + budget];
    F --> G[return result];
    E -- fail --> H{Exponential backoff};
    H --> D;
    H -- all fail in tier --> I{Cross-tier fallback};
    I --> B;
    I -- all tiers exhausted --> J[Throw error with failure details];
```

**Explanation:**

1.  A `chat(messages)` request enters the router.
2.  The `Strategy.selectTier()` analyzes the messages to determine the preferred cost tier.
3.  A **Circuit check** ensures that only healthy providers are considered. If a provider's circuit is open (due to recent failures), it's temporarily skipped.
4.  A **Round-robin pick** selects an available provider within the chosen tier.
5.  The selected **Provider.chat()** is called.
6.  **If successful**: Latency and budget are tracked, and the result is returned.
7.  **If failed**: **Exponential backoff** is applied, and another provider within the same tier is attempted.
8.  **If all providers in a tier fail**: **Cross-tier fallback** attempts to route the request to the next available cost tier.
9.  **If all tiers are exhausted**: An error is thrown, providing comprehensive failure details.

### Provider Abstraction: A Unified Interface

All LLM providers in neonity implement a single, consistent `Provider` interface. This interface accepts a unified `Message[]` array (using neonity's internal `ContentBlock` format) and supports optional streaming callbacks. Each provider adapter is responsible for translating between neonity's internal message format and its native API shape.

Crucially, the `ProviderRouter` itself also implements the `Provider` interface. This design allows the core agent to treat the router as just another provider, simplifying the agent's logic and enabling seamless integration of advanced routing capabilities without the agent needing to be aware of the underlying routing complexity.

### Skill Architecture: Enhancing Agent Intelligence

Skills in neonity are primarily implemented as pure system-prompt augmentations. When a skill is toggled on, its predefined `systemPrompt` is dynamically appended to the agent's main system prompt under an `## Active Skill` heading. This allows skills to inject specialized instructions and context directly into the LLM's initial understanding. Optionally, skills can also contribute additional `Tool` instances to the tool registry, expanding the agent's actionable capabilities. The active skill state (which skills are on/off) is persisted to `~/.neonity/skills.json`, ensuring your preferred skills are active across sessions.

## Slash Commands

Interact with neonity using these powerful slash commands, designed for efficiency and control:

| Command                   | Action                                                         |
|---------------------------|----------------------------------------------------------------|
| `/help`                   | Display a list of all available slash commands and their descriptions. |
| `/exit`, `/quit`          | Terminate the neonity application gracefully.                  |
| `/clear`                  | Clear the current conversation history, starting a fresh interaction. |
| `/save <name>`            | Save the current session's conversation history and active skills under a specified name. |
| `/load <name>`            | Load a previously saved session by its name, restoring conversation and skill states. |
| `/sessions`               | List all saved sessions, showing their names and creation times. |
| `/delsession <name>`      | Delete a specific saved session by its name.                   |
| `/skills`                 | Show a list of all built-in skills and their current activation status. |
| `/skill <name>`           | Toggle a named skill on or off. For example, `/skill code-reviewer`. |
| `/memory`                 | List and search stored memories. Use `/memory stats` for statistics. |
| `/router`                 | Display the current status of the Smart Router, including its routing strategy, circuit breaker states, and latency statistics. |
| `/router-reset [provider]`| Reset all circuit breakers, or specify a provider label (e.g., `anthropic-cheap`) to reset only that provider's circuit. |
| `/cost`                   | Show the cumulative token usage and estimated cost for the current session, if `ROUTER_TRACK_BUDGET` is enabled. |

## Configuration (`.env`)

neonity is highly configurable via environment variables, primarily managed through a `.env` file in your project root. Below are the key configuration options:

### Single-Provider Mode Configuration

These variables are used when `ROUTER_MODE` is `false` (the default):

| Variable              | Description                                                  | Default Value                |
|-----------------------|--------------------------------------------------------------|------------------------------|
| `DEFAULT_PROVIDER`    | Specifies your preferred LLM provider (e.g., `anthropic`, `openai`, `gemini`, `deepseek`). neonity will fall back if the key is missing. | `deepseek` |
| `ANTHROPIC_API_KEY`   | Your API key for Anthropic models.                           | —                            |
| `OPENAI_API_KEY`      | Your API key for OpenAI models.                              | —                            |
| `GEMINI_API_KEY`      | Your API key for Google Gemini models.                       | —                            |
| `DEEPSEEK_API_KEY`    | Your API key for DeepSeek models.                            | —                            |
| `DEEPSEEK_BASE_URL`   | Override the base URL for DeepSeek API requests.             | `https://api.deepseek.com`   |
| `ANTHROPIC_MODEL`     | Specify a custom Anthropic model (e.g., `claude-3-opus-20240229`). | (provider default)           |
| `OPENAI_MODEL`        | Specify a custom OpenAI model (e.g., `gpt-4-turbo-2024-04-09`). | (provider default)           |
| `GEMINI_MODEL`        | Specify a custom Google Gemini model (e.g., `gemini-1.5-pro`). | (provider default)           |
| `DEEPSEEK_MODEL`      | Specify a custom DeepSeek model (e.g., `deepseek-v4-32k`). | (provider default)           |

### Smart Router Mode Configuration (`ROUTER_MODE=true`)

Enable these options to activate and fine-tune the intelligent router:

| Variable                    | Description                                                | Default Value |
|-----------------------------|------------------------------------------------------------|---------|
| `ROUTER_MODE`               | Set to `true` to enable the Smart Router.                  | `false` |
| `ROUTER_VERBOSE`            | Set to `true` to log detailed routing decisions and fallback events to stderr. |
| `ROUTER_TRACK_LATENCY`      | Set to `true` to record and display per-provider response times (average, P95 latency, error rate) with `/router`. |
| `ROUTER_TRACK_BUDGET`       | Set to `true` to track cumulative token usage and estimated costs for the session, viewable with `/cost`. |
| `CHEAP_PROVIDER`            | Specifies the provider for the `cheap` tier.               | Auto    |
| `CHEAP_MODEL`               | Specifies the model for the `cheap` tier. Overrides default. |
| `CHEAP_LABEL`               | Custom label for the cheap provider in router output.      | Auto    |
| `STANDARD_PROVIDER`         | Specifies the provider for the `standard` tier.            | Auto    |
| `STANDARD_MODEL`            | Specifies the model for the `standard` tier.               | Auto    |
| `PREMIUM_PROVIDER`          | Specifies the provider for the `premium` tier.             | Auto    |
| `PREMIUM_MODEL`             | Specifies the model for the `premium` tier.                | Auto    |

### Strategy Tuning (Router Mode Only)

These optional variables allow you to fine-tune the router's complexity analysis and resilience:

| Variable                       | Description                                                     | Default   |
|--------------------------------|-----------------------------------------------------------------|-----------|
| `ROUTER_COMPLEXITY_THRESHOLD`  | A score (0–1) indicating the minimum keyword complexity to route a query to the `premium` tier. | `0.5` |
| `ROUTER_COMPLEX_THRESHOLD`     | The total character count threshold for a query to be considered complex enough for the `premium` tier. | `3000` |
| `ROUTER_TURN_THRESHOLD`        | The minimum number of conversational turns required to automatically escalate a query to the `premium` tier. | `5` |
| `ROUTER_CHEAP_CHAR_LIMIT`      | Maximum character count for a query to be short-circuited to the `cheap` tier, bypassing detailed complexity analysis. | `500` |
| `ROUTER_CIRCUIT_THRESHOLD`     | The number of consecutive failures before a provider's circuit breaker opens, temporarily disabling it. | `3` |
| `ROUTER_CIRCUIT_COOLDOWN`      | The cooldown duration (in milliseconds) before a disabled provider is given a "half-open" trial by the circuit breaker. | `30000` |

### Global Settings

These settings apply regardless of single-provider or router mode:

| Variable              | Description                                                  | Default Value          |
|-----------------------|--------------------------------------------------------------|------------------------|
| `MAX_TOKENS`          | The maximum number of output tokens the LLM can generate per turn. | `4096` |
| `MAX_ITERATIONS`      | The maximum number of REACT loop iterations the agent will perform before stopping. | `50` |
| `TEMPERATURE`         | Controls the randomness of the LLM's output (0.0 for deterministic, higher for more creative). Will override provider defaults if set. | (provider default) |
| `WORKING_DIRECTORY`   | Override the agent's default working directory. Defaults to the current process's working directory. | `process.cwd()` |
| `CONTEXT_STRATEGY`    | Context window management strategy: `truncation` or `summarization`. | `truncation` |
| `CONTEXT_RESERVE_RATIO` | Fraction of the context window reserved for output tokens. | `0.25` |
| `CONTEXT_PRESERVE_GROUPS` | Number of recent message groups always preserved during truncation. | `4` |
| `CONTEXT_WINDOW_SIZE` | Override the auto-detected context window size (in tokens). | Auto |
| `CONTEXT_SUMMARIZATION_MODEL` | Model used for summarization calls when using the summarization strategy. | (current provider) |

## License

MIT
