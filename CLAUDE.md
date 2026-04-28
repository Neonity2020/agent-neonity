# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Compile TypeScript → dist/
pnpm dev              # Watch mode compilation
pnpm start            # Run compiled version (node dist/index.js)
pnpm start:dev        # Run from source via tsx (no build needed)
pnpm test             # Run all tests (tsx --test src/**/__tests__/*.test.ts)
```

To run a single test file: `tsx --test src/agent/__tests__/context-manager.test.ts`

## Project Overview

neonity is a terminal-based AI coding assistant (agent harness) written in TypeScript. It supports multiple LLM providers (Anthropic, OpenAI, Gemini, DeepSeek, Minimax, GLM) with an optional smart router that routes queries to cost-appropriate tiers.

## Architecture

**Entry point**: `src/index.ts` — wires up config, provider, tools, skills, memory, agent, and REPL.

**Data flow**: User input → REPL (`src/cli/repl.ts`) → Agent REACT loop (`src/agent/agent.ts`) → Provider.chat() → streaming callbacks → tool execution → loop continues until end_turn.

### Key modules

- **`src/config.ts`** — Environment-driven configuration. `loadConfig()` returns `UnifiedAppConfig` (single-provider or router mode). All provider credentials and settings come from `.env`.
- **`src/types.ts`** — Core types: `Provider`, `Tool`, `Message`, `ContentBlock`, `AgentConfig`. All provider adapters implement the `Provider` interface (`chat()` with streaming callbacks).
- **`src/provider/`** — Provider adapters + router. Each provider (anthropic, openai, gemini, deepseek, minimax, glm) has its own file. `factory.ts` creates providers by type and assembles the `ProviderRouter`. The router (`router.ts`) uses a `CostOptimizedStrategy` with three tiers (cheap/standard/premium), circuit breaker, and cross-tier fallback.
- **`src/agent/`** — Agent loop (`agent.ts`), system prompt builder (`system-prompt.ts`), context window manager (`context-manager.ts`). The agent manages conversation history, tool execution, skill state, and provider switching at runtime.
- **`src/tool/`** — Built-in tools: bash, read, write, edit, web-search, hn. Each implements the `Tool` interface from `types.ts`. Registered in `ToolRegistry`.
- **`src/skill/`** — Runtime-togglable skills that augment the system prompt. Built-in skills in `src/skill/builtin/`: code-reviewer, test-writer, git-committer, doc-writer, hn-top, git-pusher.
- **`src/memory/`** — Persistent memory stored in `~/.neonity/`. `MemoryManager` handles categorized storage; `MemoryTool` exposes it to the agent.
- **`src/cli/`** — Terminal UI: REPL with readline, streaming output, markdown rendering, session save/load, tab completion.

### Provider adapter pattern

Each provider adapter translates between neonity's unified types (`Message`, `ContentBlock`, `ProviderResponse`) and the provider-specific SDK. All adapters support streaming via `StreamCallbacks`. When adding a new provider:

1. Create `src/provider/<name>-provider.ts` implementing the `Provider` interface
2. Add the provider type to `ProviderType` in `src/config.ts`
3. Add API key resolution in `getApiKey()` and default model in `DEFAULT_MODELS`
4. Register in `createProvider()` in `src/provider/factory.ts`

### Context management

When the conversation exceeds the model's context window, `ContextManager` applies either truncation (drop oldest messages) or summarization (compress into a summary). Configured via `CONTEXT_STRATEGY`, `CONTEXT_RESERVE_RATIO`, `CONTEXT_PRESERVE_GROUPS` env vars.

## Configuration

All config is via `.env` (see `.env.example`). Key variables:

- `ROUTER_MODE=true` — enable multi-provider routing
- `DEFAULT_PROVIDER` — single-provider mode provider (default: deepseek)
- `CHEAP_PROVIDER` / `STANDARD_PROVIDER` / `PREMIUM_PROVIDER` — router tier assignments
- `MAX_ITERATIONS` — agent loop limit (default: 50)
- `CONTEXT_STRATEGY` — truncation or summarization

## Testing

Uses Node.js built-in test runner (`node:test` assert) via `tsx`. Tests live in `src/**/__tests__/*.test.ts`. Currently only `context-manager.test.ts` exists.
