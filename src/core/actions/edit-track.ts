import * as Y from "yjs";
import { actionRegistry } from "@/core/actions/registry";
import type { ActionDefinition } from "@/core/actions/types";
import { engine } from "@/core/engine";
import { debugLog } from "@/core/editor/action-log";
import {
  createBar,
  createBeat,
  createMasterBar,
  createStaff,
  createTrack,
  createVoice,
} from "@/core/schema";
import { TRACK_PRESETS, type TrackPreset } from "@/core/presets";

const transact = (fn: () => void) => engine.localEditYDoc(fn);
const getScoreMap = () => engine.getScoreMap();

function getNextChannel(yTracks: Y.Array<Y.Map<unknown>>, preset: TrackPreset): number {
  if (preset.channel !== 0) return preset.channel;

  let maxChannel = -1;
  for (let i = 0; i < yTracks.length; i++) {
    const yPlaybackInfo = yTracks.get(i).get("playbackInfo") as
      | Y.Map<unknown>
      | undefined;
    const channel =
      (yPlaybackInfo?.get("primaryChannel") as number | undefined) ?? -1;
    if (channel !== 9) {
      maxChannel = Math.max(maxChannel, channel);
    }
  }

  const next = maxChannel + 1;
  return next === 9 ? 10 : next;
}

function appendRestBar(yStaff: Y.Map<unknown>, clef: number): void {
  const yBars = yStaff.get("bars") as Y.Array<Y.Map<unknown>>;
  const yBar = createBar(clef);
  yBars.push([yBar]);

  const intBar = yBars.get(yBars.length - 1);
  const yVoices = intBar.get("voices") as Y.Array<Y.Map<unknown>>;
  yVoices.push([createVoice()]);

  const intVoice = yVoices.get(0);
  const yBeats = intVoice.get("beats") as Y.Array<Y.Map<unknown>>;
  const yBeat = createBeat();
  yBeat.set("isEmpty", false);
  yBeats.push([yBeat]);
}

function createPresetStaffShell(args: {
  isPercussion: boolean;
  showTablature: boolean;
  showStandardNotation: boolean;
  tuning: readonly number[];
}): Y.Map<unknown> {
  const yStaff = createStaff([...args.tuning]);
  yStaff.set("isPercussion", args.isPercussion);
  yStaff.set("showTablature", args.showTablature);
  yStaff.set("showStandardNotation", args.showStandardNotation);
  return yStaff;
}

function appendStaffFromPreset(
  yStaves: Y.Array<Y.Map<unknown>>,
  args: {
    clef: number;
    isPercussion: boolean;
    showTablature: boolean;
    showStandardNotation: boolean;
    tuning: readonly number[];
    barCount: number;
  },
): void {
  yStaves.push([createPresetStaffShell(args)]);
  const yStaff = yStaves.get(yStaves.length - 1);
  for (let i = 0; i < args.barCount; i++) {
    appendRestBar(yStaff, args.clef);
  }
}

function appendTrackFromPresetY(
  yTracks: Y.Array<Y.Map<unknown>>,
  preset: TrackPreset,
  barCount: number,
  channel: number,
): void {
  yTracks.push([createTrack(preset.defaultName)]);
  const yTrack = yTracks.get(yTracks.length - 1);
  yTrack.set("shortName", preset.defaultName.slice(0, 20));
  const yPlaybackInfo = yTrack.get("playbackInfo") as Y.Map<unknown>;
  yPlaybackInfo.set("program", preset.program);
  yPlaybackInfo.set("primaryChannel", channel);
  yPlaybackInfo.set("secondaryChannel", channel);

  const yStaves = yTrack.get("staves") as Y.Array<Y.Map<unknown>>;

  if (!preset.isPercussion && preset.stringCount === 0) {
    appendStaffFromPreset(
      yStaves,
      {
        clef: 4,
        isPercussion: false,
        showTablature: false,
        showStandardNotation: true,
        tuning: [],
        barCount,
      },
    );
    appendStaffFromPreset(
      yStaves,
      {
        clef: 3,
        isPercussion: false,
        showTablature: false,
        showStandardNotation: true,
        tuning: [],
        barCount,
      },
    );
  } else {
    appendStaffFromPreset(
      yStaves,
      {
        clef: preset.clef,
        isPercussion: preset.isPercussion,
        showTablature: preset.stringCount > 0 && !preset.isPercussion,
        showStandardNotation: preset.stringCount === 0 || preset.isPercussion,
        tuning: preset.tuning ?? [],
        barCount,
      },
    );
  }
}

