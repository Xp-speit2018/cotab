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
  createTuning,
  createVoice,
} from "@/core/schema";
import {
  TRACK_PRESETS,
  standardNotationTrackSpec,
  type TrackCreationSpec,
  type TrackPresetId,
} from "@/core/presets";
import { generalMidiInstrument } from "@/core/general-midi";
import { actionArgs, defineDocumentAction } from "./definition";
import {
  integer,
  nonNegativeInteger,
  percussionMappingListSchema,
  positiveInteger,
} from "./args-schema";
import {
  forceSystemBreak,
  moveSystemBreak,
  preventSystemBreak,
  readYSystemLayout,
  reflowSystems,
  writeYSystemLayout,
  type SystemBreakDirection,
  type SystemLayoutState,
} from "./system-layout";

const transact = (fn: () => void) => engine.localEditYDoc(fn);
const getScoreMap = () => engine.getScoreMap();

function mutateTrackSystemLayout(
  trackIndex: number,
  mutate: (
    totalBars: number,
    current: SystemLayoutState,
  ) => SystemLayoutState | null,
): boolean {
  const yScore = getScoreMap();
  const yTrack = engine.resolveYTrack(trackIndex);
  if (!yScore || !yTrack) return false;
  const totalBars = (
    yScore.get("masterBars") as Y.Array<Y.Map<unknown>> | undefined
  )?.length ?? 0;
  const next = mutate(totalBars, readYSystemLayout(yTrack));
  if (!next) return false;
  transact(() => writeYSystemLayout(yTrack, next));
  return true;
}

