import "@/core/actions";
import { executeActionUnsafe, getAllActions } from "@/core/actions/registry";
import type { ActionCategory } from "@/core/actions/types";
import { registerAppAction } from "./registry";
import type { AppActionDomain } from "./types";

function domainForCoreAction(category: ActionCategory): AppActionDomain {
  if (category === "navigation") return "selector";
  return "document";
}

export function registerDocumentAppActions(): void {
  for (const action of getAllActions()) {
    registerAppAction({
      id: action.id,
      domain: domainForCoreAction(action.category),
      i18nKey: action.i18nKey,
      category: action.category,
      execute: (args, context) => executeActionUnsafe(action.id, args, context),
      ...(action.isEnabled ? { isEnabled: () => action.isEnabled?.() ?? true } : {}),
    });
  }
}
