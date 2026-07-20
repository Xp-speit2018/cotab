import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TUPLET_PRESETS = [
  { numerator: 3, denominator: 2 },
  { numerator: 5, denominator: 4 },
  { numerator: 6, denominator: 4 },
  { numerator: 7, denominator: 4 },
  { numerator: 9, denominator: 8 },
] as const;

export function tupletSummary(
  numerator: number,
  denominator: number,
  noneLabel: string,
): string {
  return numerator > 0 && denominator > 0
    ? `${numerator}:${denominator}`
    : noneLabel;
}

export function TupletEditor({
  numerator,
  denominator,
  noneLabel,
  numeratorLabel,
  denominatorLabel,
  applyLabel,
  onCommit,
  onDone,
}: {
  numerator: number;
  denominator: number;
  noneLabel: string;
  numeratorLabel: string;
  denominatorLabel: string;
  applyLabel: string;
  onCommit: (numerator: number, denominator: number) => void;
  onDone: () => void;
}) {
  const [draftNumerator, setDraftNumerator] = useState(
    numerator > 0 ? numerator : 3,
  );
  const [draftDenominator, setDraftDenominator] = useState(
    denominator > 0 ? denominator : 2,
  );

  useEffect(() => {
    setDraftNumerator(numerator > 0 ? numerator : 3);
    setDraftDenominator(denominator > 0 ? denominator : 2);
  }, [numerator, denominator]);

  const commit = (nextNumerator: number, nextDenominator: number) => {
    onCommit(nextNumerator, nextDenominator);
    onDone();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1">
        <Button
          type="button"
          variant={numerator <= 0 || denominator <= 0 ? "secondary" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => commit(-1, -1)}
        >
          {noneLabel}
        </Button>
        {TUPLET_PRESETS.map((preset) => {
          const selected = numerator === preset.numerator
            && denominator === preset.denominator;
          return (
            <Button
              key={`${preset.numerator}:${preset.denominator}`}
              type="button"
              variant={selected ? "secondary" : "outline"}
              size="sm"
              className="h-8 text-xs tabular-nums"
              onClick={() => commit(preset.numerator, preset.denominator)}
            >
              {preset.numerator}:{preset.denominator}
            </Button>
          );
        })}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <label className="space-y-1 text-[10px] text-muted-foreground">
          <span>{numeratorLabel}</span>
          <Input
            type="number"
            min={1}
            max={32}
            value={draftNumerator}
            className="h-8 text-right text-xs tabular-nums"
            onChange={(event) => setDraftNumerator(Number(event.target.value))}
          />
        </label>
        <span className="pb-1.5 text-xs text-muted-foreground">:</span>
        <label className="space-y-1 text-[10px] text-muted-foreground">
          <span>{denominatorLabel}</span>
          <Input
            type="number"
            min={1}
            max={32}
            value={draftDenominator}
            className="h-8 text-right text-xs tabular-nums"
            onChange={(event) => setDraftDenominator(Number(event.target.value))}
          />
        </label>
      </div>
      <Button
        type="button"
        size="sm"
        className="h-8 w-full"
        disabled={draftNumerator < 1 || draftDenominator < 1}
        onClick={() => commit(draftNumerator, draftDenominator)}
      >
        {applyLabel}
      </Button>
    </div>
  );
}
