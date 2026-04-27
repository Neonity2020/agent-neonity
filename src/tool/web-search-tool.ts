import type { Tool, ToolDefinition } from "../types.js";

/**
 * Configuration for web search providers.
 */
export interface WebSearchConfig {
  /** Search provider: 'serpapi', 'tavily', 'exa', 'duckduckgo' */
  provider: "serpapi" | "tavily" | "exa" | "duckduckgo";
  /** API key for the selected provider */
  apiKey?: string;
  /** Optional: custom base URL for API requests */
  baseURL?: string;
  /** Default number of results to return */
  numResults?: number;
  /** Optional: language filter (e.g., 'en', 'zh-CN') */
  language?: string;
}

/**
 * Search result from any provider.
 */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Normalized web search response.
 */
export interface SearchResponse {
  results: SearchResult[];
  /** Total number of results found (may be estimated) */
  totalResults?: number;
  /** The query that was executed */
  query: string;
  /** Time taken in milliseconds */
  latencyMs?: number;
}

/**
 * Web search tool implementation.
 * Supports multiple providers: SerpAPI, Tavily, Exa, DuckDuckGo.
 */
export class WebSearchTool implements Tool {
  readonly name = "web-search";
  readonly description =
    "Search the web for information. Returns title, URL, and snippet for each result. Use when you need current information, facts, or data not in the local codebase.";
  readonly inputSchema: Tool["inputSchema"] = {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query (max 500 characters)",
      },
      num_results: {
        type: "number",
        description: "Number of results to return (default: 5, max: 20)",
      },
      language: {
        type: "string",
        description: "Language filter (e.g., 'en', 'zh-CN'). Uses provider default if not specified.",
      },
    },
    required: ["query"],
  };

  constructor(private config: WebSearchConfig) {}

  async execute(input: Record<string, unknown>): Promise<string> {
    const query = input.query as string;
    const numResults = Math.min(
      (input.num_results as number) ?? this.config.numResults ?? 5,
      20
    );
    const language = (input.language as string) ?? this.config.language ?? "en";

    if (!query || query.trim().length === 0) {
      return JSON.stringify({ error: "Query cannot be empty" }, null, 2);
    }

    if (query.length > 500) {
      return JSON.stringify(
        { error: "Query exceeds 500 character limit" },
        null,
        2
      );
    }

    const startTime = Date.now();

    try {
      const response = await this.executeSearch(query, numResults, language);
      const latencyMs = Date.now() - startTime;

      return JSON.stringify(
        {
          ...response,
          latencyMs,
        },
        null,
        2
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return JSON.stringify(
        { error: `Search failed: ${errorMessage}` },
        null,
        2
      );
    }
  }

  private async executeSearch(
    query: string,
    numResults: number,
    language: string
  ): Promise<SearchResponse> {
    switch (this.config.provider) {
      case "serpapi":
        return this.searchWithSerpAPI(query, numResults, language);
      case "tavily":
        return this.searchWithTavily(query, numResults);
      case "exa":
        return this.searchWithExa(query, numResults);
      case "duckduckgo":
        return this.searchWithDuckDuckGo(query, numResults);
      default:
        throw new Error(`Unknown provider: ${this.config.provider}`);
    }
  }

  private async searchWithSerpAPI(
    query: string,
    numResults: number,
    language: string
  ): Promise<SearchResponse> {
    const apiKey = this.config.apiKey ?? process.env.SERPAPI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "SerpAPI API key not configured. Set SERPAPI_API_KEY environment variable."
      );
    }

    const params = new URLSearchParams({
      q: query,
      api_key: apiKey,
      engine: "google",
      num: String(numResults),
      hl: language,
    });

    const response = await fetch(
      `https://serpapi.com/search?${params.toString()}`
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SerpAPI error ${response.status}: ${text}`);
    }

    const data = await response.json() as {
      search_metadata?: { total_results?: string | number };
      organic_results?: Array<{
        title?: string;
        link?: string;
        snippet?: string;
      }>;
    };

    const results: SearchResult[] = (data.organic_results ?? []).map((r) => ({
      title: r.title ?? "Untitled",
      url: r.link ?? "",
      snippet: r.snippet ?? "",
    }));

    return {
      results,
      totalResults: data.search_metadata?.total_results
        ? Number(data.search_metadata.total_results)
        : results.length,
      query,
    };
  }

  private async searchWithTavily(
    query: string,
    numResults: number
  ): Promise<SearchResponse> {
    const apiKey = this.config.apiKey ?? process.env.TAVILY_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Tavily API key not configured. Set TAVILY_API_KEY environment variable."
      );
    }

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: numResults,
        include_answer: false,
        include_raw_content: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Tavily error ${response.status}: ${text}`);
    }

    const data = await response.json() as {
      results?: Array<{
        title?: string;
        url?: string;
        content?: string;
      }>;
    };

    const results: SearchResult[] = (data.results ?? []).map((r) => ({
      title: r.title ?? "Untitled",
      url: r.url ?? "",
      snippet: r.content ?? "",
    }));

    return { results, query };
  }

  private async searchWithExa(
    query: string,
    numResults: number
  ): Promise<SearchResponse> {
    const apiKey = this.config.apiKey ?? process.env.EXA_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Exa API key not configured. Set EXA_API_KEY environment variable."
      );
    }

    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        num_results: numResults,
        text: {
          max_characters: 500,
          include_embeddings: false,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Exa error ${response.status}: ${text}`);
    }

    const data = await response.json() as {
      results?: Array<{
        title?: string;
        url?: string;
        text?: string;
        score?: number;
      }>;
    };

    const results: SearchResult[] = (data.results ?? []).map((r) => ({
      title: r.title ?? "Untitled",
      url: r.url ?? "",
      snippet: r.text?.substring(0, 300) ?? "",
      metadata: { score: r.score },
    }));

    return { results, query };
  }

  private async searchWithDuckDuckGo(
    query: string,
    numResults: number
  ): Promise<SearchResponse> {
    // DuckDuckGo HTML scraping - lightweight, no API key required
    // Uses the unofficial JSON endpoint
    const encodedQuery = encodeURIComponent(query);
    const url = `https://duckduckgo.com/?q=${encodedQuery}&format=json&t=neonity`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "neonity/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo error ${response.status}`);
    }

    // DuckDuckGo JSON API returns results in a specific format
    const data = await response.json() as {
      results?: Array<{
        title?: string;
        url?: string;
        text?: string;
      }>;
    };

    const results: SearchResult[] = (data.results ?? [])
      .slice(0, numResults)
      .map((r) => ({
        title: r.title ?? "Untitled",
        url: r.url ?? "",
        snippet: r.text ?? "",
      }));

    return { results, query };
  }
}

