import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AutomationType,
  type TempoAutomationSchema,
} from "@/core/schema";

interface DraftTempoAutomation extends TempoAutomationSchema {
  draftId: number;
}

function createDrafts(
  automations: readonly TempoAutomationSchema[],
  nextId: () => number,
): DraftTempoAutomation[] {
  return automations.map((automation) => ({ ...automation, draftId: nextId() }));
}

function nextPosition(automations: readonly DraftTempoAutomation[]): number {
  if (automations.length === 0) return 0;
  const positions = automations
    .map((automation) => automation.ratioPosition)
    .sort((a, b) => a - b);
  let bestStart = 0;
  let bestEnd = positions[0];
  for (let index = 0; index < positions.length - 1; index++) {
    if (positions[index + 1] - positions[index] > bestEnd - bestStart) {
      bestStart = positions[index];
      bestEnd = positions[index + 1];
    }
  }
  if (1 - positions.at(-1)! > bestEnd - bestStart) {
    bestStart = positions.at(-1)!;
    bestEnd = 1;
  }
  return Number(((bestStart + bestEnd) / 2).toFixed(3));
}

export function tempoAutomationsSummary(
  automations: readonly TempoAutomationSchema[],
  noneLabel: string,
  countLabel: (count: number) => string,
): string {
  if (automations.length === 0) return noneLabel;
  if (automations.length === 1) return `${automations[0].value} BPM`;
  const values = automations.map((automation) => automation.value);
  return `${countLabel(automations.length)} · ${Math.min(...values)}–${Math.max(...values)} BPM`;
}

export function TempoAutomationsEditor({
  automations,
  labels,
  onCommit,
  onDone,
}: {
  automations: readonly TempoAutomationSchema[];
  labels: {
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
  };
  onCommit: (automations: TempoAutomationSchema[]) => void;
  onDone: () => void;
}) {
  const nextDraftId = useRef(0);
  const allocateId = () => nextDraftId.current++;
  const [drafts, setDrafts] = useState(() => createDrafts(automations, allocateId));

  useEffect(() => {
    setDrafts(createDrafts(automations, allocateId));
  }, [automations]);

  const update = (draftId: number, patch: Partial<TempoAutomationSchema>) => {
    setDrafts((current) => current.map((draft) =>
      draft.draftId === draftId ? { ...draft, ...patch } : draft));
  };

  const positions = drafts.map((draft) => draft.ratioPosition);
  const hasPositionConflict = positions.some((position, index) =>
    positions.some((other, otherIndex) =>
      otherIndex !== index && Math.abs(position - other) < 0.000_001));

  return (
    <div className="space-y-3">
      <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
        {drafts.map((draft, index) => {
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

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-[11px] text-muted-foreground">
                  <span>{labels.bpm}</span>
                  <input
                    type="number"
                    min={1}
                    value={draft.value}
                    aria-label={`${labels.bpm} ${index + 1}`}
                    className="h-8 w-full rounded border bg-background px-2 text-sm text-foreground outline-none focus:border-primary"
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
          onClick={() => {
            const position = nextPosition(drafts);
            const prior = [...drafts].sort(
              (a, b) => a.ratioPosition - b.ratioPosition,
            ).at(-1);
            setDrafts((current) => [...current, {
              draftId: allocateId(),
              isLinear: false,
              type: AutomationType.Tempo,
              value: prior?.value ?? 120,
              ratioPosition: position,
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
          disabled={hasPositionConflict || drafts.some((draft) => draft.value <= 0)}
          onClick={() => {
            const result = drafts
              .map(({ draftId: _draftId, ...automation }) => automation)
              .sort((a, b) => a.ratioPosition - b.ratioPosition);
            onCommit(result);
            onDone();
          }}
        >
          {labels.apply}
        </Button>
      </div>
    </div>
  );
}
