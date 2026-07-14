import type { TFunction } from "i18next";
import * as z from "zod";

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

export interface DocumentActionExecutionContext {
  readonly t: TFunction;
}

export type DocumentActionArgsSchema = z.ZodObject;

export interface DocumentActionDefinition<
  Id extends string = string,
  ArgsSchema extends DocumentActionArgsSchema = DocumentActionArgsSchema,
  Result = void | boolean,
> {
  readonly id: Id;
  readonly i18nKey: string;
  readonly category: DocumentActionCategory;
  readonly argsSchema: ArgsSchema;
  execute(
    args: z.output<ArgsSchema>,
    context: DocumentActionExecutionContext,
  ): Result;
  isEnabled?(): boolean;
}

export function defineDocumentAction<
  const Id extends string,
  ArgsSchema extends DocumentActionArgsSchema,
  Result,
>(
  definition: DocumentActionDefinition<Id, ArgsSchema, Result>,
): DocumentActionDefinition<Id, ArgsSchema, Result> {
  return definition;
}

export function actionArgs<const Shape extends z.ZodRawShape>(
  shape: Shape,
): z.ZodObject<Shape> {
  return z.strictObject(shape);
}

export const emptyActionArgs = z.strictObject({});

export function actionArgsJsonSchema(
  schema: DocumentActionArgsSchema,
): Record<string, unknown> {
  const { $schema: _draft, ...jsonSchema } = z.toJSONSchema(schema, {
    target: "draft-07",
  }) as Record<string, unknown>;
  return jsonSchema;
}

export function formatActionArgsError(
  actionId: string,
  error: z.ZodError,
): string {
  const details = error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `args.${issue.path.join(".")}` : "args";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
  return `Invalid arguments for ${actionId}: ${details}`;
}
