import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Toolbar } from "@/components/Toolbar";
import { EditorWorkspace } from "@/components/EditorWorkspace";
import { ShortcutConfigPanel } from "@/components/ShortcutConfigPanel";
import { TrackPresetDialog } from "@/components/TrackPresetDialog";
import { RoomDialog } from "@/components/RoomDialog";
import { DocumentStorageConflictDialog } from "@/components/DocumentStorageConflictDialog";
import { StorageProviderDialog } from "@/components/StorageProviderDialog";
import { WebDavLocationDialog } from "@/components/WebDavLocationDialog";
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
      <EditorWorkspace />
      <ShortcutConfigPanel />
      <TrackPresetDialog />
      <RoomDialog />
      <DocumentStorageConflictDialog />
      <StorageProviderDialog />
      <WebDavLocationDialog />
    </div>
  );
}
