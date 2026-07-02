/**
 * MCP stdio adapter — headless engine access via the MCP protocol.
 *
 * This is not a sync authority. It is a local protocol host over the same
 * shared editor engine used by the Web UI and CLI targets.
 *
 * Proves the editor engine runs in Node.js without DOM by:
 * 1. Importing the engine without Web UI or WebRTC adapter code
 * 2. Loading and manipulating scores via actions
 * 3. Exporting to GP7 format
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
  type ListToolsRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { localEngineHost } from "@/adapters/local/engine-host";
import type { SelectedBeat } from "@/core/engine";

// Tool definitions
const TOOLS = [
  {
    name: "get_score",
    description: "Get the full score as JSON",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "execute_action",
    description: "Execute a registered action by ID with arguments",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Action ID (e.g., edit.score.setTitle)" },
        args: { type: "object", description: "Action arguments" },
      },
      required: ["id"],
    },
  },
  {
    name: "set_selection",
    description: "Set the current selection (cursor position)",
    inputSchema: {
      type: "object" as const,
      properties: {
        trackIndex: { type: "number" },
        staffIndex: { type: "number" },
        voiceIndex: { type: "number" },
        barIndex: { type: "number" },
        beatIndex: { type: "number" },
        string: { type: "number", nullable: true },
      },
      required: ["trackIndex", "staffIndex", "voiceIndex", "barIndex", "beatIndex"],
    },
  },
  {
    name: "get_selection",
    description: "Get the current selection",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "undo",
    description: "Undo the last change",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "redo",
    description: "Redo the last undone change",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "init_doc",
    description: "Initialize a new blank document",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "list_actions",
    description: "List all registered action IDs",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

// Tool handlers
function handleGetScore() {
  const snapshot = localEngineHost.snapshot();
  return {
    content: [{ type: "text" as const, text: JSON.stringify(snapshot, null, 2) }],
  };
}

function handleExecuteAction(args: { id: string; args?: unknown }) {
  try {
    const result = localEngineHost.executeAction(args.id, args.args ?? undefined);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ success: true, result }, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: message }) }],
      isError: true,
    };
  }
}

function handleSetSelection(args: {
  trackIndex: number;
  staffIndex: number;
  voiceIndex: number;
  barIndex: number;
  beatIndex: number;
  string?: number | null;
}) {
  const selection: SelectedBeat = {
    trackIndex: args.trackIndex,
    staffIndex: args.staffIndex,
    voiceIndex: args.voiceIndex,
    barIndex: args.barIndex,
    beatIndex: args.beatIndex,
    string: args.string ?? null,
  };
  localEngineHost.setSelection(selection);
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ success: true, selection }) }],
  };
}

function handleGetSelection() {
  const selection = localEngineHost.getSelection();
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ selection }, null, 2) }],
  };
}

function handleUndo() {
  if (!localEngineHost.undo()) {
    return { content: [{ type: "text" as const, text: "No undo manager available" }] };
  }
  return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, operation: "undo" }) }] };
}

function handleRedo() {
  if (!localEngineHost.redo()) {
    return { content: [{ type: "text" as const, text: "No undo manager available" }] };
  }
  return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, operation: "redo" }) }] };
}

function handleInitDoc() {
  localEngineHost.ensureDocument();
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ success: true, operation: "initDoc" }) }],
  };
}

function handleListActions() {
  const ids = localEngineHost.listActionIds();
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ actions: ids }, null, 2) }],
  };
}

// Main handler router
async function handleToolCall(request: CallToolRequest) {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "get_score":
      return handleGetScore();
    case "execute_action":
      return handleExecuteAction(args as { id: string; args?: unknown });
    case "set_selection":
      return handleSetSelection(args as { trackIndex: number; staffIndex: number; voiceIndex: number; barIndex: number; beatIndex: number; string?: number | null });
    case "get_selection":
      return handleGetSelection();
    case "undo":
      return handleUndo();
    case "redo":
      return handleRedo();
    case "init_doc":
      return handleInitDoc();
    case "list_actions":
      return handleListActions();
    default:
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
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
    return { tools: TOOLS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    return handleToolCall(request);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr so it doesn't interfere with stdio protocol
  console.error("CoTab MCP stdio adapter started");
}
