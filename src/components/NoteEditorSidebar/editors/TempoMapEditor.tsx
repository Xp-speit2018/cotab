import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AutomationType,
  type TempoAutomationSchema,
} from "@/core/schema";
import type { TempoMapEntryInfo } from "@/stores/render-types";

interface DraftTempoPoint extends TempoAutomationSchema {
  draftId: number;
  masterBarIndex: number;
}

export interface TempoMapLabels {
  none: string;
  count: (count: number) => string;
  bar: string;
  bpm: string;
  position: string;
  text: string;
  textPlaceholder: string;
  gradual: string;
  visible: string;
  add: string;
  remove: string;
  apply: string;
  positionConflict: string;
}

function createDrafts(
  entries: readonly TempoMapEntryInfo[],
  nextId: () => number,
): DraftTempoPoint[] {
  return entries.flatMap((entry) => entry.automations.map((automation) => ({
    ...automation,
    masterBarIndex: entry.masterBarIndex,
    draftId: nextId(),
  })));
}

function comparePoints(
  left: Pick<DraftTempoPoint, "masterBarIndex" | "ratioPosition">,
  right: Pick<DraftTempoPoint, "masterBarIndex" | "ratioPosition">,
): number {
  return left.masterBarIndex - right.masterBarIndex
    || left.ratioPosition - right.ratioPosition;
}

function nextPoint(
  drafts: readonly DraftTempoPoint[],
  masterBarCount: number,
): { masterBarIndex: number; ratioPosition: number; value: number } {
  const sorted = [...drafts].sort(comparePoints);
  const last = sorted.at(-1);
  if (!last) return { masterBarIndex: 0, ratioPosition: 0, value: 120 };
  if (last.masterBarIndex + 1 < masterBarCount) {
    return {
      masterBarIndex: last.masterBarIndex + 1,
      ratioPosition: 0,
      value: last.value,
    };
  }

  const positions = sorted
    .filter((draft) => draft.masterBarIndex === last.masterBarIndex)
    .map((draft) => draft.ratioPosition)
    .sort((left, right) => left - right);
  let gapStart = 0;
  let gapEnd = positions[0];
  for (let index = 0; index < positions.length - 1; index++) {
    if (positions[index + 1] - positions[index] > gapEnd - gapStart) {
      gapStart = positions[index];
      gapEnd = positions[index + 1];
    }
  }
  if (1 - positions.at(-1)! > gapEnd - gapStart) {
    gapStart = positions.at(-1)!;
    gapEnd = 1;
  }
  return {
    masterBarIndex: last.masterBarIndex,
    ratioPosition: Number(((gapStart + gapEnd) / 2).toFixed(3)),
    value: last.value,
  };
}

export function tempoMapSummary(
  entries: readonly TempoMapEntryInfo[],
  labels: Pick<TempoMapLabels, "none" | "count">,
): string {
  const points = entries.flatMap((entry) => entry.automations);
  if (points.length === 0) return labels.none;
  const values = points.map((point) => point.value);
  return `${labels.count(points.length)} · ${Math.min(...values)}–${Math.max(...values)} BPM`;
}

