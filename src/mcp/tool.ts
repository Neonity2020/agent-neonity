import type { Tool, ToolDefinition } from "../types.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

export class McpTool implements Tool {
  public readonly name: string;
  public readonly description: string;
  public readonly inputSchema: ToolDefinition["inputSchema"];
  
  constructor(
    private client: Client,
    private serverName: string,
    private toolDef: any
  ) {
    this.name = toolDef.name;
    this.description = `[MCP: ${this.serverName}] ${toolDef.description || ""}`;
    
    // We assume the schema is JSON schema compatible.
    this.inputSchema = toolDef.inputSchema as ToolDefinition["inputSchema"];
    
    // Fallback if input schema is empty
    if (!this.inputSchema || !this.inputSchema.type) {
        this.inputSchema = { type: "object", properties: {} };
    }
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    try {
      const result = await this.client.callTool({
        name: this.name,
        arguments: input,
      });

      if (result.isError) {
        return `Error from MCP Server (${this.serverName}): ${JSON.stringify(result.content)}`;
      }

      // Convert MCP content to string format
      return (result.content as any[])
        .map((c: any) => {
          if (c.type === "text") return c.text;
          return JSON.stringify(c);
        })
        .join("\n");
    } catch (err: any) {
      return `Failed to execute MCP tool ${this.name} on server ${this.serverName}: ${err.message}`;
    }
  }
}
