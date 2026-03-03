import * as alphaTab from "@coderline/alphatab";
import { actionRegistry } from "./registry";
import type { ActionDefinition } from "./types";
import type { TrackInfo } from "@/stores/player-store";
import { usePlayerStore } from "@/stores/player-store";
import { debugLog } from "@/stores/debug-log-store";
import {
  applyBarWarningStyles,
  createTrackFromPreset,
  getApi,
  getTrack,
  extractTrackInfo,
  setPendingSelection,
  TRACK_PRESETS,
} from "@/stores/player-internals";

const addTrackAction: ActionDefinition<string> = {
  id: "edit.track.add",
  i18nKey: "actions.edit.track.add",
  category: "edit.track",
  params: [
    { name: "presetId", type: "string", i18nKey: "actions.edit.track.add.params.presetId" },
  ],
  execute: (presetId, _context) => {
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
    const score = api.score;
    try {
      debugLog("info", "edit.track.add", "start", {
        presetId,
        presetName: preset.defaultName,
        trackCount: score.tracks.length,
        masterBarCount: score.masterBars.length,
      });
      const track = createTrackFromPreset(score, preset);
      debugLog("debug", "edit.track.add", "calling score.addTrack", {
        trackName: track.name,
        staffCount: track.staves.length,
        barCount: track.staves[0]?.bars.length ?? 0,
      });
      score.addTrack(track);
      debugLog("debug", "edit.track.add", "calling score.finish()");
      score.finish(api.settings);
      debugLog("debug", "edit.track.add", "score.finish() completed");
      applyBarWarningStyles();
      const existing = usePlayerStore.getState().tracks;
      const tracks: TrackInfo[] = score.tracks.map((t, i) => ({
        index: i,
        name: t.name,
        volume: existing[i]?.volume ?? 1,
        isMuted: existing[i]?.isMuted ?? false,
        isSolo: existing[i]?.isSolo ?? false,
        isPercussion: t.isPercussion,
      }));
      usePlayerStore.setState({ tracks });
      debugLog("debug", "edit.track.add", "state updated", { newTracksLength: tracks.length });
      api.renderTracks(score.tracks);
      debugLog("info", "edit.track.add", "complete", {
        newTrackIndex: track.index,
        newTrackName: track.name,
        totalTracks: score.tracks.length,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw err;
    }
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
      debugLog("warn", "edit.track.delete", "blocked — last track", {
        trackCount: score.tracks.length,
      });
      return false;
    }
    const removedTrack = score.tracks[trackIndex];
    try {
      debugLog("info", "edit.track.delete", "start", {
        trackIndex,
        trackName: removedTrack?.name ?? "—",
        trackCount: score.tracks.length,
        masterBarCount: score.masterBars.length,
      });
      const sel = usePlayerStore.getState().selectedBeat;
      score.tracks.splice(trackIndex, 1);
      debugLog("debug", "edit.track.delete", "spliced track", {
        newTrackCount: score.tracks.length,
      });
      for (let i = 0; i < score.tracks.length; i++) {
        score.tracks[i].index = i;
      }
      debugLog("debug", "edit.track.delete", "track indices updated");
      score.finish(api.settings);
      debugLog("debug", "edit.track.delete", "score.finish() completed");
      applyBarWarningStyles();
      if (sel && sel.trackIndex === trackIndex) {
        debugLog("debug", "edit.track.delete", "selection cleared (was on deleted track)");
        usePlayerStore.setState({
          selectedBeat: null,
          selectedTrackInfo: null,
          selectedStaffInfo: null,
          selectedBarInfo: null,
          selectedVoiceInfo: null,
          selectedBeatInfo: null,
          selectedNoteIndex: -1,
          selectedString: null,
        });
      } else if (sel && sel.trackIndex > trackIndex) {
        debugLog("debug", "edit.track.delete", "selection adjusted", {
          oldTrackIndex: sel.trackIndex,
          newTrackIndex: sel.trackIndex - 1,
        });
        setPendingSelection({
          trackIndex: sel.trackIndex - 1,
          barIndex: sel.barIndex,
          beatIndex: sel.beatIndex,
          staffIndex: sel.staffIndex,
          voiceIndex: sel.voiceIndex,
          string: sel.string,
        });
      }
      const existing = usePlayerStore.getState().tracks;
      const tracks: TrackInfo[] = score.tracks.map((t, i) => {
        const oldIndex = i < trackIndex ? i : i + 1;
        return {
          index: i,
          name: t.name,
          volume: existing[oldIndex]?.volume ?? 1,
          isMuted: existing[oldIndex]?.isMuted ?? false,
          isSolo: existing[oldIndex]?.isSolo ?? false,
          isPercussion: t.isPercussion,
        };
      });
      usePlayerStore.setState({ tracks });
      debugLog("debug", "edit.track.delete", "state updated", {
        newTracksLength: tracks.length,
      });
      api.renderTracks(score.tracks);
      debugLog("info", "edit.track.delete", "complete", {
        removedTrackName: removedTrack?.name ?? "—",
        newTrackCount: score.tracks.length,
      });
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw err;
    }
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
    const api = getApi();
    const track = getTrack(trackIndex);
    if (!api || !track) return;
    track.name = name;
    usePlayerStore.setState({
      tracks: usePlayerStore.getState().tracks.map((t) =>
        t.index === trackIndex ? { ...t, name } : t,
      ),
    });
    const sel = usePlayerStore.getState().selectedBeat;
    if (sel && sel.trackIndex === trackIndex) {
      usePlayerStore.setState({ selectedTrackInfo: extractTrackInfo(track) });
    }
    api.render();
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
    const api = getApi();
    const track = getTrack(trackIndex);
    if (!api || !track) return;
    track.shortName = shortName;
    const sel = usePlayerStore.getState().selectedBeat;
    if (sel && sel.trackIndex === trackIndex) {
      usePlayerStore.setState({ selectedTrackInfo: extractTrackInfo(track) });
    }
    api.render();
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

    const sel = usePlayerStore.getState().selectedBeat;
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
    const api = getApi();
    const track = getTrack(trackIndex);
    if (!api || !track) return;
    track.playbackInfo.program = program;
    const sel = usePlayerStore.getState().selectedBeat;
    if (sel && sel.trackIndex === trackIndex) {
      usePlayerStore.setState({ selectedTrackInfo: extractTrackInfo(track) });
    }
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
    "edit.track.add": { args: string; result: void };
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

