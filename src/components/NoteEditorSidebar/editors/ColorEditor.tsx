import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
] as const;

export function colorHexToRaw(hex: string): number {
  const rgb = Number.parseInt(hex.slice(1), 16);
  return ((0xff << 24) | rgb) | 0;
}

export function colorRgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, value))
      .toString(16)
      .padStart(2, "0"))
    .join("")}`;
}

export function ColorEditor({
  value,
  labels,
  onCommit,
  onDone,
}: {
  value: string;
  labels: { custom: string; apply: string };
  onCommit: (raw: number) => void;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-8 gap-1.5">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            className={cn(
              "aspect-square rounded border border-black/10",
              draft === color && "ring-2 ring-primary ring-offset-1",
            )}
            style={{ backgroundColor: color }}
            onClick={() => setDraft(color)}
          />
        ))}
      </div>
      <label className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{labels.custom}</span>
        <input
          type="color"
          value={draft}
          aria-label={labels.custom}
          className="ml-auto h-8 w-16 cursor-pointer rounded border bg-background p-1"
          onChange={(event) => setDraft(event.currentTarget.value)}
        />
        <span className="font-mono text-foreground">{draft.toUpperCase()}</span>
      </label>
      <div className="flex justify-end border-t pt-3">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            onCommit(colorHexToRaw(draft));
            onDone();
          }}
        >
          {labels.apply}
        </Button>
      </div>
    </div>
  );
}
