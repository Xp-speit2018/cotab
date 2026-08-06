import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ClipboardPaste,
  Copy as CopyIcon,
  ExternalLink,
  Keyboard,
  Network,
  Redo2,
  Scissors,
  Undo2,
} from "lucide-react";

import { executeAppAction } from "@/app-actions";
import { isTauriRuntime } from "@/agent/target";
import { CodexProxyPreferencesDialog } from "@/components/CodexProxyPreferencesDialog";
import { useSidebarLayoutStore } from "@/components/NoteEditorSidebar/sidebar-store";
import { DeleteTrackDialog } from "@/components/NoteEditorSidebar/TracksSection";
import { ScoreLayoutToolbarControls } from "@/components/ScoreLayoutControls";
import {
  AppMenu,
  AppMenuCheckboxItem,
  AppMenuControl,
  AppMenuGroup,
  AppMenuItem,
  AppMenuLink,
  AppMenuRadioGroup,
  AppMenuRadioItem,
  AppMenuSeparator,
} from "@/components/ui/app-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import { formatShortcut, useShortcutStore } from "@/shortcuts";
import { useEditorStore } from "@/stores/editor-store";
import { usePlayerStore } from "@/stores/render-store";
import { saveAutoSavePreference } from "@/storage/storage-preferences";
import {
  setWorkspaceAutoSaveEnabled,
  useDocumentWorkspaceStore,
} from "@/workspace/document-workspace";

function useMenuShortcut(actionId: string): string | undefined {
  const keys = useShortcutStore((state) =>
    state.bindings.find((binding) => binding.id === actionId)?.keys);
  return keys ? formatShortcut(keys) : undefined;
}

