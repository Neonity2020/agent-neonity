/**
 * Long-term Memory System for Neonity
 * 
 * Stores persistent knowledge in .neonity-memory.md files that survive across sessions.
 * Uses markdown format for human readability and LLM compatibility.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface MemoryEntry {
  id: string;
  category: MemoryCategory;
  tags: string[];
  content: string;
  createdAt: string;
  updatedAt: string;
  confidence: number; // 0-1, how confident we are this is still accurate
}

export type MemoryCategory = 
  | "project"      // Project structure, tech stack, conventions
  | "preference"   // User preferences, coding style
  | "knowledge"    // Technical knowledge, solutions found
  | "context"      // Current task context, decisions made
  | "pattern";     // Recurring patterns, tool usage habits

export interface MemoryStats {
  totalEntries: number;
  byCategory: Record<MemoryCategory, number>;
  lastUpdated: string | null;
}

/**
 * Generate a unique ID for a memory entry
 */
function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Parse a memory entry from markdown content
 */
function parseEntry(markdown: string): MemoryEntry | null {
  const lines = markdown.trim().split("\n");
  
  // Extract frontmatter
  const frontmatter: Record<string, string> = {};
  let inFrontmatter = false;
  let contentStart = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.trim() === "---") {
      if (!inFrontmatter) {
        inFrontmatter = true;
      } else {
        contentStart = i + 1;
        break;
      }
      continue;
    }
    
    if (inFrontmatter) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        frontmatter[key] = value;
      }
    }
  }
  
  if (!frontmatter.id || !frontmatter.category) {
    return null;
  }
  
  const content = lines.slice(contentStart).join("\n").trim();
  
  return {
    id: frontmatter.id,
    category: frontmatter.category as MemoryCategory,
    tags: frontmatter.tags ? frontmatter.tags.split(",").map(t => t.trim()) : [],
    content,
    createdAt: frontmatter.createdAt || new Date().toISOString(),
    updatedAt: frontmatter.updatedAt || new Date().toISOString(),
    confidence: parseFloat(frontmatter.confidence) || 0.8,
  };
}

/**
 * Serialize a memory entry to markdown
 */
function serializeEntry(entry: MemoryEntry): string {
  return `---
id: ${entry.id}
category: ${entry.category}
tags: ${entry.tags.join(", ")}
createdAt: ${entry.createdAt}
updatedAt: ${entry.updatedAt}
confidence: ${entry.confidence}
---

${entry.content}`;
}

/**
 * Memory Manager - handles persistence and retrieval of memories
 */
export class MemoryManager {
  private memories: Map<string, MemoryEntry> = new Map();
  private memoryDir: string;
  private globalMemoryPath: string;
  private projectMemoryPath: string;
  
  constructor(workingDirectory: string) {
    this.memoryDir = path.join(workingDirectory, ".neonity");
    this.globalMemoryPath = path.join(this.memoryDir, "memory.md");
    this.projectMemoryPath = path.join(this.memoryDir, "project-memory.md");
  }
  
