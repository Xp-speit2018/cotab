/**
 * MCP stdio adapter — headless engine access via the MCP protocol.
 *
 * This is not a sync authority. It is a local protocol host over the same
 * shared editor engine used by the Web UI and CLI targets.
 *
 * The stdio transport delegates every tool to the same minimal MCP dispatcher
 * used by the browser Agent Runtime.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
  type ListToolsRequest,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { localEngineHost } from "@/adapters/local/engine-host";
import {
  executeMinimalMcpTool,
  MINIMAL_MCP_TOOLS,
} from "@/protocol/minimal-mcp";

// Main handler router
async function handleToolCall(request: CallToolRequest) {
  const { name, arguments: args } = request.params;
  const result = executeMinimalMcpTool(localEngineHost, name, args ?? {});
  const payload = result.ok
    ? { success: true, result: result.value ?? null }
    : { success: false, error: result.error };
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    ...(result.ok ? {} : { isError: true }),
  };
}

export async function startServer(): Promise<void> {
  const server = new Server(
    {
      name: "cotab-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, (_request: ListToolsRequest) => {
    return { tools: MINIMAL_MCP_TOOLS as readonly Tool[] };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    return handleToolCall(request);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr so it doesn't interfere with stdio protocol
  console.error("CoTab MCP stdio adapter started");
}
