import OpenAI from "openai";
import type {
  ContentBlock,
  Message,
  Provider,
  ProviderConfig,
  ProviderResponse,
  StreamCallbacks,
  ToolDefinition,
} from "../types.js";

export class OpenAIProvider implements Provider {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;
  private maxTokens: number;
  private temperature?: number;

  constructor(config: ProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      ...(config.baseURL && { baseURL: config.baseURL }),
    });
    this.model = config.model;
    this.maxTokens = config.maxTokens;
    this.temperature = config.temperature;
  }

  async chat(
    messages: Message[],
    tools: ToolDefinition[],
    callbacks?: StreamCallbacks,
    systemPrompt?: string
  ): Promise<ProviderResponse> {
    const sdkMessages = this.convertMessages(messages);

    // Insert system prompt as the first message
    if (systemPrompt) {
      sdkMessages.unshift({
        role: "system" as const,
        content: systemPrompt,
      } as OpenAI.ChatCompletionSystemMessageParam);
    }

    const params: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model: this.model,
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

    const completion = await this.client.chat.completions.create(params);

    const choice = completion.choices?.[0];
    const message = choice?.message;
    if (!message) {
      const response: ProviderResponse = {
        stopReason: "end_turn",
        content: [],
      };
      callbacks?.onComplete?.(response);
      return response;
    }

    // Extract reasoning_content (DeepSeek thinking mode)
    const rawMessage = message as unknown as Record<string, unknown>;
    const reasoningContent = typeof rawMessage.reasoning_content === "string"
      ? rawMessage.reasoning_content
      : undefined;

    // Build response content blocks
    const content: ContentBlock[] = [];

    if (reasoningContent) {
      content.push({ type: "reasoning", text: reasoningContent });
    }

    if (message.content) {
      content.push({ type: "text", text: message.content });
      callbacks?.onTextDelta?.(message.content);
    }

    if (message.tool_calls) {
      for (const tc of message.tool_calls) {
        if (tc.type !== "function") continue;
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
    const stopReason = this.mapStopReason(
      choice.finish_reason ?? null,
      hasToolCalls
    );

    const response: ProviderResponse = { stopReason, content };
    callbacks?.onComplete?.(response);
    return response;
  }

  private convertMessages(
    messages: Message[]
  ): OpenAI.ChatCompletionMessageParam[] {
    const result: OpenAI.ChatCompletionMessageParam[] = [];

    for (const msg of messages) {
      const toolResults = msg.content.filter(
        (b) => b.type === "tool_result"
      );
      const textBlocks = msg.content.filter((b) => b.type === "text");
      const toolUseBlocks = msg.content.filter(
        (b) => b.type === "tool_use"
      );
      const reasoningBlocks = msg.content.filter(
        (b) => b.type === "reasoning"
      );

      // Tool results -> tool messages
      for (const tr of toolResults) {
        result.push({
          role: "tool",
          tool_call_id: tr.tool_use_id,
          content: tr.content,
        });
      }

      const reasoningText = reasoningBlocks.length > 0
        ? reasoningBlocks
            .map((b) => (b as { type: "reasoning"; text: string }).text)
            .join("")
        : undefined;

      // Assistant message with tool calls
      if (toolUseBlocks.length > 0) {
        const assistantMsg: Record<string, unknown> = {
          role: "assistant",
          content: textBlocks.map((b) => (b as { type: "text"; text: string }).text).join("") || null,
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
        if (reasoningText) assistantMsg.reasoning_content = reasoningText;
        result.push(assistantMsg as unknown as OpenAI.ChatCompletionAssistantMessageParam);
      } else if (textBlocks.length > 0 || (msg.role === "assistant" && reasoningText)) {
        // Pure text or reasoning-only message
        const textMsg: Record<string, unknown> = {
          role: msg.role as "user" | "assistant",
          content: textBlocks.map((b) => (b as { type: "text"; text: string }).text).join("") || null,
        };
        if (msg.role === "assistant" && reasoningText) {
          textMsg.reasoning_content = reasoningText;
        }
        result.push(textMsg as unknown as OpenAI.ChatCompletionMessageParam);
      }
    }

    return result;
  }

  private mapStopReason(
    reason: string | null,
    hasToolCalls: boolean
  ): ProviderResponse["stopReason"] {
    if (reason === "tool_calls" || hasToolCalls) return "tool_use";
    if (reason === "length") return "max_tokens";
    return "end_turn";
  }
}
