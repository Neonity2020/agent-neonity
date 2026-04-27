import type {
  AgentConfig,
  Message,
  Provider,
  StreamCallbacks,
  ToolResultContent,
  ToolDefinition,
} from "../types.js";
import { ToolRegistry } from "../tool/tool.js";
import { SkillRegistry } from "../skill/skill.js";
import { buildSystemPrompt } from "./system-prompt.js";
import {
  ContextManager,
  type ContextManagerConfig,
  type TokenEstimate,
} from "./context-manager.js";
import { MemoryManager } from "../memory/memory.js";

export class Agent {
  private history: Message[] = [];
  private provider: Provider;
  private toolRegistry: ToolRegistry;
  private skillRegistry: SkillRegistry;
  private config: AgentConfig;
  private workingDirectory: string;
  private contextManager: ContextManager;
  private memoryManager: MemoryManager | null = null;

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
    this.contextManager = new ContextManager(contextManagerConfig);
    
    // Initialize memory manager if available
    this.initMemory();
  }

  /**
   * Initialize memory system
   */
  private async initMemory(): Promise<void> {
    try {
      this.memoryManager = new MemoryManager(this.workingDirectory);
      await this.memoryManager.initialize();
    } catch (err) {
      console.warn("Failed to initialize memory system:", err);
      this.memoryManager = null;
    }
  }

  /** Get the SkillRegistry (for REPL to manage skills). */
  getSkillRegistry(): SkillRegistry {
    return this.skillRegistry;
  }

  /** Get the Provider (for REPL to inspect router stats). */
  getProvider(): Provider {
    return this.provider;
  }

  /** Get the MemoryManager (for REPL to manage memories). */
  getMemoryManager(): MemoryManager | null {
    return this.memoryManager;
  }

  /** Get a copy of the conversation history (for session persistence). */
  getHistory(): Message[] {
    return structuredClone(this.history);
  }

  /** Replace the conversation history (for session restore). */
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

  /** Build the effective system prompt including active skills and memories. */
  private buildEffectivePrompt(): string {
    const allTools = this.skillRegistry.getToolDefinitions(
      this.toolRegistry.getDefinitions()
    );
    const skillPrompt = this.skillRegistry.getActivePrompt();
    const memoryPrompt = this.memoryManager?.getForSystemPrompt() || "";

    return buildSystemPrompt({
      workingDirectory: this.workingDirectory,
      platform: process.platform,
      tools: allTools,
      skillPrompt: skillPrompt || undefined,
      memoryPrompt: memoryPrompt || undefined,
    });
  }

  /** Get current context window token estimate. */
  getContextStatus(systemPrompt?: string, tools?: ToolDefinition[]): TokenEstimate {
    const sp = systemPrompt ?? this.buildEffectivePrompt();
    const t = tools ?? this.skillRegistry.getToolDefinitions(this.toolRegistry.getDefinitions());
    return this.contextManager.estimateTokens(this.history, sp, t, this.config.provider.model);
  }

  private async reactLoop(callbacks?: StreamCallbacks): Promise<void> {
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
      this.history.push({ role: "assistant", content: response.content });

      // Report token usage if available
      if (response.usage) {
        callbacks?.onTokenUsage?.(response.usage);
      }

      // If the LLM is done (no tool calls), exit the loop
      if (
        response.stopReason === "end_turn" ||
        response.stopReason === "max_tokens"
      ) {
        if (response.stopReason === "max_tokens") {
          callbacks?.onTextDelta?.(
            "\n[Warning: Response truncated due to max token limit]"
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
            let result = await this.skillRegistry.executeSkillTool(
              block.name,
              block.input
            );
            if (result === null) {
              result = await this.toolRegistry.execute(
                block.name,
                block.input
              );
            }

            // Notify stream callbacks of tool result for rich display
            callbacks?.onToolResult?.(block.id, result);

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
            });
          }
        }

        // Append tool results as user message
        this.history.push({ role: "user", content: toolResults });
      }
    }

    callbacks?.onTextDelta?.(
      "\n[Warning: Reached maximum iteration limit]"
    );
  }
}
