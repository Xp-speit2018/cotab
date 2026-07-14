import { useEffect, useMemo, useState } from "react";
import { Play } from "lucide-react";
import {
  createDocumentActionFormArgs,
  getDocumentActionFormDefinition,
  validateDocumentActionFormArgs,
  type DocumentActionFormField,
} from "@/app-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function emptyValue(field: DocumentActionFormField): unknown {
  if (field.nullable) return null;
  if (field.enumValues && field.enumValues.length > 0) return field.enumValues[0];
  if (field.kind === "boolean") return false;
  if (field.kind === "integer" || field.kind === "number") return 0;
  if (field.kind === "json") return {};
  return "";
}

function jsonOption(value: unknown): string {
  return JSON.stringify(value);
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: DocumentActionFormField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (field.enumValues) {
    return (
      <select
        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
        value={jsonOption(value)}
        onChange={(event) => onChange(JSON.parse(event.target.value))}
      >
        {field.enumValues.map((option) => (
          <option key={jsonOption(option)} value={jsonOption(option)}>
            {String(option)}
          </option>
        ))}
      </select>
    );
  }

  if (field.kind === "boolean") {
    return (
      <input
        type="checkbox"
        checked={value === true}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-primary"
      />
    );
  }

  if (field.kind === "integer" || field.kind === "number") {
    return (
      <Input
        type="number"
        className="h-8 text-xs"
        step={field.kind === "integer" ? 1 : "any"}
        min={field.minimum}
        max={field.maximum}
        value={typeof value === "number" ? value : ""}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    );
  }

  if (field.kind === "string") {
    return (
      <Input
        className="h-8 text-xs"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <textarea
      className="min-h-20 w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
      value={JSON.stringify(value, null, 2)}
      onChange={(event) => {
        try {
          onChange(JSON.parse(event.target.value));
        } catch {
          // Keep the last valid structured value until the JSON is complete.
        }
      }}
    />
  );
}

export function DocumentActionArgsForm({
  actionId,
  submitLabel = "Execute",
  disabled = false,
  onSubmit,
}: {
  actionId: string;
  submitLabel?: string;
  disabled?: boolean;
  onSubmit: (args: Record<string, unknown>) => void;
}) {
  const definition = useMemo(
    () => getDocumentActionFormDefinition(actionId),
    [actionId],
  );
  const [args, setArgs] = useState<Record<string, unknown>>(() =>
    createDocumentActionFormArgs(actionId),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setArgs(createDocumentActionFormArgs(actionId));
    setError(null);
  }, [actionId]);

  if (!definition) return null;

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        const result = validateDocumentActionFormArgs(actionId, args);
        if (!result.success) {
          setError(result.message);
          return;
        }
        setError(null);
        onSubmit(result.data);
      }}
    >
      {definition.fields.map((field) => {
        const included = Object.hasOwn(args, field.name);
        const value = args[field.name];
        const isNull = value === null;
        return (
          <div key={field.name} className="grid grid-cols-[minmax(96px,0.8fr)_minmax(0,1.2fr)] items-start gap-2">
            <label className="flex min-h-8 items-center gap-1.5 break-words text-xs text-muted-foreground">
              {!field.required && (
                <input
                  type="checkbox"
                  checked={included}
                  onChange={(event) => {
                    setArgs((current) => {
                      if (!event.target.checked) {
                        const next = { ...current };
                        delete next[field.name];
                        return next;
                      }
                      return {
                        ...current,
                        [field.name]: emptyValue(field),
                      };
                    });
                  }}
                  className="h-3.5 w-3.5 accent-primary"
                />
              )}
              {field.name}
            </label>
            {included && (
              <div className="min-w-0 space-y-1">
                {field.nullable && (
                  <label className="flex h-6 items-center gap-1.5 text-[10px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={isNull}
                      onChange={(event) =>
                        setArgs((current) => ({
                          ...current,
                          [field.name]: event.target.checked
                            ? null
                            : emptyValue({ ...field, nullable: false }),
                        }))
                      }
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    null
                  </label>
                )}
                {!isNull && (
                  <FieldControl
                    field={field}
                    value={value}
                    onChange={(nextValue) =>
                      setArgs((current) => ({
                        ...current,
                        [field.name]: nextValue,
                      }))
                    }
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
      {error && (
        <div role="alert" className="break-words text-xs text-destructive">
          {error}
        </div>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={disabled}>
          <Play />
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
