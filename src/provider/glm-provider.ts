import type {
  ContentBlock,
  Message,
  ModelInfo,
  Provider,
  ProviderConfig,
  ProviderResponse,
  StreamCallbacks,
  ToolDefinition,
} from "../types.js";

interface ChatMessage {
  role: string;
  content: string | null;
  thinking_content?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

/**
 * Provider for Zhipu AI (GLM) models.
 * Supports GLM-4 and GLM-5 series with OpenAI-compatible API.
 * 
 * Features:
 * - Thinking mode (GLM-4): thinking_content field
 * - Tool calling support
 * - Token usage reporting
 */
export class GLMProvider implements Provider {
  readonly name = "glm";
  private apiKey: string;
  private baseURL: string;
  private _model: string;
  private maxTokens: number;
  private temperature?: number;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL ?? "https://open.bigmodel.cn/api/coding/paas/v4";
    this._model = config.model;
    this.maxTokens = config.maxTokens;
    this.temperature = config.temperature;
  }

  get model(): string {
    return this._model;
  }

  setModel(model: string): void {
    this._model = model;
  }

  listModels(): ModelInfo[] {
    return [
      { id: "GLM-5.1", label: "GLM-5.1", tier: "premium" },
      { id: "GLM-5-Turbo", label: "GLM-5-Turbo", tier: "standard" },
      { id: "GLM-4.7", label: "GLM-4.7", tier: "standard" },
      { id: "GLM-4.5-air", label: "GLM-4.5-Air", tier: "cheap" },
    ];
  }

  async chat(
    messages: Message[],
    tools: ToolDefinition[],
    callbacks?: StreamCallbacks,
    systemPrompt?: string
  ): Promise<ProviderResponse> {
    const sdkMessages = this.convertMessages(messages);

    if (systemPrompt) {
      sdkMessages.unshift({ role: "system", content: systemPrompt });
    }

    const body: Record<string, unknown> = {
      model: this._model,
      max_tokens: this.maxTokens,
      messages: sdkMessages,
      ...(this.temperature !== undefined && { temperature: this.temperature }),
      ...(tools.length > 0 && {
        tools: tools.map((t) => ({
          type: "function" as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: t.inputSchema,
          },
        })),
      }),
    };

    const resp = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`GLM API error (${resp.status}): ${text}`);
    }

    const data = (await resp.json()) as {
      choices: Array<{
        message: {
          role: string;
          content: string | null;
          thinking_content?: string;
          tool_calls?: Array<{
            id: string;
            type: "function";
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason: string;
      }>;
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
      };
    };

    const choice = data.choices?.[0];
    const message = choice?.message;

    if (!message) {
      const response: ProviderResponse = {
        stopReason: "end_turn",
        content: [],
        usage: data.usage && {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
        },
      };
      callbacks?.onComplete?.(response);
      return response;
    }

    const content: ContentBlock[] = [];

    // GLM uses thinking_content instead of reasoning_content
    if (message.thinking_content !== undefined && message.thinking_content !== null) {
      content.push({ type: "reasoning", text: message.thinking_content });
    }

    if (message.content) {
      content.push({ type: "text", text: message.content });
      callbacks?.onTextDelta?.(message.content);
    }

    if (message.tool_calls) {
      for (const tc of message.tool_calls) {
        let parsedInput: Record<string, unknown> = {};
        try {
          parsedInput = JSON.parse(tc.function.arguments);
        } catch {
          parsedInput = { _raw: tc.function.arguments };
        }

        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: parsedInput,
        });

        callbacks?.onToolUseStart?.(tc.id, tc.function.name);
      }
    }

    const hasToolCalls = (message.tool_calls?.length ?? 0) > 0;
    const stopReason = this.mapStopReason(choice.finish_reason, hasToolCalls);

    const response: ProviderResponse = {
      stopReason,
      content,
      usage: data.usage && {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      },
    };
    callbacks?.onComplete?.(response);
    return response;
  }

  private convertMessages(messages: Message[]): ChatMessage[] {
    const result: ChatMessage[] = [];

    for (const msg of messages) {
      const toolResults = msg.content.filter((b) => b.type === "tool_result");
      const textBlocks = msg.content.filter((b) => b.type === "text");
      const toolUseBlocks = msg.content.filter((b) => b.type === "tool_use");
      const reasoningBlocks = msg.content.filter((b) => b.type === "reasoning");

      for (const tr of toolResults) {
        result.push({
          role: "tool",
          tool_call_id: tr.tool_use_id,
          content: tr.content,
        });
      }

      const thinkingText =
        reasoningBlocks.length > 0
          ? reasoningBlocks
              .map((b) => (b as { type: "reasoning"; text: string }).text)
              .join("")
          : undefined;

      if (toolUseBlocks.length > 0) {
        const assistantMsg: ChatMessage = {
          role: "assistant",
          content:
            textBlocks
              .map((b) => (b as { type: "text"; text: string }).text)
              .join("") || null,
          tool_calls: toolUseBlocks.map((b) => {
            const tu = b as {
              type: "tool_use";
              id: string;
              name: string;
              input: Record<string, unknown>;
            };
            return {
              id: tu.id,
              type: "function" as const,
              function: {
                name: tu.name,
                arguments: JSON.stringify(tu.input),
              },
            };
          }),
        };
        if (thinkingText !== undefined) assistantMsg.thinking_content = thinkingText;
        result.push(assistantMsg);
      } else if (
        textBlocks.length > 0 ||
        (msg.role === "assistant" && thinkingText)
      ) {
        const textMsg: ChatMessage = {
          role: msg.role,
          content:
            textBlocks
              .map((b) => (b as { type: "text"; text: string }).text)
              .join("") || null,
        };
        if (msg.role === "assistant" && thinkingText !== undefined) {
          textMsg.thinking_content = thinkingText;
        }
        result.push(textMsg);
      }
    }

    return result;
  }

  private mapStopReason(
    reason: string,
    hasToolCalls: boolean
  ): ProviderResponse["stopReason"] {
    if (reason === "tool_calls" || hasToolCalls) return "tool_use";
    if (reason === "length") return "max_tokens";
    return "end_turn";
  }
}
