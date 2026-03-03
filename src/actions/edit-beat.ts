import * as alphaTab from "@coderline/alphatab";
import { actionRegistry } from "./registry";
import type { ActionDefinition } from "./types";
import { debugLog } from "@/stores/debug-log-store";
import {
  getApi,
  getSnapGrids,
  resolveBeat,
  applyBarWarningStyles,
  setPendingSelection,
  formatPitch,
  snapPositionToPitch,
  gp7IdToPercussionArticulation,
  DRUM_STAFFLINE_DEFAULTS,
  GP7_STAFF_LINE_MAP,
} from "@/stores/player-internals";
import { usePlayerStore } from "@/stores/player-store";

function applyBeatUpdates(updates: Record<string, unknown>): void {
  const sel = usePlayerStore.getState().selectedBeat;
  const api = getApi();
  if (!sel || !api) {
    debugLog("debug", "edit.beat.applyBeatUpdates", "no selection or API", { updates });
    return;
  }
  const beat = resolveBeat(
    sel.trackIndex,
    sel.barIndex,
    sel.beatIndex,
    sel.staffIndex,
    sel.voiceIndex,
  );
  if (!beat) {
    debugLog("debug", "edit.beat.applyBeatUpdates", "no beat resolved", {
      updates,
      sel,
    });
    return;
  }
  const b = beat as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(updates)) {
    b[key] = value;
  }
  beat.voice.finish(api.settings);
  applyBarWarningStyles();
  setPendingSelection({
    trackIndex: sel.trackIndex,
    barIndex: sel.barIndex,
    beatIndex: sel.beatIndex,
    staffIndex: sel.staffIndex,
    voiceIndex: sel.voiceIndex,
    string: sel.string,
  });
  api.render();
}

const placeNoteAction: ActionDefinition<void> = {
  id: "edit.beat.placeNote",
  i18nKey: "actions.edit.beat.placeNote",
  category: "edit.beat",
  execute: (_args, _context) => {
    const sel = usePlayerStore.getState().selectedBeat;
    const api = getApi();
    if (!sel || !api || sel.string === null) return;

    const score = api.score;
    if (!score) return;

    const beat = resolveBeat(
      sel.trackIndex,
      sel.barIndex,
      sel.beatIndex,
      sel.staffIndex,
      sel.voiceIndex,
    );
    if (!beat) return;

    const track = score.tracks[sel.trackIndex];
    if (!track) return;
    const staff = track.staves[sel.staffIndex];
    if (!staff) return;

    const note = new alphaTab.model.Note();

    if (track.isPercussion) {
      const gridKey = `${sel.trackIndex}:${sel.staffIndex}`;
      const grid = getSnapGrids().get(gridKey);
      const observedArtic = grid?.percussionMap?.get(sel.string);
      if (observedArtic !== undefined) {
        note.percussionArticulation = observedArtic;
      } else {
        const defaultGp7Id = DRUM_STAFFLINE_DEFAULTS[sel.string];
        if (defaultGp7Id !== undefined) {
          note.percussionArticulation =
            gp7IdToPercussionArticulation(track, defaultGp7Id);
        } else {
          const idsAtLine = GP7_STAFF_LINE_MAP.get(sel.string);
          const fallbackId = idsAtLine?.[0] ?? 42;
          note.percussionArticulation =
            gp7IdToPercussionArticulation(track, fallbackId);
        }
      }
    } else if (staff.showTablature && staff.tuning.length > 0) {
      note.fret = 1;
      note.string = sel.string;
    } else {
      const position = sel.string;
      const pitch = snapPositionToPitch(beat.voice.bar.clef, position);
      note.octave = pitch.octave;
      note.tone = pitch.tone;

      debugLog("info", "edit.beat.placeNote", "piano note", {
        trackIndex: sel.trackIndex,
        staffIndex: sel.staffIndex,
        barIndex: sel.barIndex,
        beatIndex: sel.beatIndex,
        snapPosition: position,
        clef: beat.voice.bar.clef as unknown as number,
        octave: note.octave,
        tone: note.tone,
        pitch: formatPitch(
          note.octave as unknown as number,
          note.tone as unknown as number,
        ),
      });
    }

    beat.addNote(note);
    beat.isEmpty = false;
    beat.duration = alphaTab.model.Duration.Quarter as number as alphaTab.model.Duration;

    beat.voice.finish(api.settings);
    applyBarWarningStyles();

    setPendingSelection({
      trackIndex: sel.trackIndex,
      barIndex: sel.barIndex,
      beatIndex: sel.beatIndex,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      string: sel.string,
    });
    api.render();
  },
};

