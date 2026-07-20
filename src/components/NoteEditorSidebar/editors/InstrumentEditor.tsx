import { useEffect, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  GENERAL_MIDI_INSTRUMENTS,
  generalMidiInstrument,
} from "@/core/general-midi";
import { cn } from "@/lib/utils";

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
    bank: string;
    apply: string;
    noResults: string;
  };
  onCommit: (program: number, bank: number) => void;
  onDone: () => void;
}) {
  const [draftProgram, setDraftProgram] = useState(program);
  const [draftBank, setDraftBank] = useState(bank);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setDraftProgram(program);
    setDraftBank(bank);
  }, [program, bank]);

  const grouped = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matches = GENERAL_MIDI_INSTRUMENTS.filter((instrument) =>
      !normalized
      || instrument.name.toLowerCase().includes(normalized)
      || instrument.family.toLowerCase().includes(normalized));
    const result = new Map<string, typeof matches>();
    for (const instrument of matches) {
      const family = result.get(instrument.family) ?? [];
      family.push(instrument);
      result.set(instrument.family, family);
    }
    return result;
  }, [query]);

  return (
    <div className="space-y-3">
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_8rem]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="search"
            value={query}
            aria-label={labels.search}
            placeholder={labels.search}
            className="h-9 w-full rounded border bg-background pl-8 pr-3 text-sm outline-none focus:border-primary"
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>
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

      <div className="max-h-[55vh] overflow-y-auto rounded border">
        {grouped.size === 0 && (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            {labels.noResults}
          </div>
        )}
        {[...grouped.entries()].map(([family, instruments]) => (
          <div key={family}>
            <div className="sticky top-0 z-10 border-y bg-muted px-3 py-1 text-[10px] font-semibold uppercase text-muted-foreground first:border-t-0">
              {family}
            </div>
            <div className="grid sm:grid-cols-2">
              {instruments.map((instrument) => (
                <button
                  key={instrument.program}
                  type="button"
                  aria-pressed={draftProgram === instrument.program}
                  className={cn(
                    "flex min-h-8 items-center gap-2 border-b px-3 py-1 text-left text-xs hover:bg-accent/50 sm:odd:border-r",
                    draftProgram === instrument.program && "bg-primary/10 text-primary",
                  )}
                  onClick={() => setDraftProgram(instrument.program)}
                >
                  <span className="truncate">{instrument.name}</span>
                  {draftProgram === instrument.program && (
                    <Check className="ml-auto h-3.5 w-3.5 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
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
