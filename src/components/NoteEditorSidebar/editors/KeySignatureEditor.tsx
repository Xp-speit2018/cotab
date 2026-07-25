import { useEffect, useState } from "react";
import { KeySignatureType } from "@/core/schema";
import { Button } from "@/components/ui/button";
import { PresetCombobox } from "../PresetCombobox";

interface KeyTonic {
  label: string;
  pitchClass: number;
  signature: number;
}

interface KeyMode {
  type: KeySignatureType;
  tonics: readonly KeyTonic[];
}

function tonics(
  labels: readonly string[],
  pitchClasses: readonly number[],
): readonly KeyTonic[] {
  return labels.map((label, index) => ({
    label,
    pitchClass: pitchClasses[index],
    signature: index - 7,
  }));
}

const KEY_MODES: readonly KeyMode[] = [
  {
    type: KeySignatureType.Major,
    tonics: tonics(
      [
        "C♭", "G♭", "D♭", "A♭", "E♭", "B♭", "F", "C",
        "G", "D", "A", "E", "B", "F♯", "C♯",
      ],
      [11, 6, 1, 8, 3, 10, 5, 0, 7, 2, 9, 4, 11, 6, 1],
    ),
  },
  {
    type: KeySignatureType.Minor,
    tonics: tonics(
      [
        "A♭", "E♭", "B♭", "F", "C", "G", "D", "A",
        "E", "B", "F♯", "C♯", "G♯", "D♯", "A♯",
      ],
      [8, 3, 10, 5, 0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10],
    ),
  },
];

function keyMode(type: KeySignatureType): KeyMode {
  return KEY_MODES.find((mode) => mode.type === type) ?? KEY_MODES[0];
}

function keyTonic(signature: number, type: KeySignatureType): KeyTonic {
  const mode = keyMode(type);
  return mode.tonics.find((tonic) => tonic.signature === signature)
    ?? mode.tonics[7];
}

export function keySignatureSummary(
  signature: number,
  type: KeySignatureType,
): string {
  const tonic = keyTonic(signature, type).label;
  return type === KeySignatureType.Minor ? `${tonic}m` : tonic;
}

export function KeySignatureEditor({
  signature,
  type,
  modeLabel,
  tonicLabel,
  majorLabel,
  minorLabel,
  applyLabel,
  onCommit,
  onDone,
}: {
  signature: number;
  type: KeySignatureType;
  modeLabel: string;
  tonicLabel: string;
  majorLabel: string;
  minorLabel: string;
  applyLabel: string;
  onCommit: (signature: number, type: KeySignatureType) => void;
  onDone: () => void;
}) {
  const [draftType, setDraftType] = useState(type);
  const [draftSignature, setDraftSignature] = useState(signature);
  useEffect(() => {
    setDraftType(type);
    setDraftSignature(signature);
  }, [signature, type]);

  const draftMode = keyMode(draftType);
  const draftTonic = keyTonic(draftSignature, draftType);
  const modeLabels = new Map<KeySignatureType, string>([
    [KeySignatureType.Major, majorLabel],
    [KeySignatureType.Minor, minorLabel],
  ]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-[11px] text-muted-foreground">
          <span className="block">{modeLabel}</span>
          <PresetCombobox
            value={draftType}
            ariaLabel={modeLabel}
            options={KEY_MODES.map((mode) => ({
              value: mode.type,
              label: modeLabels.get(mode.type) ?? String(mode.type),
            }))}
            onValueChange={(nextType) => {
              const currentPitchClass = draftTonic.pitchClass;
              const nextMode = keyMode(nextType);
              const nextTonic = nextMode.tonics.find(
                (tonic) => tonic.label === draftTonic.label,
              ) ?? nextMode.tonics.find(
                (tonic) => tonic.pitchClass === currentPitchClass,
              ) ?? nextMode.tonics[7];
              setDraftType(nextType);
              setDraftSignature(nextTonic.signature);
            }}
            triggerClassName="h-9"
            align="start"
          />
        </label>

        <label className="space-y-1 text-[11px] text-muted-foreground">
          <span className="block">{tonicLabel}</span>
          <PresetCombobox
            value={draftSignature}
            ariaLabel={tonicLabel}
            options={draftMode.tonics.map((tonic) => ({
              value: tonic.signature,
              label: tonic.label,
            }))}
            onValueChange={setDraftSignature}
            triggerClassName="h-9"
            align="start"
          />
        </label>
      </div>

      <div className="flex justify-end border-t pt-3">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            onCommit(draftSignature, draftType);
            onDone();
          }}
        >
          {applyLabel}
        </Button>
      </div>
    </div>
  );
}
