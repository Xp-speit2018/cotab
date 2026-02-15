import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  Guitar,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VolumeKnob } from "@/components/ui/volume-knob";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { usePlayerStore, type TrackInfo, type TrackBounds } from "@/stores/player-store";
import { cn } from "@/lib/utils";

// ─── Compact Mixer (positioned per-track, aligned to rendered staff) ─────────

function CompactMixer({
  track,
  bounds,
}: {
  track: TrackInfo;
  bounds: TrackBounds;
}) {
  const setTrackVolume = usePlayerStore((s) => s.setTrackVolume);
  const setTrackMute = usePlayerStore((s) => s.setTrackMute);
  const setTrackSolo = usePlayerStore((s) => s.setTrackSolo);

  return (
    <div
      className={cn(
        "absolute left-0 right-0 flex flex-col justify-center gap-1 border-b px-2",
        track.isMuted && "opacity-60",
      )}
      style={{ top: bounds.y, height: bounds.height }}
    >
      {/* Track name */}
      <div className="flex items-center gap-1.5 min-w-0">
        <Guitar className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        <span className="truncate text-xs font-medium">{track.name}</span>
      </div>

      {/* Controls row: Mute, Solo, Volume */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 flex-shrink-0"
          onClick={() => setTrackMute(track.index, !track.isMuted)}
        >
          {track.isMuted ? (
            <VolumeX className="h-3 w-3 text-destructive" />
          ) : (
            <Volume2 className="h-3 w-3" />
          )}
        </Button>

        <Button
          variant={track.isSolo ? "secondary" : "ghost"}
          size="icon"
          className="h-5 w-5 flex-shrink-0 text-[10px] font-bold"
          onClick={() => setTrackSolo(track.index, !track.isSolo)}
        >
          S
        </Button>

        <VolumeKnob
          value={track.isMuted ? 0 : track.volume}
          onValueChange={(v) => setTrackVolume(track.index, v)}
        />
      </div>
    </div>
  );
}

// ─── Score Viewport ──────────────────────────────────────────────────────────

const DEFAULT_HEADER_WIDTH = 140; // px — narrower now that knob replaces slider
const MIN_HEADER_WIDTH = 80;
const MAX_HEADER_WIDTH = 300;
const HEADER_WIDTH_KEY = "cotab:header-width";

function loadHeaderWidth(): number {
  try {
    const raw = localStorage.getItem(HEADER_WIDTH_KEY);
    if (raw) {
      const v = Number(raw);
      if (v >= MIN_HEADER_WIDTH && v <= MAX_HEADER_WIDTH) return v;
    }
  } catch {
    // ignore
  }
  return DEFAULT_HEADER_WIDTH;
}

function saveHeaderWidth(w: number) {
  localStorage.setItem(HEADER_WIDTH_KEY, String(w));
}

export function ScoreViewport() {
  const { t } = useTranslation();
  const mainRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const [headerWidth, setHeaderWidth] = useState(loadHeaderWidth);
  const headerWidthAtDragStart = useRef(headerWidth);

  const initialize = usePlayerStore((s) => s.initialize);
  const destroy = usePlayerStore((s) => s.destroy);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const tracks = usePlayerStore((s) => s.tracks);
  const visibleTrackIndices = usePlayerStore((s) => s.visibleTrackIndices);
  const trackBounds = usePlayerStore((s) => s.trackBounds);

  // visibleTrackIndices is the single source of truth (derived from api.tracks).
  // trackBounds has one entry per visible track, in the same order.
  const visibleSet = new Set(visibleTrackIndices);
  const visibleTracks = tracks.filter((t) => visibleSet.has(t.index));
  const hasHeaders = trackBounds.length > 0 && visibleTracks.length > 0;

  // Total content height for the headers pane (matches rendered score height)
  const contentHeight =
    trackBounds.length > 0
      ? Math.max(...trackBounds.map((b) => b.y + b.height))
      : 0;

  useEffect(() => {
    if (mainRef.current && viewportRef.current) {
      initialize(mainRef.current, viewportRef.current);
    }
    return () => {
      destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Inner ref for the mixer panel (positioned via transform to sync with viewport)
  const innerRef = useRef<HTMLDivElement>(null);
  const mixerRef = useRef<HTMLDivElement>(null);

  // Sync mixer panel's vertical position with the viewport's scrollTop
  const syncMixerTransform = useCallback(() => {
    if (viewportRef.current && innerRef.current) {
      const scrollTop = viewportRef.current.scrollTop;
      innerRef.current.style.transform = `translateY(-${scrollTop}px)`;
    }
  }, []);

  // Custom scroll behavior:
  //   - Mixer panel: wheel → vertical scroll on viewport
  //   - Score viewport: wheel → horizontal scroll on viewport
  useEffect(() => {
    const viewport = viewportRef.current;
    const mixer = mixerRef.current;
    if (!viewport) return;

    const handleViewportWheel = (e: WheelEvent) => {
      // Remap vertical wheel to horizontal scroll on the score
      if (e.deltaY !== 0) {
        e.preventDefault();
        viewport.scrollLeft += e.deltaY;
      }
    };

    const handleMixerWheel = (e: WheelEvent) => {
      // Wheel on mixer → vertical scroll on viewport
      e.preventDefault();
      viewport.scrollTop += e.deltaY;
    };

    // Must use { passive: false } to allow preventDefault
    viewport.addEventListener("wheel", handleViewportWheel, { passive: false });
    mixer?.addEventListener("wheel", handleMixerWheel, { passive: false });

    return () => {
      viewport.removeEventListener("wheel", handleViewportWheel);
      mixer?.removeEventListener("wheel", handleMixerWheel);
    };
  }, [hasHeaders]);

  // ── Header panel resize ──
  const handleHeaderResizeStart = useCallback(() => {
    headerWidthAtDragStart.current = headerWidth;
  }, [headerWidth]);

  const handleHeaderResize = useCallback((deltaX: number) => {
    const newWidth = Math.min(
      MAX_HEADER_WIDTH,
      Math.max(MIN_HEADER_WIDTH, headerWidthAtDragStart.current + deltaX),
    );
    setHeaderWidth(newWidth);
  }, []);

  const handleHeaderResizeEnd = useCallback(() => {
    saveHeaderWidth(headerWidth);
  }, [headerWidth]);

  return (
    <div className="relative flex flex-1 overflow-hidden">
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

      {/* Track Headers (aligned to rendered staff positions) */}
      {hasHeaders && (
        <>
          <div
            ref={mixerRef}
            className="flex-shrink-0 overflow-hidden bg-card"
            style={{ width: headerWidth }}
          >
            <div ref={innerRef} className="relative will-change-transform" style={{ height: contentHeight }}>
              {visibleTracks.map((track, i) =>
                trackBounds[i] ? (
                  <CompactMixer
                    key={track.index}
                    track={track}
                    bounds={trackBounds[i]}
                  />
                ) : null,
              )}
            </div>
          </div>
          <ResizeHandle
            side="right"
            onResizeStart={handleHeaderResizeStart}
            onResize={handleHeaderResize}
            onResizeEnd={handleHeaderResizeEnd}
          />
        </>
      )}

      {/* AlphaTab Viewport (scroll container) */}
      <div
        ref={viewportRef}
        className="at-viewport flex-1 overflow-auto"
        onScroll={syncMixerTransform}
      >
        {/* AlphaTab Main (rendering target) */}
        <div ref={mainRef} className="at-main" />
      </div>
    </div>
  );
}
