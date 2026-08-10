import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { ChordSchema } from "@/core/schema";
import type { ChordDefinitionInfo } from "@/stores/render-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { analyzeChordFingering } from "@/core/chords";
import { PresetCombobox } from "../PresetCombobox";
import { ChordCandidateList } from "./ChordCandidateList";
import { ChordCompositionChart } from "./ChordCompositionChart";
import { ChordFunctionLegend } from "./ChordFunctionLegend";
import {
  InteractiveFretboard,
  type FretboardLabelMode,
} from "./InteractiveFretboard";

const DIAGRAM_FRETS = 5;

function copyChord(chord: ChordSchema): ChordSchema {
  return {
    ...chord,
    strings: [...chord.strings],
    barreFrets: [...chord.barreFrets],
  };
}

function emptyChord(stringCount: number): ChordSchema {
  return {
    name: "",
    firstFret: 1,
    strings: Array.from({ length: stringCount }, () => -1),
    barreFrets: [],
    showName: true,
    showDiagram: true,
    showFingering: false,
  };
}

function createChordId(): string {
  return `cotab-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
}

function ChordDiagram({
  chord,
  hiddenLabel,
}: {
  chord: ChordSchema;
  hiddenLabel: string;
}) {
  if (!chord.showDiagram) {
    return (
      <div
        data-chord-diagram-hidden
        className="flex min-h-32 items-center justify-center rounded-md border border-dashed px-4 text-center text-[11px] text-muted-foreground"
      >
        {hiddenLabel}
      </div>
    );
  }

  const stringCount = Math.max(1, chord.strings.length);
  return (
    <div className="mx-auto w-48 py-2" data-chord-diagram>
      {chord.showName && (
        <div className="mb-2 truncate text-center text-sm font-semibold">
          {chord.name || "—"}
        </div>
      )}
      <div className="relative mx-auto h-32 w-40">
        {chord.firstFret > 1 && (
          <span className="absolute -left-6 top-[30px] text-[9px] tabular-nums text-muted-foreground">
            {chord.firstFret}fr
          </span>
        )}
        {Array.from({ length: stringCount }, (_, index) => {
          const left = stringCount === 1 ? 50 : (index / (stringCount - 1)) * 100;
          const alphaTabStringIndex = stringCount - index - 1;
          const fret = chord.strings[alphaTabStringIndex] ?? -1;
          const marker = fret < 0 ? "×" : fret === 0 ? "○" : null;
          const relativeFret = fret - chord.firstFret + 1;
          return (
            <div
              key={index}
              data-diagram-string={stringCount - index}
              data-alphatab-string-index={alphaTabStringIndex}
            >
              <div
                className="absolute top-6 h-[100px] w-px bg-foreground/60"
                style={{ left: `${left}%` }}
              />
              {marker && (
                <span
                  className="absolute top-0 -translate-x-1/2 text-xs font-medium"
                  style={{ left: `${left}%` }}
                >
                  {marker}
                </span>
              )}
              {relativeFret >= 1 && relativeFret <= DIAGRAM_FRETS && (
                <span
                  className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
                  style={{
                    left: `${left}%`,
                    top: `${24 + (relativeFret - 0.5) * 20}px`,
                  }}
                />
              )}
            </div>
          );
        })}
        {Array.from({ length: DIAGRAM_FRETS + 1 }, (_, index) => (
          <div
            key={index}
            className={cn(
              "absolute left-0 w-full bg-foreground/60",
              index === 0 && chord.firstFret === 1 ? "h-1" : "h-px",
            )}
            style={{ top: `${24 + index * 20}px` }}
          />
        ))}
        {chord.barreFrets.map((fret) => {
          const relativeFret = fret - chord.firstFret + 1;
          if (relativeFret < 1 || relativeFret > DIAGRAM_FRETS) return null;
          return (
            <div
              key={fret}
              data-chord-barre={fret}
              className="absolute left-0 h-2.5 w-full -translate-y-1/2 rounded-full bg-foreground"
              style={{ top: `${24 + (relativeFret - 0.5) * 20}px` }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function ChordPickerEditor({
  definitions,
  selectedId,
  label,
  noneLabel,
  missingLabel,
  onSelect,
  onDone,
}: {
  definitions: readonly ChordDefinitionInfo[];
  selectedId: string | null;
  label: string;
  noneLabel: string;
  missingLabel: string;
  onSelect: (id: string | null) => void;
  onDone: () => void;
}) {
  const hasMissingReference = selectedId !== null
    && !definitions.some((definition) => definition.id === selectedId);
  const choose = (id: string | null) => {
    onSelect(id);
    onDone();
  };
  return (
    <div className="space-y-2">
      {hasMissingReference && (
        <div className="px-2 py-1 text-xs text-destructive">{missingLabel}</div>
      )}
      <PresetCombobox
        value={selectedId}
        valueLabel={hasMissingReference ? missingLabel : noneLabel}
        ariaLabel={label}
        options={[
          { value: null, label: noneLabel },
          ...definitions.map((definition) => ({
            value: definition.id,
            label: definition.name || "—",
          })),
        ]}
        onValueChange={choose}
        align="start"
      />
    </div>
  );
}

export function ChordLibraryEditor({
  definitions,
  stringCount,
  tuning,
  capo,
  labels,
  onSave,
  onDelete,
}: {
  definitions: readonly ChordDefinitionInfo[];
  stringCount: number;
  tuning: readonly number[];
  capo: number;
  labels: {
    newChord: string;
    name: string;
    firstFret: string;
    barreFrets: string;
    showName: string;
    showDiagram: string;
    showFingering: string;
    save: string;
    delete: string;
    confirmDelete: string;
    fretboard: string;
    mute: string;
    open: string;
    string: string;
    fret: string;
    possibleChords: string;
    noChordCandidates: string;
    bestMatch: string;
    alternativeChords: string;
    bass: string;
    showNoteNames: string;
    showIntervals: string;
    chordComposition: string;
    chordCompositionEmpty: string;
    semitoneDistance: string;
    extensions: string;
    sixthSeventh: string;
    fifthFunction: string;
    thirdFunction: string;
    rootFunction: string;
    scoreDisplay: string;
    diagramPreview: string;
    diagramHidden: string;
    fingeringUnavailable: string;
  };
  onSave: (id: string, chord: ChordSchema) => void;
  onDelete: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    definitions[0]?.id ?? null,
  );
  const selectedDefinition = useMemo(
    () => definitions.find((definition) => definition.id === selectedId) ?? null,
    [definitions, selectedId],
  );
  const [draft, setDraft] = useState<ChordSchema>(() =>
    selectedDefinition ? copyChord(selectedDefinition) : emptyChord(stringCount));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fretboardLabelMode, setFretboardLabelMode] = useState<FretboardLabelMode>("notes");
  const candidates = useMemo(() => analyzeChordFingering({
    tuning,
    frets: draft.strings,
    capo,
  }), [capo, draft.strings, tuning]);
  const activeCandidate = candidates.find((candidate) => candidate.symbol === draft.name)
    ?? candidates[0]
    ?? null;

  useEffect(() => {
    if (selectedDefinition) setDraft(copyChord(selectedDefinition));
  }, [selectedDefinition]);

  const selectDefinition = (definition: ChordDefinitionInfo) => {
    setSelectedId(definition.id);
    setDraft(copyChord(definition));
    setConfirmDelete(false);
  };
  const startNew = () => {
    setSelectedId(null);
    setDraft(emptyChord(stringCount));
    setConfirmDelete(false);
  };

  return (
    <div className="grid min-h-[420px] grid-cols-1 gap-4 md:grid-cols-[150px_minmax(0,1fr)]">
      <div className="border-b pb-3 md:border-b-0 md:border-r md:pb-0 md:pr-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mb-2 h-8 w-full justify-start"
          onClick={startNew}
        >
          <Plus />
          {labels.newChord}
        </Button>
        <div className="flex flex-wrap gap-1 md:block md:space-y-1">
          {definitions.map((definition) => (
            <button
              key={definition.id}
              type="button"
              className={cn(
                "min-w-24 flex-1 truncate rounded px-2 py-1.5 text-left text-xs hover:bg-accent/50 md:w-full",
                selectedId === definition.id && "bg-accent font-medium",
              )}
              onClick={() => selectDefinition(definition)}
            >
              {definition.name || "—"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-3">
          <label className="block max-w-64 space-y-1 text-xs text-muted-foreground">
            <span>{labels.name}</span>
            <Input
              value={draft.name}
              className="h-8 text-xs"
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">{labels.fretboard}</div>
              <div className="flex rounded-md border p-0.5">
                {([
                  ["notes", labels.showNoteNames],
                  ["intervals", labels.showIntervals],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={fretboardLabelMode === mode}
                    className={cn(
                      "rounded px-2 py-0.5 text-[10px] transition-colors",
                      fretboardLabelMode === mode
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => setFretboardLabelMode(mode)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <ChordFunctionLegend
              labels={{
                root: labels.rootFunction,
                third: labels.thirdFunction,
                fifth: labels.fifthFunction,
                sixthSeventh: labels.sixthSeventh,
                extensions: labels.extensions,
              }}
            />
            <InteractiveFretboard
              tuning={tuning}
              frets={draft.strings}
              firstFret={draft.firstFret}
              capo={capo}
              candidate={activeCandidate}
              labelMode={fretboardLabelMode}
              labels={{
                fretboard: labels.fretboard,
                mute: labels.mute,
                open: labels.open,
                string: labels.string,
                fret: labels.fret,
              }}
              onChange={(strings) => setDraft({ ...draft, strings })}
            />
          </div>

          <ChordCandidateList
            candidates={candidates}
            selectedName={draft.name}
            labels={{
              possibleChords: labels.possibleChords,
              noCandidates: labels.noChordCandidates,
              bestMatch: labels.bestMatch,
              alternatives: labels.alternativeChords,
              bass: labels.bass,
            }}
            onSelect={(candidate) => setDraft({ ...draft, name: candidate.symbol })}
          />

          <section className="space-y-1.5">
            <div className="flex items-center gap-2 py-1 text-xs font-medium">
              <span>{labels.chordComposition}</span>
              {activeCandidate && (
                <span className="font-mono text-sm font-semibold">{activeCandidate.symbol}</span>
              )}
            </div>
            <ChordCompositionChart
              candidate={activeCandidate}
              labels={{
                empty: labels.chordCompositionEmpty,
                semitones: labels.semitoneDistance,
                extensions: labels.extensions,
                sixthSeventh: labels.sixthSeventh,
                fifth: labels.fifthFunction,
                third: labels.thirdFunction,
                root: labels.rootFunction,
                bass: labels.bass,
              }}
            />
          </section>

          <section className="space-y-1 border-t pt-2">
            <div className="text-xs font-medium">
              {labels.scoreDisplay}
            </div>
            <div className="grid gap-4 rounded-md border bg-muted/10 p-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                <div className="space-y-3">
                  <label className="block w-24 space-y-1 text-xs text-muted-foreground">
                    <span>{labels.firstFret}</span>
                    <Input
                      type="number"
                      min={1}
                      max={24}
                      value={draft.firstFret}
                      className="h-8 text-xs"
                      onChange={(event) => setDraft({
                        ...draft,
                        firstFret: Math.max(1, Number(event.target.value)),
                      })}
                    />
                  </label>

                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">{labels.barreFrets}</div>
                    <div className="flex flex-wrap gap-1">
                      {Array.from({ length: DIAGRAM_FRETS }, (_, index) => draft.firstFret + index)
                        .map((fret) => {
                          const active = draft.barreFrets.includes(fret);
                          return (
                            <Button
                              key={fret}
                              type="button"
                              variant={active ? "secondary" : "outline"}
                              size="icon-xs"
                              aria-pressed={active}
                              onClick={() => setDraft({
                                ...draft,
                                barreFrets: active
                                  ? draft.barreFrets.filter((value) => value !== fret)
                                  : [...draft.barreFrets, fret].sort((a, b) => a - b),
                              })}
                            >
                              {fret}
                            </Button>
                          );
                        })}
                    </div>
                  </div>

                  {([
                    ["showName", labels.showName],
                    ["showDiagram", labels.showDiagram],
                  ] as const).map(([field, label]) => (
                    <label key={field} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={draft[field]}
                        className="h-4 w-4 accent-primary"
                        onChange={(event) => setDraft({
                          ...draft,
                          [field]: event.target.checked,
                        })}
                      />
                      {label}
                    </label>
                  ))}

                  <div className="text-[10px] leading-relaxed text-muted-foreground">
                    {labels.showFingering}: {labels.fingeringUnavailable}
                  </div>
                </div>

                <div className="border-t pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                  <div className="mb-1 text-[10px] text-muted-foreground">
                    {labels.diagramPreview}
                  </div>
                  <ChordDiagram chord={draft} hiddenLabel={labels.diagramHidden} />
                </div>
              </div>
          </section>
        </div>
      </div>

      <div className="flex justify-between border-t pt-3 md:col-span-2">
        {selectedId === null ? <span /> : (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              onDelete(selectedId);
              startNew();
            }}
          >
            <Trash2 />
            {confirmDelete ? labels.confirmDelete : labels.delete}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          disabled={!draft.name.trim() || draft.strings.length === 0}
          onClick={() => {
            const id = selectedId ?? createChordId();
            onSave(id, { ...draft, name: draft.name.trim() });
            setSelectedId(id);
          }}
        >
          {labels.save}
        </Button>
      </div>
    </div>
  );
}
