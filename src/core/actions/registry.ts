import type * as z from "zod";
import { debugLog } from "@/core/editor/action-log";
import { DOCUMENT_ACTIONS, type AnyDocumentAction } from "./catalog";
import { formatActionArgsError } from "./definition";
import type {
  DocumentActionArgs,
  DocumentActionExecutionContext,
  DocumentActionId,
  DocumentActionResult,
} from "./types";

type RuntimeDocumentAction = {
  readonly id: string;
  readonly argsSchema: z.ZodType;
  execute(args: unknown, context: DocumentActionExecutionContext): unknown;
};

export class UnknownDocumentActionError extends Error {
  constructor(actionId: string) {
    super(`Unknown document action: ${actionId}`);
    this.name = "UnknownDocumentActionError";
  }
}

export class DocumentActionArgumentsError extends Error {
  readonly actionId: string;
  readonly cause: z.ZodError;

  constructor(actionId: string, cause: z.ZodError) {
    super(formatActionArgsError(actionId, cause));
    this.name = "DocumentActionArgumentsError";
    this.actionId = actionId;
    this.cause = cause;
  }
}

class DocumentActionRegistry {
  private readonly actions = new Map<string, AnyDocumentAction>();

  constructor() {
    for (const action of DOCUMENT_ACTIONS) {
      if (this.actions.has(action.id)) {
        throw new Error(`Duplicate document action definition: ${action.id}`);
      }
      this.actions.set(action.id, action);
    }
  }

  get<Id extends DocumentActionId>(
    id: Id,
  ): Extract<AnyDocumentAction, { readonly id: Id }> | undefined;
  get(id: string): AnyDocumentAction | undefined;
  get(id: string): AnyDocumentAction | undefined {
    return this.actions.get(id);
  }

  getAll(): readonly AnyDocumentAction[] {
    return DOCUMENT_ACTIONS;
  }
}

export const documentActionRegistry = new DocumentActionRegistry();

function executeValidatedDocumentAction(
  definition: AnyDocumentAction,
  args: unknown,
  context: DocumentActionExecutionContext,
): unknown {
  const runtimeDefinition = definition as unknown as RuntimeDocumentAction;
  const parsed = runtimeDefinition.argsSchema.safeParse(args);
  if (!parsed.success) {
    debugLog("warn", "action", "invalid-arguments", {
      id: definition.id,
      issues: parsed.error.issues,
    });
    throw new DocumentActionArgumentsError(definition.id, parsed.error);
  }

  debugLog("debug", "action", "execute", {
    id: definition.id,
    args: parsed.data,
  });
  const start = performance.now?.() ?? Date.now();

  try {
    const result = runtimeDefinition.execute(parsed.data, context);
    const durationMs = (performance.now?.() ?? Date.now()) - start;

    if (result !== undefined) {
      debugLog("debug", "action", "result", {
        id: definition.id,
        result,
        durationMs,
      });
    } else if (durationMs > 1) {
      debugLog("debug", "action", "done", {
        id: definition.id,
        durationMs,
      });
    }

    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    debugLog("error", "action", "failed", {
      id: definition.id,
      durationMs: (performance.now?.() ?? Date.now()) - start,
      error: err.message,
      stack: err.stack,
    });
    throw error;
  }
}

export function executeDocumentAction<Id extends DocumentActionId>(
  id: Id,
  args: DocumentActionArgs<Id>,
  context: DocumentActionExecutionContext,
): DocumentActionResult<Id> {
  const definition = documentActionRegistry.get(id);
  if (!definition) throw new UnknownDocumentActionError(id);
  return executeValidatedDocumentAction(
    definition,
    args,
    context,
  ) as DocumentActionResult<Id>;
}

export function executeDocumentActionById(
  id: string,
  args: unknown,
  context: DocumentActionExecutionContext,
): unknown {
  const definition = documentActionRegistry.get(id);
  if (!definition) throw new UnknownDocumentActionError(id);
  return executeValidatedDocumentAction(definition, args, context);
}

export function getAllDocumentActions(): readonly AnyDocumentAction[] {
  return documentActionRegistry.getAll();
}
