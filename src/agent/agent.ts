import type {
  AgentConfig,
  Message,
  ModelInfo,
  Provider,
  ProviderConfig,
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
import { ProviderRouter } from "../provider/router.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

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

  /** Get the current model name. */
  getModel(): string {
    return this.provider.model ?? "unknown";
  }

  /** Switch to a different model. Returns true if successful. */
  async switchModel(model: string): Promise<boolean> {
    // Router mode: find which provider offers this model and switch to single-provider
    if (this.provider instanceof ProviderRouter) {
      const found = this.provider.findProviderForModel(model);
      if (!found) return false;
      return this.switchProvider(found.providerType, found.model);
    }

    // Single provider: validate then set
    const available = this.getAvailableModels();
    if (!available.some(m => m.id === model)) return false;

    if (this.provider.setModel) {
      this.provider.setModel(model);
      this.config.provider.model = model;
      return true;
    }
    return false;
  }

  /** Get available models for the current provider. */
  getAvailableModels(): ModelInfo[] {
    if (this.provider.listModels) {
      return this.provider.listModels();
    }
    // Fallback: just return the current model
    return [{ id: this.getModel(), label: this.getModel() }];
  }

  /** Get current provider name. */
  getProviderName(): string {
    return this.provider.name;
  }

  /** Check if router mode is active. */
  isRouterMode(): boolean {
    return this.provider instanceof ProviderRouter;
  }

  /** Switch to a different provider (type + optional model override). */
  async switchProvider(providerType: string, model?: string): Promise<boolean> {
    // Dynamically import to avoid circular deps — factory needs Agent, Agent can't import factory
    const { createProvider } = await import("../provider/factory.js");
    const { getApiKey, DEFAULT_MODELS } = await import("../config.js");

    const validProviders = ["anthropic", "openai", "gemini", "deepseek", "minimax", "glm"];
    if (!validProviders.includes(providerType)) {
      return false;
    }

    const pt = providerType as "anthropic" | "openai" | "gemini" | "deepseek" | "minimax" | "glm";
    const apiKey = getApiKey(pt);
    if (!apiKey) {
      console.error(`No API key found for provider: ${providerType}`);
      return false;
    }

    const finalModel = model ?? DEFAULT_MODELS[pt];

    const providerConfig: ProviderConfig = {
      apiKey,
      model: finalModel,
      maxTokens: parseInt(process.env.MAX_TOKENS ?? "4096", 10),
      temperature: process.env.TEMPERATURE ? parseFloat(process.env.TEMPERATURE) : undefined,
      ...(pt === "deepseek" && { baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com" }),
      ...(pt === "minimax" && { baseURL: process.env.MINIMAX_BASE_URL ?? "https://api.minimaxi.com/anthropic" }),
      ...(pt === "glm" && { baseURL: process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/coding/paas/v4" }),
    };

    const newProvider = createProvider(pt, providerConfig);
    this.provider = newProvider;

    // Also update the stored config so context-manager etc. get the right model
    this.config.provider = providerConfig;

    return true;
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
    
    let soulPrompt = "";
    try {
      const pathsToCheck = [
        path.join(this.workingDirectory, "SOUL.md"),
        path.join(this.workingDirectory, ".neonity", "SOUL.md"),
        path.join(os.homedir(), ".neonity", "SOUL.md")
      ];
      
      for (const p of pathsToCheck) {
        if (fs.existsSync(p)) {
          soulPrompt = fs.readFileSync(p, "utf-8");
          break; // Use the first one found (prioritize local over global)
        }
      }
    } catch (err) {
      console.warn("Failed to read SOUL.md:", err);
    }

    return buildSystemPrompt({
      workingDirectory: this.workingDirectory,
      platform: process.platform,
      tools: allTools,
      providerName: this.provider.name,
      modelName: this.provider.model ?? undefined,
      skillPrompt: skillPrompt || undefined,
      memoryPrompt: memoryPrompt || undefined,
      soulPrompt: soulPrompt || undefined,
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
