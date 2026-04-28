import type { ToolDefinition } from "../types.js";

export interface SystemPromptContext {
  workingDirectory: string;
  platform: string;
  tools: ToolDefinition[];
  /** Current provider name (e.g. "anthropic", "openai", "router") */
  providerName?: string;
  /** Current model identifier (e.g. "claude-sonnet-4-20250514") */
  modelName?: string;
  /** Optional prompt augmentation from active skills */
  skillPrompt?: string;
  /** Optional long-term memory to inject */
  memoryPrompt?: string;
  /** Optional personality/instructions from SOUL.md */
  soulPrompt?: string;
}

export function buildSystemPrompt(ctx: SystemPromptContext): string {
  const toolDescriptions = ctx.tools
    .map((t) => `- **${t.name}**: ${t.description}`)
    .join("\n");

  return `You are an AI coding assistant running in a terminal. You help users with software engineering tasks.

## Environment
- Working directory: ${ctx.workingDirectory}
- Platform: ${ctx.platform}
- Provider: ${ctx.providerName ?? "unknown"}${ctx.modelName ? ` | Model: ${ctx.modelName}` : ""}

## Available Tools
${toolDescriptions}
${ctx.skillPrompt ? `\n${ctx.skillPrompt}\n` : ""}
${ctx.memoryPrompt ? `\n${ctx.memoryPrompt}\n` : ""}
${ctx.soulPrompt ? `\n## Agent Personality & Custom Instructions\n${ctx.soulPrompt}\n` : ""}
## Instructions
- Use tools to accomplish tasks. Show your reasoning in text before taking actions.
- Be direct and concise. Avoid unnecessary preamble.
- When editing files, use the edit tool with exact string matching.
- When creating new files, use the write tool.
- If a task is ambiguous, ask the user for clarification.
- Report errors clearly and suggest solutions.`;
}
