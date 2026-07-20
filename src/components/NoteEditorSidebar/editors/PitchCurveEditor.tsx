import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import type { BendPointSchema } from "@/core/schema";
import {
  BendStyle,
  BendType,
  WhammyType,
} from "@/core/schema";
import {
  bendStyleLabel,
  bendTypeLabel,
  whammyTypeLabel,
} from "../labels";

const GRAPH_WIDTH = 264;
const GRAPH_HEIGHT = 132;
const GRAPH_LEFT = 28;
const GRAPH_RIGHT = 8;
const GRAPH_TOP = 10;
const GRAPH_BOTTOM = 22;
const MAX_OFFSET = 60;
const MAX_VALUE = 12;

function clonePoints(points: readonly BendPointSchema[]): BendPointSchema[] {
  return points.map((point) => ({ ...point }));
}

function extremePointIndex(points: readonly BendPointSchema[]): number {
  let result = 0;
  for (let index = 1; index < points.length; index++) {
    if (Math.abs(points[index].value) > Math.abs(points[result].value)) {
      result = index;
    }
  }
  return result;
}

function bendPreset(type: number): BendPointSchema[] {
  switch (type) {
    case BendType.Release: return [{ offset: 0, value: 4 }, { offset: 60, value: 0 }];
    case BendType.BendRelease: return [
      { offset: 0, value: 0 },
      { offset: 30, value: 4 },
      { offset: 30, value: 4 },
      { offset: 60, value: 0 },
    ];
    case BendType.Hold:
    case BendType.Prebend:
      return [{ offset: 0, value: 4 }, { offset: 60, value: 4 }];
    case BendType.PrebendBend:
      return [{ offset: 0, value: 4 }, { offset: 60, value: 8 }];
    case BendType.PrebendRelease:
      return [{ offset: 0, value: 4 }, { offset: 60, value: 0 }];
    default:
      return [{ offset: 0, value: 0 }, { offset: 60, value: 4 }];
  }
}

function whammyPreset(type: number): BendPointSchema[] {
  switch (type) {
    case WhammyType.Dip:
      return [
        { offset: 0, value: 0 },
        { offset: 30, value: -4 },
        { offset: 60, value: 0 },
      ];
    case WhammyType.Hold:
    case WhammyType.Predive:
      return [{ offset: 0, value: -4 }, { offset: 60, value: -4 }];
    case WhammyType.PrediveDive:
      return [{ offset: 0, value: -4 }, { offset: 60, value: -8 }];
    default:
      return [{ offset: 0, value: 0 }, { offset: 60, value: -4 }];
  }
}

function presetFor(kind: "bend" | "whammy", type: number): BendPointSchema[] {
  return kind === "bend" ? bendPreset(type) : whammyPreset(type);
}

function isCustom(kind: "bend" | "whammy", type: number): boolean {
  return kind === "bend"
    ? type === BendType.Custom
    : type === WhammyType.Custom;
}

function typeOptions(
  kind: "bend" | "whammy",
  t: (key: string) => string,
): Array<{ value: number; label: string }> {
  return kind === "bend"
    ? ([
        BendType.Bend,
        BendType.Release,
        BendType.BendRelease,
        BendType.Hold,
        BendType.Prebend,
        BendType.PrebendBend,
        BendType.PrebendRelease,
        BendType.Custom,
      ] as const).map((value) => ({ value, label: bendTypeLabel(value, t) }))
    : ([
        WhammyType.Dive,
        WhammyType.Dip,
        WhammyType.Hold,
        WhammyType.Predive,
        WhammyType.PrediveDive,
        WhammyType.Custom,
      ] as const).map((value) => ({ value, label: whammyTypeLabel(value, t) }));
}

export function pitchCurveSummary(
  kind: "bend" | "whammy",
  type: number,
  points: readonly BendPointSchema[] | null,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const typeName = kind === "bend"
    ? bendTypeLabel(type as BendType, t)
    : whammyTypeLabel(type as WhammyType, t);
  if (!points?.length) return typeName;
  const extreme = points.reduce((result, point) =>
    Math.abs(point.value) > Math.abs(result) ? point.value : result, 0);
  const tones = extreme / 4;
  const formatted = `${tones > 0 ? "+" : ""}${Number(tones.toFixed(2))}`;
  return `${typeName} · ${t("sidebar.effects.curveToneValue", { value: formatted })}`;
}

