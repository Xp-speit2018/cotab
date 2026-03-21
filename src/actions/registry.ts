import type {
  ActionArgs,
  ActionDefinition,
  ActionExecutionContext,
  ActionId,
  ActionResult,
} from "./types";
import { debugLog } from "@/core/editor/action-log";

class ActionRegistry {
  private readonly actions = new Map<string, ActionDefinition<unknown, unknown>>();

  register<TArgs = void, TResult = void | boolean>(
    definition: ActionDefinition<TArgs, TResult>,
  ): void {
    if (this.actions.has(definition.id)) {
      debugLog("warn", "ActionRegistry", "duplicate action registration ignored", {
        id: definition.id,
      });
      return;
    }
    this.actions.set(definition.id, definition as ActionDefinition<unknown, unknown>);
  }

  get<TArgs = void, TResult = void | boolean>(
    id: string,
  ): ActionDefinition<TArgs, TResult> | undefined {
    return this.actions.get(id) as ActionDefinition<TArgs, TResult> | undefined;
  }

  getAll(): readonly ActionDefinition<unknown, unknown>[] {
    return Array.from(this.actions.values());
  }
}

export const actionRegistry = new ActionRegistry();

export function executeAction<Id extends ActionId>(
  id: Id,
  args: ActionArgs<Id>,
  context: ActionExecutionContext,
): ActionResult<Id> | undefined {
  const definition = actionRegistry.get<ActionArgs<Id>, ActionResult<Id>>(id);
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

export function executeActionUnsafe<TArgs = void, TResult = void | boolean>(
  id: string,
  args: TArgs,
  context: ActionExecutionContext,
): TResult | undefined {
  const definition = actionRegistry.get<TArgs, TResult>(id);
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

export function getAllActions(): readonly ActionDefinition<unknown, unknown>[] {
  return actionRegistry.getAll();
}