export function EditMenu() {
  const { t } = useTranslation();
  const [deleteTrackOpen, setDeleteTrackOpen] = useState(false);
  const canUndo = useEditorStore((state) => state.canUndo);
  const canRedo = useEditorStore((state) => state.canRedo);
  const selectedBeat = usePlayerStore((state) => state.selectedBeatInfo);
  const selectedNoteIndex = usePlayerStore((state) => state.selectedNoteIndex);
  const hasBar = usePlayerStore((state) => state.selectedBarInfo !== null);
  const selectedTrack = usePlayerStore((state) => {
    const trackIndex = state.selector.trackIndex;
    return trackIndex === null ? null : state.tracks[trackIndex] ?? null;
  });
  const hasDocument = useDocumentWorkspaceStore(
    (state) => state.activeTabId !== "",
  );
  const undoShortcut = useMenuShortcut("document.undo");
  const redoShortcut = useMenuShortcut("document.redo");
  const cutShortcut = useMenuShortcut("document.cut");
  const copyShortcut = useMenuShortcut("document.copy");
  const pasteShortcut = useMenuShortcut("document.paste");
  const insertRestBeforeShortcut = useMenuShortcut(
    "document.beat.insertRestBefore",
  );
  const insertRestAfterShortcut = useMenuShortcut(
    "document.beat.insertRestAfter",
  );
  const deleteNoteShortcut = useMenuShortcut("document.beat.deleteNote");
  const insertBarBeforeShortcut = useMenuShortcut("document.bar.insertBefore");
  const insertBarAfterShortcut = useMenuShortcut("document.bar.insertAfter");
  const deleteBarShortcut = useMenuShortcut("document.bar.delete");
  const deleteTrackShortcut = useMenuShortcut("document.track.delete");
  const hasBeat = selectedBeat !== null;
  const hasNote = selectedBeat !== null
    && selectedNoteIndex >= 0
    && selectedNoteIndex < selectedBeat.notes.length;

  return (
    <>
      <AppMenu label={t("toolbar.editMenu")} testId="edit-menu">
        <AppMenuGroup>
          <AppMenuItem
            icon={Undo2}
            shortcut={undoShortcut}
            disabled={!canUndo}
            onSelect={() => executeAppAction("document.undo", {}, { t })}
          >
            {t("toolbar.undo")}
          </AppMenuItem>
          <AppMenuItem
            icon={Redo2}
            shortcut={redoShortcut}
            disabled={!canRedo}
            onSelect={() => executeAppAction("document.redo", {}, { t })}
          >
            {t("toolbar.redo")}
          </AppMenuItem>
        </AppMenuGroup>

        <AppMenuSeparator />
        <AppMenuGroup>
          <AppMenuItem
            icon={Scissors}
            shortcut={cutShortcut}
            disabled={!hasBeat}
            onSelect={() => executeAppAction("document.cut", {}, { t })}
          >
            {t("toolbar.edit.cut")}
          </AppMenuItem>
          <AppMenuItem
            icon={CopyIcon}
            shortcut={copyShortcut}
            disabled={!hasBeat}
            onSelect={() => executeAppAction("document.copy", {}, { t })}
          >
            {t("toolbar.edit.copy")}
          </AppMenuItem>
          <AppMenuItem
            icon={ClipboardPaste}
            shortcut={pasteShortcut}
            disabled={!hasBeat}
            onSelect={() => executeAppAction("document.paste", {}, { t })}
          >
            {t("toolbar.edit.paste")}
          </AppMenuItem>
        </AppMenuGroup>

        <AppMenuSeparator />
        <AppMenuGroup label={t("toolbar.edit.beat")}>
          <AppMenuItem
            shortcut={insertRestBeforeShortcut}
            disabled={!hasBeat}
            onSelect={() => executeAppAction(
              "document.beat.insertRestBefore",
              {},
              { t },
            )}
          >
            {t("toolbar.edit.insertRestBefore")}
          </AppMenuItem>
          <AppMenuItem
            shortcut={insertRestAfterShortcut}
            disabled={!hasBeat}
            onSelect={() => executeAppAction(
              "document.beat.insertRestAfter",
              {},
              { t },
            )}
          >
            {t("toolbar.edit.insertRestAfter")}
          </AppMenuItem>
        </AppMenuGroup>

        <AppMenuSeparator />
        <AppMenuGroup label={t("toolbar.edit.note")}>
          <AppMenuItem
            shortcut={deleteNoteShortcut}
            disabled={!hasNote}
            onSelect={() => executeAppAction(
              "document.beat.deleteNote",
              {},
              { t },
            )}
          >
            {t("toolbar.edit.deleteNote")}
          </AppMenuItem>
        </AppMenuGroup>

        <AppMenuSeparator />
        <AppMenuGroup label={t("toolbar.edit.bar")}>
          <AppMenuItem
            shortcut={insertBarBeforeShortcut}
            disabled={!hasBar}
            onSelect={() => executeAppAction(
              "document.bar.insertBefore",
              {},
              { t },
            )}
          >
            {t("toolbar.edit.insertBarBefore")}
          </AppMenuItem>
          <AppMenuItem
            shortcut={insertBarAfterShortcut}
            disabled={!hasBar}
            onSelect={() => executeAppAction(
              "document.bar.insertAfter",
              {},
              { t },
            )}
          >
            {t("toolbar.edit.insertBarAfter")}
          </AppMenuItem>
          <AppMenuItem
            shortcut={deleteBarShortcut}
            disabled={!hasBar}
            onSelect={() => executeAppAction(
              "document.bar.delete",
              {},
              { t },
            )}
          >
            {t("toolbar.edit.deleteBar")}
          </AppMenuItem>
        </AppMenuGroup>

        <AppMenuSeparator />
        <AppMenuGroup label={t("toolbar.edit.track")}>
          <AppMenuItem
            disabled={!hasDocument}
            onSelect={() => executeAppAction(
              "view.openTrackCreator",
              undefined,
              { t },
            )}
          >
            {t("toolbar.edit.newTrack")}
          </AppMenuItem>
          <AppMenuItem
            shortcut={deleteTrackShortcut}
            disabled={!selectedTrack}
            onSelect={() => setDeleteTrackOpen(true)}
          >
            {t("toolbar.edit.deleteTrack")}
          </AppMenuItem>
        </AppMenuGroup>
      </AppMenu>

      {selectedTrack && (
        <DeleteTrackDialog
          open={deleteTrackOpen}
          onOpenChange={setDeleteTrackOpen}
          trackUuid={selectedTrack.uuid}
          trackName={selectedTrack.name}
        />
      )}
    </>
  );
}

export function LayoutMenu() {
  const { t } = useTranslation();
  const scoreLayout = usePlayerStore((state) => state.scoreLayout);
  const zoom = usePlayerStore((state) => state.zoom);

  return (
    <AppMenu
      label={t("toolbar.layoutMenu")}
      testId="layout-menu"
    >
      <AppMenuGroup label={t("toolbar.scoreLayout")}>
        <AppMenuRadioGroup
          value={scoreLayout}
          onValueChange={(layout) => executeAppAction(
            "view.setScoreLayout",
            { layout: layout as "horizontal" | "parchment" },
            { t },
          )}
        >
          <AppMenuRadioItem value="horizontal">
            {t("toolbar.horizontalLayout")}
          </AppMenuRadioItem>
          <AppMenuRadioItem value="parchment">
            {t("toolbar.parchmentLayout")}
          </AppMenuRadioItem>
        </AppMenuRadioGroup>
      </AppMenuGroup>

      {scoreLayout === "parchment" && (
        <>
          <AppMenuSeparator />
          <AppMenuGroup label={t("toolbar.parchmentLayout")}>
            <ScoreLayoutToolbarControls variant="menu" />
          </AppMenuGroup>
        </>
      )}

      <AppMenuSeparator />
      <AppMenuGroup label={t("toolbar.view")}>
        <AppMenuControl className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{t("toolbar.zoom")}</span>
          <span className="font-mono tabular-nums">{Math.round(zoom * 100)}%</span>
        </div>
        <Slider
          aria-label={t("toolbar.zoom")}
          min={25}
          max={200}
          step={5}
          value={[Math.round(zoom * 100)]}
          onKeyDown={(event) => event.stopPropagation()}
          onValueChange={([value]) =>
            usePlayerStore.getState().setZoom(value / 100)}
        />
        </AppMenuControl>
      </AppMenuGroup>
    </AppMenu>
  );
}

