import { debugLog } from "@/core/editor/action-log";
import {
  documentActionRegistry,
  executeDocumentActionById,
  getAllDocumentActions,
} from "@/core/actions/registry";
import type { AnyDocumentAction } from "@/core/actions/catalog";
import type {
  AppActionArgs,
  AppActionDefinition,
  AppActionExecutionContext,
  AppActionId,
  AppActionResult,
} from "./types";

class AppActionRegistry {
  private readonly actions = new Map<string, AppActionDefinition<unknown, unknown>>();

  register<TArgs = void, TResult = void | boolean>(
    definition: AppActionDefinition<TArgs, TResult>,
  ): void {
    if (this.actions.has(definition.id)) {
      debugLog("warn", "AppActionRegistry", "duplicate action registration ignored", {
        id: definition.id,
      });
      return;
    }
    this.actions.set(definition.id, definition as AppActionDefinition<unknown, unknown>);
  }

  get<TArgs = void, TResult = void | boolean>(
    id: string,
  ): AppActionDefinition<TArgs, TResult> | undefined {
    return this.actions.get(id) as AppActionDefinition<TArgs, TResult> | undefined;
  }

  getAll(): readonly AppActionDefinition<unknown, unknown>[] {
    return Array.from(this.actions.values());
  }
}

export const appActionRegistry = new AppActionRegistry();

export function isDocumentAppAction(id: string): boolean {
  return documentActionRegistry.get(id) !== undefined;
}

function documentActionAsAppAction(
  definition: AnyDocumentAction,
): AppActionDefinition<unknown, unknown> {
  return {
    id: definition.id,
    domain: "document",
    i18nKey: definition.i18nKey,
    category: definition.category,
    execute: (args, context) =>
      executeDocumentActionById(definition.id, args, context),
    ...(definition.isEnabled
      ? { isEnabled: () => definition.isEnabled?.() ?? true }
      : {}),
  };
}

export function registerAppAction<TArgs = void, TResult = void | boolean>(
  definition: AppActionDefinition<TArgs, TResult>,
): void {
  appActionRegistry.register(definition);
}

export function executeAppAction<Id extends AppActionId>(
  id: Id,
  args: AppActionArgs<Id>,
  context: AppActionExecutionContext,
): AppActionResult<Id> | undefined {
  const actionId = String(id);
  const documentDefinition = documentActionRegistry.get(actionId);
  if (documentDefinition) {
    return executeDocumentActionById(
      actionId,
      args,
      context,
    ) as AppActionResult<Id>;
  }

  const definition = appActionRegistry.get<
    AppActionArgs<Id>,
    AppActionResult<Id>
  >(actionId);
  if (!definition) {
    debugLog("warn", "app-action", "unknown", { id: String(id) });
    return undefined;
  }

  debugLog("debug", "app-action", "execute", { id: String(id), args });
  const start = performance.now?.() ?? Date.now();

  try {
    const result = definition.execute(args, context);
    const end = performance.now?.() ?? Date.now();
    const durationMs = end - start;

    if (result !== undefined) {
      debugLog("debug", "app-action", "result", { id: String(id), result, durationMs });
    } else if (durationMs > 1) {
      debugLog("debug", "app-action", "done", { id: String(id), durationMs });
    }

    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const end = performance.now?.() ?? Date.now();
    const durationMs = end - start;

    debugLog("error", "app-action", "failed", {
      id: String(id),
      durationMs,
      error: err.message,
      stack: err.stack,
    });
    throw error;
  }
}

export function executeAppActionUnsafe<TArgs = void, TResult = void | boolean>(
  id: string,
  args: TArgs,
  context: AppActionExecutionContext,
): TResult | undefined {
  const documentDefinition = documentActionRegistry.get(id);
  if (documentDefinition) {
    return executeDocumentActionById(id, args, context) as TResult;
  }

  const definition = appActionRegistry.get<TArgs, TResult>(id);
  if (!definition) {
    debugLog("warn", "app-action", "unknown-unsafe", { id });
    return undefined;
  }

  debugLog("debug", "app-action", "execute-unsafe", { id, args });
  const start = performance.now?.() ?? Date.now();

  try {
    const result = definition.execute(args, context);
    const end = performance.now?.() ?? Date.now();
    const durationMs = end - start;

    if (result !== undefined) {
      debugLog("debug", "app-action", "result-unsafe", { id, result, durationMs });
    } else if (durationMs > 1) {
      debugLog("debug", "app-action", "done-unsafe", { id, durationMs });
    }

    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const end = performance.now?.() ?? Date.now();
    const durationMs = end - start;

    debugLog("error", "app-action", "failed-unsafe", {
      id,
      durationMs,
      error: err.message,
      stack: err.stack,
    });
    throw error;
  }
}

export function getAllAppActions(): readonly AppActionDefinition<unknown, unknown>[] {
  return [
    ...getAllDocumentActions().map((action) => documentActionAsAppAction(action)),
    ...appActionRegistry.getAll(),
  ];
}
