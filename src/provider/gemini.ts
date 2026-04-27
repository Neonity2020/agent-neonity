import { GoogleGenAI, Type } from "@google/genai";
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

export class GeminiProvider implements Provider {
  readonly name = "gemini";
  private client: GoogleGenAI;
  private _model: string;
  private maxTokens: number;
  private temperature?: number;

  constructor(config: ProviderConfig) {
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
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
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", tier: "standard" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", tier: "premium" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", tier: "cheap" },
      { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash-Lite", tier: "cheap" },
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", tier: "premium" },
      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash", tier: "standard" },
    ];
  }

  async chat(
    messages: Message[],
    tools: ToolDefinition[],
    callbacks?: StreamCallbacks,
    systemPrompt?: string
  ): Promise<ProviderResponse> {
    const contents = this.convertMessages(messages);

    // Gemini uses systemInstruction for system prompts
    const config: Record<string, unknown> = {
      maxOutputTokens: this.maxTokens,
    };
    if (systemPrompt) {
      config.systemInstruction = systemPrompt;
    }
    if (this.temperature !== undefined) {
      config.temperature = this.temperature;
    }

    if (tools.length > 0) {
      config.tools = [
        {
          functionDeclarations: tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: this.convertSchema(t.inputSchema),
          })),
        },
      ];
    }

    const response = await this.client.models.generateContent({
      model: this._model,
      contents,
      config,
    });

    const content = this.extractContent(response);
    const hasToolCalls = content.some((b) => b.type === "tool_use");

    const stopReason: ProviderResponse["stopReason"] = hasToolCalls
      ? "tool_use"
      : response.candidates?.[0]?.finishReason === "MAX_TOKENS"
        ? "max_tokens"
        : "end_turn";

    // Stream text output via callbacks (non-streaming API, but we simulate streaming)
    for (const block of content) {
      if (block.type === "text") {
        callbacks?.onTextDelta?.(block.text);
      } else if (block.type === "tool_use") {
        callbacks?.onToolUseStart?.(block.id, block.name);
      }
    }

    const result: ProviderResponse = { stopReason, content };
    callbacks?.onComplete?.(result);
    return result;
  }

  private convertMessages(messages: Message[]) {
    return messages.map((msg) => {
      const role = msg.role === "assistant" ? "model" : "user";
      const parts: Array<Record<string, unknown>> = [];

      for (const block of msg.content) {
        switch (block.type) {
          case "text":
            parts.push({ text: block.text });
            break;
          case "tool_use":
            parts.push({
              functionCall: {
                name: block.name,
                args: block.input,
                id: block.id,
              },
            });
            break;
          case "tool_result":
            parts.push({
              functionResponse: {
                name: `tool_${block.tool_use_id}`,
                id: block.tool_use_id,
                response: { result: block.content },
              },
            });
            break;
        }
      }

      return { role, parts };
    });
  }

  private extractContent(
    response: Awaited<
      ReturnType<GoogleGenAI["models"]["generateContent"]>
    >
  ): ContentBlock[] {
    const blocks: ContentBlock[] = [];
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) return blocks;

    for (const part of candidate.content.parts) {
      if (part.text) {
        blocks.push({ type: "text", text: part.text });
      }
      if (part.functionCall) {
        blocks.push({
          type: "tool_use",
          id:
            (part.functionCall.id as string) ??
            `fc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: part.functionCall.name ?? "unknown",
          input:
            (part.functionCall.args as Record<string, unknown>) ?? {},
        });
      }
    }

    return blocks;
  }

  private convertSchema(
    schema: ToolDefinition["inputSchema"]
  ): Record<string, unknown> {
    const properties: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(schema.properties)) {
      properties[key] = this.convertProperty(val as Record<string, unknown>);
    }

    return {
      type: Type.OBJECT,
      properties,
      required: schema.required,
    };
  }

  private convertProperty(
    prop: Record<string, unknown>
  ): Record<string, unknown> {
    const typeMap: Record<string, string> = {
      string: Type.STRING,
      number: Type.NUMBER,
      integer: Type.INTEGER,
      boolean: Type.BOOLEAN,
      array: Type.ARRAY,
      object: Type.OBJECT,
    };

    const result: Record<string, unknown> = {
      type: typeMap[prop.type as string] ?? Type.STRING,
    };

    if (prop.description) {
      result.description = prop.description;
    }
    if (prop.properties) {
      const nested: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(
        prop.properties as Record<string, unknown>
      )) {
        nested[key] = this.convertProperty(
          val as Record<string, unknown>
        );
      }
      result.properties = nested;
    }
    if (prop.items) {
      result.items = this.convertProperty(
        prop.items as Record<string, unknown>
      );
    }

    return result;
  }
}
