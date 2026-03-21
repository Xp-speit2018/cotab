import * as Y from "yjs";
import * as alphaTab from "@coderline/alphatab";
import { actionRegistry } from "./registry";
import type { ActionDefinition } from "./types";
import { usePlayerStore } from "@/stores/render-store";
import { engine, importTrack } from "@/core/engine";
import { useEditorStore } from "@/stores/editor-store";
import { debugLog } from "@/core/editor/action-log";
import {
  createTrackFromPreset,
  getApi,
  setPendingSelection,
  TRACK_PRESETS,
} from "@/stores/render-internals";

const transact = (fn: () => void) => engine.localEditYDoc(fn);
const getScoreMap = () => engine.getScoreMap();

const addTrackAction: ActionDefinition<string | void> = {
  id: "edit.track.add",
  i18nKey: "actions.edit.track.add",
  category: "edit.track",
  params: [
    { name: "presetId", type: "string", i18nKey: "actions.edit.track.add.params.presetId" },
  ],
  execute: (presetId, _context) => {
    if (!presetId) {
      usePlayerStore.setState({ addTrackDialogOpen: true });
      return;
    }
    const api = getApi();
    if (!api?.score) {
      debugLog("warn", "edit.track.add", "no API or score");
      return;
    }
    const preset = TRACK_PRESETS.find((p) => p.id === presetId);
    if (!preset) {
      debugLog("warn", "edit.track.add", "unknown preset", { presetId });
      return;
    }
    const yScore = getScoreMap();
    if (!yScore) return;

    const score = api.score;
    const atTrack = createTrackFromPreset(score, preset);
    const yTrack = importTrack(atTrack);

    debugLog("info", "edit.track.add", "start", {
      presetId,
      presetName: preset.defaultName,
      trackCount: score.tracks.length,
    });

    transact(() => {
      const yTracks = yScore.get("tracks") as Y.Array<Y.Map<unknown>>;
      yTracks.push([yTrack]);
    });

    debugLog("info", "edit.track.add", "complete");
  },
};

const deleteTrackAction: ActionDefinition<number> = {
  id: "edit.track.delete",
  i18nKey: "actions.edit.track.delete",
  category: "edit.track",
  params: [
    { name: "trackIndex", type: "number", i18nKey: "actions.edit.track.delete.params.trackIndex" },
  ],
  execute: (trackIndex, _context): boolean => {
    const api = getApi();
    if (!api?.score) {
      debugLog("warn", "edit.track.delete", "no API or score");
      return false;
    }
    const score = api.score;
    if (score.tracks.length <= 1) {
      debugLog("warn", "edit.track.delete", "blocked — last track");
      return false;
    }
    const yScore = getScoreMap();
    if (!yScore) return false;

    const sel = useEditorStore.getState().selectedBeat;
    if (sel && sel.trackIndex === trackIndex) {
      useEditorStore.setState({
        selectedBeat: null,
        selectedNoteIndex: -1,
        selectionRange: null,
      });
      usePlayerStore.setState({
        selectedBeat: null,
        selectionRange: null,
        selectedTrackInfo: null,
        selectedStaffInfo: null,
        selectedBarInfo: null,
        selectedVoiceInfo: null,
        selectedBeatInfo: null,
        selectedNoteIndex: -1,
        selectedString: null,
      });
    } else if (sel && sel.trackIndex > trackIndex) {
      setPendingSelection({
        trackIndex: sel.trackIndex - 1,
        barIndex: sel.barIndex,
        beatIndex: sel.beatIndex,
        staffIndex: sel.staffIndex,
        voiceIndex: sel.voiceIndex,
        string: sel.string,
      });
    }

    debugLog("info", "edit.track.delete", "start", { trackIndex });

    transact(() => {
      const yTracks = yScore.get("tracks") as Y.Array<Y.Map<unknown>>;
      yTracks.delete(trackIndex, 1);
    });

    debugLog("info", "edit.track.delete", "complete");
    return true;
  },
};

