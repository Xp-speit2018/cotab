/**
 * DocumentActions — headless action system for the editor engine.
 *
 * These are not the whole AppAction space. TransportAction and ViewAction
 * implementations live above core because they may depend on local player or
 * UI state.
 */

import { executeDocumentAction as executeDocumentActionInternal } from "./registry";
import type { DocumentActionExecutionContext, DocumentActionId, DocumentActionArgs, DocumentActionResult } from "./types";

// Import pure actions to trigger registration
import "./edit-score";
import "./edit-staff";
import "./edit-history";
import "./edit-clipboard";
import "./edit-bar";
import "./edit-master-bar";
import "./edit-beat";
import "./edit-note";
import "./edit-track";

export { documentActionRegistry, getAllDocumentActions } from "./registry";
export type {
  DocumentActionCategory,
  DocumentActionDefinition,
  DocumentActionParamSchema,
  DocumentActionId,
  DocumentActionArgs,
  DocumentActionResult,
} from "./types";

export function executeDocumentAction<Id extends DocumentActionId>(
  id: Id,
  args: DocumentActionArgs<Id>,
  context: DocumentActionExecutionContext,
): DocumentActionResult<Id> | undefined {
  return executeDocumentActionInternal(id, args, context);
}
