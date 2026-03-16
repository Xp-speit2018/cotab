import { useRef } from "react";
import { useTranslation } from "react-i18next";
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
import { executeAction } from "@/actions";
import { usePlayerStore } from "@/stores/player-store";
import { useShortcutStore } from "@/shortcuts";
import { useTabStore } from "@/core/store";
import { useUndoStore } from "@/stores/undo-store";
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
  const { t, i18n } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPlayerReady = usePlayerStore((s) => s.isPlayerReady);
  const playerState = usePlayerStore((s) => s.playerState);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const endTime = usePlayerStore((s) => s.endTime);
  const zoom = usePlayerStore((s) => s.zoom);
  const scoreTitle = usePlayerStore((s) => s.scoreTitle);
  const scoreArtist = usePlayerStore((s) => s.scoreArtist);
  const soundFontProgress = usePlayerStore((s) => s.soundFontProgress);
  const loadFile = usePlayerStore((s) => s.loadFile);
  const editorMode = usePlayerStore((s) => s.editorMode);
  const tabConnected = useTabStore((s) => s.connected);
  const tabRoomCode = useTabStore((s) => s.roomCode);
  const canUndo = useUndoStore((s) => s.canUndo);
  const canRedo = useUndoStore((s) => s.canRedo);

  const isPlaying = playerState === "playing";

  const cycleEditorMode = () => {
    const nextMode = editorMode === "essentials" ? "advanced" : "essentials";
    executeAction("view.setEditorMode", nextMode, { t });
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
            onClick={() => executeAction("file.exportGp", undefined, { t })}
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
            onClick={() => executeAction("edit.undo", undefined, { t })}
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
            onClick={() => executeAction("edit.redo", undefined, { t })}
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("toolbar.redo")}</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* ── Center: Playback Controls ──────────────────────────────────── */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => executeAction("playback.stop", undefined, { t })}
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
              className="h-8 w-8"
              onClick={() => executeAction("playback.setPlaying", !isPlaying, { t })}
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
            {isPlaying ? t("toolbar.pause") : t("toolbar.play")}
          </TooltipContent>
        </Tooltip>

        <span className="min-w-[100px] text-center font-mono text-xs text-muted-foreground tabular-nums">
          {isPlayerReady
            ? `${formatTime(currentTime)} / ${formatTime(endTime)}`
            : t("toolbar.loading", { percent: Math.floor(soundFontProgress * 100) })}
        </span>
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
          onChange={(e) => executeAction("view.setZoom", Number(e.target.value), { t })}
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
              onClick={() => useTabStore.setState({ roomDialogOpen: true })}
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
