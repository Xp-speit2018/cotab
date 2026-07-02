import type { TFunction } from "i18next";
import type { ActionExecutionContext } from "./types";

const identityT = ((key: string) => key) as unknown as TFunction;

export function createIdentityActionContext(): ActionExecutionContext {
  return { t: identityT };
}
