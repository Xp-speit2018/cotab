import { DOCUMENT_ACTIONS } from "@/core/actions/catalog";
import {
  DocumentActionArgumentsError,
  UnknownDocumentActionError,
} from "@/core/actions/registry";
import {
  EXECUTE_DOCUMENT_ACTION_JSON_SCHEMA,
  type DocumentActionDescriptor,
  type JsonSchema,
} from "@/core/actions/projections";
import type { SelectedBeat } from "@/core/engine";

export type { JsonSchema } from "@/core/actions/projections";

export interface MinimalMcpToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
}

export type CoreEditActionDescriptor = DocumentActionDescriptor;

export interface CoreEditSelection extends SelectedBeat {
  noteIndex?: number;
}

export interface MinimalMcpHost {
  snapshot(): unknown;
  listActions(): readonly CoreEditActionDescriptor[];
  executeDocumentAction(id: string, args: unknown): unknown;
  setSelection(selection: CoreEditSelection): CoreEditSelection | null;
  getSelection(): CoreEditSelection | null;
  undo(): boolean;
  redo(): boolean;
}

export type MinimalMcpErrorCode =
  | "invalid_arguments"
  | "unknown_tool"
  | "execution_failed";

export type MinimalMcpCallResult =
  | { readonly ok: true; readonly value: unknown }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: MinimalMcpErrorCode;
        readonly message: string;
      };
    };

const EMPTY_OBJECT_SCHEMA: JsonSchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

export const MINIMAL_MCP_TOOLS: readonly MinimalMcpToolDefinition[] = [
  {
    name: "get_score",
    description: "Get the full CoTab score as JSON.",
    inputSchema: EMPTY_OBJECT_SCHEMA,
  },
  {
    name: "list_actions",
    description: "List the core-edit actions available in this CoTab runtime.",
    inputSchema: EMPTY_OBJECT_SCHEMA,
  },
  {
    name: "execute_action",
    description: "Execute a core-edit action using the object arguments defined by that action.",
    inputSchema: EXECUTE_DOCUMENT_ACTION_JSON_SCHEMA,
  },
  {
    name: "set_selection",
    description: "Set this runtime peer's selector before executing selection-scoped actions.",
    inputSchema: {
      type: "object",
      properties: {
        trackIndex: { type: "integer", minimum: 0 },
        staffIndex: { type: "integer", minimum: 0 },
        voiceIndex: { type: "integer", minimum: 0 },
        barIndex: { type: "integer", minimum: 0 },
        beatIndex: { type: "integer", minimum: 0 },
        string: { type: ["integer", "null"] },
        noteIndex: { type: "integer", minimum: -1 },
      },
      required: ["trackIndex", "staffIndex", "voiceIndex", "barIndex", "beatIndex"],
      additionalProperties: false,
    },
  },
  {
    name: "get_selection",
    description: "Get this runtime peer's current selector.",
    inputSchema: EMPTY_OBJECT_SCHEMA,
  },
  {
    name: "undo",
    description: "Undo this runtime peer's most recent document edit.",
    inputSchema: EMPTY_OBJECT_SCHEMA,
  },
  {
    name: "redo",
    description: "Redo this runtime peer's most recently undone document edit.",
    inputSchema: EMPTY_OBJECT_SCHEMA,
  },
];

function invalidArguments(message: string): MinimalMcpCallResult {
  return {
    ok: false,
    error: { code: "invalid_arguments", message },
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readIndex(
  args: Record<string, unknown>,
  name: string,
  optional: boolean = false,
): number | undefined {
  const value = args[name];
  if (value === undefined && optional) return undefined;
  if (!Number.isInteger(value) || (value as number) < (name === "noteIndex" ? -1 : 0)) {
    throw new Error(`${name} must be an integer in range.`);
  }
  return value as number;
}

function parseSelection(value: unknown): CoreEditSelection | MinimalMcpCallResult {
  const args = asRecord(value);
  if (!args) return invalidArguments("set_selection expects an object argument.");

  try {
    const stringValue = args.string;
    if (
      stringValue !== undefined &&
      stringValue !== null &&
      !Number.isInteger(stringValue)
    ) {
      return invalidArguments("string must be an integer or null.");
    }

    const selection: CoreEditSelection = {
      trackIndex: readIndex(args, "trackIndex")!,
      staffIndex: readIndex(args, "staffIndex")!,
      voiceIndex: readIndex(args, "voiceIndex")!,
      barIndex: readIndex(args, "barIndex")!,
      beatIndex: readIndex(args, "beatIndex")!,
      string: (stringValue as number | null | undefined) ?? null,
    };
    const noteIndex = readIndex(args, "noteIndex", true);
    if (noteIndex !== undefined) selection.noteIndex = noteIndex;
    return selection;
  } catch (error) {
    return invalidArguments(error instanceof Error ? error.message : String(error));
  }
}

export function executeMinimalMcpTool(
  host: MinimalMcpHost,
  toolName: string,
  rawArguments: unknown = {},
): MinimalMcpCallResult {
  try {
    switch (toolName) {
      case "get_score":
        return { ok: true, value: host.snapshot() };
      case "list_actions":
        return { ok: true, value: host.listActions() };
      case "execute_action": {
        const args = asRecord(rawArguments);
        if (
          !args ||
          typeof args.id !== "string" ||
          !("args" in args)
        ) {
          return invalidArguments(
            "execute_action requires a string id and an args object.",
          );
        }
        const action = DOCUMENT_ACTIONS.find((candidate) => candidate.id === args.id);
        if (!action) {
          return invalidArguments(`Unknown document action: ${args.id}`);
        }
        const parsed = action.argsSchema.safeParse(args.args);
        if (!parsed.success) {
          return invalidArguments(
            new DocumentActionArgumentsError(action.id, parsed.error).message,
          );
        }
        return {
          ok: true,
          value: host.executeDocumentAction(args.id, parsed.data),
        };
      }
      case "set_selection": {
        const selection = parseSelection(rawArguments);
        if ("ok" in selection) return selection;
        return { ok: true, value: host.setSelection(selection) };
      }
      case "get_selection":
        return { ok: true, value: host.getSelection() };
      case "undo":
        return { ok: true, value: host.undo() };
      case "redo":
        return { ok: true, value: host.redo() };
      default:
        return {
          ok: false,
          error: {
            code: "unknown_tool",
            message: `Unknown CoTab MCP tool: ${toolName}`,
          },
        };
    }
  } catch (error) {
    if (
      error instanceof DocumentActionArgumentsError ||
      error instanceof UnknownDocumentActionError
    ) {
      return invalidArguments(error.message);
    }
    return {
      ok: false,
      error: {
        code: "execution_failed",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
