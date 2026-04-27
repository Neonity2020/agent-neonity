import { CodeBlock } from "@/components/code-block";

export default function Chapter() {
  return (
    <div className="space-y-8">
      {/* Anthropic */}
      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          1. Anthropic Provider
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          The Anthropic adapter wraps the{" "}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm text-cyan-400">@anthropic-ai/sdk</code>.
          It uses the streaming Messages API and converts between Anthropic&apos;s
          native types and Neonity&apos;s neutral ContentBlock types.
        </p>
        <CodeBlock
          filename="src/provider/anthropic.ts (excerpt)"
          code={`export class AnthropicProvider implements Provider {
  readonly name = "anthropic";
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(config: ProviderConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model;
    this.maxTokens = config.maxTokens;
  }

  async chat(
    messages: Message[],
    tools: ToolDefinition[],
    callbacks?: StreamCallbacks,
    systemPrompt?: string
  ): Promise<ProviderResponse> {
    const sdkMessages = this.convertMessages(messages);

    const params = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: sdkMessages,
      ...(systemPrompt && { system: systemPrompt }),
      ...(tools.length > 0 && {
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.inputSchema,
        })),
      }),
    };

    const stream = this.client.messages.stream(params);

    stream.on("text", (text) => {
      callbacks?.onTextDelta?.(text);
    });

    const finalMessage = await stream.finalMessage();
    const content = this.convertResponse(finalMessage);
    const stopReason = this.mapStopReason(
      finalMessage.stop_reason
    );

    return { stopReason, content, usage: { ... } };
  }
}`}
        />
        <p className="text-slate-400 text-sm mt-3">
          Anthropic supports system prompts natively via the{" "}
          <code className="bg-slate-800 px-1 py-0.5 rounded text-xs">system</code>{" "}
          parameter—no need to inject it as a message.
        </p>
      </section>

      {/* OpenAI */}
      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          2. OpenAI (and DeepSeek) Provider
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          The OpenAI provider handles both OpenAI and DeepSeek (via OpenAI
          compatibility). It supports streaming, reasoning content (for DeepSeek
          R1&apos;s thinking mode), and function-call-style tool use.
        </p>
        <CodeBlock
          filename="src/provider/openai-provider.ts (excerpt)"
          code={`export class OpenAIProvider implements Provider {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;

  constructor(config: ProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      ...(config.baseURL && { baseURL: config.baseURL }),
    });
    this.model = config.model;
  }

  async chat(
    messages: Message[],
    tools: ToolDefinition[],
    callbacks?: StreamCallbacks,
    systemPrompt?: string
  ): Promise<ProviderResponse> {
    const sdkMessages = this.convertMessages(messages);

    // OpenAI needs system prompt as first message
    if (systemPrompt) {
      sdkMessages.unshift({
        role: "system",
        content: systemPrompt,
      });
    }

    const stream = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: sdkMessages,
      stream: true,
      ...(tools.length > 0 && {
        tools: tools.map((t) => ({
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: t.inputSchema,
          },
        })),
      }),
    });

    // Stream processing loop...
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta;
      // Handle reasoning_content (DeepSeek thinking)
      // Handle content (text deltas)
      // Handle tool_calls (accumulated JSON chunks)
    }

    return { stopReason, content };
  }
}`}
        />
      </section>

      {/* Gemini */}
      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          3. Gemini Provider
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          Gemini uses Google&apos;s GenAI SDK with function declarations. Unlike the
          others, Gemini&apos;s API is non-streaming in this implementation—the
          response is returned as a complete object and then &quot;simulated&quot; as
          streaming through the callbacks.
        </p>
        <CodeBlock
          filename="src/provider/gemini.ts (excerpt)"
          code={`export class GeminiProvider implements Provider {
  readonly name = "gemini";
  private client: GoogleGenAI;

  constructor(config: ProviderConfig) {
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
  }

  async chat(
    messages: Message[],
    tools: ToolDefinition[],
    callbacks?: StreamCallbacks,
    systemPrompt?: string
  ): Promise<ProviderResponse> {
    const contents = this.convertMessages(messages);
    const config: Record<string, unknown> = { ... };

    // Gemini uses systemInstruction
    if (systemPrompt) {
      config.systemInstruction = systemPrompt;
    }

    // Convert tools to functionDeclarations
    if (tools.length > 0) {
      config.tools = [{
        functionDeclarations: tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: this.convertSchema(t.inputSchema),
        })),
      }];
    }

    const response = await this.client.models.generateContent({
      model: this.model,
      contents,
      config,
    });

    const content = this.extractContent(response);
    return { stopReason, content };
  }
}`}
        />
      </section>

      {/* DeepSeek */}
      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          4. DeepSeek Native Provider
        </h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          DeepSeek now has its own native adapter. While DeepSeek&apos;s API is
          OpenAI-compatible, a dedicated adapter enables proper handling of{" "}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm text-cyan-400">reasoning_content</code>{" "}
          — chain-of-thought tokens emitted by DeepSeek R1/V3 &quot;thinking&quot; models.
        </p>
        <CodeBlock
          filename="src/provider/deepseek-provider.ts (excerpt)"
          code={`export class DeepSeekProvider implements Provider {
  readonly name = "deepseek";
  private client: OpenAI;
  private model: string;

  constructor(config: ProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL ?? "https://api.deepseek.com",
    });
    this.model = config.model;
  }

  async chat(
    messages: Message[],
    tools: ToolDefinition[],
    callbacks?: StreamCallbacks,
    systemPrompt?: string
  ): Promise<ProviderResponse> {
    // ... same structure as OpenAI, but with reasoning_content
    // handling in the stream processing loop

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta;

      // Handle reasoning_content (DeepSeek thinking)
      if (delta?.reasoning_content) {
        callbacks?.onReasoningDelta?.(
          delta.reasoning_content
        );
      }

      // Handle text content
      if (delta?.content) {
        callbacks?.onTextDelta?.(delta.content);
      }

      // Handle tool_calls (accumulated JSON chunks)
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          callbacks?.onToolUseDelta?.(
            tc.id ?? "",
            tc.function?.arguments ?? ""
          );
        }
      }
    }
  }
}`}
        />
      </section>

      {/* Comparison */}
      <section>
        <h2 className="text-xl font-bold text-white mb-3">
          Provider Comparison
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-2 px-3 text-slate-400 font-medium">
                  Feature
                </th>
                <th className="text-left py-2 px-3 text-cyan-400">Anthropic</th>
                <th className="text-left py-2 px-3 text-green-400">OpenAI</th>
                <th className="text-left py-2 px-3 text-blue-400">Gemini</th>
                <th className="text-left py-2 px-3 text-purple-400">DeepSeek</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              <tr className="border-b border-slate-800/50">
                <td className="py-2 px-3">Streaming</td>
                <td className="py-2 px-3">✅ Native</td>
                <td className="py-2 px-3">✅ Native</td>
                <td className="py-2 px-3">⚠️ Simulated</td>
                <td className="py-2 px-3">✅ Native</td>
              </tr>
              <tr className="border-b border-slate-800/50">
                <td className="py-2 px-3">System Prompt</td>
                <td className="py-2 px-3">system param</td>
                <td className="py-2 px-3">system message</td>
                <td className="py-2 px-3">systemInstruction</td>
                <td className="py-2 px-3">system message</td>
              </tr>
              <tr className="border-b border-slate-800/50">
                <td className="py-2 px-3">Tool Format</td>
                <td className="py-2 px-3">tools array</td>
                <td className="py-2 px-3">function tools</td>
                <td className="py-2 px-3">functionDeclarations</td>
                <td className="py-2 px-3">function tools</td>
              </tr>
              <tr>
                <td className="py-2 px-3">Reasoning</td>
                <td className="py-2 px-3">—</td>
                <td className="py-2 px-3">—</td>
                <td className="py-2 px-3">—</td>
                <td className="py-2 px-3">reasoning_content</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
