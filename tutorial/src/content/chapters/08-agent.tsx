import { CodeBlock } from "@/components/code-block";

export default function Chapter() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          The ReAct Pattern
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          ReAct (Reasoning + Acting) is the core AI agent pattern. The agent
          loops through these steps until the task is complete or the iteration
          limit is hit:
        </p>
        <ol className="space-y-3 text-slate-300 list-decimal list-inside marker:text-cyan-400 ml-2">
          <li>Send conversation history + system prompt + tool definitions to the LLM</li>
          <li>If the LLM returns text → exit loop (task complete)</li>
          <li>If the LLM returns tool calls → execute them</li>
          <li>Feed tool results back into conversation history</li>
          <li>Repeat from step 1</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">Agent Class</h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          The Agent maintains the conversation history, holds references to the
          provider and tool registry, and exposes methods for session management.
        </p>
        <CodeBlock
          filename="src/agent/agent.ts (excerpt)"
          code={`export class Agent {
  private history: Message[] = [];
  private provider: Provider;
  private toolRegistry: ToolRegistry;
  private skillRegistry: SkillRegistry;
  private config: AgentConfig;
  private workingDirectory: string;
  private contextManager: ContextManager;

  constructor(
    config: AgentConfig,
    provider: Provider,
    toolRegistry: ToolRegistry,
    skillRegistry: SkillRegistry,
    workingDirectory: string,
    contextManagerConfig?: Partial<ContextManagerConfig>,
  ) {
    this.config = config;
    this.provider = provider;
    this.toolRegistry = toolRegistry;
    this.skillRegistry = skillRegistry;
    this.workingDirectory = workingDirectory;
    this.contextManager = new ContextManager(
      contextManagerConfig
    );
  }

  /** Get the SkillRegistry (for REPL to manage skills). */
  getSkillRegistry(): SkillRegistry {
    return this.skillRegistry;
  }

  /** Get the Provider (for REPL to inspect router stats). */
  getProvider(): Provider {
    return this.provider;
  }

  /** Get a copy of the conversation history. */
  getHistory(): Message[] {
    return structuredClone(this.history);
  }

  /** Replace the conversation history. */
  loadHistory(messages: Message[]): void {
    this.history = structuredClone(messages);
  }

  /** Clear conversation history. */
  clearHistory(): void {
    this.history = [];
  }

  async run(
    userInput: string,
    callbacks?: StreamCallbacks
  ): Promise<void> {
    this.history.push({
      role: "user",
      content: [{ type: "text", text: userInput }],
    });

    await this.reactLoop(callbacks);
  }

  /** Build the effective system prompt including active skills. */
  private buildEffectivePrompt(): string {
    const allTools = this.skillRegistry.getToolDefinitions(
      this.toolRegistry.getDefinitions()
    );
    const skillPrompt = this.skillRegistry.getActivePrompt();

    return buildSystemPrompt({
      workingDirectory: this.workingDirectory,
      platform: process.platform,
      tools: allTools,
      skillPrompt: skillPrompt || undefined,
    });
  }
}`}
        />
        <p className="text-slate-300 leading-relaxed mt-4">
          Note the use of{" "}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm text-cyan-400">structuredClone</code>{" "}
          for deep cloning the history. This prevents external mutation of the
          agent&apos;s internal state while still allowing session persistence.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">The React Loop</h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          This is the engine. It loops until the LLM says it&apos;s done or we hit
          the max iterations cap.
        </p>
        <CodeBlock
          filename="src/agent/agent.ts (reactLoop)"
          code={`private async reactLoop(
  callbacks?: StreamCallbacks
): Promise<void> {
  for (let i = 0; i < this.config.maxIterations; i++) {
    const systemPrompt = this.buildEffectivePrompt();
    const allTools = this.skillRegistry.getToolDefinitions(
      this.toolRegistry.getDefinitions()
    );

    // Context window management
    const managed = await this.contextManager.manage(
      this.history,
      systemPrompt,
      allTools,
      this.config.provider.model,
      this.provider,
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

    // Append assistant response to history
    this.history.push({
      role: "assistant",
      content: response.content,
    });

    // If the LLM is done (no tool calls), exit
    if (
      response.stopReason === "end_turn" ||
      response.stopReason === "max_tokens"
    ) {
      if (response.stopReason === "max_tokens") {
        callbacks?.onTextDelta?.(
          "\\n[Warning: truncated due to max token limit]"
        );
      }
      return;
    }

    // Execute tool calls
    if (response.stopReason === "tool_use") {
      const toolResults: ToolResultContent[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          callbacks?.onToolUseStart?.(block.id, block.name);

          // Try skill tools first, then base registry
          let result = await this.skillRegistry
            .executeSkillTool(block.name, block.input);
          if (result === null) {
            result = await this.toolRegistry.execute(
              block.name,
              block.input
            );
          }

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      // Append tool results as user message
      this.history.push({
        role: "user",
        content: toolResults,
      });
    }
  }

  callbacks?.onTextDelta?.(
    "\\n[Warning: Reached maximum iteration limit]"
  );
}`}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Three Stop Reasons
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              reason: "end_turn",
              color: "green",
              desc: "The LLM finished its response. Display the output and exit the loop.",
            },
            {
              reason: "tool_use",
              color: "cyan",
              desc: "The LLM requested tool executions. Run them, feed results back, and loop again.",
            },
            {
              reason: "max_tokens",
              color: "yellow",
              desc: "The LLM hit the token limit. Show a warning and exit to prevent infinite loops.",
            },
          ].map((s) => (
            <div
              key={s.reason}
              className="p-4 rounded border border-slate-800 bg-slate-900/50"
            >
              <code className={`text-xs text-${s.color}-400 font-mono`}>
                {s.reason}
              </code>
              <p className="text-sm text-slate-400 mt-2">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Why History = User Messages for Tool Results?
        </h2>
        <p className="text-slate-300 leading-relaxed">
          Notice that tool results are appended with{" "}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm text-cyan-400">role: &quot;user&quot;</code>.
          This follows the LLM API convention where tool results are sent as
          user-role messages. The providers handle the conversion to their
          native format (Anthropic uses{" "}
          <code className="bg-slate-800 px-1 py-0.5 rounded text-xs">tool_result</code>{" "}
          blocks, OpenAI uses{" "}
          <code className="bg-slate-800 px-1 py-0.5 rounded text-xs">role: tool</code>{" "}
          messages). The agent doesn&apos;t need to care about these differences.
        </p>
      </section>
    </div>
  );
}
