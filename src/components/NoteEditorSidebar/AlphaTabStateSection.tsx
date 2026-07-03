import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { getApi } from "@/stores/render-api";
import { SectionHeader } from "./primitives";
import { RuntimeStateTree } from "./EditorStateSection";

const POLL_INTERVAL_MS = 300;

type RuntimeState = Record<string, unknown>;

function readOwnValue(value: Record<string, unknown>, key: string): unknown {
  try {
    return value[key];
  } catch (error) {
    return `<throws ${error instanceof Error ? error.message : String(error)}>`;
  }
}

function readAlphaTabStateSnapshot(): RuntimeState {
  const api = getApi();
  if (!api) {
    return {
      api: null,
      isReadyForPlayback: false,
    };
  }

  const apiRecord = api as unknown as Record<string, unknown>;
  const playbackRange = api.playbackRange
    ? {
        startTick: api.playbackRange.startTick,
        endTick: api.playbackRange.endTick,
      }
    : null;

  return {
    isReadyForPlayback: readOwnValue(apiRecord, "isReadyForPlayback"),
    playerState: readOwnValue(apiRecord, "playerState"),
    tickPosition: readOwnValue(apiRecord, "tickPosition"),
    timePosition: readOwnValue(apiRecord, "timePosition"),
    currentTime: readOwnValue(apiRecord, "currentTime"),
    endTime: readOwnValue(apiRecord, "endTime"),
    playbackRange,
    isLooping: readOwnValue(apiRecord, "isLooping"),
    playbackSpeed: readOwnValue(apiRecord, "playbackSpeed"),
    masterVolume: readOwnValue(apiRecord, "masterVolume"),
    metronomeVolume: readOwnValue(apiRecord, "metronomeVolume"),
    currentPosition: readOwnValue(apiRecord, "currentPosition"),
    loadedMidiInfo: readOwnValue(apiRecord, "loadedMidiInfo"),
    score: readOwnValue(apiRecord, "score"),
    tracks: readOwnValue(apiRecord, "tracks"),
    boundsLookup: readOwnValue(apiRecord, "boundsLookup"),
    settings: readOwnValue(apiRecord, "settings"),
    player: readOwnValue(apiRecord, "player"),
    api,
  };
}

function useAlphaTabStateSnapshot(isOpen: boolean): RuntimeState {
  const [snapshot, setSnapshot] = useState<RuntimeState>(() => readAlphaTabStateSnapshot());

  useEffect(() => {
    const update = () => setSnapshot(readAlphaTabStateSnapshot());
    update();
    if (!isOpen) return undefined;

    const interval = window.setInterval(update, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [isOpen]);

  return snapshot;
}

export function AlphaTabStateSection({
  dragHandleProps,
}: {
  dragHandleProps?: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const snapshot = useAlphaTabStateSnapshot(isOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SectionHeader
        title={t("sidebar.alphaTabState.title")}
        helpText={t("sidebar.alphaTabState.help")}
        isOpen={isOpen}
        dragHandleProps={dragHandleProps}
      />
      <CollapsibleContent>
        <div className="py-0.5">
          <RuntimeStateTree
            label={t("sidebar.alphaTabState.topLevel")}
            value={snapshot}
            path="AlphaTabState"
          />
        </div>
        <Separator />
      </CollapsibleContent>
    </Collapsible>
  );
}
