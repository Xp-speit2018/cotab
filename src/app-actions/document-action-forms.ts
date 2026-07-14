import { DOCUMENT_ACTION_DESCRIPTORS } from "@/core/actions/projections";
import { documentActionRegistry } from "@/core/actions/registry";

export type DocumentActionFormFieldKind =
  | "boolean"
  | "enum"
  | "integer"
  | "json"
  | "number"
  | "string";

export interface DocumentActionFormField {
  readonly name: string;
  readonly kind: DocumentActionFormFieldKind;
  readonly required: boolean;
  readonly nullable: boolean;
  readonly enumValues?: readonly unknown[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly exclusiveMinimum?: number;
  readonly exclusiveMaximum?: number;
  readonly schema: Record<string, unknown>;
}

export interface DocumentActionFormDefinition {
  readonly id: string;
  readonly i18nKey: string;
  readonly fields: readonly DocumentActionFormField[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function unwrapNullable(schema: Record<string, unknown>): {
  schema: Record<string, unknown>;
  nullable: boolean;
} {
  const variants = Array.isArray(schema.anyOf) ? schema.anyOf : [];
  const records = variants.map(asRecord).filter((value) => value !== null);
  const nullable = records.some((variant) => variant.type === "null");
  const valueSchema = records.find((variant) => variant.type !== "null");
  return { schema: valueSchema ?? schema, nullable };
}

function fieldKind(schema: Record<string, unknown>): DocumentActionFormFieldKind {
  if (Array.isArray(schema.enum)) return "enum";
  switch (schema.type) {
    case "boolean":
      return "boolean";
    case "integer":
      return "integer";
    case "number":
      return "number";
    case "string":
      return "string";
    default:
      return "json";
  }
}

function formDefinition(
  descriptor: (typeof DOCUMENT_ACTION_DESCRIPTORS)[number],
): DocumentActionFormDefinition {
  const properties = asRecord(descriptor.argsSchema.properties) ?? {};
  const required = new Set(
    Array.isArray(descriptor.argsSchema.required)
      ? descriptor.argsSchema.required.filter(
          (name): name is string => typeof name === "string",
        )
      : [],
  );
  return {
    id: descriptor.id,
    i18nKey: descriptor.i18nKey,
    fields: Object.entries(properties).flatMap(([name, value]) => {
      const rawSchema = asRecord(value);
      if (!rawSchema) return [];
      const unwrapped = unwrapNullable(rawSchema);
      return [{
        name,
        kind: fieldKind(unwrapped.schema),
        required: required.has(name),
        nullable: unwrapped.nullable,
        ...(Array.isArray(unwrapped.schema.enum)
          ? { enumValues: unwrapped.schema.enum }
          : {}),
        ...(typeof unwrapped.schema.minimum === "number"
          ? { minimum: unwrapped.schema.minimum }
          : {}),
        ...(typeof unwrapped.schema.maximum === "number"
          ? { maximum: unwrapped.schema.maximum }
          : {}),
        ...(typeof unwrapped.schema.exclusiveMinimum === "number"
          ? { exclusiveMinimum: unwrapped.schema.exclusiveMinimum }
          : {}),
        ...(typeof unwrapped.schema.exclusiveMaximum === "number"
          ? { exclusiveMaximum: unwrapped.schema.exclusiveMaximum }
          : {}),
        schema: rawSchema,
      }];
    }),
  };
}

export const DOCUMENT_ACTION_FORM_DEFINITIONS: readonly DocumentActionFormDefinition[] =
  DOCUMENT_ACTION_DESCRIPTORS.map(formDefinition);

export function getDocumentActionFormDefinition(
  actionId: string,
): DocumentActionFormDefinition | undefined {
  return DOCUMENT_ACTION_FORM_DEFINITIONS.find((form) => form.id === actionId);
}

function defaultFieldValue(field: DocumentActionFormField): unknown {
  if (field.nullable) return null;
  if (field.enumValues && field.enumValues.length > 0) return field.enumValues[0];
  switch (field.kind) {
    case "boolean":
      return false;
    case "integer":
    case "number":
      if (field.minimum !== undefined) return field.minimum;
      if (field.exclusiveMinimum !== undefined) return field.exclusiveMinimum + 1;
      return 0;
    case "string":
      return "";
    case "json": {
      const unwrapped = unwrapNullable(field.schema).schema;
      return unwrapped.type === "array" ? [] : {};
    }
  }
}

export function createDocumentActionFormArgs(actionId: string): Record<string, unknown> {
  const definition = getDocumentActionFormDefinition(actionId);
  if (!definition) return {};
  return Object.fromEntries(
    definition.fields
      .filter((field) => field.required)
      .map((field) => [field.name, defaultFieldValue(field)]),
  );
}

export function validateDocumentActionFormArgs(
  actionId: string,
  args: unknown,
):
  | { readonly success: true; readonly data: Record<string, unknown> }
  | { readonly success: false; readonly message: string } {
  const action = documentActionRegistry.get(actionId);
  if (!action) {
    return { success: false, message: `Unknown document action: ${actionId}` };
  }
  const parsed = action.argsSchema.safeParse(args);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues
        .map((issue) => {
          const path = issue.path.length > 0 ? issue.path.join(".") : "args";
          return `${path}: ${issue.message}`;
        })
        .join("; "),
    };
  }
  return { success: true, data: parsed.data };
}