function getNextChannel(
  yTracks: Y.Array<Y.Map<unknown>>,
  spec: TrackCreationSpec,
): number {
  if (spec.staves.some((staff) => staff.isPercussion)) return 9;

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

function createPresetStaffShell(
  staff: TrackCreationSpec["staves"][number],
): Y.Map<unknown> {
  const yStaff = createStaff([...staff.stringTuning.tunings]);
  yStaff.set("isPercussion", staff.isPercussion);
  yStaff.set("showTablature", staff.showTablature);
  yStaff.set("showStandardNotation", staff.showStandardNotation);
  yStaff.set("capo", staff.capo);
  yStaff.set("transpositionPitch", staff.transpositionPitch);
  yStaff.set("displayTranspositionPitch", staff.displayTranspositionPitch);
  const yStringTuning = createTuning(staff.stringTuning.tunings);
  yStringTuning.set("name", staff.stringTuning.name);
  yStringTuning.set("isStandard", staff.stringTuning.isStandard);
  yStaff.set("stringTuning", yStringTuning);
  return yStaff;
}

function appendStaffFromPreset(
  yStaves: Y.Array<Y.Map<unknown>>,
  args: {
    staff: TrackCreationSpec["staves"][number];
    barCount: number;
  },
): void {
  yStaves.push([createPresetStaffShell(args.staff)]);
  const yStaff = yStaves.get(yStaves.length - 1);
  for (let i = 0; i < args.barCount; i++) {
    appendRestBar(yStaff, args.staff.initialClef);
  }
}

function appendTrackFromPresetY(
  yTracks: Y.Array<Y.Map<unknown>>,
  preset: TrackCreationSpec,
  barCount: number,
  channel: number,
): void {
  yTracks.push([createTrack(preset.defaultName)]);
  const yTrack = yTracks.get(yTracks.length - 1);
  yTrack.set("shortName", preset.shortName);
  yTrack.set("defaultSystemsLayout", preset.defaultSystemsLayout);
  (yTrack.get("color") as Y.Map<unknown>).set("raw", preset.colorRaw);
  const yPlaybackInfo = yTrack.get("playbackInfo") as Y.Map<unknown>;
  yPlaybackInfo.set("program", preset.playbackInfo.program);
  yPlaybackInfo.set("bank", preset.playbackInfo.bank);
  yPlaybackInfo.set("primaryChannel", channel);
  yPlaybackInfo.set("secondaryChannel", channel);

  const yStaves = yTrack.get("staves") as Y.Array<Y.Map<unknown>>;

  for (const staff of preset.staves) {
    appendStaffFromPreset(
      yStaves,
      {
        staff,
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

const addInstrumentTrackAction = defineDocumentAction({
  id: "document.track.addInstrument",
  i18nKey: "actions.edit.track.addInstrument",
  category: "document.track",
  argsSchema: actionArgs({
    program: integer.min(0).max(127),
    bank: integer.min(0).max(16383),
  }),
  execute: ({ program, bank }) => {
    const instrument = generalMidiInstrument(program);
    const yScore = getScoreMap();
    if (!instrument || !yScore) return false;

    const spec = standardNotationTrackSpec(instrument.name, program, bank);
    const yTracks = yScore.get("tracks") as Y.Array<Y.Map<unknown>>;
    const yMasterBars = yScore.get("masterBars") as Y.Array<Y.Map<unknown>>;
    const channel = getNextChannel(yTracks, spec);

    debugLog("info", "document.track.addInstrument", "start", {
      program,
      bank,
      instrumentName: instrument.name,
      trackCount: yTracks.length,
    });

    transact(() => {
      if (yMasterBars.length === 0) {
        yMasterBars.push([createMasterBar()]);
      }
      appendTrackFromPresetY(yTracks, spec, yMasterBars.length, channel);
    });

    debugLog("info", "document.track.addInstrument", "complete");
    return true;
  },
});

const deleteTrackAction = defineDocumentAction({
  id: "document.track.delete",
  i18nKey: "actions.edit.track.delete",
  category: "document.track",
  argsSchema: actionArgs({ trackUuid: z.string().min(1) }),
  execute: ({ trackUuid }): boolean => {
    const yScore = getScoreMap();
    if (!yScore) return false;

    const yTracks = yScore.get("tracks") as Y.Array<Y.Map<unknown>> | undefined;
    if (!yTracks || yTracks.length <= 1) {
      debugLog("warn", "document.track.delete", "blocked — last track");
      return false;
    }
    const trackIndex = yTracks.toArray().findIndex(
      (yTrack) => yTrack.get("uuid") === trackUuid,
    );
    if (trackIndex < 0) {
      debugLog("warn", "document.track.delete", "unknown track uuid", {
        trackUuid,
      });
      return false;
    }

    debugLog("info", "document.track.delete", "start", {
      trackUuid,
      trackIndex,
    });

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

const setTrackColorAction = defineDocumentAction({
  id: "document.track.setColor",
  i18nKey: "actions.edit.track.setColor",
  category: "document.track",
  argsSchema: actionArgs({
    trackIndex: nonNegativeInteger,
    raw: integer.min(-2147483648).max(2147483647),
  }),
  execute: ({ trackIndex, raw }) => {
    const yTrack = engine.resolveYTrack(trackIndex);
    if (!yTrack) return;
    transact(() => {
      let color = yTrack.get("color") as Y.Map<unknown> | undefined;
      if (!color) {
        color = new Y.Map<unknown>();
        yTrack.set("color", color);
      }
      color.set("raw", raw);
    });
  },
});

const setTrackInstrumentAction = defineDocumentAction({
  id: "document.track.setInstrument",
  i18nKey: "actions.edit.track.setInstrument",
  category: "document.track",
  argsSchema: actionArgs({
    trackIndex: nonNegativeInteger,
    program: integer.min(0).max(127),
    bank: integer.min(0).max(16383),
  }),
  execute: ({ trackIndex, program, bank }) => {
    const yTrack = engine.resolveYTrack(trackIndex);
    if (!yTrack) return;
    transact(() => {
      const yPlaybackInfo = yTrack.get("playbackInfo") as
        | Y.Map<unknown>
        | undefined;
      if (!yPlaybackInfo) return;
      yPlaybackInfo.set("program", program);
      yPlaybackInfo.set("bank", bank);
    });
  },
});

const setTrackDefaultSystemsLayoutAction = defineDocumentAction({
  id: "document.track.setDefaultSystemsLayout",
  i18nKey: "actions.edit.track.setDefaultSystemsLayout",
  category: "document.track",
  argsSchema: actionArgs({
    trackIndex: nonNegativeInteger,
    value: positiveInteger,
  }),
  execute: ({ trackIndex, value }) => {
    const yTrack = engine.resolveYTrack(trackIndex);
    if (!yTrack) return;
    transact(() => {
      yTrack.set("defaultSystemsLayout", value);
    });
  },
});

const setTrackSystemsLayoutAction = defineDocumentAction({
  id: "document.track.setSystemsLayout",
  i18nKey: "actions.edit.track.setSystemsLayout",
  category: "document.track",
  argsSchema: actionArgs({
    trackIndex: nonNegativeInteger,
    value: z.array(positiveInteger),
  }),
  execute: ({ trackIndex, value }) => {
    const yTrack = engine.resolveYTrack(trackIndex);
    if (!yTrack) return;
    transact(() => {
      let systemsLayout = yTrack.get("systemsLayout") as
        | Y.Array<number>
        | undefined;
      if (!systemsLayout) {
        systemsLayout = new Y.Array<number>();
        yTrack.set("systemsLayout", systemsLayout);
      } else if (systemsLayout.length > 0) {
        systemsLayout.delete(0, systemsLayout.length);
      }
      if (value.length > 0) systemsLayout.push([...value]);
    });
  },
});

const reflowTrackSystemsAction = defineDocumentAction({
  id: "document.track.reflowSystems",
  i18nKey: "actions.edit.track.reflowSystems",
  category: "document.track",
  argsSchema: actionArgs({
    trackIndex: nonNegativeInteger,
    barsPerSystem: positiveInteger,
    startBarIndex: nonNegativeInteger.nullable(),
  }),
  execute: ({ trackIndex, barsPerSystem, startBarIndex }) =>
    mutateTrackSystemLayout(trackIndex, (totalBars, current) =>
      reflowSystems(totalBars, current, barsPerSystem, startBarIndex),
    ),
});

const forceTrackSystemBreakAction = defineDocumentAction({
  id: "document.track.forceSystemBreak",
  i18nKey: "actions.edit.track.forceSystemBreak",
  category: "document.track",
  argsSchema: actionArgs({
    trackIndex: nonNegativeInteger,
    barIndex: nonNegativeInteger,
  }),
  execute: ({ trackIndex, barIndex }) =>
    mutateTrackSystemLayout(trackIndex, (totalBars, current) =>
      forceSystemBreak(totalBars, current, barIndex),
    ),
});

const preventTrackSystemBreakAction = defineDocumentAction({
  id: "document.track.preventSystemBreak",
  i18nKey: "actions.edit.track.preventSystemBreak",
  category: "document.track",
  argsSchema: actionArgs({
    trackIndex: nonNegativeInteger,
    barIndex: nonNegativeInteger,
  }),
  execute: ({ trackIndex, barIndex }) =>
    mutateTrackSystemLayout(trackIndex, (totalBars, current) =>
      preventSystemBreak(totalBars, current, barIndex),
    ),
});

const moveTrackSystemBreakAction = defineDocumentAction({
  id: "document.track.moveSystemBreak",
  i18nKey: "actions.edit.track.moveSystemBreak",
  category: "document.track",
  argsSchema: actionArgs({
    trackIndex: nonNegativeInteger,
    barIndex: nonNegativeInteger,
    direction: z.enum(["left", "right"]),
  }),
  execute: ({ trackIndex, barIndex, direction }) =>
    mutateTrackSystemLayout(trackIndex, (totalBars, current) =>
      moveSystemBreak(
        totalBars,
        current,
        barIndex,
        direction as SystemBreakDirection,
      ),
    ),
});

const setPercussionMapAction = defineDocumentAction({
  id: "document.track.setPercussionMap",
  i18nKey: "actions.edit.track.setPercussionMap",
  category: "document.track",
  argsSchema: actionArgs({
    trackIndex: nonNegativeInteger,
    mappings: percussionMappingListSchema,
  }),
  execute: ({ trackIndex, mappings }): boolean => {
    const yTrack = engine.resolveYTrack(trackIndex);
    const yArticulations = yTrack?.get("percussionArticulations") as
      | Y.Array<Y.Map<unknown>>
      | undefined;
    if (!yArticulations) return false;
    if (mappings.some(
      (mapping) => mapping.articulationIndex >= yArticulations.length,
    )) return false;
    transact(() => {
      for (const mapping of mappings) {
        yArticulations.get(mapping.articulationIndex).set(
          "outputMidiNumber",
          mapping.outputMidiNumber,
        );
      }
    });
    return true;
  },
});

export const trackDocumentActions = [
  addTrackAction,
  addInstrumentTrackAction,
  deleteTrackAction,
  setTrackNameAction,
  setTrackShortNameAction,
  setTrackColorAction,
  setTrackInstrumentAction,
  setTrackDefaultSystemsLayoutAction,
  setTrackSystemsLayoutAction,
  reflowTrackSystemsAction,
  forceTrackSystemBreakAction,
  preventTrackSystemBreakAction,
  moveTrackSystemBreakAction,
  setPercussionMapAction,
] as const;