export function TempoMapEditor({
  entries,
  masterBarCount,
  labels,
  onCommit,
  onDone,
}: {
  entries: readonly TempoMapEntryInfo[];
  masterBarCount: number;
  labels: TempoMapLabels;
  onCommit: (entries: TempoMapEntryInfo[]) => void;
  onDone: () => void;
}) {
  const nextDraftId = useRef(0);
  const allocateId = () => nextDraftId.current++;
  const [drafts, setDrafts] = useState(() => createDrafts(entries, allocateId));

  useEffect(() => {
    setDrafts(createDrafts(entries, allocateId));
  }, [entries]);

  const update = (draftId: number, patch: Partial<DraftTempoPoint>) => {
    setDrafts((current) => current.map((draft) =>
      draft.draftId === draftId ? { ...draft, ...patch } : draft));
  };
  const hasPositionConflict = drafts.some((draft, index) =>
    drafts.some((other, otherIndex) =>
      otherIndex !== index
      && other.masterBarIndex === draft.masterBarIndex
      && Math.abs(other.ratioPosition - draft.ratioPosition) < 0.000_001));
  const hasInvalidPoint = drafts.some((draft) =>
    draft.masterBarIndex < 0
    || draft.masterBarIndex >= masterBarCount
    || draft.value <= 0);

  return (
    <div className="space-y-3">
      <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
        {[...drafts].sort(comparePoints).map((draft, index) => {
          const positionPercent = Number((draft.ratioPosition * 100).toFixed(1));
          return (
            <div key={draft.draftId} className="rounded-md border p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold tabular-nums">
                  {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`${labels.remove} ${index + 1}`}
                  onClick={() => setDrafts((current) =>
                    current.filter((item) => item.draftId !== draft.draftId))}
                >
                  <Trash2 />
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-[6rem_8rem_1fr]">
                <label className="space-y-1 text-[11px] text-muted-foreground">
                  <span>{labels.bar}</span>
                  <input
                    type="number"
                    min={1}
                    max={masterBarCount}
                    value={draft.masterBarIndex + 1}
                    aria-label={`${labels.bar} ${index + 1}`}
                    className="h-8 w-full rounded border bg-background px-2 text-right text-sm text-foreground outline-none focus:border-primary"
                    onChange={(event) => {
                      const value = event.currentTarget.valueAsNumber;
                      if (Number.isFinite(value)) {
                        update(draft.draftId, {
                          masterBarIndex: Math.trunc(value) - 1,
                        });
                      }
                    }}
                  />
                </label>
                <label className="space-y-1 text-[11px] text-muted-foreground">
                  <span>{labels.bpm}</span>
                  <input
                    type="number"
                    min={1}
                    value={draft.value}
                    aria-label={`${labels.bpm} ${index + 1}`}
                    className="h-8 w-full rounded border bg-background px-2 text-right text-sm text-foreground outline-none focus:border-primary"
                    onChange={(event) => {
                      const value = event.currentTarget.valueAsNumber;
                      if (Number.isFinite(value)) update(draft.draftId, { value });
                    }}
                  />
                </label>
                <label className="space-y-1 text-[11px] text-muted-foreground">
                  <span>{labels.text}</span>
                  <input
                    type="text"
                    value={draft.text}
                    aria-label={`${labels.text} ${index + 1}`}
                    placeholder={labels.textPlaceholder}
                    className="h-8 w-full rounded border bg-background px-2 text-sm text-foreground outline-none focus:border-primary"
                    onChange={(event) => update(draft.draftId, {
                      text: event.currentTarget.value,
                    })}
                  />
                </label>
              </div>

              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{labels.position}</span>
                  <label className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={positionPercent}
                      aria-label={`${labels.position} ${index + 1}`}
                      className="h-7 w-16 rounded border bg-background px-1.5 text-right text-xs text-foreground outline-none focus:border-primary"
                      onChange={(event) => {
                        const value = event.currentTarget.valueAsNumber;
                        if (Number.isFinite(value)) {
                          update(draft.draftId, {
                            ratioPosition: Math.max(0, Math.min(100, value)) / 100,
                          });
                        }
                      }}
                    />
                    <span>%</span>
                  </label>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.1}
                  value={positionPercent}
                  aria-label={`${labels.position} ${index + 1} slider`}
                  className="h-5 w-full accent-primary"
                  onChange={(event) => update(draft.draftId, {
                    ratioPosition: Number(event.currentTarget.value) / 100,
                  })}
                />
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-[11px]">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={draft.isLinear}
                    onChange={(event) => update(draft.draftId, {
                      isLinear: event.currentTarget.checked,
                    })}
                  />
                  {labels.gradual}
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={draft.isVisible}
                    onChange={(event) => update(draft.draftId, {
                      isVisible: event.currentTarget.checked,
                    })}
                  />
                  {labels.visible}
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {hasPositionConflict && (
        <p role="alert" className="text-xs text-destructive">
          {labels.positionConflict}
        </p>
      )}

      <div className="flex items-center justify-between border-t pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={masterBarCount === 0}
          onClick={() => {
            const point = nextPoint(drafts, masterBarCount);
            setDrafts((current) => [...current, {
              draftId: allocateId(),
              masterBarIndex: point.masterBarIndex,
              isLinear: false,
              type: AutomationType.Tempo,
              value: point.value,
              ratioPosition: point.ratioPosition,
              text: "",
              isVisible: true,
            }]);
          }}
        >
          <Plus />
          {labels.add}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={hasPositionConflict || hasInvalidPoint}
          onClick={() => {
            const grouped = new Map<number, TempoAutomationSchema[]>();
            for (const { draftId: _draftId, masterBarIndex, ...automation } of
              [...drafts].sort(comparePoints)) {
              const automations = grouped.get(masterBarIndex) ?? [];
              automations.push(automation);
              grouped.set(masterBarIndex, automations);
            }
            onCommit([...grouped].map(([masterBarIndex, automations]) => ({
              masterBarIndex,
              automations,
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
