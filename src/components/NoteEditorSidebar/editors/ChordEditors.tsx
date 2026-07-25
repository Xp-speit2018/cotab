import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { ChordSchema } from "@/core/schema";
import type { ChordDefinitionInfo } from "@/stores/render-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PresetCombobox } from "../PresetCombobox";

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
    showFingering: true,
  };
}

function createChordId(): string {
  return `cotab-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
}

function ChordDiagram({ chord }: { chord: ChordSchema }) {
  const stringCount = Math.max(1, chord.strings.length);
  return (
    <div className="mx-auto w-48 py-2">
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
          const fret = chord.strings[index] ?? -1;
          const marker = fret < 0 ? "×" : fret === 0 ? "○" : null;
          const relativeFret = fret - chord.firstFret + 1;
          return (
            <div key={index}>
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
  labels,
  onSave,
  onDelete,
}: {
  definitions: readonly ChordDefinitionInfo[];
  stringCount: number;
  labels: {
    newChord: string;
    name: string;
    firstFret: string;
    strings: string;
    barreFrets: string;
    showName: string;
    showDiagram: string;
    showFingering: string;
    save: string;
    delete: string;
    confirmDelete: string;
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
        <div className="space-y-3">
          <label className="block space-y-1 text-xs text-muted-foreground">
            <span>{labels.name}</span>
            <Input
              value={draft.name}
              className="h-8 text-xs"
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <label className="block space-y-1 text-xs text-muted-foreground">
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
            <div className="text-xs text-muted-foreground">{labels.strings}</div>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(1, stringCount)}, minmax(0, 1fr))` }}>
              {draft.strings.map((fret, index) => (
                <Input
                  key={index}
                  type="number"
                  min={-1}
                  max={36}
                  value={fret}
                  aria-label={`${labels.strings} ${index + 1}`}
                  className="h-8 px-1 text-center text-xs tabular-nums"
                  onChange={(event) => {
                    const strings = [...draft.strings];
                    strings[index] = Number(event.target.value);
                    setDraft({ ...draft, strings });
                  }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">{labels.barreFrets}</div>
            <div className="flex gap-1">
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
            ["showFingering", labels.showFingering],
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
        </div>

        <div className="border-l pl-4">
          <ChordDiagram chord={draft} />
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