export function PreferencesMenu() {
  const { t, i18n } = useTranslation();
  const [proxyOpen, setProxyOpen] = useState(false);
  const autoSaveEnabled = useEditorStore(
    (state) => state.storage.autoSaveEnabled,
  );
  const debugTabEnabled = useSidebarLayoutStore(
    (state) => state.debugTabEnabled,
  );
  const showSnapGrid = usePlayerStore((state) => state.showSnapGrid);

  return (
    <>
      <AppMenu
        label={t("toolbar.preferencesMenu")}
        testId="preferences-menu"
      >
        <AppMenuGroup label={t("toolbar.preferences.general")}>
          <AppMenuCheckboxItem
            checked={autoSaveEnabled}
            closeOnSelect={false}
            onSelect={() => {
              const enabled = !autoSaveEnabled;
              saveAutoSavePreference(enabled);
              setWorkspaceAutoSaveEnabled(enabled);
            }}
          >
            {t("toolbar.autoSave")}
          </AppMenuCheckboxItem>
        </AppMenuGroup>

        <AppMenuSeparator />
        <AppMenuGroup label={t("toolbar.preferences.keyboard")}>
          <AppMenuItem
            icon={Keyboard}
            onSelect={() => useShortcutStore.getState().setConfigPanelOpen(true)}
          >
            {t("shortcuts.title")}
          </AppMenuItem>
        </AppMenuGroup>

        <AppMenuSeparator />
        <AppMenuGroup label={t("toolbar.language")}>
          <AppMenuRadioGroup
            value={i18n.language}
            onValueChange={(code) => void i18n.changeLanguage(code)}
          >
            {Object.entries(SUPPORTED_LANGUAGES).map(([code, label]) => (
              <AppMenuRadioItem key={code} value={code}>
                {label}
              </AppMenuRadioItem>
            ))}
          </AppMenuRadioGroup>
        </AppMenuGroup>

        <AppMenuSeparator />
        <AppMenuGroup label={t("toolbar.preferences.developer")}>
          <AppMenuCheckboxItem
            checked={debugTabEnabled}
            closeOnSelect={false}
            onSelect={() => useSidebarLayoutStore
              .getState()
              .setDebugTabEnabled(!debugTabEnabled)}
          >
            {t("toolbar.preferences.showDebugTab")}
          </AppMenuCheckboxItem>
          <AppMenuCheckboxItem
            checked={showSnapGrid}
            closeOnSelect={false}
            onSelect={() => usePlayerStore.getState().setShowSnapGrid(!showSnapGrid)}
          >
            {t("toolbar.preferences.showSnapGrid")}
          </AppMenuCheckboxItem>
        </AppMenuGroup>

        {isTauriRuntime() && (
          <>
            <AppMenuSeparator />
            <AppMenuGroup label={t("toolbar.preferences.agent")}>
              <AppMenuItem icon={Network} onSelect={() => setProxyOpen(true)}>
                {t("agent.proxy.title")}
              </AppMenuItem>
            </AppMenuGroup>
          </>
        )}
      </AppMenu>
      <CodexProxyPreferencesDialog
        open={proxyOpen}
        onOpenChange={setProxyOpen}
      />
    </>
  );
}

export function HelpMenu() {
  const { t } = useTranslation();
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <>
      <AppMenu label={t("toolbar.helpMenu")} testId="help-menu">
        <AppMenuGroup>
          <AppMenuItem onSelect={() => setAboutOpen(true)}>
            {t("toolbar.aboutCoTab")}
          </AppMenuItem>
          <AppMenuLink
            href="https://github.com/Xp-speit2018/cotab"
            icon={ExternalLink}
          >
            {t("toolbar.projectHome")}
          </AppMenuLink>
        </AppMenuGroup>
      </AppMenu>

      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>CoTab</DialogTitle>
            <DialogDescription>
              {t("toolbar.aboutDescription")}
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">AGPL-3.0</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
