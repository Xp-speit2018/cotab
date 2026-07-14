/**
 * Headless document editing protocol. Transport and view actions live above
 * core because they depend on local player or UI state.
 */

export { DOCUMENT_ACTIONS } from "./catalog";
export {
  documentActionRegistry,
  DocumentActionArgumentsError,
  executeDocumentAction,
  executeDocumentActionById,
  getAllDocumentActions,
  UnknownDocumentActionError,
} from "./registry";
export { actionArgsJsonSchema } from "./definition";
export {
  DOCUMENT_ACTION_DESCRIPTORS,
  EXECUTE_DOCUMENT_ACTION_JSON_SCHEMA,
} from "./projections";
export type {
  DocumentActionDescriptor,
  JsonSchema,
} from "./projections";
export type {
  DocumentActionArgs,
  DocumentActionArgsSchema,
  DocumentActionCategory,
  DocumentActionDefinition,
  DocumentActionExecutionContext,
  DocumentActionId,
  DocumentActionResult,
} from "./types";
