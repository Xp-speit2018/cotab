import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * VolumeKnob — A compact SVG rotary control for volume (0-1).
 *
 * Interaction: Click + vertical drag to adjust value.
 * Shows a 0-100 tooltip while dragging.
 *
 * Visual: A circular arc that fills from the bottom-left (~225°)
 * clockwise to the bottom-right (~315°+360°) as the value increases.
 * The knob has a thick track, a bright fill arc, and a position line indicator.
 */

const KNOB_SIZE = 22;
const STROKE_WIDTH = 3;
const RADIUS = (KNOB_SIZE - STROKE_WIDTH) / 2;
const CENTER = KNOB_SIZE / 2;

// Arc spans 270° with a 90° gap at the bottom
const ARC_START_DEG = 225;
const ARC_SWEEP_DEG = 270;

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = degToRad(deg - 90); // SVG: 0° is top
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const sweep = endDeg - startDeg;
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

interface VolumeKnobProps {
  /** Value from 0 to 1. */
  value: number;
  /** Called with new value (0-1) during drag. */
  onValueChange: (value: number) => void;
  /** Extra class name for the wrapper. */
  className?: string;
  /** If true, knob is disabled. */
  disabled?: boolean;
}

function VolumeKnob({
  value,
  onValueChange,
  className,
  disabled = false,
}: VolumeKnobProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStartY = React.useRef(0);
  const dragStartValue = React.useRef(0);

  // Sensitivity: how many px of vertical drag = full 0→1 sweep
  const DRAG_RANGE_PX = 80;

  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      dragStartY.current = e.clientY;
      dragStartValue.current = value;
      setIsDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [disabled, value],
  );

  const handlePointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const deltaY = dragStartY.current - e.clientY; // up = positive
      const deltaValue = deltaY / DRAG_RANGE_PX;
      const newValue = Math.min(1, Math.max(0, dragStartValue.current + deltaValue));
      onValueChange(newValue);
    },
    [isDragging, onValueChange],
  );

  const handlePointerUp = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  // Arc paths
  const bgArc = describeArc(
    CENTER, CENTER, RADIUS,
    ARC_START_DEG, ARC_START_DEG + ARC_SWEEP_DEG,
  );

  const valueDeg = ARC_START_DEG + value * ARC_SWEEP_DEG;
  const valueArc =
    value > 0.005
      ? describeArc(CENTER, CENTER, RADIUS, ARC_START_DEG, valueDeg)
      : "";

  // Position indicator: a short line from center toward the value angle
  const lineInner = polarToCartesian(CENTER, CENTER, RADIUS * 0.3, valueDeg);
  const lineOuter = polarToCartesian(CENTER, CENTER, RADIUS - STROKE_WIDTH * 0.5, valueDeg);

  const displayPercent = Math.round(value * 100);

  return (
    <div
      className={cn(
        "relative inline-flex cursor-ns-resize select-none items-center justify-center",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="slider"
      aria-valuenow={displayPercent}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={disabled ? -1 : 0}
    >
      <svg
        width={KNOB_SIZE}
        height={KNOB_SIZE}
        viewBox={`0 0 ${KNOB_SIZE} ${KNOB_SIZE}`}
        className="block"
      >
        {/* Background track arc */}
        <path
          d={bgArc}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          className="text-muted-foreground/25"
        />
        {/* Value fill arc */}
        {valueArc && (
          <path
            d={valueArc}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            className="text-primary"
          />
        )}
        {/* Position indicator line (from inner to outer) */}
        <line
          x1={lineInner.x}
          y1={lineInner.y}
          x2={lineOuter.x}
          y2={lineOuter.y}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          className="text-foreground"
        />
      </svg>

      {/* Tooltip: shown only while dragging */}
      {isDragging && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-popover px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-popover-foreground shadow-md ring-1 ring-border">
          {displayPercent}
        </div>
      )}
    </div>
  );
}

export { VolumeKnob };