const deleteNoteAction: ActionDefinition<void> = {
  id: "edit.beat.deleteNote",
  i18nKey: "actions.edit.beat.deleteNote",
  category: "edit.beat",
  execute: (_args, _context): boolean => {
    const sel = usePlayerStore.getState().selectedBeat;
    const api = getApi();
    if (!sel || !api) return false;

    const beat = resolveBeat(
      sel.trackIndex,
      sel.barIndex,
      sel.beatIndex,
      sel.staffIndex,
      sel.voiceIndex,
    );
    if (!beat) return false;

    const voice = beat.voice;
    const noteIdx = usePlayerStore.getState().selectedNoteIndex;

    if (beat.notes.length === 0 || beat.isRest) {
      if (voice.beats.length <= 1) return false;

      const beatIdx = voice.beats.indexOf(beat);
      if (beatIdx < 0) return false;

      voice.beats.splice(beatIdx, 1);
      voice.finish(api.settings);
      applyBarWarningStyles();

      const newBeatIdx = Math.min(beatIdx, voice.beats.length - 1);
      setPendingSelection({
        trackIndex: sel.trackIndex,
        barIndex: sel.barIndex,
        beatIndex: newBeatIdx,
        staffIndex: sel.staffIndex,
        voiceIndex: sel.voiceIndex,
        string: sel.string,
      });

      api.render();
      return true;
    }

    if (noteIdx < 0 || noteIdx >= beat.notes.length) return false;

    const staff = beat.voice.bar.staff;
    const track = staff.track;
    const note = beat.notes[noteIdx];

    if (!track.isPercussion && !staff.showTablature) {
      debugLog("info", "edit.beat.deleteNote", "piano note", {
        trackIndex: sel.trackIndex,
        staffIndex: sel.staffIndex,
        barIndex: sel.barIndex,
        beatIndex: sel.beatIndex,
        noteIndex: noteIdx,
        clef: beat.voice.bar.clef as unknown as number,
        octave: note.octave,
        tone: note.tone,
        pitch: formatPitch(
          note.octave as unknown as number,
          note.tone as unknown as number,
        ),
      });
    }

    if (beat.notes.length > 1) {
      beat.notes.splice(noteIdx, 1);
      for (let i = 0; i < beat.notes.length; i++) {
        beat.notes[i].index = i;
      }
      voice.finish(api.settings);
      applyBarWarningStyles();

      const newNoteIdx = Math.min(noteIdx, beat.notes.length - 1);
      setPendingSelection({
        trackIndex: sel.trackIndex,
        barIndex: sel.barIndex,
        beatIndex: sel.beatIndex,
        staffIndex: sel.staffIndex,
        voiceIndex: sel.voiceIndex,
        string: beat.notes[newNoteIdx]?.string ?? sel.string,
      });
    } else {
      beat.notes = [];
      voice.finish(api.settings);
      applyBarWarningStyles();

      setPendingSelection({
        trackIndex: sel.trackIndex,
        barIndex: sel.barIndex,
        beatIndex: sel.beatIndex,
        staffIndex: sel.staffIndex,
        voiceIndex: sel.voiceIndex,
        string: sel.string,
      });
    }

    api.render();
    return true;
  },
};

const insertRestBeforeAction: ActionDefinition<number | void> = {
  id: "edit.beat.insertRestBefore",
  i18nKey: "actions.edit.beat.insertRestBefore",
  category: "edit.beat",
  params: [{ name: "duration", type: "number", i18nKey: "actions.edit.beat.insertRestBefore.params.duration" }],
  execute: (duration, _context) => {
    const sel = usePlayerStore.getState().selectedBeat;
    const api = getApi();
    if (!sel || !api) return;
    const beat = resolveBeat(
      sel.trackIndex,
      sel.barIndex,
      sel.beatIndex,
      sel.staffIndex,
      sel.voiceIndex,
    );
    if (!beat) return;
    const voice = beat.voice;

    const restBeat = new alphaTab.model.Beat();
    restBeat.isEmpty = false;
    restBeat.duration = (duration as alphaTab.model.Duration) ?? beat.duration;
    restBeat.notes = [];

    const idx = voice.beats.indexOf(beat);
    if (idx >= 0) {
      voice.beats.splice(idx, 0, restBeat);
      restBeat.voice = voice;
    } else {
      voice.addBeat(restBeat);
    }
    voice.finish(api.settings);
    applyBarWarningStyles();

    setPendingSelection({
      trackIndex: sel.trackIndex,
      barIndex: sel.barIndex,
      beatIndex: idx >= 0 ? idx : sel.beatIndex,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      string: sel.string,
    });
    api.render();
  },
};

