import { useEffect, useState } from "react";
import { KeySignatureType } from "@/core/schema";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

const MAJOR_KEYS = [
  "C♭", "G♭", "D♭", "A♭", "E♭", "B♭", "F", "C",
  "G", "D", "A", "E", "B", "F♯", "C♯",
] as const;
const MINOR_KEYS = [
  "A♭m", "E♭m", "B♭m", "Fm", "Cm", "Gm", "Dm", "Am",
  "Em", "Bm", "F♯m", "C♯m", "G♯m", "D♯m", "A♯m",
] as const;

export function keySignatureSummary(
  signature: number,
  type: KeySignatureType,
): string {
  const index = Math.max(0, Math.min(14, signature + 7));
  return (type === KeySignatureType.Minor ? MINOR_KEYS : MAJOR_KEYS)[index];
}

export function KeySignatureEditor({
  signature,
  type,
  majorLabel,
  minorLabel,
  onCommit,
  onDone,
}: {
  signature: number;
  type: KeySignatureType;
  majorLabel: string;
  minorLabel: string;
  onCommit: (signature: number, type: KeySignatureType) => void;
  onDone: () => void;
}) {
  const [draftType, setDraftType] = useState(type);
  useEffect(() => setDraftType(type), [type]);
  const keys = draftType === KeySignatureType.Minor ? MINOR_KEYS : MAJOR_KEYS;
  return (
    <div className="space-y-3">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={String(draftType)}
        className="grid w-full grid-cols-2"
        onValueChange={(value) => {
          if (value) setDraftType(Number(value) as KeySignatureType);
        }}
      >
        <ToggleGroupItem value={String(KeySignatureType.Major)} className="h-8">
          {majorLabel}
        </ToggleGroupItem>
        <ToggleGroupItem value={String(KeySignatureType.Minor)} className="h-8">
          {minorLabel}
        </ToggleGroupItem>
      </ToggleGroup>
      <div className="grid grid-cols-5 gap-1">
        {keys.map((name, index) => {
          const nextSignature = index - 7;
          const selected = signature === nextSignature && type === draftType;
          return (
            <button
              key={name}
              type="button"
              className={selected
                ? "h-8 rounded border border-primary/40 bg-primary/15 text-xs font-medium text-primary"
                : "h-8 rounded border text-xs hover:bg-accent/50"}
              onClick={() => {
                onCommit(nextSignature, draftType);
                onDone();
              }}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
