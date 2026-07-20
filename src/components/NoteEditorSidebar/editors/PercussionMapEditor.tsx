import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generalMidiPercussionName } from "@/core/general-midi";
import type { InstrumentArticulationSchema } from "@/core/schema";

export interface PercussionArticulationEditorInfo
  extends InstrumentArticulationSchema {
  articulationIndex: number;
  technique: string;
}

export interface PercussionMapping {
  articulationIndex: number;
  outputMidiNumber: number;
}

export function PercussionMapEditor({
  articulations,
  labels,
  onCommit,
  onDone,
}: {
  articulations: readonly PercussionArticulationEditorInfo[];
  labels: {
    search: string;
    midiNote: string;
    customSound: string;
    noResults: string;
    apply: string;
  };
  onCommit: (mappings: PercussionMapping[]) => void;
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Record<number, number>>(() =>
    Object.fromEntries(articulations.map(
      (item) => [item.articulationIndex, item.outputMidiNumber],
    )));

  useEffect(() => {
    setDraft(Object.fromEntries(
      articulations.map(
        (item) => [item.articulationIndex, item.outputMidiNumber],
      ),
    ));
  }, [articulations]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return articulations;
    return articulations.filter((articulation) => {
      const sound = generalMidiPercussionName(
        draft[articulation.articulationIndex] ?? articulation.outputMidiNumber,
      ) ?? "";
      return articulation.elementType.toLowerCase().includes(normalized)
        || articulation.technique.toLowerCase().includes(normalized)
        || sound.toLowerCase().includes(normalized);
    });
  }, [articulations, draft, query]);

  return (
    <div className="space-y-3">
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

      <div className="max-h-[58vh] overflow-y-auto rounded border">
        {filtered.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            {labels.noResults}
          </div>
        )}
        {filtered.map((articulation) => {
          const value = draft[articulation.articulationIndex]
            ?? articulation.outputMidiNumber;
          const soundName = generalMidiPercussionName(value) ?? labels.customSound;
          const articulationLabel = articulation.technique
            ? `${articulation.elementType} · ${articulation.technique}`
            : articulation.elementType;
          return (
            <div
              key={articulation.articulationIndex}
              className="grid min-h-12 grid-cols-[minmax(0,1fr)_6rem] items-center gap-3 border-b px-3 py-1.5 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">
                  {articulationLabel}
                </div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {soundName}
                </div>
              </div>
              <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="sr-only">{labels.midiNote}</span>
                <input
                  type="number"
                  min={0}
                  max={127}
                  value={value}
                  aria-label={articulationLabel}
                  className="h-8 w-full rounded border bg-background px-2 text-right text-xs text-foreground outline-none focus:border-primary"
                  onChange={(event) => {
                    const next = event.currentTarget.valueAsNumber;
                    if (Number.isFinite(next)) {
                      setDraft((current) => ({
                        ...current,
                        [articulation.articulationIndex]: Math.max(
                          0,
                          Math.min(127, Math.trunc(next)),
                        ),
                      }));
                    }
                  }}
                />
              </label>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end border-t pt-3">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            onCommit(articulations.map((articulation) => ({
              articulationIndex: articulation.articulationIndex,
              outputMidiNumber:
                draft[articulation.articulationIndex]
                ?? articulation.outputMidiNumber,
            })));
            onDone();
          }}
        >
          {labels.apply}
        </Button>
      </div>
    </div>
  );
}
