/**
 * MCP server — headless engine verification via stdio transport.
 *
 * Proves the editor engine runs in Node.js without DOM by:
 * 1. Importing the engine (which now lazy-loads y-webrtc)
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
import { engine } from "@/core/engine";
import "@/core/actions"; // Register all actions
import { executeActionUnsafe } from "@/core/actions/registry";
import { snapshotScore } from "@/core/schema";
import type { SelectedBeat } from "@/core/engine";

// Initialize engine on first use
function ensureEngine(): void {
  if (!engine.getDoc()) {
    engine.initDoc();
  }
}

// Build action execution context
function buildContext() {
  return {
    engine,
    selectedBeat: engine.selectedBeat,
  };
}

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
  ensureEngine();
  const scoreMap = engine.getScoreMap();
  if (!scoreMap) {
    return { content: [{ type: "text" as const, text: "No document loaded" }] };
  }
  const snapshot = snapshotScore(scoreMap);
  return {
    content: [{ type: "text" as const, text: JSON.stringify(snapshot, null, 2) }],
  };
}

function handleExecuteAction(args: { id: string; args?: unknown }) {
  ensureEngine();
  const ctx = buildContext();
  try {
    const result = executeActionUnsafe(args.id, args.args ?? undefined, ctx);
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
  ensureEngine();
  const selection: SelectedBeat = {
    trackIndex: args.trackIndex,
    staffIndex: args.staffIndex,
    voiceIndex: args.voiceIndex,
    barIndex: args.barIndex,
    beatIndex: args.beatIndex,
    string: args.string ?? null,
  };
  engine.localSetSelection(selection);
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ success: true, selection }) }],
  };
}

function handleGetSelection() {
  ensureEngine();
  const selection = engine.selectedBeat;
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ selection }, null, 2) }],
  };
}

function handleUndo() {
  ensureEngine();
  const undoManager = engine.getUndoManager();
  if (!undoManager) {
    return { content: [{ type: "text" as const, text: "No undo manager available" }] };
  }
  undoManager.undo();
  return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, operation: "undo" }) }] };
}

function handleRedo() {
  ensureEngine();
  const undoManager = engine.getUndoManager();
  if (!undoManager) {
    return { content: [{ type: "text" as const, text: "No undo manager available" }] };
  }
  undoManager.redo();
  return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, operation: "redo" }) }] };
}

function handleInitDoc() {
  engine.initDoc();
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ success: true, operation: "initDoc" }) }],
  };
}

async function handleListActions() {
  // Import dynamically to avoid circular issues
  const { getAllActions } = await import("@/core/actions/registry");
  const actions = getAllActions() as { id: string }[];
  const ids = actions.map((a) => a.id).sort();
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
      return await handleListActions();
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
  console.error("CoTab MCP server started on stdio");
}
