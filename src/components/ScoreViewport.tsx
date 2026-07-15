import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { usePlayerStore } from "@/stores/render-store";
import { useTransportModifierActive } from "@/shortcuts";
import { cn } from "@/lib/utils";

// ─── Score Viewport ──────────────────────────────────────────────────────────

export function ScoreViewport() {
  const { t } = useTranslation();
  const mainRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const initialize = usePlayerStore((s) => s.initialize);
  const destroy = usePlayerStore((s) => s.destroy);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const scoreLayout = usePlayerStore((s) => s.scoreLayout);
  const transportModifierActive = useTransportModifierActive();

  useEffect(() => {
    if (mainRef.current && viewportRef.current) {
      initialize(mainRef.current, viewportRef.current);
    }
    return () => {
      destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The horizontal score is a timeline, so a vertical wheel advances it.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || scoreLayout !== "horizontal") return;

    const handleViewportWheel = (e: WheelEvent) => {
      // Remap vertical wheel to horizontal scroll on the score
      if (e.deltaY !== 0) {
        e.preventDefault();
        viewport.scrollLeft += e.deltaY;
      }
    };

    viewport.addEventListener("wheel", handleViewportWheel, { passive: false });

    return () => {
      viewport.removeEventListener("wheel", handleViewportWheel);
    };
  }, [scoreLayout]);

  return (
    <div data-score-viewport className="relative flex min-w-0 flex-1 overflow-hidden">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {t("viewport.loadingScore")}
            </span>
          </div>
        </div>
      )}

      {/* AlphaTab Viewport (scroll container) */}
      <div
        ref={viewportRef}
        className={cn(
          "at-viewport flex-1 overflow-auto isolate",
          transportModifierActive && "at-transport-mode",
        )}
      >
        {/* AlphaTab Main (rendering target) */}
        <div ref={mainRef} className="at-main" />
      </div>
    </div>
  );
}
