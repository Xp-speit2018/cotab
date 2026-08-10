import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import type { ChordSchema } from "@/core/schema";
import type { ChordDefinitionInfo } from "@/stores/render-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  analyzeChordFingering,
  candidateToChordFormula,
  CHORD_TONE_DEFINITIONS,
  formatChordFormula,
  formatPitchClass,
  generateChordVoicings,
  modulo12,
  type ChordFormula,
  type ChordToneId,
  type VoicingDensity,
} from "@/core/chords";
import { PresetCombobox } from "../PresetCombobox";
import { ChordCandidateList } from "./ChordCandidateList";
import { ChordCompositionChart } from "./ChordCompositionChart";
import { ChordFunctionLegend } from "./ChordFunctionLegend";
import {
  InteractiveFretboard,
  type FretboardLabelMode,
} from "./InteractiveFretboard";

const DIAGRAM_FRETS = 5;
const EMPTY_FORMULA: ChordFormula = {
  rootPitchClass: 0,
  bassPitchClass: 0,
  tones: ["1"],
};

function ChordSectionHeading({
  title,
  help,
  actions,
}: {
  title: ReactNode;
  help: string;
  actions?: ReactNode;
}) {
  return (
    <div
      data-chord-section-heading
      className="flex min-h-7 flex-wrap items-center justify-between gap-2"
    >
      <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-foreground">
        <span data-chord-section-title className="flex min-w-0 items-center gap-2">
          {title}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={help}
              className="flex h-4 w-4 shrink-0 cursor-default items-center justify-center rounded-full border border-border text-[9px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ?
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-60">
            {help}
          </TooltipContent>
        </Tooltip>
      </div>
      {actions}
    </div>
  );
}

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
    rootPicker: string;
    scoreDisplay: string;
    diagramPreview: string;
    diagramHidden: string;
    voicingSuggestions: string;
    voicingDensity: string;
    voicingCompact: string;
    voicingBalanced: string;
    voicingFull: string;
    voicingOpen: string;
    voicingMovable: string;
    voicingStrings: string;
    voicingRootPosition: (stringNumber: number) => string;
    fretboardHelp: string;
    chordRecognitionHelp: string;
    chordCompositionHelp: string;
    voicingSuggestionsHelp: string;
    voicingSuggestionsEmpty: string;
    scoreDisplayHelp: string;
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
  const [formulaOverride, setFormulaOverride] = useState<ChordFormula | null>(null);
  const [voicingDensity, setVoicingDensity] = useState<VoicingDensity>("balanced");
  const candidates = useMemo(() => analyzeChordFingering({
    tuning,
    frets: draft.strings,
    capo,
  }), [capo, draft.strings, tuning]);
  const activeCandidate = candidates.find((candidate) => candidate.symbol === draft.name)
    ?? candidates[0]
    ?? null;
  const analyzedFormula = useMemo(
    () => activeCandidate ? candidateToChordFormula(activeCandidate) : null,
    [activeCandidate],
  );
  const formula = formulaOverride
    ?? analyzedFormula
    ?? EMPTY_FORMULA;
  const voicingSuggestions = useMemo(() => formula.tones.length < 2
    ? []
    : generateChordVoicings({
      formula,
      tuning,
      capo,
      maxResults: 8,
      density: voicingDensity,
    }), [capo, formula, tuning, voicingDensity]);

  useEffect(() => {
    if (selectedDefinition) setDraft(copyChord(selectedDefinition));
  }, [selectedDefinition]);

  const selectDefinition = (definition: ChordDefinitionInfo) => {
    setSelectedId(definition.id);
    setDraft(copyChord(definition));
    setConfirmDelete(false);
    setFormulaOverride(null);
  };
  const startNew = () => {
    setSelectedId(null);
    setDraft(emptyChord(stringCount));
    setConfirmDelete(false);
    setFormulaOverride(null);
  };

  const applyFormula = (nextFormula: ChordFormula) => {
    const normalizedFormula = {
      ...nextFormula,
      rootPitchClass: modulo12(nextFormula.rootPitchClass),
      bassPitchClass: modulo12(nextFormula.bassPitchClass),
      tones: nextFormula.tones.includes("1")
        ? nextFormula.tones
        : (["1", ...nextFormula.tones] as ChordToneId[]),
    };
    const [bestVoicing] = normalizedFormula.tones.length < 2
      ? []
      : generateChordVoicings({
        formula: normalizedFormula,
        tuning,
        capo,
        maxResults: 1,
        density: voicingDensity,
      });
    setFormulaOverride(normalizedFormula);
    setDraft((current) => ({
      ...current,
      name: formatChordFormula(normalizedFormula),
      strings: bestVoicing?.strings ?? current.strings,
      firstFret: bestVoicing?.firstFret ?? current.firstFret,
      barreFrets: bestVoicing ? [] : current.barreFrets,
    }));
  };

  const toggleFormulaTone = (tone: ChordToneId) => {
    if (tone === "1") return;
    const selected = formula.tones.includes(tone);
    let tones = selected
      ? formula.tones.filter((item) => item !== tone)
      : [...formula.tones, tone];
    const chordFunction = CHORD_TONE_DEFINITIONS[tone].chordFunction;
    if (!selected && chordFunction !== "extensions") {
      tones = tones.filter((item) => item === tone
        || item === "1"
        || CHORD_TONE_DEFINITIONS[item].chordFunction !== chordFunction);
    }
    const pitchClasses = new Set(tones.map((item) => modulo12(
      formula.rootPitchClass + CHORD_TONE_DEFINITIONS[item].semitones,
    )));
    applyFormula({
      ...formula,
      tones,
      bassPitchClass: pitchClasses.has(formula.bassPitchClass)
        ? formula.bassPitchClass
        : formula.rootPitchClass,
    });
  };

  return (
    <TooltipProvider>
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
          <section className="space-y-1.5" data-chord-section="fretboard">
            <ChordSectionHeading
              title={labels.fretboard}
              help={labels.fretboardHelp}
              actions={(
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
              )}
            />
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
              fretWindowSize={DIAGRAM_FRETS}
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
              onChange={(strings) => {
                setFormulaOverride(null);
                setDraft({ ...draft, strings });
              }}
            />
          </section>

          <section className="space-y-1.5" data-chord-section="composition">
            <ChordSectionHeading
              title={labels.chordComposition}
              help={labels.chordCompositionHelp}
              actions={<div
                data-chord-root-control
                className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
              >
                <span>{labels.rootFunction}</span>
                <PresetCombobox
                  value={formula.rootPitchClass}
                  ariaLabel={labels.rootPicker}
                  options={Array.from({ length: 12 }, (_, pitchClass) => ({
                    value: pitchClass,
                    label: formatPitchClass(pitchClass),
                  }))}
                  onValueChange={(rootPitchClass) => {
                    const transpose = modulo12(rootPitchClass - formula.rootPitchClass);
                    applyFormula({
                      ...formula,
                      rootPitchClass,
                      bassPitchClass: modulo12(formula.bassPitchClass + transpose),
                    });
                  }}
                  align="end"
                  triggerClassName="h-7 w-24 shrink-0"
                  contentClassName="w-36"
                />
              </div>}
            />
            <ChordCompositionChart
              formula={formula}
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
              onToneToggle={toggleFormulaTone}
              onBassChange={(bassPitchClass) => applyFormula({
                ...formula,
                bassPitchClass,
              })}
            />
          </section>

          <div className="grid gap-3 lg:grid-cols-2" data-chord-analysis-grid>
            <section
              className="min-w-0 space-y-1.5 rounded-md border bg-muted/10 p-3"
              data-chord-section="recognition"
            >
              <ChordSectionHeading
                title={labels.possibleChords}
                help={labels.chordRecognitionHelp}
              />
              <ChordCandidateList
                candidates={candidates}
                selectedName={draft.name}
                labels={{
                  noCandidates: labels.noChordCandidates,
                  bestMatch: labels.bestMatch,
                  alternatives: labels.alternativeChords,
                  bass: labels.bass,
                }}
                onSelect={(candidate) => {
                  setFormulaOverride(candidateToChordFormula(candidate));
                  setDraft({ ...draft, name: candidate.symbol });
                }}
              />
            </section>

            <section
              className="min-w-0 space-y-1.5 rounded-md border bg-muted/10 p-3"
              data-chord-section="voicings"
              data-chord-voicings
            >
              <ChordSectionHeading
                title={labels.voicingSuggestions}
                help={labels.voicingSuggestionsHelp}
                actions={voicingSuggestions.length > 0 ? <ToggleGroup
                  type="single"
                  value={voicingDensity}
                  aria-label={labels.voicingDensity}
                  variant="outline"
                  size="sm"
                  onValueChange={(value) => {
                    if (value) setVoicingDensity(value as VoicingDensity);
                  }}
                >
                  <ToggleGroupItem value="compact" className="h-7 px-2 text-[10px]">
                    {labels.voicingCompact}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="balanced" className="h-7 px-2 text-[10px]">
                    {labels.voicingBalanced}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="full" className="h-7 px-2 text-[10px]">
                    {labels.voicingFull}
                  </ToggleGroupItem>
                </ToggleGroup> : undefined}
              />
              {voicingSuggestions.length === 0 ? (
                <div className="rounded border border-dashed px-2 py-3 text-center text-[11px] text-muted-foreground">
                  {labels.voicingSuggestionsEmpty}
                </div>
              ) : <div className="grid gap-1.5 sm:grid-cols-2">
                {voicingSuggestions.map((voicing) => {
                  const selected = voicing.strings.every((fret, stringIndex) =>
                    draft.strings[stringIndex] === fret);
                  const shape = [...voicing.strings]
                    .reverse()
                    .map((fret) => fret < 0 ? "×" : fret.toString())
                    .join(" ");
                  return (
                    <button
                      key={voicing.strings.join(",")}
                      type="button"
                      aria-pressed={selected}
                      data-voicing-family={voicing.familyKey}
                      className={cn(
                        "min-w-0 rounded-md border px-2.5 py-2 text-left transition-colors",
                        selected
                          ? "border-input bg-accent text-accent-foreground"
                          : "border-border bg-background hover:bg-accent/50",
                      )}
                      onClick={() => {
                        setFormulaOverride(formula);
                        setDraft({
                          ...draft,
                          name: formatChordFormula(formula),
                          strings: voicing.strings,
                          firstFret: voicing.firstFret,
                          barreFrets: [],
                        });
                      }}
                    >
                      <span className="block truncate font-mono text-[11px] font-semibold">
                        {shape}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] text-muted-foreground">
                        <span>{voicing.position === "open"
                          ? labels.voicingOpen
                          : labels.voicingMovable}</span>
                        <span>{voicing.soundingStrings} {labels.voicingStrings}</span>
                        {voicing.rootString !== null && (
                          <span>{labels.voicingRootPosition(voicing.rootString)}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>}
            </section>
          </div>

          <section className="space-y-1.5 border-t pt-2" data-chord-section="score-display">
            <ChordSectionHeading title={labels.scoreDisplay} help={labels.scoreDisplayHelp} />
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
                      <span className="relative h-4 w-4 shrink-0">
                        <input
                          type="checkbox"
                          checked={draft[field]}
                          className="peer h-4 w-4 cursor-default appearance-none rounded border border-input bg-background text-accent-foreground transition-colors checked:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onChange={(event) => setDraft({
                            ...draft,
                            [field]: event.target.checked,
                          })}
                        />
                        <Check className="pointer-events-none absolute inset-0 h-4 w-4 p-0.5 text-accent-foreground opacity-0 peer-checked:opacity-100" />
                      </span>
                      {label}
                    </label>
                  ))}

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
    </TooltipProvider>
  );
}