const insertRestAfterAction: ActionDefinition<number | void> = {
  id: "edit.beat.insertRestAfter",
  i18nKey: "actions.edit.beat.insertRestAfter",
  category: "edit.beat",
  params: [{ name: "duration", type: "number", i18nKey: "actions.edit.beat.insertRestAfter.params.duration" }],
  execute: (duration, _context) => {
    const sel = usePlayerStore.getState().selectedBeat;
    const api = getApi();
    if (!sel || !api) return;
    const beat = resolveBeat(
      sel.trackIndex,
      sel.barIndex,
      sel.beatIndex,
      sel.staffIndex,
      sel.voiceIndex,
    );
    if (!beat) return;
    const voice = beat.voice;

    const restBeat = new alphaTab.model.Beat();
    restBeat.isEmpty = false;
    restBeat.duration = (duration as alphaTab.model.Duration) ?? beat.duration;
    restBeat.notes = [];

    const idx = voice.beats.indexOf(beat);
    if (idx >= 0 && idx < voice.beats.length - 1) {
      voice.beats.splice(idx + 1, 0, restBeat);
      restBeat.voice = voice;
    } else {
      voice.addBeat(restBeat);
    }
    voice.finish(api.settings);
    applyBarWarningStyles();

    setPendingSelection({
      trackIndex: sel.trackIndex,
      barIndex: sel.barIndex,
      beatIndex: idx >= 0 ? idx + 1 : voice.beats.length - 1,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      string: sel.string,
    });
    api.render();
  },
};

const setRestAction: ActionDefinition<boolean> = {
  id: "edit.beat.setRest",
  i18nKey: "actions.edit.beat.setRest",
  category: "edit.beat",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.beat.setRest.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ isRest: value });
  },
};

const setDurationAction: ActionDefinition<number> = {
  id: "edit.beat.setDuration",
  i18nKey: "actions.edit.beat.setDuration",
  category: "edit.beat",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.beat.setDuration.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ duration: value });
  },
};

const setDotsAction: ActionDefinition<number> = {
  id: "edit.beat.setDots",
  i18nKey: "actions.edit.beat.setDots",
  category: "edit.beat",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.beat.setDots.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ dots: value });
  },
};

const setSlashedAction: ActionDefinition<boolean> = {
  id: "edit.beat.setSlashed",
  i18nKey: "actions.edit.beat.setSlashed",
  category: "edit.beat",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.beat.setSlashed.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ slashed: value });
  },
};

const setDynamicsAction: ActionDefinition<number> = {
  id: "edit.beat.setDynamics",
  i18nKey: "actions.edit.beat.setDynamics",
  category: "edit.beat",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.beat.setDynamics.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ dynamics: value });
  },
};

const setVibratoAction: ActionDefinition<number> = {
  id: "edit.beat.setVibrato",
  i18nKey: "actions.edit.beat.setVibrato",
  category: "edit.beat",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.beat.setVibrato.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ vibrato: value });
  },
};

const setDeadSlappedAction: ActionDefinition<boolean> = {
  id: "edit.beat.setDeadSlapped",
  i18nKey: "actions.edit.beat.setDeadSlapped",
  category: "edit.beat",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.beat.setDeadSlapped.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ deadSlapped: value });
  },
};

const setLegatoOriginAction: ActionDefinition<boolean> = {
  id: "edit.beat.setLegatoOrigin",
  i18nKey: "actions.edit.beat.setLegatoOrigin",
  category: "edit.beat",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.beat.setLegatoOrigin.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ isLegatoOrigin: value });
  },
};

const setTapAction: ActionDefinition<boolean> = {
  id: "edit.beat.setTap",
  i18nKey: "actions.edit.beat.setTap",
  category: "edit.beat",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.beat.setTap.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ tap: value });
  },
};

const setSlapAction: ActionDefinition<boolean> = {
  id: "edit.beat.setSlap",
  i18nKey: "actions.edit.beat.setSlap",
  category: "edit.beat",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.beat.setSlap.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ slap: value });
  },
};

const setPopAction: ActionDefinition<boolean> = {
  id: "edit.beat.setPop",
  i18nKey: "actions.edit.beat.setPop",
  category: "edit.beat",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.beat.setPop.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ pop: value });
  },
};

const setPickStrokeAction: ActionDefinition<number> = {
  id: "edit.beat.setPickStroke",
  i18nKey: "actions.edit.beat.setPickStroke",
  category: "edit.beat",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.beat.setPickStroke.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ pickStroke: value });
  },
};

const setWhammyBarTypeAction: ActionDefinition<number> = {
  id: "edit.beat.setWhammyBarType",
  i18nKey: "actions.edit.beat.setWhammyBarType",
  category: "edit.beat",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.beat.setWhammyBarType.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ whammyBarType: value });
  },
};

