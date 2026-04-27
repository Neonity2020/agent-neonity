import type { Message, ContentBlock, ToolDefinition, Provider } from "../types.js";

// ── Model context window sizes ───────────────────────────────

const MODEL_CONTEXT_WINDOWS: readonly { pattern: string; windowSize: number }[] = [
  { pattern: "claude-opus-4", windowSize: 200_000 },
  { pattern: "claude-sonnet-4", windowSize: 200_000 },
  { pattern: "claude-haiku-3-5", windowSize: 200_000 },
  { pattern: "gpt-4.1", windowSize: 1_047_576 },
  { pattern: "gpt-4o", windowSize: 128_000 },
  { pattern: "gemini-2.5-pro", windowSize: 1_048_576 },
  { pattern: "gemini-2.5-flash", windowSize: 1_048_576 },
  { pattern: "deepseek-v4-pro", windowSize: 128_000 },
  { pattern: "deepseek-chat", windowSize: 128_000 },
  { pattern: "glm-5", windowSize: 256_000 },
  { pattern: "glm-4", windowSize: 128_000 },
  { pattern: "glm-5-0514", windowSize: 256_000 },
];

const DEFAULT_CONTEXT_WINDOW = 128_000;

// ── Strategy ─────────────────────────────────────────────────

export type ContextStrategy = "truncation" | "summarization";

// ── Configuration ────────────────────────────────────────────

export interface ContextManagerConfig {
  strategy: ContextStrategy;
  reserveRatio: number;
  preserveRecentGroups: number;
  summarizationModel?: string;
  contextWindowOverride?: number;
}

// ── Token estimate result ────────────────────────────────────

export interface TokenEstimate {
  totalTokens: number;
  systemPromptTokens: number;
  toolDefinitionTokens: number;
  messageTokens: number;
  contextWindow: number;
  reservedForOutput: number;
  isOverBudget: boolean;
}

// ── Context management result ────────────────────────────────

export interface ManagedContext {
  messages: Message[];
  wasManaged: boolean;
  messagesAffected: number;
  estimate: TokenEstimate;
}

// ── Internal: message group ──────────────────────────────────

interface MessageGroup {
  indices: number[];
  tokenCount: number;
}

// ── Constants ────────────────────────────────────────────────

const CHARS_PER_TOKEN = 4;
const STRUCTURED_CHARS_PER_TOKEN = 3.5;
const MESSAGE_OVERHEAD_TOKENS = 4;
const TOOL_PAIR_OVERHEAD_TOKENS = 10;

// ── ContextManager ───────────────────────────────────────────

export class ContextManager {
  private config: ContextManagerConfig;

  constructor(config?: Partial<ContextManagerConfig>) {
    this.config = {
      strategy: config?.strategy ?? "truncation",
      reserveRatio: config?.reserveRatio ?? 0.25,
      preserveRecentGroups: config?.preserveRecentGroups ?? 4,
      summarizationModel: config?.summarizationModel,
      contextWindowOverride: config?.contextWindowOverride,
    };
  }

  getContextWindowSize(model: string): number {
    if (this.config.contextWindowOverride) return this.config.contextWindowOverride;
    const lower = model.toLowerCase();
    for (const { pattern, windowSize } of MODEL_CONTEXT_WINDOWS) {
      if (lower.includes(pattern)) return windowSize;
    }
    return DEFAULT_CONTEXT_WINDOW;
  }

  estimateTokens(
    messages: Message[],
    systemPrompt: string,
    tools: ToolDefinition[],
    model: string,
  ): TokenEstimate {
    const contextWindow = this.getContextWindowSize(model);
    const reservedForOutput = Math.ceil(contextWindow * this.config.reserveRatio);
    const systemPromptTokens = this.estimateTextTokens(systemPrompt);
    const toolDefinitionTokens = this.estimateToolDefTokens(tools);
    const messageTokens = messages.reduce((s, m) => s + this.estimateMessageTokens(m), 0);
    const totalTokens = systemPromptTokens + toolDefinitionTokens + messageTokens;
    const budget = contextWindow - reservedForOutput;

    return {
      totalTokens,
      systemPromptTokens,
      toolDefinitionTokens,
      messageTokens,
      contextWindow,
      reservedForOutput,
      isOverBudget: totalTokens > budget,
    };
  }

  async manage(
    messages: Message[],
    systemPrompt: string,
    tools: ToolDefinition[],
    model: string,
    provider?: Provider,
  ): Promise<ManagedContext> {
    const estimate = this.estimateTokens(messages, systemPrompt, tools, model);

    if (!estimate.isOverBudget) {
      return { messages, wasManaged: false, messagesAffected: 0, estimate };
    }

    const groups = this.groupMessages(messages);
    const budget = estimate.contextWindow - estimate.reservedForOutput;
    const targetTokens = budget - estimate.systemPromptTokens - estimate.toolDefinitionTokens;

    if (this.config.strategy === "summarization" && provider) {
      return this.applySummarization(messages, groups, targetTokens, estimate, provider);
    }

    return this.applyTruncation(messages, groups, targetTokens, estimate);
  }

  // ── Private: token estimation ──────────────────────────────

  private estimateTextTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  private estimateToolDefTokens(tools: ToolDefinition[]): number {
    if (tools.length === 0) return 0;
    return Math.ceil(JSON.stringify(tools).length / STRUCTURED_CHARS_PER_TOKEN);
  }

