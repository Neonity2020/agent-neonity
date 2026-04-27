import type {
  ContentBlock,
  Message,
  Provider,
  ProviderConfig,
  ProviderResponse,
  StreamCallbacks,
  ToolDefinition,
} from "../types.js";

interface ChatMessage {
  role: string;
  content: string | null;
  reasoning_content?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

export class DeepSeekProvider implements Provider {
  readonly name = "deepseek";
  private apiKey: string;
  private baseURL: string;
  private model: string;
  private maxTokens: number;
  private temperature?: number;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL ?? "https://api.deepseek.com";
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

    if (systemPrompt) {
      sdkMessages.unshift({ role: "system", content: systemPrompt });
    }

    const body: Record<string, unknown> = {
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
      // Debug: log the messages we sent so we can see what's missing
      const assistantMsgs = sdkMessages.filter((m) => m.role === "assistant");
      const withRC = assistantMsgs.filter(
        (m) => "reasoning_content" in m && (m as ChatMessage).reasoning_content !== undefined
      );
      console.error(
        `[deepseek-debug] ${resp.status} error. Sent ${sdkMessages.length} msgs, ` +
        `${assistantMsgs.length} assistant, ${withRC.length} with reasoning_content`
      );
      for (let i = 0; i < sdkMessages.length; i++) {
        const m = sdkMessages[i];
        if (m.role === "assistant") {
          const hasRC = "reasoning_content" in m;
          const hasTC = m.tool_calls && m.tool_calls.length > 0;
          console.error(
            `  [${i}] assistant: content=${JSON.stringify(m.content)?.slice(0, 60)}, ` +
            `reasoning_content=${hasRC ? "YES" : "MISSING"}, tool_calls=${hasTC ? "YES" : "no"}`
          );
        }
      }
      throw new Error(`DeepSeek API error (${resp.status}): ${text}`);
    }

    const data = (await resp.json()) as {
      choices: Array<{
        message: {
          role: string;
          content: string | null;
          reasoning_content?: string;
          tool_calls?: Array<{
            id: string;
            type: "function";
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason: string;
      }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    const choice = data.choices?.[0];
    const message = choice?.message;

    // Debug: log what we captured from the response
    console.error(
      `[deepseek-debug] Response: content=${JSON.stringify(message?.content)?.slice(0, 60)}, ` +
      `reasoning_content=${message?.reasoning_content ? `${message.reasoning_content.length} chars` : "MISSING"}, ` +
      `tool_calls=${message?.tool_calls?.length ?? 0}`
    );

    if (!message) {
      const response: ProviderResponse = {
        stopReason: "end_turn",
        content: [],
      };
      callbacks?.onComplete?.(response);
      return response;
    }

    const content: ContentBlock[] = [];

    if (message.reasoning_content !== undefined && message.reasoning_content !== null) {
      content.push({ type: "reasoning", text: message.reasoning_content });
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

    const response: ProviderResponse = { stopReason, content };
    callbacks?.onComplete?.(response);
    return response;
  }

  private convertMessages(messages: Message[]): ChatMessage[] {
    const result: ChatMessage[] = [];

    for (const msg of messages) {
      const toolResults = msg.content.filter((b) => b.type === "tool_result");
      const textBlocks = msg.content.filter((b) => b.type === "text");
      const toolUseBlocks = msg.content.filter((b) => b.type === "tool_use");
      const reasoningBlocks = msg.content.filter(
        (b) => b.type === "reasoning"
      );

      for (const tr of toolResults) {
        result.push({
          role: "tool",
          tool_call_id: tr.tool_use_id,
          content: tr.content,
        });
      }

      const reasoningText =
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
        if (reasoningText !== undefined) assistantMsg.reasoning_content = reasoningText;
        result.push(assistantMsg);
      } else if (
        textBlocks.length > 0 ||
        (msg.role === "assistant" && reasoningText)
      ) {
        const textMsg: ChatMessage = {
          role: msg.role,
          content:
            textBlocks
              .map((b) => (b as { type: "text"; text: string }).text)
              .join("") || null,
        };
        if (msg.role === "assistant" && reasoningText !== undefined) {
          textMsg.reasoning_content = reasoningText;
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