const setBrushTypeAction: ActionDefinition<number> = {
  id: "edit.beat.setBrushType",
  i18nKey: "actions.edit.beat.setBrushType",
  category: "edit.beat",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.beat.setBrushType.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ brushType: value });
  },
};

const setCrescendoAction: ActionDefinition<number> = {
  id: "edit.beat.setCrescendo",
  i18nKey: "actions.edit.beat.setCrescendo",
  category: "edit.beat",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.beat.setCrescendo.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ crescendo: value });
  },
};

const setFadeAction: ActionDefinition<number> = {
  id: "edit.beat.setFade",
  i18nKey: "actions.edit.beat.setFade",
  category: "edit.beat",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.beat.setFade.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ fade: value });
  },
};

const setGolpeAction: ActionDefinition<number> = {
  id: "edit.beat.setGolpe",
  i18nKey: "actions.edit.beat.setGolpe",
  category: "edit.beat",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.beat.setGolpe.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ golpe: value });
  },
};

const setWahPedalAction: ActionDefinition<number> = {
  id: "edit.beat.setWahPedal",
  i18nKey: "actions.edit.beat.setWahPedal",
  category: "edit.beat",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.beat.setWahPedal.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ wahPedal: value });
  },
};

const toggleBeatIsEmptyAction: ActionDefinition<void> = {
  id: "edit.beat.toggleEmpty",
  i18nKey: "actions.edit.beat.toggleEmpty",
  category: "edit.beat",
  execute: (_args, _context) => {
    const sel = usePlayerStore.getState().selectedBeat;
    const api = getApi();
    if (!sel || !api) return;

    const beat = resolveBeat(
      sel.trackIndex,
      sel.barIndex,
      sel.beatIndex,
      sel.staffIndex,
      sel.voiceIndex,
    );
    if (!beat) return;

    beat.isEmpty = !beat.isEmpty;
    beat.voice.finish(api.settings);
    applyBarWarningStyles();

    setPendingSelection({
      trackIndex: sel.trackIndex,
      barIndex: sel.barIndex,
      beatIndex: sel.beatIndex,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      string: sel.string,
    });
    api.render();
  },
};

actionRegistry.register(placeNoteAction);
actionRegistry.register(deleteNoteAction);
actionRegistry.register(insertRestBeforeAction);
actionRegistry.register(insertRestAfterAction);
actionRegistry.register(setRestAction);
actionRegistry.register(setDurationAction);
actionRegistry.register(setDotsAction);
actionRegistry.register(setSlashedAction);
actionRegistry.register(setDynamicsAction);
actionRegistry.register(setVibratoAction);
actionRegistry.register(setDeadSlappedAction);
actionRegistry.register(setLegatoOriginAction);
actionRegistry.register(setTapAction);
actionRegistry.register(setSlapAction);
actionRegistry.register(setPopAction);
actionRegistry.register(setPickStrokeAction);
actionRegistry.register(setWhammyBarTypeAction);
actionRegistry.register(setBrushTypeAction);
actionRegistry.register(setCrescendoAction);
actionRegistry.register(setFadeAction);
actionRegistry.register(setGolpeAction);
actionRegistry.register(setWahPedalAction);
actionRegistry.register(toggleBeatIsEmptyAction);

declare global {
  interface ActionMap {
    "edit.beat.placeNote": { args: void; result: void };
    "edit.beat.deleteNote": { args: void; result: boolean };
    "edit.beat.insertRestBefore": { args: number | void; result: void };
    "edit.beat.insertRestAfter": { args: number | void; result: void };
    "edit.beat.setRest": { args: boolean; result: void };
    "edit.beat.setDuration": { args: number; result: void };
    "edit.beat.setDots": { args: number; result: void };
    "edit.beat.setSlashed": { args: boolean; result: void };
    "edit.beat.setDynamics": { args: number; result: void };
    "edit.beat.setVibrato": { args: number; result: void };
    "edit.beat.setDeadSlapped": { args: boolean; result: void };
    "edit.beat.setLegatoOrigin": { args: boolean; result: void };
    "edit.beat.setTap": { args: boolean; result: void };
    "edit.beat.setSlap": { args: boolean; result: void };
    "edit.beat.setPop": { args: boolean; result: void };
    "edit.beat.setPickStroke": { args: number; result: void };
    "edit.beat.setWhammyBarType": { args: number; result: void };
    "edit.beat.setBrushType": { args: number; result: void };
    "edit.beat.setCrescendo": { args: number; result: void };
    "edit.beat.setFade": { args: number; result: void };
    "edit.beat.setGolpe": { args: number; result: void };
    "edit.beat.setWahPedal": { args: number; result: void };
    "edit.beat.toggleEmpty": { args: void; result: void };
  }
}

export {};

