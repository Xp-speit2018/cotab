import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { useEditorStore } from "@/stores/editor-store";
import { SectionHeader } from "./primitives";
import { RuntimeStateTree } from "./EditorStateSection";

export function SyncStateSection({
  dragHandleProps,
}: {
  dragHandleProps?: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const connected = useEditorStore((state) => state.connected);
  const roomCode = useEditorStore((state) => state.roomCode);
  const connectionStatus = useEditorStore((state) => state.connectionStatus);
  const connectionError = useEditorStore((state) => state.connectionError);
  const userName = useEditorStore((state) => state.userName);
  const syncState = useEditorStore((state) => state.syncState);
  const peers = useEditorStore((state) => state.peers);

  return (
    <Collapsible
      data-debug-section="sync-state"
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <SectionHeader
        title={t("sidebar.syncState.title")}
        helpText={t("sidebar.syncState.help")}
        isOpen={isOpen}
        dragHandleProps={dragHandleProps}
      />
      <CollapsibleContent>
        <div className="py-0.5">
          <RuntimeStateTree
            label={t("sidebar.syncState.topLevel")}
            value={{
              connected,
              roomCode,
              connectionStatus,
              connectionError,
              userName,
              peers,
              syncState,
            }}
            path="SyncState"
          />
        </div>
        <Separator />
      </CollapsibleContent>
    </Collapsible>
  );
}
