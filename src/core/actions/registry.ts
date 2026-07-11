import type {
  DocumentActionArgs,
  DocumentActionDefinition,
  DocumentActionExecutionContext,
  DocumentActionId,
  DocumentActionResult,
} from "./types";
import { debugLog } from "@/core/editor/action-log";

class DocumentActionRegistry {
  private readonly actions = new Map<string, DocumentActionDefinition<unknown, unknown>>();

  register<TArgs = void, TResult = void | boolean>(
    definition: DocumentActionDefinition<TArgs, TResult>,
  ): void {
    if (this.actions.has(definition.id)) {
      debugLog("warn", "DocumentActionRegistry", "duplicate action registration ignored", {
        id: definition.id,
      });
      return;
    }
    this.actions.set(definition.id, definition as DocumentActionDefinition<unknown, unknown>);
  }

  get<TArgs = void, TResult = void | boolean>(
    id: string,
  ): DocumentActionDefinition<TArgs, TResult> | undefined {
    return this.actions.get(id) as DocumentActionDefinition<TArgs, TResult> | undefined;
  }

  getAll(): readonly DocumentActionDefinition<unknown, unknown>[] {
    return Array.from(this.actions.values());
  }
}

export const documentActionRegistry = new DocumentActionRegistry();

export function executeDocumentAction<Id extends DocumentActionId>(
  id: Id,
  args: DocumentActionArgs<Id>,
  context: DocumentActionExecutionContext,
): DocumentActionResult<Id> | undefined {
  const definition = documentActionRegistry.get<DocumentActionArgs<Id>, DocumentActionResult<Id>>(id);
  if (!definition) {
    debugLog("warn", "action", "unknown", { id });
    return undefined;
  }

  debugLog("debug", "action", "execute", { id, args });
  const start = performance.now?.() ?? Date.now();

  try {
    const result = definition.execute(args, context);
    const end = performance.now?.() ?? Date.now();
    const durationMs = end - start;

    if (result !== undefined) {
      debugLog("debug", "action", "result", { id, result, durationMs });
    } else if (durationMs > 1) {
      debugLog("debug", "action", "done", { id, durationMs });
    }

    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const end = performance.now?.() ?? Date.now();
    const durationMs = end - start;

    debugLog("error", "action", "failed", {
      id,
      durationMs,
      error: err.message,
      stack: err.stack,
    });
    throw error;
  }
}

export function executeDocumentActionUnsafe<TArgs = void, TResult = void | boolean>(
  id: string,
  args: TArgs,
  context: DocumentActionExecutionContext,
): TResult | undefined {
  const definition = documentActionRegistry.get<TArgs, TResult>(id);
  if (!definition) {
    debugLog("warn", "action", "unknown-unsafe", { id });
    return undefined;
  }
  debugLog("debug", "action", "execute-unsafe", { id, args });
  const start = performance.now?.() ?? Date.now();

  try {
    const result = definition.execute(args, context);
    const end = performance.now?.() ?? Date.now();
    const durationMs = end - start;

    if (result !== undefined) {
      debugLog("debug", "action", "result-unsafe", { id, result, durationMs });
    } else if (durationMs > 1) {
      debugLog("debug", "action", "done-unsafe", { id, durationMs });
    }

    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const end = performance.now?.() ?? Date.now();
    const durationMs = end - start;

    debugLog("error", "action", "failed-unsafe", {
      id,
      durationMs,
      error: err.message,
      stack: err.stack,
    });
    throw error;
  }
}

export function getAllDocumentActions(): readonly DocumentActionDefinition<unknown, unknown>[] {
  return documentActionRegistry.getAll();
}
