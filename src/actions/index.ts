import { executeAction as executeActionInternal } from "./registry";
import type { ActionExecutionContext, ActionId, ActionArgs, ActionResult } from "./types";
import "./navigation";
import "./edit-score";
import "./edit-track";
import "./edit-staff";
import "./edit-bar";
import "./edit-beat";
import "./edit-note";
import "./edit-history";
import "./edit-clipboard";

export { actionRegistry, getAllActions } from "./registry";
export type {
  ActionCategory,
  ActionDefinition,
  ActionParamSchema,
  ActionId,
  ActionArgs,
  ActionResult,
} from "./types";

export function executeAction<Id extends ActionId>(
  id: Id,
  args: ActionArgs<Id>,
  context: ActionExecutionContext,
): ActionResult<Id> | undefined {
  return executeActionInternal(id, args, context);
}

