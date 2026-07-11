import "@/core/actions";
import { registerSelectorActions } from "./selector-actions";
import { registerTransportActions } from "./transport-actions";
import { registerViewActions } from "./view-actions";

registerSelectorActions();
registerTransportActions();
registerViewActions();

export {
  appActionRegistry,
  executeAppAction,
  executeAppActionUnsafe,
  getAllAppActions,
  registerAppAction,
} from "./registry";
export type {
  AppActionArgs,
  AppActionDefinition,
  AppActionDomain,
  AppActionExecutionContext,
  AppActionId,
  AppActionResult,
} from "./types";
