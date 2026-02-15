import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ResizeHandle — A thin vertical drag handle placed at the edge of a panel.
 *
 * Dragging horizontally resizes the adjacent panel.
 * `side="right"` means the handle sits on the right edge (drag right = wider).
 * `side="left"` means the handle sits on the left edge (drag left = wider).
 */

interface ResizeHandleProps {
  /** Which side of the panel this handle sits on. */
  side: "left" | "right";
  /** Called once when drag starts. */
  onResizeStart?: () => void;
  /** Called continuously with the pixel delta from the drag start.
   *  Positive delta = moving right. */
  onResize: (deltaX: number) => void;
  /** Called once when drag ends. */
  onResizeEnd?: () => void;
  className?: string;
}

function ResizeHandle({
  side,
  onResizeStart,
  onResize,
  onResizeEnd,
  className,
}: ResizeHandleProps) {
  const startX = React.useRef(0);
  const isDragging = React.useRef(false);

  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      startX.current = e.clientX;
      isDragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      onResizeStart?.();
    },
    [onResizeStart],
  );

  const handlePointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientX - startX.current;
      onResize(delta);
    },
    [onResize],
  );

  const handlePointerUp = React.useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      // Release capture
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      onResizeEnd?.();
    },
    [onResizeEnd],
  );

  return (
    <div
      className={cn(
        "flex-shrink-0 cursor-col-resize select-none",
        "w-[5px] hover:bg-primary/20 active:bg-primary/30 transition-colors",
        side === "right" ? "border-r border-border" : "border-l border-border",
        className,
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="separator"
      aria-orientation="vertical"
    />
  );
}

export { ResizeHandle };