  private estimateBlockTokens(block: ContentBlock): number {
    switch (block.type) {
      case "text":
      case "reasoning":
        return Math.ceil((block.text?.length ?? 0) / CHARS_PER_TOKEN);
      case "tool_use":
        return (
          Math.ceil(
            ((block.name?.length ?? 0) + JSON.stringify(block.input ?? {}).length) /
            STRUCTURED_CHARS_PER_TOKEN,
          ) + TOOL_PAIR_OVERHEAD_TOKENS
        );
      case "tool_result":
        return Math.ceil((block.content?.length ?? 0) / CHARS_PER_TOKEN) + TOOL_PAIR_OVERHEAD_TOKENS;
    }
  }

  private estimateMessageTokens(msg: Message): number {
    let tokens = MESSAGE_OVERHEAD_TOKENS;
    for (const block of msg.content) {
      tokens += this.estimateBlockTokens(block);
    }
    return tokens;
  }

  // ── Private: message grouping ──────────────────────────────

  private groupMessages(messages: Message[]): MessageGroup[] {
    const groups: MessageGroup[] = [];
    let i = 0;

    while (i < messages.length) {
      const msg = messages[i];
      const hasToolUse = msg.role === "assistant" && msg.content.some((b) => b.type === "tool_use");

      if (hasToolUse && i + 1 < messages.length) {
        const next = messages[i + 1];
        if (next.content.some((b) => b.type === "tool_result")) {
          groups.push({
            indices: [i, i + 1],
            tokenCount: this.estimateMessageTokens(msg) + this.estimateMessageTokens(next),
          });
          i += 2;
          continue;
        }
      }

      groups.push({
        indices: [i],
        tokenCount: this.estimateMessageTokens(msg),
      });
      i += 1;
    }

    return groups;
  }

  // ── Private: truncation ────────────────────────────────────

  private applyTruncation(
    messages: Message[],
    groups: MessageGroup[],
    targetTokens: number,
    estimate: TokenEstimate,
  ): ManagedContext {
    const preserveCount = Math.min(this.config.preserveRecentGroups, groups.length);
    const recentGroups = groups.slice(-preserveCount);
    const recentTokens = recentGroups.reduce((s, g) => s + g.tokenCount, 0);

    const oldGroups = groups.slice(0, groups.length - preserveCount);
    const availableTokens = targetTokens - recentTokens;

    if (availableTokens <= 0) {
      // Even dropping all old groups, recent ones don't fit — keep only last group
      const last = groups[groups.length - 1];
      const kept = last.indices.map((idx) => messages[idx]);
      const newEstimate = this.estimateTokens(kept, "", [], estimate.contextWindow.toString());
      return { messages: kept, wasManaged: true, messagesAffected: messages.length - kept.length, estimate: newEstimate };
    }

    // Keep old groups from the front until budget exhausted
    const keptOldIndices: number[] = [];
    let used = 0;
    for (const group of oldGroups) {
      if (used + group.tokenCount > availableTokens) break;
      keptOldIndices.push(...group.indices);
      used += group.tokenCount;
    }

    const allIndices = [...keptOldIndices, ...recentGroups.flatMap((g) => g.indices)].sort(
      (a, b) => a - b,
    );
    const kept = allIndices.map((idx) => messages[idx]);
    const droppedCount = messages.length - kept.length;
    const newEstimate = this.estimateTokens(kept, "", [], estimate.contextWindow.toString());

    return { messages: kept, wasManaged: droppedCount > 0, messagesAffected: droppedCount, estimate: newEstimate };
  }

  // ── Private: summarization ─────────────────────────────────

  private async applySummarization(
    messages: Message[],
    groups: MessageGroup[],
    targetTokens: number,
    estimate: TokenEstimate,
    provider: Provider,
  ): Promise<ManagedContext> {
    const preserveCount = Math.min(this.config.preserveRecentGroups, groups.length);
    const recentGroups = groups.slice(-preserveCount);
    const oldGroups = groups.slice(0, groups.length - preserveCount);

    if (oldGroups.length === 0) {
      return this.applyTruncation(messages, groups, targetTokens, estimate);
    }

    // Build transcript of old messages
    const oldMessages = oldGroups.flatMap((g) => g.indices.map((idx) => messages[idx]));
    const transcript = oldMessages
      .map((msg) => {
        const parts = msg.content
          .map((b) => {
            switch (b.type) {
              case "text":
                return b.text;
              case "reasoning":
                return `[thinking: ${b.text}]`;
              case "tool_use":
                return `[called ${b.name}(${JSON.stringify(b.input).slice(0, 200)})]`;
              case "tool_result":
                return `[result: ${b.content.slice(0, 500)}]`;
            }
          })
          .join("\n");
        return `${msg.role}: ${parts}`;
      })
      .join("\n\n");

    const summaryPrompt = `Summarize the following conversation into a concise summary. Preserve:
- Key decisions and their rationale
- Files read, written, or edited (with paths)
- Commands executed and their outcomes
- Errors encountered and resolutions
- The current task state and what remains

Be terse. Omit pleasantries.

Transcript:
${transcript}`;

    try {
      const response = await provider.chat(
        [{ role: "user", content: [{ type: "text", text: summaryPrompt }] }],
        [],
        undefined,
        undefined,
      );

      const summaryText = response.content
        .filter((b): b is { type: "text"; text: string } => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      const summaryMessage: Message = {
        role: "user",
        content: [{ type: "text", text: `[Context Summary]\n${summaryText}` }],
      };

      const recentMessages = recentGroups
        .flatMap((g) => g.indices)
        .sort((a, b) => a - b)
        .map((idx) => messages[idx]);

      const managed = [summaryMessage, ...recentMessages];
      const newEstimate = this.estimateTokens(managed, "", [], estimate.contextWindow.toString());

      return { messages: managed, wasManaged: true, messagesAffected: oldMessages.length, estimate: newEstimate };
    } catch {
      // Summarization failed — fall back to truncation
      return this.applyTruncation(messages, groups, targetTokens, estimate);
    }
  }
}
