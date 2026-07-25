import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  GENERAL_MIDI_INSTRUMENTS,
  generalMidiInstrument,
} from "@/core/general-midi";
import { PresetCombobox } from "../PresetCombobox";

const COMMON_INSTRUMENT_PROGRAMS = [
  0,
  24,
  25,
  27,
  29,
  30,
  32,
  33,
  34,
  40,
  42,
  48,
] as const;

export function instrumentSummary(
  program: number,
  bank: number,
  unknownLabel: string,
  bankLabel: string,
): string {
  const name = generalMidiInstrument(program)?.name ?? unknownLabel;
  return bank === 0 ? name : `${name} · ${bankLabel} ${bank}`;
}

export function InstrumentEditor({
  program,
  bank,
  labels,
  onCommit,
  onDone,
}: {
  program: number;
  bank: number;
  labels: {
    search: string;
    common: string;
    bank: string;
    apply: string;
  };
  onCommit: (program: number, bank: number) => void;
  onDone: () => void;
}) {
  const [draftProgram, setDraftProgram] = useState(program);
  const [draftBank, setDraftBank] = useState(bank);

  useEffect(() => {
    setDraftProgram(program);
    setDraftBank(bank);
  }, [program, bank]);

  const instrumentOptions = useMemo(() => {
    const optionFor = (
      instrument: (typeof GENERAL_MIDI_INSTRUMENTS)[number],
      group: string,
    ) => ({
      value: instrument.program,
      label: instrument.name,
      group,
      keywords: [String(instrument.program + 1), instrument.family],
      description: `${instrument.program + 1} · ${instrument.family}`,
    });
    return [
      ...COMMON_INSTRUMENT_PROGRAMS.map((program) =>
        optionFor(GENERAL_MIDI_INSTRUMENTS[program], labels.common)),
      ...GENERAL_MIDI_INSTRUMENTS.map((instrument) =>
        optionFor(instrument, instrument.family)),
    ];
  }, [labels.common]);

  return (
    <div className="space-y-3">
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_8rem]">
        <div className="space-y-1 text-[11px] text-muted-foreground">
          <span className="block">{labels.search}</span>
          <PresetCombobox
            value={draftProgram}
            ariaLabel={labels.search}
            options={instrumentOptions}
            onValueChange={setDraftProgram}
            triggerClassName="h-9 text-sm"
            contentClassName="w-[min(28rem,calc(100vw-2rem))]"
            optionContainerClassName="sm:grid sm:grid-cols-2"
            portalled={false}
            align="start"
          />
        </div>
        <label className="space-y-1 text-[11px] text-muted-foreground">
          <span className="block">{labels.bank}</span>
          <input
            type="number"
            min={0}
            max={16383}
            value={draftBank}
            aria-label={labels.bank}
            className="h-9 w-full rounded border bg-background px-2 text-right text-sm text-foreground outline-none focus:border-primary"
            onChange={(event) => {
              const value = event.currentTarget.valueAsNumber;
              if (Number.isFinite(value)) {
                setDraftBank(Math.max(0, Math.min(16383, Math.trunc(value))));
              }
            }}
          />
        </label>
      </div>

      <div className="flex items-center justify-between border-t pt-3">
        <span className="min-w-0 truncate text-sm font-medium">
          {generalMidiInstrument(draftProgram)?.name}
        </span>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            onCommit(draftProgram, draftBank);
            onDone();
          }}
        >
          {labels.apply}
        </Button>
      </div>
    </div>
  );
}
