import { useRef } from "react";
import { useTranslation } from "react-i18next";
import * as alphaTab from "@coderline/alphatab";
import {
  FolderOpen,
  Download,
  Play,
  Pause,
  Square,
  Globe,
  Check,
  Layers,
  Keyboard,
  Users,
  Undo2,
  Redo2,
  Repeat2,
} from "lucide-react";
import { SUPPORTED_LANGUAGES } from "@/i18n";
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
import { executeAppAction } from "@/app-actions";
import { usePlayerStore } from "@/stores/render-store";
import { getApi } from "@/stores/render-api";
import {
  formatShortcut,
  transportModifierToKeyCombo,
  useShortcutStore,
  useTransportModifierActive,
} from "@/shortcuts";
import { useEditorStore } from "@/stores/editor-store";
import { cn } from "@/lib/utils";

const EDITOR_MODE_STORAGE_KEY = "cotab:editorMode";

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim() || "untitled";
}

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
  const { t, i18n } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPlayerReady = usePlayerStore((s) => s.isPlayerReady);
  const playerState = usePlayerStore((s) => s.playerState);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const endTime = usePlayerStore((s) => s.endTime);
  const isLooping = usePlayerStore((s) => s.isLooping);
  const zoom = usePlayerStore((s) => s.zoom);
  const scoreTitle = usePlayerStore((s) => s.scoreTitle);
  const scoreArtist = usePlayerStore((s) => s.scoreArtist);
  const soundFontProgress = usePlayerStore((s) => s.soundFontProgress);
  const loadFile = usePlayerStore((s) => s.loadFile);
  const transport = usePlayerStore((s) => s.transport);
  const editorMode = usePlayerStore((s) => s.editorMode);
  const tabConnected = useEditorStore((s) => s.connected);
  const tabRoomCode = useEditorStore((s) => s.roomCode);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const transportModifier = useShortcutStore((s) => s.transportModifier);
  const transportModifierActive = useTransportModifierActive();

  const isPlaying = playerState === "playing";
  const transportModifierLabel = formatShortcut(transportModifierToKeyCombo(transportModifier));
  const playheadLabel = transport.playhead
    ? t("toolbar.playheadPosition", {
        bar: transport.playhead.barIndex + 1,
        beat: transport.playhead.beatIndex + 1,
      })
    : t("toolbar.noPlayhead");
  const loopLabel = transport.loopRange
    ? t("toolbar.loopRange", {
        start: `${transport.loopRange.start.barIndex + 1}.${transport.loopRange.start.beatIndex + 1}`,
        end: `${transport.loopRange.end.barIndex + 1}.${transport.loopRange.end.beatIndex + 1}`,
      })
    : null;

  const cycleEditorMode = () => {
    const nextMode = editorMode === "essentials" ? "advanced" : "essentials";
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(EDITOR_MODE_STORAGE_KEY, nextMode);
    }
    usePlayerStore.setState({ editorMode: nextMode });
  };

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
        <TooltipContent>{t("toolbar.openFile")}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={!isPlayerReady}
            onClick={() => {
              const api = getApi();
              const score = api?.score;
              if (!score) return;
              const exporter = new alphaTab.exporter.Gp7Exporter();
              const data = exporter.export(score, null);
              const filename = `${sanitizeFilename(score.title || "untitled")}.gp`;
              const blob = new Blob([data], { type: "application/octet-stream" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = filename;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("toolbar.exportFile")}</TooltipContent>
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
          {scoreTitle || t("toolbar.noFileLoaded")}
        </span>
        {scoreArtist && (
          <span className="block truncate text-xs text-muted-foreground leading-tight">
            {scoreArtist}
          </span>
        )}
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* ── Undo / Redo ────────────────────────────────────────────────── */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={!canUndo}
            onClick={() => executeAppAction("edit.undo", undefined, { t })}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("toolbar.undo")}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={!canRedo}
            onClick={() => executeAppAction("edit.redo", undefined, { t })}
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("toolbar.redo")}</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* ── Center: Playback Controls ──────────────────────────────────── */}
      <div
        className={cn(
          "flex items-center gap-1 rounded-md px-0.5 transition-colors",
          transportModifierActive && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8",
                transportModifierActive && "hover:bg-emerald-500/15",
              )}
              onClick={() => executeAppAction("transport.stop", undefined, { t })}
              disabled={!isPlayerReady}
            >
              <Square className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("toolbar.stop")}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8",
                transportModifierActive && "hover:bg-emerald-500/15",
              )}
              aria-label={isPlaying ? t("toolbar.pause") : t("toolbar.playFromPlayhead")}
              onClick={() => executeAppAction("transport.playPause", undefined, { t })}
              disabled={!isPlayerReady}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isPlaying ? t("toolbar.pause") : t("toolbar.playFromPlayhead")}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isLooping ? "secondary" : "ghost"}
              size="icon"
              className={cn(
                "h-8 w-8",
                isLooping && "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300",
                transportModifierActive && "hover:bg-emerald-500/15",
              )}
              aria-pressed={isLooping}
              aria-label={t("toolbar.loop")}
              onClick={() => executeAppAction("transport.toggleLoop", undefined, { t })}
              disabled={!isPlayerReady || !transport.loopRange}
            >
              <Repeat2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("toolbar.loop")}</TooltipContent>
        </Tooltip>

        <div className="flex min-w-[150px] flex-col justify-center px-1 leading-tight">
          <span className="truncate text-xs font-medium tabular-nums">
            {playheadLabel}
            {loopLabel ? ` · ${loopLabel}` : ""}
          </span>
          <span className="truncate font-mono text-[11px] text-muted-foreground tabular-nums">
            {isPlayerReady
              ? `${formatTime(currentTime)} / ${formatTime(endTime)}`
              : t("toolbar.loading", { percent: Math.floor(soundFontProgress * 100) })}
          </span>
        </div>
        {transportModifierActive && (
          <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            {t("toolbar.transportMode", { modifier: transportModifierLabel })}
          </span>
        )}
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* ── Right: Editor mode, Zoom, Language ──────────────────────────── */}
      <div className="flex items-center gap-1">
        {/* Editor palette mode: Essentials / Advanced */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 font-normal text-muted-foreground hover:text-foreground"
              onClick={cycleEditorMode}
              title={t("toolbar.editorMode")}
            >
              <Layers className="h-3.5 w-3.5" />
              <span className="text-xs">
                {editorMode === "essentials"
                  ? t("toolbar.essentials")
                  : t("toolbar.advanced")}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t("toolbar.editorMode")}:{" "}
            {editorMode === "essentials"
              ? t("toolbar.essentials")
              : t("toolbar.advanced")}
          </TooltipContent>
        </Tooltip>

        {/* Zoom */}
        <select
          value={zoom}
          onChange={(e) => usePlayerStore.getState().setZoom(Number(e.target.value))}
          className="h-8 rounded-md border bg-transparent px-2 text-xs"
          title={t("toolbar.zoom")}
        >
          {ZOOM_OPTIONS.map((z) => (
            <option key={z} value={z}>
              {z}x
            </option>
          ))}
        </select>

        {/* Collaborate */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="relative h-8 gap-1.5 px-2 font-normal text-muted-foreground hover:text-foreground"
              onClick={() => usePlayerStore.setState({ roomDialogOpen: true })}
            >
              <Users className="h-3.5 w-3.5" />
              {tabConnected && (
                <>
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-xs">{tabRoomCode}</span>
                </>
              )}
              {!tabConnected && (
                <span className="text-xs">{t("room.button")}</span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("room.button")}</TooltipContent>
        </Tooltip>

        {/* Keyboard Shortcuts */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => useShortcutStore.getState().setConfigPanelOpen(true)}
            >
              <Keyboard className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("shortcuts.title")}</TooltipContent>
        </Tooltip>

        {/* Language Selector */}
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger
                className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
                title={t("toolbar.language")}
              >
                <Globe className="h-4 w-4" />
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>{t("toolbar.language")}</TooltipContent>
          </Tooltip>

          <PopoverContent align="end" className="w-44 p-1">
            <div className="px-2 py-1.5">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                {t("toolbar.language")}
              </span>
            </div>
            {Object.entries(SUPPORTED_LANGUAGES).map(([code, label]) => {
              const isActive = i18n.language === code;
              return (
                <button
                  key={code}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
                    !isActive && "text-muted-foreground",
                  )}
                  onClick={() => i18n.changeLanguage(code)}
                >
                  {isActive ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <span className="h-3.5 w-3.5" />
                  )}
                  <span>{label}</span>
                </button>
              );
            })}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
