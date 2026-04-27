/**
 * Precise token counting using OpenAI's tiktoken.
 * Falls back to character-based estimation if tiktoken fails to load.
 */

import tiktoken, { type Tiktoken } from "tiktoken";

export const MODEL_ENCODINGS: Record<string, string> = {
  // Anthropic
  "claude-opus-4": "cl100k_base",
  "claude-sonnet-4": "cl100k_base",
  "claude-haiku-3-5": "cl100k_base",
  "claude-opus-3-5": "cl100k_base",
  "claude-sonnet-3-5": "cl100k_base",
  "claude-haiku-3": "cl100k_base",

  // OpenAI
  "gpt-4": "cl100k_base",
  "gpt-4o": "cl100k_base",
  "gpt-4o-mini": "cl100k_base",
  "gpt-4-turbo": "cl100k_base",
  "gpt-3.5-turbo": "cl100k_base",
  "gpt-4.1": "cl100k_base",
  "gpt-4.1-mini": "cl100k_base",
  "gpt-4.1-nano": "cl100k_base",

  // DeepSeek
  "deepseek": "cl100k_base",
  "deepseek-chat": "cl100k_base",

  // Gemini
  "gemini": "cl100k_base",

  // Default
  "default": "cl100k_base",
};

/**
 * Get the tiktoken encoding name for a given model.
 */
export function getEncodingForModel(model: string): string {
  const lower = model.toLowerCase();
  for (const [key, encoding] of Object.entries(MODEL_ENCODINGS)) {
    if (lower.includes(key.toLowerCase())) {
      return encoding;
    }
  }
  return MODEL_ENCODINGS["default"];
}

/**
 * Cache for tiktoken encodings to avoid repeated initialization.
 */
const encodingCache = new Map<string, Tiktoken>();

/**
 * Get a cached (or freshly initialized) tiktoken encoder.
 */
export function getEncoder(model: string): Tiktoken | null {
  const encodingName = getEncodingForModel(model);

  if (!encodingCache.has(encodingName)) {
    try {
      const enc = tiktoken.encoding_for_model(encodingName as tiktoken.TiktokenModel);
      encodingCache.set(encodingName, enc);
    } catch {
      // Fallback: manually initialize by encoding name
      try {
        const enc = tiktoken.get_encoding(encodingName as tiktoken.TiktokenEncoding);
        encodingCache.set(encodingName, enc);
      } catch {
        return null;
      }
    }
  }

  return encodingCache.get(encodingName) ?? null;
}

/**
 * Count tokens in a string with a given model.
 * Falls back to character-based estimation if tiktoken fails.
 */
export function countTokens(text: string, model: string): number {
  const encoder = getEncoder(model);
  if (encoder) {
    return encoder.encode(text).length;
  }

  // Fallback: character-based estimation (4 chars/token)
  return Math.ceil(text.length / 4);
}

/**
 * Count tokens in multiple strings.
 */
export function countTokensMulti(texts: string[], model: string): number {
  return texts.reduce((sum, text) => sum + countTokens(text, model), 0);
}

/**
 * Count tokens in a JSON-serializable value.
 */
export function countTokensJson(value: unknown, model: string): number {
  return countTokens(JSON.stringify(value), model);
}

/**
 * Estimate tokens for tool definitions.
 */
export function countToolDefinitionTokens(
  tools: Array<{ name: string; description: string; input_schema: { type: string; properties: Record<string, unknown>; required?: string[] } }>,
  model: string
): number {
  if (tools.length === 0) return 0;
  return countTokensJson(tools, model);
}

/**
 * Clear the encoding cache (useful for testing).
 */
export function clearEncodingCache(): void {
  for (const enc of encodingCache.values()) {
    try {
      enc.free();
    } catch {
      // Ignore
    }
  }
  encodingCache.clear();
}
