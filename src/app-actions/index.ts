import "@/core/actions";
import { registerSelectorActions } from "./selector-actions";
import { registerStorageActions } from "./storage-actions";
import { registerTransportActions } from "./transport-actions";
import { registerViewActions } from "./view-actions";

registerSelectorActions();
registerStorageActions();
registerTransportActions();
registerViewActions();

export {
  appActionRegistry,
  executeAppAction,
  executeAppActionUnsafe,
  getAllAppActions,
  isDocumentAppAction,
  registerAppAction,
} from "./registry";
export {
  createDocumentActionFormArgs,
  DOCUMENT_ACTION_FORM_DEFINITIONS,
  getDocumentActionFormDefinition,
  validateDocumentActionFormArgs,
} from "./document-action-forms";
export type {
  DocumentActionFormDefinition,
  DocumentActionFormField,
  DocumentActionFormFieldKind,
} from "./document-action-forms";
export type {
  AppActionArgs,
  AppActionDefinition,
  AppActionDomain,
  AppActionExecutionContext,
  AppActionId,
  AppActionResult,
} from "./types";
