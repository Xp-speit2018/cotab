import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BrushType,
  Duration,
  GraceType,
  HarmonicType,
  TremoloPickingStyle,
} from "@/core/schema";

function ChoiceGrid<T extends number>({
  value,
  options,
  columns = 2,
  onChange,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  columns?: number;
  onChange: (value: T) => void;
}) {
  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={value === option.value ? "secondary" : "outline"}
          size="sm"
          className="h-8 min-w-0 px-2 text-xs"
          onClick={() => onChange(option.value)}
        >
          <span className="truncate">{option.label}</span>
        </Button>
      ))}
    </div>
  );
}

export function TrillEditor({
  value,
  speed,
  fretLabel,
  speedLabel,
  applyLabel,
  durationLabels,
  onCommit,
  onDone,
}: {
  value: number;
  speed: Duration;
  fretLabel: string;
  speedLabel: string;
  applyLabel: string;
  durationLabels: Record<Duration.Eighth | Duration.Sixteenth | Duration.ThirtySecond, string>;
  onCommit: (value: number, speed: Duration) => void;
  onDone: () => void;
}) {
  const [draftValue, setDraftValue] = useState(Math.max(0, value));
  const [draftSpeed, setDraftSpeed] = useState(speed);

  useEffect(() => {
    setDraftValue(Math.max(0, value));
    setDraftSpeed(speed);
  }, [value, speed]);

  const speeds = [
    Duration.Eighth,
    Duration.Sixteenth,
    Duration.ThirtySecond,
  ] as const;

  return (
    <div className="space-y-3">
      <label className="block space-y-1 text-[10px] text-muted-foreground">
        <span>{fretLabel}</span>
        <Input
          type="number"
          min={0}
          max={36}
          value={draftValue}
          className="h-8 text-xs tabular-nums"
          onChange={(event) => setDraftValue(Number(event.target.value))}
        />
      </label>
      <div className="space-y-1">
        <div className="text-[10px] text-muted-foreground">{speedLabel}</div>
        <ChoiceGrid
          value={draftSpeed}
          columns={3}
          options={speeds.map((duration) => ({
            value: duration,
            label: durationLabels[duration],
          }))}
          onChange={setDraftSpeed}
        />
      </div>
      <Button
        type="button"
        size="sm"
        className="h-8 w-full"
        disabled={!Number.isFinite(draftValue) || draftValue < 0}
        onClick={() => {
          onCommit(draftValue, draftSpeed);
          onDone();
        }}
      >
        {applyLabel}
      </Button>
    </div>
  );
}

export function HarmonicEditor({
  type,
  value,
  typeLabel,
  valueLabel,
  applyLabel,
  options,
  onCommit,
  onDone,
}: {
  type: HarmonicType;
  value: number;
  typeLabel: string;
  valueLabel: string;
  applyLabel: string;
  options: readonly { value: HarmonicType; label: string }[];
  onCommit: (type: HarmonicType, value: number) => void;
  onDone: () => void;
}) {
  const [draftType, setDraftType] = useState(type);
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    setDraftType(type);
    setDraftValue(value);
  }, [type, value]);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="text-[10px] text-muted-foreground">{typeLabel}</div>
        <ChoiceGrid value={draftType} options={options} onChange={setDraftType} />
      </div>
      <label className="block space-y-1 text-[10px] text-muted-foreground">
        <span>{valueLabel}</span>
        <Input
          type="number"
          min={0}
          max={24}
          step={0.5}
          value={draftValue}
          className="h-8 text-xs tabular-nums"
          onChange={(event) => setDraftValue(Number(event.target.value))}
        />
      </label>
      <Button
        type="button"
        size="sm"
        className="h-8 w-full"
        disabled={!Number.isFinite(draftValue) || draftValue < 0}
        onClick={() => {
          onCommit(draftType, draftValue);
          onDone();
        }}
      >
        {applyLabel}
      </Button>
    </div>
  );
}

export function BrushEditor({
  type,
  duration,
  typeLabel,
  durationLabel,
  applyLabel,
  options,
  onCommit,
  onDone,
}: {
  type: BrushType;
  duration: number;
  typeLabel: string;
  durationLabel: string;
  applyLabel: string;
  options: readonly { value: BrushType; label: string }[];
  onCommit: (type: BrushType, duration: number) => void;
  onDone: () => void;
}) {
  const [draftType, setDraftType] = useState(type);
  const [draftDuration, setDraftDuration] = useState(duration);

  useEffect(() => {
    setDraftType(type);
    setDraftDuration(duration);
  }, [type, duration]);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="text-[10px] text-muted-foreground">{typeLabel}</div>
        <ChoiceGrid value={draftType} options={options} onChange={setDraftType} />
      </div>
      <label className="block space-y-1 text-[10px] text-muted-foreground">
        <span>{durationLabel}</span>
        <Input
          type="number"
          min={1}
          max={960}
          value={draftDuration}
          className="h-8 text-xs tabular-nums"
          onChange={(event) => setDraftDuration(Number(event.target.value))}
        />
      </label>
      <Button
        type="button"
        size="sm"
        className="h-8 w-full"
        disabled={!Number.isInteger(draftDuration) || draftDuration < 1}
        onClick={() => {
          onCommit(draftType, draftDuration);
          onDone();
        }}
      >
        {applyLabel}
      </Button>
    </div>
  );
}

export function GraceEditor({
  value,
  options,
  onCommit,
  onDone,
}: {
  value: GraceType;
  options: readonly { value: GraceType; label: string }[];
  onCommit: (value: GraceType) => void;
  onDone: () => void;
}) {
  return (
    <ChoiceGrid
      value={value}
      options={options}
      onChange={(nextValue) => {
        onCommit(nextValue);
        onDone();
      }}
    />
  );
}

export function TremoloPickingEditor({
  marks,
  style,
  marksLabel,
  styleLabel,
  applyLabel,
  styleOptions,
  onCommit,
  onDone,
}: {
  marks: number;
  style: TremoloPickingStyle;
  marksLabel: string;
  styleLabel: string;
  applyLabel: string;
  styleOptions: readonly { value: TremoloPickingStyle; label: string }[];
  onCommit: (marks: number, style: TremoloPickingStyle) => void;
  onDone: () => void;
}) {
  const [draftMarks, setDraftMarks] = useState(marks);
  const [draftStyle, setDraftStyle] = useState(style);

  useEffect(() => {
    setDraftMarks(marks);
    setDraftStyle(style);
  }, [marks, style]);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="text-[10px] text-muted-foreground">{marksLabel}</div>
        <ChoiceGrid
          value={draftMarks}
          columns={3}
          options={[1, 2, 3].map((nextMarks) => ({
            value: nextMarks,
            label: String(nextMarks),
          }))}
          onChange={setDraftMarks}
        />
      </div>
      <div className="space-y-1">
        <div className="text-[10px] text-muted-foreground">{styleLabel}</div>
        <ChoiceGrid value={draftStyle} options={styleOptions} onChange={setDraftStyle} />
      </div>
      <Button
        type="button"
        size="sm"
        className="h-8 w-full"
        onClick={() => {
          onCommit(draftMarks, draftStyle);
          onDone();
        }}
      >
        {applyLabel}
      </Button>
    </div>
  );
}
