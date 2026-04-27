/**
 * Memory Tool - Allows the Agent to read and write long-term memories
 */

import type { Tool, ToolDefinition } from "../types.js";
import { MemoryManager, type MemoryCategory, type MemoryEntry } from "./memory.js";

export interface MemoryToolInput {
  action: "add" | "search" | "list" | "get" | "update" | "delete" | "stats";
  
  // For 'add' action
  content?: string;
  category?: MemoryCategory;
  tags?: string[];
  
  // For 'search' action
  query?: string;
  categories?: MemoryCategory[];
  
  // For 'get' and 'update' actions
  id?: string;
  
  // For 'update' action
  newContent?: string;
  newTags?: string[];
  confidence?: number;
}

export class MemoryTool implements Tool {
  readonly name = "memory";
  readonly description = "Store and retrieve persistent long-term memories. Use to remember project conventions, user preferences, technical solutions, and context across sessions.";
  readonly inputSchema: ToolDefinition["inputSchema"] = {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["add", "search", "list", "get", "update", "delete", "stats"],
        description: "The memory action to perform",
      },
      content: {
        type: "string",
        description: "Memory content (for 'add' action)",
      },
      category: {
        type: "string",
        enum: ["project", "preference", "knowledge", "context", "pattern"],
        description: "Category of the memory (for 'add' action)",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "Tags for the memory (for 'add' action)",
      },
      query: {
        type: "string",
        description: "Search query (for 'search' action)",
      },
      categories: {
        type: "array",
        items: { type: "string" },
        description: "Filter by categories (for 'search' action)",
      },
      id: {
        type: "string",
        description: "Memory ID (for 'get', 'update', 'delete' actions)",
      },
      newContent: {
        type: "string",
        description: "New content (for 'update' action)",
      },
      newTags: {
        type: "array",
        items: { type: "string" },
        description: "New tags (for 'update' action)",
      },
      confidence: {
        type: "number",
        description: "Confidence level 0-1 (for 'update' action)",
      },
    },
    required: ["action"],
  };

  constructor(private memoryManager: MemoryManager) {}

  async execute(input: Record<string, unknown>): Promise<string> {
    const action = input.action as MemoryToolInput["action"];

    switch (action) {
      case "add":
        return this.handleAdd(input);
      case "search":
        return this.handleSearch(input);
      case "list":
        return this.handleList();
      case "get":
        return this.handleGet(input);
      case "update":
        return this.handleUpdate(input);
      case "delete":
        return this.handleDelete(input);
      case "stats":
        return this.handleStats();
      default:
        return `Unknown action: ${action}. Use one of: add, search, list, get, update, delete, stats`;
    }
  }

  private async handleAdd(input: Record<string, unknown>): Promise<string> {
    const content = input.content as string;
    if (!content) {
      return "Error: 'content' is required for 'add' action";
    }

    const category = (input.category as MemoryCategory) || "knowledge";
    const tags = (input.tags as string[]) || [];

    const entry = await this.memoryManager.add(content, category, { tags });
    return `Memory saved successfully.
- ID: ${entry.id}
- Category: ${entry.category}
- Tags: ${entry.tags.join(", ") || "(none)"}
- Content: ${entry.content}`;
  }

  private async handleSearch(input: Record<string, unknown>): Promise<string> {
    const query = input.query as string;
    const categories = input.categories as MemoryCategory[] | undefined;

    if (!query) {
      return "Error: 'query' is required for 'search' action";
    }

    const results = this.memoryManager.search(query, { categories });

    if (results.length === 0) {
      return "No memories found matching your query.";
    }

    const lines = [`Found ${results.length} matching memory(ies):\n`];
    
    for (const entry of results) {
      lines.push(this.formatEntry(entry));
      lines.push("");
    }

    return lines.join("\n");
  }

  private async handleList(): Promise<string> {
    const entries = this.memoryManager.getAll();

    if (entries.length === 0) {
      return "No memories stored yet. Use 'memory add' to create one.";
    }

    const lines = [`${entries.length} memory(ies) stored:\n`];
    
    for (const entry of entries) {
      lines.push(this.formatEntry(entry));
      lines.push("");
    }

    return lines.join("\n");
  }

  private async handleGet(input: Record<string, unknown>): Promise<string> {
    const id = input.id as string;
    if (!id) {
      return "Error: 'id' is required for 'get' action";
    }

    const entries = this.memoryManager.getAll();
    const entry = entries.find(e => e.id === id);

    if (!entry) {
      return `Memory with ID '${id}' not found.`;
    }

    return this.formatEntry(entry, true);
  }

  private async handleUpdate(input: Record<string, unknown>): Promise<string> {
    const id = input.id as string;
    if (!id) {
      return "Error: 'id' is required for 'update' action";
    }

    const updates: Parameters<typeof this.memoryManager.update>[1] = {};
    if (input.newContent) updates.content = input.newContent as string;
    if (input.newTags) updates.tags = input.newTags as string[];
    if (input.confidence !== undefined) updates.confidence = input.confidence as number;

    const success = await this.memoryManager.update(id, updates);

    if (success) {
      return `Memory '${id}' updated successfully.`;
    }
    return `Memory with ID '${id}' not found.`;
  }

  private async handleDelete(input: Record<string, unknown>): Promise<string> {
    const id = input.id as string;
    if (!id) {
      return "Error: 'id' is required for 'delete' action";
    }

    const success = await this.memoryManager.delete(id);

    if (success) {
      return `Memory '${id}' deleted successfully.`;
    }
    return `Memory with ID '${id}' not found.`;
  }

  private async handleStats(): Promise<string> {
    const stats = this.memoryManager.getStats();

    const lines = [
      "Memory Statistics",
      "=================",
      `Total entries: ${stats.totalEntries}`,
      "",
      "By category:",
      `  - project: ${stats.byCategory.project}`,
      `  - preference: ${stats.byCategory.preference}`,
      `  - knowledge: ${stats.byCategory.knowledge}`,
      `  - context: ${stats.byCategory.context}`,
      `  - pattern: ${stats.byCategory.pattern}`,
      "",
      `Last updated: ${stats.lastUpdated || "never"}`,
    ];

    return lines.join("\n");
  }

  private formatEntry(entry: MemoryEntry, full: boolean = false): string {
    const lines = [
      `**[${entry.category}]** ${entry.id}`,
      `Tags: ${entry.tags.join(", ") || "(none)"} | Confidence: ${Math.round(entry.confidence * 100)}%`,
    ];

    if (full) {
      lines.push(`Created: ${entry.createdAt}`);
      lines.push(`Updated: ${entry.updatedAt}`);
    }

    lines.push("");
    lines.push(entry.content);

    return lines.join("\n");
  }
}
