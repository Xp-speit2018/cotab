import type * as z from "zod";
import type { DOCUMENT_ACTIONS } from "./catalog";

export type {
  DocumentActionArgsSchema,
  DocumentActionCategory,
  DocumentActionDefinition,
  DocumentActionExecutionContext,
} from "./definition";

type DocumentAction = (typeof DOCUMENT_ACTIONS)[number];
type DocumentActionById<Id extends DocumentActionId> = Extract<
  DocumentAction,
  { readonly id: Id }
>;

export type DocumentActionId = DocumentAction["id"];

export type DocumentActionArgs<Id extends DocumentActionId> = z.input<
  DocumentActionById<Id>["argsSchema"]
>;

export type DocumentActionResult<Id extends DocumentActionId> = ReturnType<
  DocumentActionById<Id>["execute"]
>;
