import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Toolbar } from "@/components/Toolbar";
import { EditorWorkspace } from "@/components/EditorWorkspace";
import { ShortcutConfigPanel } from "@/components/ShortcutConfigPanel";
import { RoomDialog } from "@/components/RoomDialog";
import { DocumentStorageConflictDialog } from "@/components/DocumentStorageConflictDialog";
import { StorageProviderDialog } from "@/components/StorageProviderDialog";
import { WebDavLocationDialog } from "@/components/WebDavLocationDialog";
import { DemoSelectionDialog } from "@/components/DemoSelectionDialog";
import { DEMO_DOCUMENTS } from "@/storage/demo-selection";
import { openDemoDocument } from "@/workspace/open-document";
import { installShortcutManager, uninstallShortcutManager, updateTranslation } from "@/shortcuts";

export default function App() {
  const { t } = useTranslation();
  const bootstrapped = useRef(false);

  useEffect(() => {
    installShortcutManager(t);
    return () => uninstallShortcutManager();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    updateTranslation(t);
  }, [t]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const demoId = new URLSearchParams(window.location.search).get("demo");
    const demo = DEMO_DOCUMENTS.find((candidate) => candidate.id === demoId);
    if (demo) void openDemoDocument(demo);
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <Toolbar />
      <EditorWorkspace />
      <ShortcutConfigPanel />
      <RoomDialog />
      <DocumentStorageConflictDialog />
      <StorageProviderDialog />
      <WebDavLocationDialog />
      <DemoSelectionDialog />
    </div>
  );
}
