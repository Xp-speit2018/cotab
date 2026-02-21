import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ChevronUp, ChevronDown, HelpCircle, GripVertical } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FpsStats {
  current: number;
  avg: number;
  min: number;
  max: number;
  frameTimeMs: number;
  frameTimes: number[];
}

interface Diagnostics {
  detectedRefreshRate: number | null;
  prefersReducedMotion: boolean;
  isBackgroundThrottled: boolean;
  rAFConsistency: "locked" | "variable" | "unknown";
  jankFrames: number;
}

const HISTORY_SIZE = 120;
const SAMPLE_INTERVAL_MS = 500;

// ─── Component ───────────────────────────────────────────────────────────────

export function FpsSection({
  dragHandleProps,
}: {
  dragHandleProps?: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [showDiag, setShowDiag] = useState(true);
  const [stats, setStats] = useState<FpsStats>({
    current: 0,
    avg: 0,
    min: Infinity,
    max: 0,
    frameTimeMs: 0,
    frameTimes: [],
  });
  const [diagnostics, setDiagnostics] = useState<Diagnostics>({
    detectedRefreshRate: null,
    prefersReducedMotion: false,
    isBackgroundThrottled: false,
    rAFConsistency: "unknown",
    jankFrames: 0,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const frameTimesRef = useRef<number[]>([]);
  const allFrameTimesRef = useRef<number[]>([]);
  const lastUpdateRef = useRef<number>(0);

  const drawGraph = useCallback((frameTimes: number[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(0, 0, w, h);

    const maxMs = 80;

    const y60 = h - (16.67 / maxMs) * h;
    ctx.strokeStyle = "rgba(34, 197, 94, 0.5)";
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, y60);
    ctx.lineTo(w, y60);
    ctx.stroke();

    const y30 = h - (33.33 / maxMs) * h;
    ctx.strokeStyle = "rgba(234, 179, 8, 0.5)";
    ctx.beginPath();
    ctx.moveTo(0, y30);
    ctx.lineTo(w, y30);
    ctx.stroke();

    ctx.setLineDash([]);

    if (frameTimes.length < 2) return;

    const barWidth = w / HISTORY_SIZE;
    for (let i = 0; i < frameTimes.length; i++) {
      const ms = frameTimes[i];
      const barHeight = Math.min((ms / maxMs) * h, h);

      if (ms <= 18) {
        ctx.fillStyle = "rgba(34, 197, 94, 0.8)";
      } else if (ms <= 35) {
        ctx.fillStyle = "rgba(234, 179, 8, 0.8)";
      } else {
        ctx.fillStyle = "rgba(239, 68, 68, 0.8)";
      }

      ctx.fillRect(i * barWidth, h - barHeight, barWidth - 0.5, barHeight);
    }
  }, []);

  // Detect native display refresh rate
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const samples: number[] = [];
    let prev = 0;
    let count = 0;
    const TARGET = 30;

    const probe = (now: number) => {
      if (cancelled) return;
      if (prev > 0) {
        samples.push(now - prev);
        count++;
      }
      prev = now;
      if (count < TARGET) {
        requestAnimationFrame(probe);
      } else {
        const sorted = [...samples].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const hz = Math.round(1000 / median);
        if (!cancelled) {
          setDiagnostics((d) => ({ ...d, detectedRefreshRate: hz }));
        }
      }
    };

    const timer = setTimeout(() => requestAnimationFrame(probe), 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setDiagnostics((d) => ({ ...d, prefersReducedMotion: mq.matches }));
  }, []);

  // Main measurement loop — only active when section is open.
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const loop = () => {
      if (cancelled) return;

      const now = performance.now();

      if (lastTimeRef.current > 0) {
        const delta = now - lastTimeRef.current;
        frameTimesRef.current.push(delta);
        allFrameTimesRef.current.push(delta);

        if (frameTimesRef.current.length > HISTORY_SIZE) {
          frameTimesRef.current.shift();
        }
        if (allFrameTimesRef.current.length > 600) {
          allFrameTimesRef.current = allFrameTimesRef.current.slice(-300);
        }

        if (now - lastUpdateRef.current >= SAMPLE_INTERVAL_MS) {
          lastUpdateRef.current = now;
          const recent = frameTimesRef.current;
          const all = allFrameTimesRef.current;

          const currentFps =
            recent.length > 0
              ? 1000 / (recent.reduce((a, b) => a + b, 0) / recent.length)
              : 0;

          const avgFps =
            all.length > 0
              ? 1000 / (all.reduce((a, b) => a + b, 0) / all.length)
              : 0;

          const minFrameTime = all.length > 0 ? Math.min(...all) : 0;
          const maxFrameTime = all.length > 0 ? Math.max(...all) : 0;

          const sorted = [...all].sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)] || 16.67;
          const jankThreshold = median * 2;
          const jankFrames = all.filter((t) => t > jankThreshold).length;

          const mean = all.reduce((a, b) => a + b, 0) / all.length;
          const variance =
            all.reduce((acc, t) => acc + (t - mean) ** 2, 0) / all.length;
          const stdDev = Math.sqrt(variance);
          const consistency: Diagnostics["rAFConsistency"] =
            all.length < 10
              ? "unknown"
              : stdDev < 3
                ? "locked"
                : "variable";

          setStats({
            current: Math.round(currentFps),
            avg: Math.round(avgFps),
            min: minFrameTime > 0 ? Math.round(1000 / maxFrameTime) : 0,
            max: maxFrameTime > 0 ? Math.round(1000 / minFrameTime) : 0,
            frameTimeMs: Math.round(recent[recent.length - 1] * 100) / 100,
            frameTimes: [...recent],
          });

          setDiagnostics((d) => ({
            ...d,
            rAFConsistency: consistency,
            jankFrames,
            isBackgroundThrottled: median > 100,
          }));

          drawGraph(recent);
        }
      } else {
        lastUpdateRef.current = now;
      }

      lastTimeRef.current = now;

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = 0;
      lastUpdateRef.current = 0;
      frameTimesRef.current = [];
      allFrameTimesRef.current = [];
    };
  }, [isOpen, drawGraph]);

  const fpsColor =
    stats.current >= 55
      ? "text-green-400"
      : stats.current >= 30
        ? "text-yellow-400"
        : "text-red-400";

  const getCauseAnalysis = (): string => {
    const { detectedRefreshRate, rAFConsistency, prefersReducedMotion } =
      diagnostics;

    if (rAFConsistency === "unknown") return t("fps.collectingData");

    if (rAFConsistency === "locked" && stats.avg >= 28 && stats.avg <= 32) {
      if (detectedRefreshRate !== null && detectedRefreshRate <= 32) {
        return t("fps.raf30HzDisplay");
      }
      return t("fps.raf30FpsLocked");
    }

    if (rAFConsistency === "variable" && stats.avg < 55) {
      return t("fps.mainThreadJank", { count: diagnostics.jankFrames });
    }

    if (prefersReducedMotion) {
      return t("fps.reducedMotionEnabled");
    }

    if (stats.avg >= 55) {
      return t("fps.performanceGood");
    }

    return t("fps.belowTarget");
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="group flex w-full items-center">
        <button
          type="button"
          className="flex h-6 w-4 shrink-0 cursor-grab items-center justify-center opacity-0 transition-opacity group-hover:opacity-60 active:cursor-grabbing"
          aria-label={t("sidebar.reorderSection")}
          {...dragHandleProps}
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </button>
        <CollapsibleTrigger className="flex flex-1 items-center justify-between py-1.5 pr-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent/50">
          <span className="flex items-center gap-1">
            {t("sidebar.fps.title")}
            {isOpen && (
              <span className={`text-[10px] font-bold tabular-nums normal-case ${fpsColor}`}>
                {stats.current} FPS
              </span>
            )}
          </span>
          {isOpen ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </CollapsibleTrigger>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 hover:text-muted-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-[200px]">
            {t("sidebar.fps.help")}
          </TooltipContent>
        </Tooltip>
      </div>
      <CollapsibleContent>
        <div className="space-y-2 px-3 py-2 font-mono text-[11px]">
          {/* Stats row */}
          <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
            <span>
              {t("fps.avg")}{" "}
              <span className="text-foreground tabular-nums">{stats.avg}</span>
            </span>
            <span>
              {t("fps.min")}{" "}
              <span className="text-foreground tabular-nums">{stats.min}</span>
            </span>
            <span>
              {t("fps.max")}{" "}
              <span className="text-foreground tabular-nums">{stats.max}</span>
            </span>
            <span>
              {t("fps.ft")}{" "}
              <span className="text-foreground tabular-nums">
                {stats.frameTimeMs}ms
              </span>
            </span>
          </div>

          {/* Frame time graph */}
          <canvas
            ref={canvasRef}
            width={240}
            height={40}
            className="w-full rounded"
          />

          {/* Legend */}
          <div className="flex gap-2 text-[9px] text-muted-foreground">
            <span>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />{" "}
              {t("fps.fps60")}
            </span>
            <span>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-400" />{" "}
              {t("fps.fps30")}
            </span>
            <span>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />{" "}
              {t("fps.fpsBelow30")}
            </span>
          </div>

          {/* Diagnostics toggle */}
          <button
            onClick={() => setShowDiag((v) => !v)}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            {showDiag ? t("fps.hideDiag") : t("fps.showDiag")}
          </button>

          {/* Diagnostics panel */}
          {showDiag && (
            <div className="flex flex-col gap-1 border-t border-border/40 pt-1.5 text-[10px]">
              <div className="font-semibold text-muted-foreground">
                {t("fps.diagnostics")}
              </div>

              <div className="flex flex-col gap-0.5 text-muted-foreground">
                <span>
                  {t("fps.detectedRafRate")}{" "}
                  <span className="text-foreground">
                    {diagnostics.detectedRefreshRate !== null
                      ? `${diagnostics.detectedRefreshRate} Hz`
                      : t("fps.measuring")}
                  </span>
                </span>
                <span>
                  {t("fps.frameConsistency")}{" "}
                  <span
                    className={
                      diagnostics.rAFConsistency === "locked"
                        ? "text-yellow-400"
                        : "text-foreground"
                    }
                  >
                    {diagnostics.rAFConsistency}
                    {diagnostics.rAFConsistency === "locked" &&
                      ` ${t("fps.throttled")}`}
                  </span>
                </span>
                <span>
                  {t("fps.jankFrames")}{" "}
                  <span className="text-foreground">
                    {diagnostics.jankFrames}
                  </span>
                </span>
                <span>
                  {t("fps.prefersReducedMotion")}{" "}
                  <span className="text-foreground">
                    {diagnostics.prefersReducedMotion
                      ? t("fps.yes")
                      : t("fps.no")}
                  </span>
                </span>
              </div>

              {/* Analysis */}
              <div className="mt-1 rounded bg-muted/50 p-1.5 text-[10px] leading-relaxed text-muted-foreground">
                {getCauseAnalysis()}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
