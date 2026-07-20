import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function longTextSummary(value: string, emptyLabel: string): string {
  const compact = value.trim().replace(/\s+/g, " ");
  return compact || emptyLabel;
}

export function LongTextEditor({
  value,
  label,
  placeholder,
  applyLabel,
  onCommit,
  onDone,
}: {
  value: string;
  label: string;
  placeholder: string;
  applyLabel: string;
  onCommit: (value: string) => void;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  const apply = () => {
    if (draft !== value) onCommit(draft);
    onDone();
  };

  return (
    <div className="space-y-3">
      <textarea
        aria-label={label}
        value={draft}
        placeholder={placeholder}
        rows={10}
        className="min-h-48 w-full resize-y rounded border bg-background px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/60 focus:border-primary"
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            apply();
          }
        }}
      />
      <div className="flex justify-end border-t pt-3">
        <Button size="sm" onClick={apply}>
          {applyLabel}
        </Button>
      </div>
    </div>
  );
}
