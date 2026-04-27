import { CodeBlock } from "@/components/code-block";

export default function Chapter() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          The Context Window Problem
        </h2>
        <p className="text-slate-300 leading-relaxed">
          Every LLM has a finite context window — the maximum number of tokens
          it can process in a single request. As conversations grow (especially
          with tool calls that produce large outputs), the history eventually
          exceeds this limit. Without management, the LLM API returns an error
          and the agent fails.
        </p>
        <p className="text-slate-300 leading-relaxed mt-3">
          Neonity&apos;s ContextManager solves this by monitoring token usage and
          applying one of two strategies — truncation or summarization — before
          the limit is reached.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Token Estimation
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          Since we can&apos;t call a tokenizer for every model, Neonity uses
          character-based heuristics. Text is estimated at ~4 chars/token, and
          structured data (JSON) at ~3.5 chars/token.
        </p>
        <CodeBlock
          filename="src/agent/context-manager.ts (estimation)"
          code={`const CHARS_PER_TOKEN = 4;
const STRUCTURED_CHARS_PER_TOKEN = 3.5;
const MESSAGE_OVERHEAD_TOKENS = 4;
const TOOL_PAIR_OVERHEAD_TOKENS = 10;

interface TokenEstimate {
  totalTokens: number;
  systemPromptTokens: number;
  toolDefinitionTokens: number;
  messageTokens: number;
  contextWindow: number;
  reservedForOutput: number;
  isOverBudget: boolean;
}

estimateTokens(
  messages: Message[],
  systemPrompt: string,
  tools: ToolDefinition[],
  model: string,
): TokenEstimate {
  const contextWindow = this.getContextWindowSize(model);
  const reservedForOutput = Math.ceil(
    contextWindow * this.config.reserveRatio
  );
  const systemPromptTokens =
    this.estimateTextTokens(systemPrompt);
  const toolDefinitionTokens =
    this.estimateToolDefTokens(tools);
  const messageTokens = messages.reduce(
    (s, m) => s + this.estimateMessageTokens(m), 0
  );
  const totalTokens =
    systemPromptTokens + toolDefinitionTokens + messageTokens;
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
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Message Grouping
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          Messages are grouped into atomic units: tool-call + tool-result pairs.
          These pairs must be preserved or dropped together — you can&apos;t keep a
          tool result without its call, or vice versa.
        </p>
        <CodeBlock
          filename="src/agent/context-manager.ts (grouping)"
          code={`interface MessageGroup {
  indices: number[];
  tokenCount: number;
}

groupMessages(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];
    const hasToolUse =
      msg.role === "assistant" &&
      msg.content.some((b) => b.type === "tool_use");

    if (hasToolUse && i + 1 < messages.length) {
      const next = messages[i + 1];
      if (next.content.some((b) => b.type === "tool_result")) {
        // Group tool call + result as one unit
        groups.push({
          indices: [i, i + 1],
          tokenCount:
            this.estimateMessageTokens(msg) +
            this.estimateMessageTokens(next),
        });
        i += 2;
        continue;
      }
    }

    // Standalone message
    groups.push({
      indices: [i],
      tokenCount: this.estimateMessageTokens(msg),
    });
    i += 1;
  }

  return groups;
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Strategy 1: Truncation
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          The default strategy. Old message groups are dropped from the front of
          the conversation, preserving the most recent groups and a configurable
          number of recent groups.
        </p>
        <CodeBlock
          filename="src/agent/context-manager.ts (truncation)"
          code={`applyTruncation(
  messages: Message[],
  groups: MessageGroup[],
  targetTokens: number,
): ManagedContext {
  const preserveCount = Math.min(
    this.config.preserveRecentGroups, // default: 4
    groups.length
  );

  // Always keep the most recent N groups
  const recentGroups = groups.slice(-preserveCount);
  const recentTokens = recentGroups.reduce(
    (s, g) => s + g.tokenCount, 0
  );

  const oldGroups = groups.slice(
    0, groups.length - preserveCount
  );
  const availableTokens = targetTokens - recentTokens;

  if (availableTokens <= 0) {
    // Even recent groups don't fit — keep only last group
    const last = groups[groups.length - 1];
    const kept = last.indices.map((idx) => messages[idx]);
    return {
      messages: kept,
      wasManaged: true,
      messagesAffected: messages.length - kept.length,
    };
  }

  // Keep old groups from the front until budget exhausted
  const keptOldIndices: number[] = [];
  let used = 0;
  for (const group of oldGroups) {
    if (used + group.tokenCount > availableTokens) break;
    keptOldIndices.push(...group.indices);
    used += group.tokenCount;
  }

  const allIndices = [
    ...keptOldIndices,
    ...recentGroups.flatMap((g) => g.indices),
  ].sort((a, b) => a - b);

  const kept = allIndices.map((idx) => messages[idx]);
  return {
    messages: kept,
    wasManaged: kept.length < messages.length,
    messagesAffected: messages.length - kept.length,
  };
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Strategy 2: Summarization
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          Instead of dropping old messages, the summarization strategy asks an
          LLM to compress them into a concise summary. This preserves context
          about decisions, errors, and task state while drastically reducing
          token usage.
        </p>
        <CodeBlock
          filename="src/agent/context-manager.ts (summarization)"
          code={`async applySummarization(
  messages: Message[],
  groups: MessageGroup[],
  targetTokens: number,
  estimate: TokenEstimate,
  provider: Provider,
): Promise<ManagedContext> {
  const preserveCount = Math.min(
    this.config.preserveRecentGroups, groups.length
  );
  const recentGroups = groups.slice(-preserveCount);
  const oldGroups = groups.slice(
    0, groups.length - preserveCount
  );

  if (oldGroups.length === 0) {
    // Nothing to summarize, fall back to truncation
    return this.applyTruncation(
      messages, groups, targetTokens, estimate
    );
  }

  // Build transcript of old messages
  const oldMessages = oldGroups.flatMap((g) =>
    g.indices.map((idx) => messages[idx])
  );
  const transcript = oldMessages
    .map((msg) => {
      const parts = msg.content
        .map((b) => {
          switch (b.type) {
            case "text": return b.text;
            case "reasoning": return \`[thinking: \${b.text}]\`;
            case "tool_use":
              return \`[called \${b.name}(\${JSON.stringify(b.input).slice(0, 200)})]\`;
            case "tool_result":
              return \`[result: \${b.content.slice(0, 500)}]\`;
          }
        })
        .join("\\n");
      return \`\${msg.role}: \${parts}\`;
    })
    .join("\\n\\n");

  const summaryPrompt = \`Summarize this conversation concisely.
Preserve:
- Key decisions and their rationale
- Files read, written, or edited (with paths)
- Commands executed and their outcomes
- Errors encountered and resolutions
- The current task state and what remains

Be terse. Omit pleasantries.

Transcript:
\${transcript}\`;

  try {
    const response = await provider.chat(
      [{ role: "user",
         content: [{ type: "text", text: summaryPrompt }] }],
      [], // no tools needed for summarization
    );

    const summaryText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as TextContent).text)
      .join("\\n");

    const summaryMessage: Message = {
      role: "user",
      content: [
        { type: "text",
          text: \`[Context Summary]\\n\${summaryText}\` }
      ],
    };

    const recentMessages = recentGroups
      .flatMap((g) => g.indices)
      .sort((a, b) => a - b)
      .map((idx) => messages[idx]);

    return {
      messages: [summaryMessage, ...recentMessages],
      wasManaged: true,
      messagesAffected: oldMessages.length,
    };
  } catch {
    // Summarization failed — fall back to truncation
    return this.applyTruncation(
      messages, groups, targetTokens, estimate
    );
  }
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Integration in the Agent Loop
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          Context management is called at the start of each REACT loop
          iteration, before the LLM call. If the budget is exceeded, the
          history is modified in-place and the loop continues with the trimmed
          conversation.
        </p>
        <CodeBlock
          filename="src/agent/agent.ts (integration)"
          code={`private async reactLoop(callbacks?: StreamCallbacks) {
  for (let i = 0; i < this.config.maxIterations; i++) {
    const systemPrompt = this.buildEffectivePrompt();
    const allTools = this.skillRegistry.getToolDefinitions(
      this.toolRegistry.getDefinitions()
    );

    // Context window management — runs before every LLM call
    const managed = await this.contextManager.manage(
      this.history,
      systemPrompt,
      allTools,
      this.config.provider.model,
      this.provider, // needed for summarization strategy
    );
    if (managed.wasManaged) {
      this.history = managed.messages;
    }

    const response = await this.provider.chat(
      this.history,
      allTools,
      callbacks,
      systemPrompt
    );
    // ... rest of loop
  }
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Model Context Window Auto-Detection
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          Different models have vastly different context windows (from 128K to
          1M+ tokens). The context manager auto-detects the window size from
          the model name, with fallback defaults:
        </p>
        <CodeBlock
          filename="src/agent/context-manager.ts (window sizes)"
          code={`const MODEL_CONTEXT_WINDOWS = [
  { pattern: "claude-opus-4",  windowSize: 200_000 },
  { pattern: "claude-sonnet-4", windowSize: 200_000 },
  { pattern: "claude-haiku-3-5", windowSize: 200_000 },
  { pattern: "gpt-4.1",        windowSize: 1_047_576 },
  { pattern: "gpt-4o",         windowSize: 128_000 },
  { pattern: "gemini-2.5-pro", windowSize: 1_048_576 },
  { pattern: "gemini-2.5-flash", windowSize: 1_048_576 },
  { pattern: "deepseek-v4-pro", windowSize: 128_000 },
  { pattern: "deepseek-chat",  windowSize: 128_000 },
];

const DEFAULT_CONTEXT_WINDOW = 128_000;

getContextWindowSize(model: string): number {
  if (this.config.contextWindowOverride)
    return this.config.contextWindowOverride;
  const lower = model.toLowerCase();
  for (const { pattern, windowSize } of MODEL_CONTEXT_WINDOWS) {
    if (lower.includes(pattern)) return windowSize;
  }
  return DEFAULT_CONTEXT_WINDOW;
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Strategy Comparison
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Aspect</th>
                <th className="text-left py-2 px-3 text-cyan-400">Truncation</th>
                <th className="text-left py-2 px-3 text-purple-400">Summarization</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              <tr className="border-b border-slate-800/50">
                <td className="py-2 px-3 text-xs">Cost</td>
                <td className="py-2 px-3 text-xs">Free — no extra LLM calls</td>
                <td className="py-2 px-3 text-xs">One extra LLM call per compression</td>
              </tr>
              <tr className="border-b border-slate-800/50">
                <td className="py-2 px-3 text-xs">Context Preservation</td>
                <td className="py-2 px-3 text-xs">Lost — old messages are gone</td>
                <td className="py-2 px-3 text-xs">Partial — key decisions preserved</td>
              </tr>
              <tr className="border-b border-slate-800/50">
                <td className="py-2 px-3 text-xs">Latency</td>
                <td className="py-2 px-3 text-xs">Instant</td>
                <td className="py-2 px-3 text-xs">+1 LLM round-trip latency</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-xs">Fallback</td>
                <td className="py-2 px-3 text-xs">N/A</td>
                <td className="py-2 px-3 text-xs">Falls back to truncation on failure</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
