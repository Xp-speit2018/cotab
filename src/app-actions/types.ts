import type { TFunction } from "i18next";
import type {} from "@/core/actions/types";

export type AppActionDomain = "document" | "selector" | "transport" | "view";

export interface AppActionExecutionContext {
  readonly t: TFunction;
}

export interface AppActionDefinition<TArgs = void, TResult = void | boolean> {
  readonly id: string;
  readonly domain: AppActionDomain;
  readonly i18nKey?: string;
  readonly category?: string;
  execute(args: TArgs, context: AppActionExecutionContext): TResult;
  isEnabled?(): boolean;
}

declare global {
  /**
   * Top-level user action registry for UI controls and shortcuts.
   * DocumentAction IDs are included through the current core ActionMap.
   */
  interface AppActionMap extends ActionMap {}
}

export type AppActionId = keyof AppActionMap;

export type AppActionArgs<Id extends AppActionId> = AppActionMap[Id]["args"];

export type AppActionResult<Id extends AppActionId> = AppActionMap[Id]["result"];

export {};
