import type { TFunction } from "i18next";

export type ActionCategory =
  | "playback"
  | "navigation"
  | "edit.score"
  | "edit.track"
  | "edit.staff"
  | "edit.bar"
  | "edit.beat"
  | "edit.note"
  | "edit.history"
  | "view";

export type PrimitiveParamType = "boolean" | "number" | "string" | "enum";

export interface ActionParamSchema {
  readonly name: string;
  readonly type: PrimitiveParamType;
  readonly enumValues?: readonly string[];
  /**
   * Base i18n key for this parameter's label/description.
   * Implementations should resolve it via the translation function.
   */
  readonly i18nKey?: string;
}

export interface ActionExecutionContext {
  /**
   * i18n translation function for resolving human-readable labels.
   * Actions should never hardcode user-facing strings.
   */
  readonly t: TFunction;
}

export interface ActionDefinition<TArgs = void, TResult = void | boolean> {
  readonly id: string;
  /**
   * Base i18n key; consumers are expected to use
   * `${i18nKey}.name` and `${i18nKey}.description`.
   */
  readonly i18nKey: string;
  readonly category: ActionCategory;
  readonly params?: readonly ActionParamSchema[];
  execute(args: TArgs, context: ActionExecutionContext): TResult;
  isEnabled?(): boolean;
}

declare global {
  /**
   * Global action map used for compile-time typing of action IDs,
   * argument payloads, and results. Individual action modules
   * augment this interface with their own entries.
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface ActionMap {}
}

export type ActionId = keyof ActionMap;

export type ActionArgs<Id extends ActionId> = ActionMap[Id]["args"];

export type ActionResult<Id extends ActionId> = ActionMap[Id]["result"];

export {};

