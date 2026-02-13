import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

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

export function FpsMonitor() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(true);
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

    // 60fps line (16.67ms)
    const y60 = h - (16.67 / maxMs) * h;
    ctx.strokeStyle = "rgba(34, 197, 94, 0.5)";
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, y60);
    ctx.lineTo(w, y60);
    ctx.stroke();

    // 30fps line (33.33ms)
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
    if (!visible) return;

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
  }, [visible]);

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setDiagnostics((d) => ({ ...d, prefersReducedMotion: mq.matches }));
  }, []);

  // Main measurement loop.
  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    const loop = () => {
      if (cancelled) return;

      // Use performance.now() for wall-clock accuracy (rAF timestamps
      // don't account for busy-wait blocking).
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

        // Throttle UI updates to every SAMPLE_INTERVAL_MS
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
  }, [visible, drawGraph]);

  // Toggle via Shift+F or custom event from Toolbar
  useEffect(() => {
    const toggle = () => setVisible((v) => !v);

    const handleKey = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === "F") toggle();
    };

    window.addEventListener("keydown", handleKey);
    window.addEventListener("toggle-fps-monitor", toggle);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("toggle-fps-monitor", toggle);
    };
  }, []);

  if (!visible) return null;

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
    <div
      className="fixed bottom-2 right-2 z-[9999] flex flex-col gap-1.5 rounded-lg border border-white/10 bg-black/85 p-2.5 font-mono text-[11px] text-white/90 shadow-xl backdrop-blur-sm"
      style={{ maxWidth: 280 }}
      title={t("fps.toggleHint")}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <span className={`text-base font-bold tabular-nums ${fpsColor}`}>
          {stats.current} FPS
        </span>
        <div className="flex gap-1.5">
          <button
            onClick={() => setShowDiag((v) => !v)}
            className="text-[10px] text-white/40 hover:text-white/80"
          >
            {showDiag ? t("fps.hideDiag") : t("fps.showDiag")}
          </button>
          <button
            onClick={() => setVisible(false)}
            className="text-white/40 hover:text-white/80"
          >
            ×
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-3 text-[10px] text-white/60">
        <span>
          {t("fps.avg")}{" "}
          <span className="text-white/80 tabular-nums">{stats.avg}</span>
        </span>
        <span>
          {t("fps.min")}{" "}
          <span className="text-white/80 tabular-nums">{stats.min}</span>
        </span>
        <span>
          {t("fps.max")}{" "}
          <span className="text-white/80 tabular-nums">{stats.max}</span>
        </span>
        <span>
          {t("fps.ft")}{" "}
          <span className="text-white/80 tabular-nums">
            {stats.frameTimeMs}ms
          </span>
        </span>
      </div>

      {/* Frame time graph */}
      <canvas ref={canvasRef} width={240} height={40} className="rounded" />

      {/* Legend */}
      <div className="flex gap-2 text-[9px] text-white/40">
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

      {/* Diagnostics panel */}
      {showDiag && (
        <div className="mt-1 flex flex-col gap-1 border-t border-white/10 pt-1.5 text-[10px]">
          <div className="font-semibold text-white/70">{t("fps.diagnostics")}</div>

          <div className="flex flex-col gap-0.5 text-white/50">
            <span>
              {t("fps.detectedRafRate")}{" "}
              <span className="text-white/80">
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
                    : "text-white/80"
                }
              >
                {diagnostics.rAFConsistency}
                {diagnostics.rAFConsistency === "locked" && ` ${t("fps.throttled")}`}
              </span>
            </span>
            <span>
              {t("fps.jankFrames")}{" "}
              <span className="text-white/80">{diagnostics.jankFrames}</span>
            </span>
            <span>
              {t("fps.prefersReducedMotion")}{" "}
              <span className="text-white/80">
                {diagnostics.prefersReducedMotion ? t("fps.yes") : t("fps.no")}
              </span>
            </span>
          </div>

          {/* Analysis */}
          <div className="mt-1 rounded bg-white/5 p-1.5 text-[10px] leading-relaxed text-white/70">
            {getCauseAnalysis()}
          </div>
        </div>
      )}
    </div>
  );
}
