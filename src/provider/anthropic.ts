import Anthropic from "@anthropic-ai/sdk";
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

export class AnthropicProvider implements Provider {
  readonly name = "anthropic";
  private client: Anthropic;
  private _model: string;
  private maxTokens: number;
  private temperature?: number;

  constructor(config: ProviderConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
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
      { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", tier: "premium" },
      { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4 (Latest)", tier: "standard" },
      { id: "claude-haiku-3-5-20241022", label: "Claude Haiku 3.5", tier: "cheap" },
      { id: "claude-opus-4-5-20250514", label: "Claude Opus 4", tier: "premium" },
      { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet (Legacy)", tier: "standard" },
    ];
  }

  async chat(
    messages: Message[],
    tools: ToolDefinition[],
    callbacks?: StreamCallbacks,
    systemPrompt?: string
  ): Promise<ProviderResponse> {
    const sdkMessages = this.convertMessages(messages);

    const params: Anthropic.MessageCreateParams = {
      model: this._model,
      max_tokens: this.maxTokens,
      messages: sdkMessages,
      ...(systemPrompt && { system: systemPrompt }),
      ...(tools.length > 0 && {
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
        })),
      }),
    };

    const stream = this.client.messages.stream(params);

    stream.on("text", (text) => {
      callbacks?.onTextDelta?.(text);
    });

    stream.on("inputJson", (_id, json) => {
      // Tool use input deltas arrive here — we don't need to stream them
      // since we get the complete input from finalMessage()
    });

    const finalMessage = await stream.finalMessage();

    const content = this.convertResponse(finalMessage);

    const stopReason = this.mapStopReason(finalMessage.stop_reason);

    const response: ProviderResponse = {
      stopReason,
      content,
      usage: finalMessage.usage
        ? {
            inputTokens: finalMessage.usage.input_tokens,
            outputTokens: finalMessage.usage.output_tokens,
          }
        : undefined,
    };

    callbacks?.onComplete?.(response);
    return response;
  }

  private convertMessages(messages: Message[]): Anthropic.MessageParam[] {
    return messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content.map((block) => this.convertBlock(block)),
    }));
  }

  private convertBlock(block: ContentBlock): Anthropic.ContentBlockParam {
    switch (block.type) {
      case "text":
        return { type: "text", text: block.text };
      case "tool_use":
        return {
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: block.input,
        };
      case "tool_result":
        return {
          type: "tool_result",
          tool_use_id: block.tool_use_id,
          content: block.content,
        };
      case "reasoning":
        return { type: "text", text: block.text };
    }
  }

  private convertResponse(msg: Anthropic.Message): ContentBlock[] {
    const blocks: ContentBlock[] = [];
    for (const block of msg.content) {
      if (block.type === "text") {
        blocks.push({ type: "text", text: block.text });
      } else if (block.type === "tool_use") {
        blocks.push({
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }
    return blocks;
  }

  private mapStopReason(
    reason: string | null | undefined
  ): ProviderResponse["stopReason"] {
    switch (reason) {
      case "end_turn":
        return "end_turn";
      case "tool_use":
        return "tool_use";
      case "max_tokens":
        return "max_tokens";
      default:
        return "end_turn";
    }
  }
}
