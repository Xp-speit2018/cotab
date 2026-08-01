import { useTranslation } from "react-i18next";
import {
  Play,
  Pause,
  Square,
  Users,
  Repeat2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { executeAppAction } from "@/app-actions";
import { usePlayerStore } from "@/stores/render-store";
import {
  formatShortcut,
  transportModifierToKeyCombo,
  useShortcutStore,
  useTransportModifierActive,
} from "@/shortcuts";
import { useEditorStore } from "@/stores/editor-store";
import { cn } from "@/lib/utils";
import { FileMenu } from "@/components/FileMenu";
import {
  EditMenu,
  HelpMenu,
  LayoutMenu,
  PreferencesMenu,
} from "@/components/ToolbarMenus";
import {
  documentStorageController,
  documentStorageProviders,
} from "@/storage/document-storage-runtime";
import { selectStorageProvider } from "@/storage/provider-selection";
import { pickLocalScoreFile } from "@/storage/tauri-local-disk-provider";
import { selectDemoDocument } from "@/storage/demo-selection";
import { scoreFileKind } from "@/storage/score-file-types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Toolbar() {
  const { t } = useTranslation();

  const isPlayerReady = usePlayerStore((s) => s.isPlayerReady);
  const playerState = usePlayerStore((s) => s.playerState);
  const isLooping = usePlayerStore((s) => s.isLooping);
  const scoreTitle = usePlayerStore((s) => s.scoreTitle);
  const scoreArtist = usePlayerStore((s) => s.scoreArtist);
  const soundFontProgress = usePlayerStore((s) => s.soundFontProgress);
  const loadFile = usePlayerStore((s) => s.loadFile);
  const loadUrl = usePlayerStore((s) => s.loadUrl);
  const selector = usePlayerStore((s) => s.selector);
  const transport = usePlayerStore((s) => s.transport);
  const tabConnected = useEditorStore((s) => s.connected);
  const tabRoomCode = useEditorStore((s) => s.roomCode);
  const transportModifier = useShortcutStore((s) => s.transportModifier);
  const transportModifierActive = useTransportModifierActive();
  const storageStatus = useEditorStore((state) => state.storage.status);

  const isPlaying = playerState === "playing";
  const playButtonLabel = isPlaying
    ? t("toolbar.pause")
    : playerState === "paused"
      ? t("toolbar.resume")
      : t("toolbar.play");
  const transportModifierLabel = formatShortcut(transportModifierToKeyCombo(transportModifier));
  const transportPositionLabel = transport.playhead
    ? t("toolbar.transportPosition", {
        modifier: transportModifierLabel,
        bar: transport.playhead.barIndex + 1,
        beat: transport.playhead.beatIndex + 1,
      })
    : t("toolbar.noTransportPosition", { modifier: transportModifierLabel });
  const selectorPositionLabel = selector.barIndex !== null && selector.beatIndex !== null
    ? t("toolbar.selectorPosition", {
        bar: selector.barIndex + 1,
        beat: selector.beatIndex + 1,
      })
    : t("toolbar.noSelectorPosition");
  const loopLabel = transport.loopRange
    ? t("toolbar.loopRange", {
        start: `${transport.loopRange.start.barIndex + 1}.${transport.loopRange.start.beatIndex + 1}`,
        end: `${transport.loopRange.end.barIndex + 1}.${transport.loopRange.end.beatIndex + 1}`,
      })
    : null;

  const handleOpenFile = async () => {
    if (
      (storageStatus === "dirty" || storageStatus === "conflict") &&
      !window.confirm(t("storage.discardUnsaved"))
    ) {
      return;
    }
    try {
      const providerId = await selectStorageProvider("open");
      if (!providerId) return;
      if (providerId === "demo-library") {
        const demo = await selectDemoDocument();
        if (demo) loadUrl(demo.url);
        return;
      }
      if (providerId === "local-file") {
        const provider = documentStorageProviders.get(providerId);
        const picked = await provider?.pickOpen();
        if (!picked) return;
        const kind = scoreFileKind(picked.displayName);
        if (kind === "cotab") {
          await documentStorageController.openStoredDocument(
            providerId,
            picked,
          );
        } else if (kind === "guitarPro") {
          documentStorageController.unbind();
          loadFile(picked.data);
        } else {
          throw new Error(t("storage.unsupportedScoreFile"));
        }
        return;
      }
      if (providerId !== "local-disk") {
        await documentStorageController.open(providerId);
        return;
      }
      const picked = await pickLocalScoreFile();
      if (!picked) return;
      if (picked.kind === "cotab") {
        await documentStorageController.openStoredDocument(
          "local-disk",
          picked.document,
        );
      } else {
        documentStorageController.unbind();
        loadFile(picked.document.data);
      }
    } catch (error) {
      documentStorageController.reportError(error);
    }
  };

  return (
    <div className="grid h-12 w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-b bg-card px-2">
      <div className="flex min-w-0 items-center overflow-hidden">
        <div className="flex shrink-0 items-center">
          <FileMenu onOpen={handleOpenFile} />
          <EditMenu />
          <LayoutMenu />
          <PreferencesMenu />
          <HelpMenu />
        </div>
      </div>

      <div
        className="flex min-w-0 items-center justify-center gap-1"
        data-testid="transport-collaboration-center"
      >
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
              aria-label={t("toolbar.stopToPlayhead")}
            >
              <Square className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("toolbar.stopToPlayhead")}</TooltipContent>
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
              aria-label={playButtonLabel}
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
            {playButtonLabel}
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

        <div className="flex min-w-[220px] max-w-[28vw] flex-col justify-center gap-0.5 px-1 leading-tight">
          <div className="flex min-w-0 items-center gap-1">
            <span
              className={cn(
                "min-w-0 truncate rounded border px-1.5 py-0.5 text-[11px] font-medium tabular-nums transition-colors",
                transportModifierActive
                  ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "border-emerald-500/15 text-emerald-700/55 dark:text-emerald-300/55",
              )}
            >
              {transportPositionLabel}
            </span>
            <span
              className={cn(
                "min-w-0 truncate rounded border px-1.5 py-0.5 text-[11px] font-medium tabular-nums transition-colors",
                transportModifierActive
                  ? "border-blue-500/15 text-blue-700/55 dark:text-blue-300/55"
                  : "border-blue-500/35 bg-blue-500/15 text-blue-700 dark:text-blue-300",
              )}
            >
              {selectorPositionLabel}
            </span>
          </div>
          <span className="truncate font-mono text-[11px] text-muted-foreground tabular-nums">
            {loopLabel ? `${loopLabel} · ` : ""}
            {isPlayerReady
              ? `${formatTime(transport.currentTime)} / ${formatTime(transport.endTime)}`
              : t("toolbar.loading", { percent: Math.floor(soundFontProgress * 100) })}
          </span>
        </div>
        </div>

        <Separator orientation="vertical" className="mx-1 h-6 shrink-0" />
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
      </div>

      <div className="min-w-0 overflow-hidden px-2 text-right">
        <span className="block truncate text-sm font-medium leading-tight">
          {scoreTitle || t("toolbar.noFileLoaded")}
        </span>
        {scoreArtist && (
          <span className="block truncate text-xs leading-tight text-muted-foreground">
            {scoreArtist}
          </span>
        )}
      </div>
    </div>
  );
}
