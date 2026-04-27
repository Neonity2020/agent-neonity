// --- Provider-agnostic content blocks ---

export interface TextContent {
  type: "text";
  text: string;
}

export interface ToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface ReasoningContent {
  type: "reasoning";
  text: string;
}

export type ContentBlock = TextContent | ToolUseContent | ToolResultContent | ReasoningContent;

export interface Message {
  role: "user" | "assistant";
  content: ContentBlock[];
}

// --- Provider interface ---

export interface ProviderConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature?: number;
  baseURL?: string;
}

export interface StreamCallbacks {
  onTextDelta?: (text: string) => void;
  onToolUseStart?: (id: string, name: string) => void;
  onToolUseDelta?: (id: string, partialJson: string) => void;
  onToolResult?: (id: string, result: string) => void;
  onComplete?: (response: ProviderResponse) => void;
}

export interface ProviderResponse {
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "error";
  content: ContentBlock[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface Provider {
  readonly name: string;
  chat(
    messages: Message[],
    tools: ToolDefinition[],
    callbacks?: StreamCallbacks,
    systemPrompt?: string
  ): Promise<ProviderResponse>;
}

// --- Tool interface ---

export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ToolDefinition["inputSchema"];
  execute(input: Record<string, unknown>): Promise<string>;
}

// --- Agent config ---

export interface AgentConfig {
  provider: ProviderConfig;
  systemPrompt: string;
  maxIterations: number;
  workingDirectory?: string;
}