const setTrackNameAction: ActionDefinition<{ trackIndex: number; name: string }> = {
  id: "edit.track.setName",
  i18nKey: "actions.edit.track.setName",
  category: "edit.track",
  params: [
    { name: "trackIndex", type: "number", i18nKey: "actions.edit.track.setName.params.trackIndex" },
    { name: "name", type: "string", i18nKey: "actions.edit.track.setName.params.name" },
  ],
  execute: ({ trackIndex, name }, _context) => {
    const yTrack = engine.resolveYTrack(trackIndex);
    if (!yTrack) return;
    transact(() => {
      yTrack.set("name", name);
    });
  },
};

const setTrackShortNameAction: ActionDefinition<{ trackIndex: number; shortName: string }> = {
  id: "edit.track.setShortName",
  i18nKey: "actions.edit.track.setShortName",
  category: "edit.track",
  params: [
    { name: "trackIndex", type: "number", i18nKey: "actions.edit.track.setShortName.params.trackIndex" },
    { name: "shortName", type: "string", i18nKey: "actions.edit.track.setShortName.params.shortName" },
  ],
  execute: ({ trackIndex, shortName }, _context) => {
    const yTrack = engine.resolveYTrack(trackIndex);
    if (!yTrack) return;
    transact(() => {
      yTrack.set("shortName", shortName);
    });
  },
};

const setTrackVisibleAction: ActionDefinition<{ trackIndex: number; visible: boolean }> = {
  id: "edit.track.setVisible",
  i18nKey: "actions.edit.track.setVisible",
  category: "edit.track",
  params: [
    { name: "trackIndex", type: "number", i18nKey: "actions.edit.track.setVisible.params.trackIndex" },
    { name: "visible", type: "boolean", i18nKey: "actions.edit.track.setVisible.params.visible" },
  ],
  execute: ({ trackIndex, visible }, _context) => {
    const api = getApi();
    if (!api?.score) return;

    const current = new Set(usePlayerStore.getState().visibleTrackIndices);
    if (visible) {
      current.add(trackIndex);
    } else {
      current.delete(trackIndex);
    }

    if (current.size === 0) return;

    const sel = useEditorStore.getState().selectedBeat;
    if (!visible && sel && sel.trackIndex === trackIndex) {
      const sorted = [...current].sort((a, b) => a - b);
      const fallback = sorted.find((i) => i > trackIndex) ?? sorted[sorted.length - 1];
      if (fallback !== undefined) {
        const barIndex = Math.min(
          sel.barIndex,
          (api.score.tracks[fallback]?.staves[0]?.bars.length ?? 1) - 1,
        );
        setPendingSelection({
          trackIndex: fallback,
          staffIndex: 0,
          voiceIndex: 0,
          barIndex,
          beatIndex: 0,
          string: null,
        });
      }
    }

    const tracksToRender = [...current]
      .sort((a, b) => a - b)
      .map((i) => api!.score!.tracks[i])
      .filter(Boolean);

    api.renderTracks(tracksToRender as alphaTab.model.Track[]);
  },
};

const setTrackProgramAction: ActionDefinition<{ trackIndex: number; program: number }> = {
  id: "edit.track.setProgram",
  i18nKey: "actions.edit.track.setProgram",
  category: "edit.track",
  params: [
    { name: "trackIndex", type: "number", i18nKey: "actions.edit.track.setProgram.params.trackIndex" },
    { name: "program", type: "number", i18nKey: "actions.edit.track.setProgram.params.program" },
  ],
  execute: ({ trackIndex, program }, _context) => {
    const yTrack = engine.resolveYTrack(trackIndex);
    if (!yTrack) return;
    transact(() => {
      yTrack.set("playbackProgram", program);
    });
  },
};

actionRegistry.register(addTrackAction);
actionRegistry.register(deleteTrackAction);
actionRegistry.register(setTrackNameAction);
actionRegistry.register(setTrackShortNameAction);
actionRegistry.register(setTrackVisibleAction);
actionRegistry.register(setTrackProgramAction);

declare global {
  interface ActionMap {
    "edit.track.add": { args: string | void; result: void };
    "edit.track.delete": { args: number; result: boolean };
    "edit.track.setName": { args: { trackIndex: number; name: string }; result: void };
    "edit.track.setShortName": {
      args: { trackIndex: number; shortName: string };
      result: void;
    };
    "edit.track.setVisible": {
      args: { trackIndex: number; visible: boolean };
      result: void;
    };
    "edit.track.setProgram": {
      args: { trackIndex: number; program: number };
      result: void;
    };
  }
}

export {};