/**
 * Create a web search tool with configuration from environment variables.
 *
 * Supported environment variables:
 * - WEB_SEARCH_PROVIDER: 'serpapi' | 'tavily' | 'exa' | 'duckduckgo' (default: 'duckduckgo')
 * - SERPAPI_API_KEY: API key for SerpAPI
 * - TAVILY_API_KEY: API key for Tavily
 * - EXA_API_KEY: API key for Exa
 * - WEB_SEARCH_NUM_RESULTS: default number of results (default: 5)
 * - WEB_SEARCH_LANGUAGE: default language code (default: 'en')
 */
export function createWebSearchTool(): Tool {
  const provider = (process.env.WEB_SEARCH_PROVIDER ?? "duckduckgo") as
    | "serpapi"
    | "tavily"
    | "exa"
    | "duckduckgo";

  const config: WebSearchConfig = {
    provider,
    apiKey: getProviderApiKey(provider),
    numResults: parseInt(process.env.WEB_SEARCH_NUM_RESULTS ?? "5", 10),
    language: process.env.WEB_SEARCH_LANGUAGE,
  };

  return new WebSearchTool(config);
}

function getProviderApiKey(provider: string): string | undefined {
  switch (provider) {
    case "serpapi":
      return process.env.SERPAPI_API_KEY;
    case "tavily":
      return process.env.TAVILY_API_KEY;
    case "exa":
      return process.env.EXA_API_KEY;
    default:
      return undefined;
  }
}

/**
 * Get tool definition for registration.
 */
export function getWebSearchToolDefinition(): ToolDefinition {
  return {
    name: "web-search",
    description:
      "Search the web for information. Returns title, URL, and snippet for each result.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query (max 500 characters)",
        },
        num_results: {
          type: "number",
          description: "Number of results to return (default: 5, max: 20)",
        },
        language: {
          type: "string",
          description: "Language filter (e.g., 'en', 'zh-CN')",
        },
      },
      required: ["query"],
    },
  };
}