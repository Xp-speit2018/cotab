import * as Y from "yjs";
import * as z from "zod";
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
import {
  TRACK_PRESETS,
  type TrackPreset,
  type TrackPresetId,
} from "@/core/presets";
import { actionArgs, defineDocumentAction } from "./definition";
import { integer, nonNegativeInteger } from "./args-schema";

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

const trackPresetIds = TRACK_PRESETS.map((preset) => preset.id) as [
  TrackPresetId,
  ...TrackPresetId[],
];

const addTrackAction = defineDocumentAction({
  id: "document.track.add",
  i18nKey: "actions.edit.track.add",
  category: "document.track",
  argsSchema: actionArgs({ presetId: z.enum(trackPresetIds) }),
  execute: ({ presetId }) => {
    const preset = TRACK_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const yScore = getScoreMap();
    if (!yScore) return;

    const yTracks = yScore.get("tracks") as Y.Array<Y.Map<unknown>>;
    const yMasterBars = yScore.get("masterBars") as Y.Array<Y.Map<unknown>>;
    const channel = getNextChannel(yTracks, preset);

    debugLog("info", "document.track.add", "start", {
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

    debugLog("info", "document.track.add", "complete");
  },
});

const deleteTrackAction = defineDocumentAction({
  id: "document.track.delete",
  i18nKey: "actions.edit.track.delete",
  category: "document.track",
  argsSchema: actionArgs({ trackIndex: nonNegativeInteger }),
  execute: ({ trackIndex }): boolean => {
    const yScore = getScoreMap();
    if (!yScore) return false;

    const yTracks = yScore.get("tracks") as Y.Array<Y.Map<unknown>> | undefined;
    if (!yTracks || yTracks.length <= 1) {
      debugLog("warn", "document.track.delete", "blocked — last track");
      return false;
    }
    if (trackIndex < 0 || trackIndex >= yTracks.length) {
      debugLog("warn", "document.track.delete", "invalid track index", { trackIndex });
      return false;
    }

    debugLog("info", "document.track.delete", "start", { trackIndex });

    transact(() => {
      yTracks.delete(trackIndex, 1);
    });

    debugLog("info", "document.track.delete", "complete");
    return true;
  },
});

const setTrackNameAction = defineDocumentAction({
  id: "document.track.setName",
  i18nKey: "actions.edit.track.setName",
  category: "document.track",
  argsSchema: actionArgs({ trackIndex: nonNegativeInteger, name: z.string() }),
  execute: ({ trackIndex, name }) => {
    const yTrack = engine.resolveYTrack(trackIndex);
    if (!yTrack) return;
    transact(() => {
      yTrack.set("name", name);
    });
  },
});

const setTrackShortNameAction = defineDocumentAction({
  id: "document.track.setShortName",
  i18nKey: "actions.edit.track.setShortName",
  category: "document.track",
  argsSchema: actionArgs({
    trackIndex: nonNegativeInteger,
    shortName: z.string(),
  }),
  execute: ({ trackIndex, shortName }) => {
    const yTrack = engine.resolveYTrack(trackIndex);
    if (!yTrack) return;
    transact(() => {
      yTrack.set("shortName", shortName);
    });
  },
});

const setTrackPlaybackInfoProgramAction = defineDocumentAction({
  id: "document.track.setPlaybackInfoProgram",
  i18nKey: "actions.edit.track.setPlaybackInfoProgram",
  category: "document.track",
  argsSchema: actionArgs({
    trackIndex: nonNegativeInteger,
    program: integer.min(0).max(127),
  }),
  execute: ({ trackIndex, program }) => {
    const yTrack = engine.resolveYTrack(trackIndex);
    if (!yTrack) return;
    transact(() => {
      const yPlaybackInfo = yTrack.get("playbackInfo") as
        | Y.Map<unknown>
        | undefined;
      yPlaybackInfo?.set("program", program);
    });
  },
});

const setPercussionArticulationOutputMidiNumberAction = defineDocumentAction({
  id: "document.track.setPercussionArticulationOutputMidiNumber",
  i18nKey: "actions.edit.track.setPercussionArticulationOutputMidiNumber",
  category: "document.track",
  argsSchema: actionArgs({
    trackIndex: nonNegativeInteger,
    articulationIndex: nonNegativeInteger,
    outputMidiNumber: integer.min(0).max(127),
  }),
  execute: ({ trackIndex, articulationIndex, outputMidiNumber }) => {
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
});

export const trackDocumentActions = [
  addTrackAction,
  deleteTrackAction,
  setTrackNameAction,
  setTrackShortNameAction,
  setTrackPlaybackInfoProgramAction,
  setPercussionArticulationOutputMidiNumberAction,
] as const;
