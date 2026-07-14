import { DOCUMENT_ACTIONS } from "./catalog";
import { actionArgsJsonSchema } from "./definition";
import type { DocumentActionCategory } from "./types";

export type JsonSchema = Record<string, unknown>;

export interface DocumentActionDescriptor {
  readonly id: string;
  readonly category: DocumentActionCategory;
  readonly i18nKey: string;
  readonly argsSchema: JsonSchema;
}

export const DOCUMENT_ACTION_DESCRIPTORS: readonly DocumentActionDescriptor[] =
  DOCUMENT_ACTIONS.map((action) => ({
    id: action.id,
    category: action.category,
    i18nKey: action.i18nKey,
    argsSchema: actionArgsJsonSchema(action.argsSchema),
  })).sort((a, b) => a.id.localeCompare(b.id));

export const EXECUTE_DOCUMENT_ACTION_JSON_SCHEMA: JsonSchema = {
  type: "object",
  oneOf: DOCUMENT_ACTION_DESCRIPTORS.map((action) => ({
    type: "object",
    properties: {
      id: { const: action.id },
      args: action.argsSchema,
    },
    required: ["id", "args"],
    additionalProperties: false,
  })),
};