const addTrackAction: ActionDefinition<string> = {
  id: "edit.track.add",
  i18nKey: "actions.edit.track.add",
  category: "edit.track",
  params: [
    { name: "presetId", type: "string", i18nKey: "actions.edit.track.add.params.presetId" },
  ],
  execute: (presetId, _context) => {
    if (!presetId) {
      debugLog("warn", "edit.track.add", "presetId required");
      return;
    }
    const preset = TRACK_PRESETS.find((p) => p.id === presetId);
    if (!preset) {
      debugLog("warn", "edit.track.add", "unknown preset", { presetId });
      return;
    }
    const yScore = getScoreMap();
    if (!yScore) return;

    const yTracks = yScore.get("tracks") as Y.Array<Y.Map<unknown>>;
    const yMasterBars = yScore.get("masterBars") as Y.Array<Y.Map<unknown>>;
    const channel = getNextChannel(yTracks, preset);

    debugLog("info", "edit.track.add", "start", {
      presetId,
      presetName: preset.defaultName,
      trackCount: yTracks.length,
    });

    transact(() => {
      if (yMasterBars.length === 0) {
        yMasterBars.push([createMasterBar()]);
      }
      appendTrackFromPresetY(yTracks, preset, yMasterBars.length, channel);
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
    const yScore = getScoreMap();
    if (!yScore) return false;

    const yTracks = yScore.get("tracks") as Y.Array<Y.Map<unknown>> | undefined;
    if (!yTracks || yTracks.length <= 1) {
      debugLog("warn", "edit.track.delete", "blocked — last track");
      return false;
    }
    if (trackIndex < 0 || trackIndex >= yTracks.length) {
      debugLog("warn", "edit.track.delete", "invalid track index", { trackIndex });
      return false;
    }

    debugLog("info", "edit.track.delete", "start", { trackIndex });

    transact(() => {
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

const setTrackPlaybackInfoProgramAction: ActionDefinition<{ trackIndex: number; program: number }> = {
  id: "edit.track.setPlaybackInfoProgram",
  i18nKey: "actions.edit.track.setPlaybackInfoProgram",
  category: "edit.track",
  params: [
    { name: "trackIndex", type: "number", i18nKey: "actions.edit.track.setPlaybackInfoProgram.params.trackIndex" },
    { name: "program", type: "number", i18nKey: "actions.edit.track.setPlaybackInfoProgram.params.program" },
  ],
  execute: ({ trackIndex, program }, _context) => {
    const yTrack = engine.resolveYTrack(trackIndex);
    if (!yTrack) return;
    transact(() => {
      const yPlaybackInfo = yTrack.get("playbackInfo") as
        | Y.Map<unknown>
        | undefined;
      yPlaybackInfo?.set("program", program);
    });
  },
};

const setPercussionArticulationOutputMidiNumberAction: ActionDefinition<{
  trackIndex: number;
  articulationIndex: number;
  outputMidiNumber: number;
}> = {
  id: "edit.track.setPercussionArticulationOutputMidiNumber",
  i18nKey: "actions.edit.track.setPercussionArticulationOutputMidiNumber",
  category: "edit.track",
  params: [
    { name: "trackIndex", type: "number", i18nKey: "actions.edit.track.setPercussionArticulationOutputMidiNumber.params.trackIndex" },
    { name: "articulationIndex", type: "number", i18nKey: "actions.edit.track.setPercussionArticulationOutputMidiNumber.params.articulationIndex" },
    { name: "outputMidiNumber", type: "number", i18nKey: "actions.edit.track.setPercussionArticulationOutputMidiNumber.params.outputMidiNumber" },
  ],
  execute: ({ trackIndex, articulationIndex, outputMidiNumber }, _context) => {
    const yTrack = engine.resolveYTrack(trackIndex);
    const yArticulations = yTrack?.get("percussionArticulations") as
      | Y.Array<Y.Map<unknown>>
      | undefined;
    if (
      !yArticulations ||
      articulationIndex < 0 ||
      articulationIndex >= yArticulations.length
    ) return;
    transact(() => {
      yArticulations
        .get(articulationIndex)
        .set("outputMidiNumber", outputMidiNumber);
    });
  },
};

actionRegistry.register(addTrackAction);
actionRegistry.register(deleteTrackAction);
actionRegistry.register(setTrackNameAction);
actionRegistry.register(setTrackShortNameAction);
actionRegistry.register(setTrackPlaybackInfoProgramAction);
actionRegistry.register(setPercussionArticulationOutputMidiNumberAction);

declare global {
  interface ActionMap {
    "edit.track.add": { args: string; result: void };
    "edit.track.delete": { args: number; result: boolean };
    "edit.track.setName": { args: { trackIndex: number; name: string }; result: void };
    "edit.track.setShortName": {
      args: { trackIndex: number; shortName: string };
      result: void;
    };
    "edit.track.setPlaybackInfoProgram": {
      args: { trackIndex: number; program: number };
      result: void;
    };
    "edit.track.setPercussionArticulationOutputMidiNumber": {
      args: {
        trackIndex: number;
        articulationIndex: number;
        outputMidiNumber: number;
      };
      result: void;
    };
  }
}

export {};
