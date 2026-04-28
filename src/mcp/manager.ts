import fs from "node:fs/promises";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpTool } from "./tool.js";
import type { ToolRegistry } from "../tool/tool.js";

export interface McpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

export interface McpConfigFile {
  mcpServers: Record<string, McpServerConfig>;
}

export interface McpServerStatus {
  name: string;
  status: "connected" | "connecting" | "failed" | "disconnected";
  toolsCount: number;
  error?: string;
}

export class McpManager {
  private clients = new Map<string, Client>();
  private transports = new Map<string, StdioClientTransport | StreamableHTTPClientTransport>();
  private statuses = new Map<string, McpServerStatus>();
  private registeredTools: string[] = [];
  
  constructor(private workingDirectory: string, private toolRegistry: ToolRegistry) {}

  public getStatuses(): McpServerStatus[] {
    return Array.from(this.statuses.values());
  }

  public async initialize(): Promise<void> {
    const configPath = await this.findConfigPath();
    if (!configPath) {
      return; // No MCP config found, skip
    }

    try {
      const configContent = await fs.readFile(configPath, "utf-8");
      const config: McpConfigFile = JSON.parse(configContent);

      if (!config.mcpServers || Object.keys(config.mcpServers).length === 0) {
        return;
      }

      console.log(`\nInitializing MCP servers from ${configPath}...`);
      
      const connectPromises = Object.entries(config.mcpServers).map(([name, serverConfig]) => 
        this.connectServer(name, serverConfig)
      );

      await Promise.all(connectPromises);
      
      // Register tools after all servers have finished trying to connect
      await this.registerAllTools();

    } catch (err: any) {
      console.error(`Failed to initialize MCP manager: ${err.message}`);
    }
  }

  public async reload(): Promise<void> {
    // Cleanup existing connections
    for (const transport of this.transports.values()) {
      await transport.close().catch(() => {});
    }
    this.clients.clear();
    this.transports.clear();
    this.statuses.clear();
    
    // Remove old tools from registry
    for (const toolName of this.registeredTools) {
      this.toolRegistry.remove(toolName);
    }
    this.registeredTools = [];

    await this.initialize();
  }

  private async connectServer(name: string, config: McpServerConfig): Promise<void> {
    this.statuses.set(name, { name, status: "connecting", toolsCount: 0 });

    try {
      let transport;

      if (config.url) {
        // Remote HTTP connection
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(config.headers || {})) {
          // Expand environment variables in header values
          headers[k] = v.replace(/\$\{?(\w+)\}?/g, (_, varName) => process.env[varName] || "");
        }
        transport = new StreamableHTTPClientTransport(new URL(config.url), {
          requestInit: {
            headers,
          },
        });
      } else {
        // Local subprocess connection
        const env: Record<string, string> = {};
        for (const [k, v] of Object.entries(process.env)) {
          if (v !== undefined) env[k] = v;
        }
        for (const [k, v] of Object.entries(config.env || {})) {
          if (v !== undefined) env[k] = v;
        }
        transport = new StdioClientTransport({
          command: config.command!,
          args: config.args!,
          env,
        });
      }

      const client = new Client(
        {
          name: "neonity",
          version: "0.1.0",
        },
        {
          capabilities: {} as any,
        }
      );

      await client.connect(transport);
      
      this.clients.set(name, client);
      this.transports.set(name, transport as any);
      this.statuses.set(name, { name, status: "connected", toolsCount: 0 });
      
    } catch (err: any) {
      this.statuses.set(name, { 
        name, 
        status: "failed", 
        toolsCount: 0,
        error: err.message 
      });
      console.error(`\nFailed to connect to MCP server '${name}': ${err.message}`);
    }
  }

  private async registerAllTools(): Promise<void> {
    for (const [name, client] of this.clients.entries()) {
      try {
        const toolsResponse = await client.listTools();
        const tools = toolsResponse.tools || [];
        
        let status = this.statuses.get(name);
        if (status) {
          status.toolsCount = tools.length;
        }

        for (const mcpToolDef of tools) {
          const toolAdapter = new McpTool(client, name, mcpToolDef);
          this.toolRegistry.register(toolAdapter);
          this.registeredTools.push(toolAdapter.name);
        }
      } catch (err: any) {
        console.error(`\nFailed to list tools for MCP server '${name}': ${err.message}`);
      }
    }
  }

  private async findConfigPath(): Promise<string | null> {
    const paths = [
      path.join(this.workingDirectory, ".neonity", "mcp_servers.json"),
      path.join(this.workingDirectory, ".mcp_servers.json"),
      path.join(this.workingDirectory, "mcp_servers.json"),
    ];

    for (const p of paths) {
      try {
        await fs.access(p);
        return p;
      } catch {
        // Ignored
      }
    }
    return null;
  }
}
