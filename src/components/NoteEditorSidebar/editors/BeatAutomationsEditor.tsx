import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GENERAL_MIDI_INSTRUMENTS, generalMidiInstrument } from "@/core/general-midi";
import {
  AutomationType,
  type AutomationSchema,
} from "@/core/schema";

const BEAT_AUTOMATION_TYPES = [
  AutomationType.Volume,
  AutomationType.Balance,
  AutomationType.Instrument,
  AutomationType.Bank,
] as const;

type BeatAutomationType = typeof BEAT_AUTOMATION_TYPES[number];
export type BeatAutomationSchema = AutomationSchema & {
  type: BeatAutomationType;
};

interface DraftAutomation extends AutomationSchema {
  draftId: number;
}

function createDrafts(
  automations: readonly AutomationSchema[],
  nextId: () => number,
): DraftAutomation[] {
  return automations.map((automation) => ({
    ...automation,
    draftId: nextId(),
  }));
}

export interface BeatAutomationLabels {
  none: string;
  count: (count: number) => string;
  type: string;
  value: string;
  volume: string;
  balance: string;
  instrument: string;
  bank: string;
  add: string;
  remove: string;
  apply: string;
  duplicateType: string;
}

function typeLabel(type: AutomationType, labels: BeatAutomationLabels): string {
  switch (type) {
    case AutomationType.Volume:
      return labels.volume;
    case AutomationType.Instrument:
      return labels.instrument;
    case AutomationType.Balance:
      return labels.balance;
    case AutomationType.Bank:
      return labels.bank;
    default:
      return String(type);
  }
}

function defaultValue(type: BeatAutomationType): number {
  switch (type) {
    case AutomationType.Volume:
      return 16;
    case AutomationType.Balance:
      return 8;
    default:
      return 0;
  }
}

function numericLimits(type: BeatAutomationType): {
  min: number;
  max: number;
  step: number;
} {
  switch (type) {
    case AutomationType.Volume:
    case AutomationType.Balance:
      return { min: 0, max: 16, step: 0.1 };
    case AutomationType.Instrument:
      return { min: 0, max: 127, step: 1 };
    case AutomationType.Bank:
      return { min: 0, max: 16383, step: 1 };
  }
}

function isBeatAutomationType(type: AutomationType): type is BeatAutomationType {
  return BEAT_AUTOMATION_TYPES.some((candidate) => candidate === type);
}

export function beatAutomationsSummary(
  automations: readonly AutomationSchema[],
  labels: BeatAutomationLabels,
): string {
  if (automations.length === 0) return labels.none;
  if (automations.length === 1) {
    const automation = automations[0];
    if (automation.type === AutomationType.Instrument) {
      return generalMidiInstrument(automation.value)?.name
        ?? `${labels.instrument} ${automation.value}`;
    }
    return `${typeLabel(automation.type, labels)} ${automation.value}`;
  }
  return `${labels.count(automations.length)} · ${automations
    .map((automation) => typeLabel(automation.type, labels))
    .join(", ")}`;
}

export function BeatAutomationsEditor({
  automations,
  labels,
  onCommit,
  onDone,
}: {
  automations: readonly AutomationSchema[];
  labels: BeatAutomationLabels;
  onCommit: (automations: BeatAutomationSchema[]) => void;
  onDone: () => void;
}) {
  const nextDraftId = useRef(0);
  const allocateId = () => nextDraftId.current++;
  const [drafts, setDrafts] = useState<DraftAutomation[]>(() =>
    createDrafts(automations, allocateId));

  useEffect(() => {
    setDrafts(createDrafts(automations, allocateId));
  }, [automations]);

  const usedTypes = new Set(drafts.map((draft) => draft.type));
  const hasDuplicateType = usedTypes.size !== drafts.length;
  const availableType = BEAT_AUTOMATION_TYPES.find((type) => !usedTypes.has(type));
  const hasInvalidValue = drafts.some((draft) => {
    if (!isBeatAutomationType(draft.type)) return true;
    const limits = numericLimits(draft.type);
    return !Number.isFinite(draft.value)
      || draft.value < limits.min
      || draft.value > limits.max
      || (limits.step === 1 && !Number.isInteger(draft.value));
  });

  const update = (draftId: number, patch: Partial<AutomationSchema>) => {
    setDrafts((current) => current.map((draft) =>
      draft.draftId === draftId ? { ...draft, ...patch } : draft));
  };

  return (
    <div className="space-y-3">
      <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
        {drafts.map((draft, index) => {
          const resolvedType = isBeatAutomationType(draft.type)
            ? draft.type
            : AutomationType.Volume;
          const limits = numericLimits(resolvedType);
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
                  <span>{labels.type}</span>
                  <select
                    value={resolvedType}
                    aria-label={`${labels.type} ${index + 1}`}
                    className="h-8 w-full rounded border bg-background px-2 text-sm text-foreground outline-none focus:border-primary"
                    onChange={(event) => {
                      const type = Number(event.currentTarget.value) as BeatAutomationType;
                      update(draft.draftId, { type, value: defaultValue(type) });
                    }}
                  >
                    {BEAT_AUTOMATION_TYPES.map((type) => (
                      <option
                        key={type}
                        value={type}
                        disabled={type !== draft.type && usedTypes.has(type)}
                      >
                        {typeLabel(type, labels)}
                      </option>
                    ))}
                  </select>
                </label>

                {resolvedType === AutomationType.Instrument ? (
                  <label className="space-y-1 text-[11px] text-muted-foreground">
                    <span>{labels.instrument}</span>
                    <select
                      value={draft.value}
                      aria-label={`${labels.value} ${index + 1}`}
                      className="h-8 w-full rounded border bg-background px-2 text-sm text-foreground outline-none focus:border-primary"
                      onChange={(event) => update(draft.draftId, {
                        value: Number(event.currentTarget.value),
                      })}
                    >
                      {GENERAL_MIDI_INSTRUMENTS.map((instrument) => (
                        <option key={instrument.program} value={instrument.program}>
                          {instrument.program + 1}. {instrument.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="space-y-1 text-[11px] text-muted-foreground">
                    <span>{resolvedType === AutomationType.Bank
                      ? labels.bank
                      : labels.value}</span>
                    <input
                      type="number"
                      min={limits.min}
                      max={limits.max}
                      step={limits.step}
                      value={draft.value}
                      aria-label={`${labels.value} ${index + 1}`}
                      className="h-8 w-full rounded border bg-background px-2 text-right text-sm text-foreground outline-none focus:border-primary"
                      onChange={(event) => {
                        const value = event.currentTarget.valueAsNumber;
                        if (Number.isFinite(value)) update(draft.draftId, { value });
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hasDuplicateType && (
        <p role="alert" className="text-xs text-destructive">
          {labels.duplicateType}
        </p>
      )}

      <div className="flex items-center justify-between border-t pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={availableType === undefined}
          onClick={() => {
            if (availableType === undefined) return;
            setDrafts((current) => [...current, {
              draftId: allocateId(),
              isLinear: false,
              type: availableType,
              value: defaultValue(availableType),
              ratioPosition: 0,
              text: "",
              isVisible: false,
            }]);
          }}
        >
          <Plus />
          {labels.add}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={hasDuplicateType || hasInvalidValue}
          onClick={() => {
            const automations = drafts
              .filter((draft): draft is DraftAutomation & BeatAutomationSchema =>
                isBeatAutomationType(draft.type))
              .map(({ draftId: _draftId, ...automation }) => automation);
            onCommit(automations);
            onDone();
          }}
        >
          {labels.apply}
        </Button>
      </div>
    </div>
  );
}
