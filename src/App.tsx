import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Toolbar } from "@/components/Toolbar";
import { ScoreViewport } from "@/components/ScoreViewport";
import { NoteEditorSidebar } from "@/components/NoteEditorSidebar";
import { ShortcutConfigPanel } from "@/components/ShortcutConfigPanel";
import { TrackPresetDialog } from "@/components/TrackPresetDialog";
import { RoomDialog } from "@/components/RoomDialog";
import { installShortcutManager, uninstallShortcutManager, updateTranslation } from "@/shortcuts";

export default function App() {
  const { t } = useTranslation();

  useEffect(() => {
    installShortcutManager(t);
    return () => uninstallShortcutManager();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    updateTranslation(t);
  }, [t]);

  return (
    <div className="flex h-screen flex-col">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <NoteEditorSidebar />
        <ScoreViewport />
      </div>
      <ShortcutConfigPanel />
      <TrackPresetDialog />
      <RoomDialog />
    </div>
  );
}
