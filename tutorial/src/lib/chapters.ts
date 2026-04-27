export interface ChapterMeta {
  slug: string;
  title: string;
  description: string;
  order: number;
}

export const chapters: ChapterMeta[] = [
  {
    slug: "01-intro",
    title: "Introduction & Architecture",
    description:
      "What is Neonity? Overview of the multi-provider AI coding agent architecture.",
    order: 1,
  },
  {
    slug: "02-setup",
    title: "Project Setup",
    description:
      "Setting up the TypeScript project, package.json, tsconfig, and environment.",
    order: 2,
  },
  {
    slug: "03-types",
    title: "Core Types & Interfaces",
    description:
      "The provider-agnostic type system: messages, content blocks, providers, tools, and agent config.",
    order: 3,
  },
  {
    slug: "04-config",
    title: "Configuration System",
    description:
      "Loading environment variables, resolving providers, and building the app config.",
    order: 4,
  },
  {
    slug: "05-provider-factory",
    title: "Provider Layer: Interface & Factory",
    description:
      "The Provider interface and factory pattern for multi-provider support.",
    order: 5,
  },
  {
    slug: "06-provider-adapters",
    title: "Provider Layer: Adapters",
    description:
      "Deep dive into Anthropic, OpenAI, Gemini, and DeepSeek provider implementations.",
    order: 6,
  },
  {
    slug: "07-tools",
    title: "Tool System",
    description:
      "Building the bash, read, write, and edit tools with the ToolRegistry.",
    order: 7,
  },
  {
    slug: "08-agent",
    title: "Agent Loop (ReAct Pattern)",
    description:
      "The reasoning + acting loop: how the agent orchestrates tool calls and responses.",
    order: 8,
  },
  {
    slug: "09-cli",
    title: "CLI & REPL",
    description:
      "Building the terminal interface: readline, streaming callbacks, and display.",
    order: 9,
  },
  {
    slug: "10-ux",
    title: "UX Enhancements",
    description:
      "Markdown rendering, session persistence, command history, and tab completion.",
    order: 10,
  },
  {
    slug: "11-skills",
    title: "Skill System",
    description:
      "Runtime-togglable skill modules that augment the agent's system prompt and tool registry.",
    order: 11,
  },
  {
    slug: "12-router",
    title: "Smart Router",
    description:
      "Multi-provider routing with cost tiers, circuit breakers, complexity analysis, and cross-tier fallback.",
    order: 12,
  },
  {
    slug: "13-context",
    title: "Context Window Management",
    description:
      "Handling long conversations with truncation and summarization strategies to stay within LLM context limits.",
    order: 13,
  },
];

export function getChapter(slug: string): ChapterMeta | undefined {
  return chapters.find((c) => c.slug === slug);
}

export function getAdjacentChapters(
  slug: string
): { prev: ChapterMeta | null; next: ChapterMeta | null } {
  const idx = chapters.findIndex((c) => c.slug === slug);
  return {
    prev: idx > 0 ? chapters[idx - 1] : null,
    next: idx < chapters.length - 1 ? chapters[idx + 1] : null,
  };
}
