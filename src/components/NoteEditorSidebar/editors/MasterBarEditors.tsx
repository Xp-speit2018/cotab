import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TIME_SIGNATURE_PRESETS = [
  [2, 4],
  [3, 4],
  [4, 4],
  [5, 4],
  [6, 8],
  [7, 8],
  [9, 8],
  [12, 8],
] as const;

export function TimeSignatureEditor({
  numerator,
  denominator,
  numeratorLabel,
  denominatorLabel,
  applyLabel,
  onCommit,
  onDone,
}: {
  numerator: number;
  denominator: number;
  numeratorLabel: string;
  denominatorLabel: string;
  applyLabel: string;
  onCommit: (numerator: number, denominator: number) => void;
  onDone: () => void;
}) {
  const [draftNumerator, setDraftNumerator] = useState(numerator);
  const [draftDenominator, setDraftDenominator] = useState(denominator);

  useEffect(() => {
    setDraftNumerator(numerator);
    setDraftDenominator(denominator);
  }, [denominator, numerator]);

  const commit = (nextNumerator: number, nextDenominator: number) => {
    onCommit(nextNumerator, nextDenominator);
    onDone();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1">
        {TIME_SIGNATURE_PRESETS.map(([top, bottom]) => (
          <Button
            key={`${top}/${bottom}`}
            type="button"
            variant={numerator === top && denominator === bottom ? "secondary" : "outline"}
            size="sm"
            className="h-8 text-xs tabular-nums"
            onClick={() => commit(top, bottom)}
          >
            {top}/{bottom}
          </Button>
        ))}
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
        <span className="pb-1.5 text-xs text-muted-foreground">/</span>
        <label className="space-y-1 text-[10px] text-muted-foreground">
          <span>{denominatorLabel}</span>
          <Input
            type="number"
            min={1}
            max={64}
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
        disabled={
          !Number.isInteger(draftNumerator)
          || draftNumerator < 1
          || draftNumerator > 32
          || !Number.isInteger(draftDenominator)
          || draftDenominator < 1
          || draftDenominator > 64
        }
        onClick={() => commit(draftNumerator, draftDenominator)}
      >
        {applyLabel}
      </Button>
    </div>
  );
}

export function SectionEditor({
  text,
  marker,
  textLabel,
  markerLabel,
  textPlaceholder,
  markerPlaceholder,
  applyLabel,
  clearLabel,
  onCommit,
  onDone,
}: {
  text: string;
  marker: string;
  textLabel: string;
  markerLabel: string;
  textPlaceholder: string;
  markerPlaceholder: string;
  applyLabel: string;
  clearLabel: string;
  onCommit: (section: { text: string; marker: string } | null) => void;
  onDone: () => void;
}) {
  const [draftText, setDraftText] = useState(text);
  const [draftMarker, setDraftMarker] = useState(marker);

  useEffect(() => {
    setDraftText(text);
    setDraftMarker(marker);
  }, [marker, text]);

  return (
    <div className="space-y-3">
      <label className="block space-y-1 text-[10px] text-muted-foreground">
        <span>{textLabel}</span>
        <Input
          value={draftText}
          placeholder={textPlaceholder}
          className="h-8 text-xs"
          onChange={(event) => setDraftText(event.target.value)}
        />
      </label>
      <label className="block space-y-1 text-[10px] text-muted-foreground">
        <span>{markerLabel}</span>
        <Input
          value={draftMarker}
          placeholder={markerPlaceholder}
          className="h-8 text-xs"
          onChange={(event) => setDraftMarker(event.target.value)}
        />
      </label>
      <div className="grid grid-cols-2 gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={!text && !marker}
          onClick={() => {
            onCommit(null);
            onDone();
          }}
        >
          {clearLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8"
          disabled={!draftText.trim() && !draftMarker.trim()}
          onClick={() => {
            onCommit({ text: draftText.trim(), marker: draftMarker.trim() });
            onDone();
          }}
        >
          {applyLabel}
        </Button>
      </div>
    </div>
  );
}
