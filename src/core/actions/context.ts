import type { TFunction } from "i18next";
import type { DocumentActionExecutionContext } from "./types";

const identityT = ((key: string) => key) as unknown as TFunction;

export function createIdentityDocumentActionContext(): DocumentActionExecutionContext {
  return { t: identityT };
}
