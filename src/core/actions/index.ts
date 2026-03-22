/**
 * Core actions — headless action system for the editor engine.
 *
 * These actions operate purely on Y.Doc and engine state, with no
 * direct dependencies on React or the AlphaTab renderer.
 */

import { executeAction as executeActionInternal } from "./registry";
import type { ActionExecutionContext, ActionId, ActionArgs, ActionResult } from "./types";

// Import pure actions to trigger registration
import "./edit-score";
import "./edit-staff";
import "./edit-history";
import "./edit-clipboard";
import "./edit-bar";
import "./edit-beat";
import "./edit-note";
import "./edit-track";
import "./navigation";

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