export function PitchCurveEditor({
  kind,
  type,
  style,
  isContinued,
  points,
  onCommit,
  onDone,
}: {
  kind: "bend" | "whammy";
  type: number;
  style: BendStyle;
  isContinued: boolean;
  points: readonly BendPointSchema[] | null;
  onCommit: (args: {
    type: number;
    style: BendStyle;
    isContinued: boolean;
    points: BendPointSchema[];
  }) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [draftType, setDraftType] = useState(type);
  const [draftStyle, setDraftStyle] = useState(style);
  const initialPoints = points?.length ? points : presetFor(kind, type);
  const [draftPoints, setDraftPoints] = useState<BendPointSchema[]>(() =>
    clonePoints(initialPoints));
  const [selectedIndex, setSelectedIndex] = useState(() =>
    extremePointIndex(initialPoints));
  const minValue = kind === "bend" ? 0 : -MAX_VALUE;
  const custom = isCustom(kind, draftType);
  const options = useMemo(() => typeOptions(kind, t), [kind, t]);

  useEffect(() => {
    setDraftType(type);
    setDraftStyle(style);
    const nextPoints = points?.length ? points : presetFor(kind, type);
    setDraftPoints(clonePoints(nextPoints));
    setSelectedIndex(extremePointIndex(nextPoints));
  }, [kind, points, style, type]);

  const graphWidth = GRAPH_WIDTH - GRAPH_LEFT - GRAPH_RIGHT;
  const graphHeight = GRAPH_HEIGHT - GRAPH_TOP - GRAPH_BOTTOM;
  const pointX = (offset: number) => GRAPH_LEFT + offset / MAX_OFFSET * graphWidth;
  const pointY = (value: number) =>
    GRAPH_TOP + (MAX_VALUE - value) / (MAX_VALUE - minValue) * graphHeight;
  const updatePoint = (index: number, next: BendPointSchema) => {
    setDraftPoints((current) => current.map((point, pointIndex) =>
      pointIndex === index ? next : point));
  };
  const clampOffset = (index: number, offset: number) => {
    const previous = draftPoints[index - 1]?.offset ?? 0;
    const next = draftPoints[index + 1]?.offset ?? MAX_OFFSET;
    return Math.max(previous, Math.min(next, offset));
  };
  const updateFromPointer = (
    index: number,
    event: React.PointerEvent<SVGCircleElement>,
  ) => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const bounds = svg.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width * GRAPH_WIDTH;
    const y = (event.clientY - bounds.top) / bounds.height * GRAPH_HEIGHT;
    const offset = Math.round((x - GRAPH_LEFT) / graphWidth * MAX_OFFSET);
    const value = Math.round(MAX_VALUE - (y - GRAPH_TOP) / graphHeight * (MAX_VALUE - minValue));
    updatePoint(index, {
      offset: custom
        ? clampOffset(index, Math.max(0, Math.min(MAX_OFFSET, offset)))
        : draftPoints[index].offset,
      value: Math.max(minValue, Math.min(MAX_VALUE, value)),
    });
  };
  const selectedPoint = draftPoints[selectedIndex] ?? draftPoints[0];

  const addPoint = () => {
    if (!custom || draftPoints.length >= 16) return;
    let insertionIndex = 1;
    let largestGap = -1;
    for (let index = 1; index < draftPoints.length; index++) {
      const gap = draftPoints[index].offset - draftPoints[index - 1].offset;
      if (gap > largestGap) {
        largestGap = gap;
        insertionIndex = index;
      }
    }
    const before = draftPoints[insertionIndex - 1];
    const after = draftPoints[insertionIndex];
    const next = [...draftPoints];
    next.splice(insertionIndex, 0, {
      offset: Math.round((before.offset + after.offset) / 2),
      value: Math.round((before.value + after.value) / 2),
    });
    setDraftPoints(next);
    setSelectedIndex(insertionIndex);
  };

  return (
    <div className="space-y-3">
      <label className="block space-y-1 text-[10px] text-muted-foreground">
        <span>{t("sidebar.effects.curveType")}</span>
        <Select
          value={String(draftType)}
          onValueChange={(value) => {
            const nextType = Number(value);
            setDraftType(nextType);
            if (!isCustom(kind, nextType)) {
              const nextPoints = presetFor(kind, nextType);
              setDraftPoints(nextPoints);
              setSelectedIndex(extremePointIndex(nextPoints));
            } else if (!draftPoints.length) {
              const nextPoints = presetFor(kind, nextType);
              setDraftPoints(nextPoints);
              setSelectedIndex(extremePointIndex(nextPoints));
            }
          }}
        >
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={String(option.value)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <div className="space-y-1">
        <div className="text-[10px] text-muted-foreground">
          {t("sidebar.effects.curveStyle")}
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={String(draftStyle)}
          className="grid w-full grid-cols-3"
          onValueChange={(value) => {
            if (value) setDraftStyle(Number(value) as BendStyle);
          }}
        >
          {([BendStyle.Default, BendStyle.Gradual, BendStyle.Fast] as const)
            .map((value) => (
              <ToggleGroupItem key={value} value={String(value)} className="h-8 px-1 text-xs">
                {bendStyleLabel(value, t)}
              </ToggleGroupItem>
            ))}
        </ToggleGroup>
      </div>

      <div className="overflow-hidden rounded border bg-muted/15">
        <svg
          viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
          className="block aspect-[2/1] w-full touch-none"
          aria-label={t("sidebar.effects.curveGraph")}
        >
          {Array.from(
            { length: (MAX_VALUE - minValue) / 4 + 1 },
            (_, index) => minValue + index * 4,
          )
            .map((value) => (
              <g key={value}>
                <line
                  x1={GRAPH_LEFT}
                  x2={GRAPH_WIDTH - GRAPH_RIGHT}
                  y1={pointY(value)}
                  y2={pointY(value)}
                  className={value === 0 ? "stroke-foreground/35" : "stroke-border"}
                  strokeDasharray={value === 0 ? undefined : "2 3"}
                />
                <text
                  x={GRAPH_LEFT - 5}
                  y={pointY(value) + 3}
                  textAnchor="end"
                  className="fill-muted-foreground text-[8px]"
                >
                  {value / 4}
                </text>
              </g>
            ))}
          {[0, 30, 60].map((offset) => (
            <g key={offset}>
              <line
                x1={pointX(offset)}
                x2={pointX(offset)}
                y1={GRAPH_TOP}
                y2={GRAPH_HEIGHT - GRAPH_BOTTOM}
                className="stroke-border"
                strokeDasharray="2 3"
              />
              <text
                x={pointX(offset)}
                y={GRAPH_HEIGHT - 6}
                textAnchor="middle"
                className="fill-muted-foreground text-[8px]"
              >
                {Math.round(offset / MAX_OFFSET * 100)}%
              </text>
            </g>
          ))}
          <polyline
            points={draftPoints.map((point) => `${pointX(point.offset)},${pointY(point.value)}`).join(" ")}
            fill="none"
            className="stroke-primary"
            strokeWidth="2"
          />
          {draftPoints.map((point, index) => (
            <circle
              key={index}
              cx={pointX(point.offset)}
              cy={pointY(point.value)}
              r={selectedIndex === index ? 5 : 4}
              tabIndex={0}
              role="slider"
              aria-label={t("sidebar.effects.curvePoint", { index: index + 1 })}
              aria-valuemin={minValue / 4}
              aria-valuemax={MAX_VALUE / 4}
              aria-valuenow={point.value / 4}
              className={selectedIndex === index
                ? "cursor-grab fill-primary stroke-background active:cursor-grabbing"
                : "cursor-grab fill-background stroke-primary active:cursor-grabbing"}
              strokeWidth="2"
              onPointerDown={(event) => {
                event.stopPropagation();
                event.currentTarget.setPointerCapture(event.pointerId);
                setSelectedIndex(index);
                updateFromPointer(index, event);
              }}
              onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  updateFromPointer(index, event);
                }
              }}
              onKeyDown={(event) => {
                const pitchDelta = event.key === "ArrowUp" ? 1
                  : event.key === "ArrowDown" ? -1
                  : 0;
                const offsetDelta = custom && event.key === "ArrowRight" ? 1
                  : custom && event.key === "ArrowLeft" ? -1
                  : 0;
                if (pitchDelta === 0 && offsetDelta === 0) return;
                event.preventDefault();
                setSelectedIndex(index);
                updatePoint(index, {
                  offset: clampOffset(index, point.offset + offsetDelta),
                  value: Math.max(minValue, Math.min(MAX_VALUE, point.value + pitchDelta)),
                });
              }}
            />
          ))}
        </svg>
      </div>

      {selectedPoint && (
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-[10px] text-muted-foreground">
            <span>{t("sidebar.effects.curvePosition")}</span>
            <Input
              type="number"
              min={0}
              max={100}
              disabled={!custom}
              value={Math.round(selectedPoint.offset / MAX_OFFSET * 100)}
              className="h-8 text-xs tabular-nums"
              onChange={(event) => updatePoint(selectedIndex, {
                ...selectedPoint,
                offset: clampOffset(
                  selectedIndex,
                  Math.round(Number(event.target.value) / 100 * MAX_OFFSET),
                ),
              })}
            />
          </label>
          <label className="space-y-1 text-[10px] text-muted-foreground">
            <span>{t("sidebar.effects.curvePitch")}</span>
            <Input
              type="number"
              min={minValue / 4}
              max={MAX_VALUE / 4}
              step={0.25}
              value={selectedPoint.value / 4}
              className="h-8 text-xs tabular-nums"
              onChange={(event) => updatePoint(selectedIndex, {
                ...selectedPoint,
                value: Math.max(
                  minValue,
                  Math.min(MAX_VALUE, Math.round(Number(event.target.value) * 4)),
                ),
              })}
            />
          </label>
        </div>
      )}

      {isContinued && (
        <div className="text-[10px] text-muted-foreground">
          {t("sidebar.effects.curveContinued")}
        </div>
      )}

      {custom && (
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 flex-1"
            disabled={draftPoints.length >= 16}
            onClick={addPoint}
          >
            <Plus />
            {t("sidebar.effects.curveAddPoint")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 flex-1"
            disabled={draftPoints.length <= 2}
            onClick={() => {
              setDraftPoints((current) => current.filter((_, index) => index !== selectedIndex));
              setSelectedIndex(Math.max(0, selectedIndex - 1));
            }}
          >
            <Trash2 />
            {t("sidebar.effects.curveRemovePoint")}
          </Button>
        </div>
      )}

      <Button
        type="button"
        size="sm"
        className="h-8 w-full"
        onClick={() => {
          onCommit({
            type: draftType,
            style: draftStyle,
            isContinued,
            points: clonePoints(draftPoints),
          });
          onDone();
        }}
      >
        {t("sidebar.common.apply")}
      </Button>
    </div>
  );
}
