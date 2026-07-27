import type { TFunction } from "i18next";
import type {
  DocumentActionArgs,
  DocumentActionId,
  DocumentActionResult,
} from "@/core/actions/types";

export type AppActionDomain =
  | "document"
  | "selector"
  | "transport"
  | "view"
  | "storage";

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
   * This map contains only app-local selector, transport, and view actions.
   * Document actions are derived directly from the core action catalog.
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface AppActionMap {}
}

type NativeAppActionId = keyof AppActionMap;

export type AppActionId = DocumentActionId | NativeAppActionId;

export type AppActionArgs<Id extends AppActionId> =
  Id extends DocumentActionId
    ? DocumentActionArgs<Id>
    : Id extends NativeAppActionId
      ? AppActionMap[Id]["args"]
      : never;

export type AppActionResult<Id extends AppActionId> =
  Id extends DocumentActionId
    ? DocumentActionResult<Id>
    : Id extends NativeAppActionId
      ? AppActionMap[Id]["result"]
      : never;

export {};
