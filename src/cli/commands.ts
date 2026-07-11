import type { SelectedBeat } from "@/core/engine";
import { localEngineHost } from "@/adapters/local/engine-host";

export type CliOperation =
  | { type: "init" }
  | { type: "new" }
  | { type: "set_selection"; selection: SelectedBeat }
  | { type: "execute"; id: string; args?: unknown }
  | { type: "snapshot" }
  | { type: "list_actions" };

export interface CliResult {
  ok: true;
  result?: unknown;
  actions?: string[];
  snapshot?: unknown;
  operations?: unknown[];
}

export function runCliOperation(operation: CliOperation): unknown {
  switch (operation.type) {
    case "init":
      localEngineHost.resetDocument();
      return { initialized: true };
    case "new":
      localEngineHost.createDefaultScore();
      return { initialized: true, defaultScore: true };
    case "set_selection":
      return { selection: localEngineHost.setSelection(operation.selection) };
    case "execute":
      return localEngineHost.executeDocumentAction(operation.id, operation.args);
    case "snapshot":
      return localEngineHost.snapshot();
    case "list_actions":
      return localEngineHost.listActionIds();
    default: {
      const unreachable: never = operation;
      return unreachable;
    }
  }
}

function parseJsonArg(value: string | undefined): unknown {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON argument: ${message}`);
  }
}

export function runCliCommand(argv: readonly string[]): CliResult {
  const [command, ...rest] = argv;

  switch (command) {
    case "list-actions":
      return { ok: true, actions: localEngineHost.listActionIds() };
    case "init":
      runCliOperation({ type: "init" });
      return { ok: true, snapshot: localEngineHost.snapshot() };
    case "new":
      runCliOperation({ type: "new" });
      return { ok: true, snapshot: localEngineHost.snapshot() };
    case "snapshot":
      return { ok: true, snapshot: localEngineHost.snapshot() };
    case "exec": {
      const [id, jsonArgs] = rest;
      if (!id) {
        throw new Error("Usage: cotab:cli exec <action-id> [json-args]");
      }
      const result = runCliOperation({
        type: "execute",
        id,
        args: parseJsonArg(jsonArgs),
      });
      return { ok: true, result, snapshot: localEngineHost.snapshot() };
    }
    case "run": {
      const [jsonOperations] = rest;
      const parsed = parseJsonArg(jsonOperations);
      if (!Array.isArray(parsed)) {
        throw new Error("Usage: cotab:cli run '<json-operation-array>'");
      }
      const operations = parsed.map((operation) => runCliOperation(operation as CliOperation));
      return { ok: true, operations, snapshot: localEngineHost.snapshot() };
    }
    case "help":
    case undefined:
      return {
        ok: true,
        result: [
          "cotab:cli list-actions",
          "cotab:cli new",
          "cotab:cli exec <action-id> [json-args]",
          "cotab:cli run '<json-operation-array>'",
        ],
      };
    default:
      throw new Error(`Unknown CLI command: ${command}`);
  }
}
