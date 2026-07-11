import type { TFunction } from "i18next";

export type DocumentActionCategory =
  | "document.score"
  | "document.track"
  | "document.staff"
  | "document.bar"
  | "document.masterBar"
  | "document.beat"
  | "document.note"
  | "document.history"
  | "document.clipboard";

export type PrimitiveParamType = "boolean" | "number" | "string" | "enum";

export interface DocumentActionParamSchema {
  readonly name: string;
  readonly type: PrimitiveParamType;
  readonly enumValues?: readonly string[];
  /**
   * Base i18n key for this parameter's label/description.
   * Implementations should resolve it via the translation function.
   */
  readonly i18nKey?: string;
}

export interface DocumentActionExecutionContext {
  /**
   * i18n translation function for resolving human-readable labels.
   * Actions should never hardcode user-facing strings.
   */
  readonly t: TFunction;
}

export interface DocumentActionDefinition<TArgs = void, TResult = void | boolean> {
  readonly id: string;
  /**
   * Base i18n key; consumers are expected to use
   * `${i18nKey}.name` and `${i18nKey}.description`.
   */
  readonly i18nKey: string;
  readonly category: DocumentActionCategory;
  readonly params?: readonly DocumentActionParamSchema[];
  execute(args: TArgs, context: DocumentActionExecutionContext): TResult;
  isEnabled?(): boolean;
}

declare global {
  /**
   * Global map for the current DocumentAction registry in src/core/actions.
   * Individual action modules augment this interface with their own entries.
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface DocumentActionMap {}
}

export type DocumentActionId = keyof DocumentActionMap;

export type DocumentActionArgs<Id extends DocumentActionId> = DocumentActionMap[Id]["args"];

export type DocumentActionResult<Id extends DocumentActionId> = DocumentActionMap[Id]["result"];

export {};