  /**
   * Initialize memory system, load existing memories
   */
  async initialize(): Promise<void> {
    // Ensure .neonity directory exists
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true });
    }
    
    // Load memories from files
    await this.loadMemories();
  }
  
  /**
   * Load memories from storage files
   */
  private async loadMemories(): Promise<void> {
    this.memories.clear();
    
    // Load global memory (user preferences, patterns)
    if (fs.existsSync(this.globalMemoryPath)) {
      await this.loadFromFile(this.globalMemoryPath);
    }
    
    // Load project-specific memory
    if (fs.existsSync(this.projectMemoryPath)) {
      await this.loadFromFile(this.projectMemoryPath);
    }
  }
  
  /**
   * Parse a memory file into entries
   */
  private async loadFromFile(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const entries = this.parseMemoryFile(content);
      
      for (const entry of entries) {
        this.memories.set(entry.id, entry);
      }
    } catch (err) {
      console.error(`Failed to load memories from ${filePath}:`, err);
    }
  }
  
  /**
   * Parse a complete memory file into entries
   */
  private parseMemoryFile(content: string): MemoryEntry[] {
    const entries: MemoryEntry[] = [];
    const sections = content.split(/\n---\n/);
    
    // First section is header/intro, skip it
    for (let i = 1; i < sections.length; i++) {
      const entry = parseEntry(sections[i]);
      if (entry) {
        entries.push(entry);
      }
    }
    
    return entries;
  }
  
  /**
   * Persist all memories to storage
   */
  private async persist(): Promise<void> {
    // Separate memories by storage location
    const globalMemories: MemoryEntry[] = [];
    const projectMemories: MemoryEntry[] = [];
    
    for (const entry of this.memories.values()) {
      if (entry.category === "preference" || entry.category === "pattern") {
        globalMemories.push(entry);
      } else {
        projectMemories.push(entry);
      }
    }
    
    // Write global memory
    const globalContent = this.serializeMemoryFile(globalMemories, "Global Memory");
    fs.writeFileSync(this.globalMemoryPath, globalContent, "utf-8");
    
    // Write project memory
    const projectContent = this.serializeMemoryFile(projectMemories, "Project Memory");
    fs.writeFileSync(this.projectMemoryPath, projectContent, "utf-8");
  }
  
  /**
   * Serialize memories to a markdown file
   */
  private serializeMemoryFile(entries: MemoryEntry[], title: string): string {
    const lines = [
      `# ${title}`,
      "",
      `> Auto-generated by Neonity. Do not edit manually unless you know what you're doing.`,
      "",
      "Entries are separated by `---`.",
      "",
    ];
    
    for (const entry of entries) {
      lines.push(serializeEntry(entry));
      lines.push("");
    }
    
    return lines.join("\n");
  }
  
  /**
   * Add a new memory entry
   */
  async add(
    content: string,
    category: MemoryCategory,
    options: {
      tags?: string[];
      confidence?: number;
    } = {}
  ): Promise<MemoryEntry> {
    const entry: MemoryEntry = {
      id: generateId(),
      category,
      tags: options.tags || [],
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      confidence: options.confidence ?? 0.8,
    };
    
    this.memories.set(entry.id, entry);
    await this.persist();
    
    return entry;
  }
  
  /**
   * Update an existing memory entry
   */
  async update(id: string, updates: Partial<Pick<MemoryEntry, "content" | "tags" | "confidence">>): Promise<boolean> {
    const entry = this.memories.get(id);
    if (!entry) return false;
    
    if (updates.content !== undefined) entry.content = updates.content;
    if (updates.tags !== undefined) entry.tags = updates.tags;
    if (updates.confidence !== undefined) entry.confidence = updates.confidence;
    entry.updatedAt = new Date().toISOString();
    
    await this.persist();
    return true;
  }
  
  /**
   * Delete a memory entry
   */
  async delete(id: string): Promise<boolean> {
    const deleted = this.memories.delete(id);
    if (deleted) {
      await this.persist();
    }
    return deleted;
  }
  
  /**
   * Search memories by query (simple keyword matching)
   */
  search(query: string, options: {
    categories?: MemoryCategory[];
    limit?: number;
  } = {}): MemoryEntry[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);
    
    const results: Array<{ entry: MemoryEntry; score: number }> = [];
    
    for (const entry of this.memories.values()) {
      // Filter by category if specified
      if (options.categories && options.categories.length > 0) {
        if (!options.categories.includes(entry.category)) {
          continue;
        }
      }
      
      // Calculate relevance score
      let score = 0;
      const contentLower = entry.content.toLowerCase();
      const tagsLower = entry.tags.join(" ").toLowerCase();
      
      for (const word of queryWords) {
        // Check content
        if (contentLower.includes(word)) {
          score += word.length;
        }
        // Check tags (weighted higher)
        if (tagsLower.includes(word)) {
          score += word.length * 2;
        }
        // Check category match
        if (entry.category.includes(word)) {
          score += 5;
        }
      }
      
      // Boost by confidence
      score *= entry.confidence;
      
      if (score > 0) {
        results.push({ entry, score });
      }
    }
    
    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    
    // Apply limit
    const limit = options.limit ?? 10;
    return results.slice(0, limit).map(r => r.entry);
  }
  
  /**
   * Get all memories, optionally filtered by category
   */
  getAll(options: {
    categories?: MemoryCategory[];
  } = {}): MemoryEntry[] {
    const entries = Array.from(this.memories.values());
    
    if (options.categories && options.categories.length > 0) {
      return entries.filter(e => options.categories!.includes(e.category));
    }
    
    return entries;
  }
  
  /**
   * Get memories formatted for system prompt injection
   */
  getForSystemPrompt(options: {
    maxEntries?: number;
    categories?: MemoryCategory[];
  } = {}): string {
    const entries = this.getAll(options);
    
    if (entries.length === 0) {
      return "";
    }
    
    const lines = [
      "",
      "## Long-term Memory",
      "",
    ];
    
    // Group by category
    const byCategory = new Map<MemoryCategory, MemoryEntry[]>();
    for (const entry of entries) {
      const list = byCategory.get(entry.category) || [];
      list.push(entry);
      byCategory.set(entry.category, list);
    }
    
    for (const [category, categoryEntries] of byCategory) {
      lines.push(`### ${this.categoryLabel(category)}`);
      
      for (const entry of categoryEntries) {
        lines.push(`- ${entry.content}`);
      }
      lines.push("");
    }
    
    return lines.join("\n");
  }
  
  /**
   * Get human-readable label for category
   */
  private categoryLabel(category: MemoryCategory): string {
    const labels: Record<MemoryCategory, string> = {
      project: "Project Knowledge",
      preference: "User Preferences",
      knowledge: "Technical Knowledge",
      context: "Context & Decisions",
      pattern: "Usage Patterns",
    };
    return labels[category];
  }
  
  /**
   * Get memory statistics
   */
  getStats(): MemoryStats {
    const entries = Array.from(this.memories.values());
    const byCategory: Record<MemoryCategory, number> = {
      project: 0,
      preference: 0,
      knowledge: 0,
      context: 0,
      pattern: 0,
    };
    
    let lastUpdated: string | null = null;
    
    for (const entry of entries) {
      byCategory[entry.category]++;
      if (!lastUpdated || entry.updatedAt > lastUpdated) {
        lastUpdated = entry.updatedAt;
      }
    }
    
    return {
      totalEntries: entries.length,
      byCategory,
      lastUpdated,
    };
  }
  
  /**
   * Summarize a conversation and store key information
   * Uses LLM to extract important facts
   */
  async summarizeConversation(
    messages: Array<{ role: string; content: string }>,
    _llmProvider?: { summarize: (text: string) => Promise<string> }
  ): Promise<MemoryEntry[]> {
    // Simple heuristic: extract key information from recent exchanges
    // A full implementation would use an LLM for this
    
    const entries: MemoryEntry[] = [];
    
    // For now, just note tool usage patterns
    const toolUsages = new Map<string, number>();
    for (const msg of messages) {
      const toolMatches = msg.content.match(/\[TOOL: (\w+)\]/g);
      if (toolMatches) {
        for (const match of toolMatches) {
          const tool = match.match(/\[TOOL: (\w+)\]/)?.[1] || "";
          toolUsages.set(tool, (toolUsages.get(tool) || 0) + 1);
        }
      }
    }
    
    // Store frequently used tools as patterns
    for (const [tool, count] of toolUsages) {
      if (count >= 3) {
        entries.push(await this.add(
          `Frequently uses the ${tool} tool (${count} times in recent session)`,
          "pattern",
          { tags: ["tool-usage", tool], confidence: 0.7 }
        ));
      }
    }
    
    return entries;
  }
  
  /**
   * Consolidate similar memories (deduplication)
   */
  async consolidate(): Promise<number> {
    const entries = Array.from(this.memories.values());
    const toRemove: string[] = [];
    
    // Find similar entries and keep the more recent/confident one
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        
        // Skip if same category but different content
        if (a.category !== b.category) continue;
        
        // Simple similarity check (could use embeddings for better matching)
        const similarity = this.calculateSimilarity(a.content, b.content);
        
        if (similarity > 0.8) {
          // Remove the older/lower confidence one
          const toDelete = a.updatedAt > b.updatedAt ? b.id : a.id;
          if (!toRemove.includes(toDelete)) {
            toRemove.push(toDelete);
          }
        }
      }
    }
    
    // Remove duplicates
    for (const id of toRemove) {
      this.memories.delete(id);
    }
    
    if (toRemove.length > 0) {
      await this.persist();
    }
    
    return toRemove.length;
  }
  
  /**
   * Calculate simple text similarity (Jaccard index of words)
   */
  private calculateSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);
    
    return intersection.size / union.size;
  }
}
