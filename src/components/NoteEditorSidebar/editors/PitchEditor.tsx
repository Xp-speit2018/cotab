import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const PITCH_NAMES = [
  "C", "C♯", "D", "D♯", "E", "F",
  "F♯", "G", "G♯", "A", "A♯", "B",
] as const;

export function pitchSummary(octave: number, tone: number): string {
  const normalizedTone = ((tone % 12) + 12) % 12;
  return `${PITCH_NAMES[normalizedTone]}${octave}`;
}

export function PitchEditor({
  octave,
  tone,
  pitchClassLabel,
  octaveLabel,
  applyLabel,
  onCommit,
  onDone,
}: {
  octave: number;
  tone: number;
  pitchClassLabel: string;
  octaveLabel: string;
  applyLabel: string;
  onCommit: (octave: number, tone: number) => void;
  onDone: () => void;
}) {
  const [draftOctave, setDraftOctave] = useState(octave);
  const [draftTone, setDraftTone] = useState(tone);

  useEffect(() => {
    setDraftOctave(octave);
    setDraftTone(tone);
  }, [octave, tone]);

  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="mb-1.5 text-[11px] font-medium text-muted-foreground">
          {pitchClassLabel}
        </legend>
        <div className="grid grid-cols-4 gap-1">
          {PITCH_NAMES.map((name, value) => (
            <button
              key={name}
              type="button"
              aria-pressed={draftTone === value}
              className={draftTone === value
                ? "h-8 rounded border border-primary/40 bg-primary/15 text-xs font-medium text-primary"
                : "h-8 rounded border text-xs hover:bg-accent/50"}
              onClick={() => setDraftTone(value)}
            >
              {name}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span>{octaveLabel}</span>
        <input
          type="number"
          min={0}
          max={9}
          value={draftOctave}
          className="h-8 w-20 rounded border bg-background px-2 text-right text-xs font-medium text-foreground outline-none focus:border-primary"
          onChange={(event) => {
            const value = event.currentTarget.valueAsNumber;
            if (Number.isFinite(value)) {
              setDraftOctave(Math.max(0, Math.min(9, Math.trunc(value))));
            }
          }}
        />
      </label>

      <div className="flex items-center justify-between border-t pt-3">
        <span className="text-sm font-semibold tabular-nums">
          {pitchSummary(draftOctave, draftTone)}
        </span>
        <Button
          size="sm"
          onClick={() => {
            onCommit(draftOctave, draftTone);
            onDone();
          }}
        >
          {applyLabel}
        </Button>
      </div>
    </div>
  );
}
