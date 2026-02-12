import { useRef } from "react";
import {
  FolderOpen,
  Play,
  Pause,
  Square,
  Layers,
  Eye,
  EyeOff,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { usePlayerStore } from "@/stores/player-store";
import { cn } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const ZOOM_OPTIONS = [0.25, 0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 2];

// ─── Component ───────────────────────────────────────────────────────────────

export function Toolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPlayerReady = usePlayerStore((s) => s.isPlayerReady);
  const playerState = usePlayerStore((s) => s.playerState);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const endTime = usePlayerStore((s) => s.endTime);
  const zoom = usePlayerStore((s) => s.zoom);
  const scoreTitle = usePlayerStore((s) => s.scoreTitle);
  const scoreArtist = usePlayerStore((s) => s.scoreArtist);
  const soundFontProgress = usePlayerStore((s) => s.soundFontProgress);
  const tracks = usePlayerStore((s) => s.tracks);
  const visibleTrackIndices = usePlayerStore((s) => s.visibleTrackIndices);

  const loadFile = usePlayerStore((s) => s.loadFile);
  const playPause = usePlayerStore((s) => s.playPause);
  const stop = usePlayerStore((s) => s.stop);
  const setZoom = usePlayerStore((s) => s.setZoom);
  const setTrackVisible = usePlayerStore((s) => s.setTrackVisible);

  const isPlaying = playerState === "playing";
  const visibleSet = new Set(visibleTrackIndices);
  const visibleCount = visibleTrackIndices.length;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadFile(file);
      e.target.value = "";
    }
  };

  return (
    <div className="flex h-12 items-center gap-1 border-b bg-card px-2">
      {/* ── Left: File + Song Info ──────────────────────────────────────── */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => fileInputRef.current?.click()}
          >
            <FolderOpen className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Open file</TooltipContent>
      </Tooltip>

      <input
        ref={fileInputRef}
        type="file"
        accept=".gp,.gp3,.gp4,.gp5,.gpx"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="ml-1 mr-2 min-w-0 flex-shrink overflow-hidden">
        <span className="block truncate text-sm font-medium leading-tight">
          {scoreTitle || "No file loaded"}
        </span>
        {scoreArtist && (
          <span className="block truncate text-xs text-muted-foreground leading-tight">
            {scoreArtist}
          </span>
        )}
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* ── Center: Playback Controls ──────────────────────────────────── */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={stop}
              disabled={!isPlayerReady}
            >
              <Square className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Stop</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={playPause}
              disabled={!isPlayerReady}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isPlaying ? "Pause" : "Play"}</TooltipContent>
        </Tooltip>

        <span className="min-w-[100px] text-center font-mono text-xs text-muted-foreground tabular-nums">
          {isPlayerReady
            ? `${formatTime(currentTime)} / ${formatTime(endTime)}`
            : `Loading ${Math.floor(soundFontProgress * 100)}%`}
        </span>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* ── Right: Speed, Loop, Zoom, Track Visibility ─────────────────── */}
      <div className="flex items-center gap-1">
        {/* Zoom */}
        <select
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="h-8 rounded-md border bg-transparent px-2 text-xs"
          title="Zoom"
        >
          {ZOOM_OPTIONS.map((z) => (
            <option key={z} value={z}>
              {z}x
            </option>
          ))}
        </select>

        {/* FPS Monitor toggle (dev only) */}
        {import.meta.env.DEV && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  window.dispatchEvent(new Event("toggle-fps-monitor"))
                }
              >
                <Activity className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>FPS Monitor (Shift+F)</TooltipContent>
          </Tooltip>
        )}

        {/* Track Visibility Popover */}
        {tracks.length > 0 && (
          <Popover>
            <PopoverTrigger
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
              title={`Tracks (${visibleCount}/${tracks.length})`}
            >
              <Layers className="h-4 w-4" />
            </PopoverTrigger>

            <PopoverContent align="end" className="w-56 p-1">
              <div className="px-2 py-1.5">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  Visible Tracks
                </span>
              </div>
              {tracks.map((track) => {
                const isVisible = visibleSet.has(track.index);
                return (
                  <button
                    key={track.index}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
                      !isVisible && "text-muted-foreground",
                    )}
                    onClick={() =>
                      setTrackVisible(track.index, !isVisible)
                    }
                  >
                    {isVisible ? (
                      <Eye className="h-3.5 w-3.5" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5" />
                    )}
                    <span className="truncate">{track.name}</span>
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
