import * as Y from "yjs";
import { actionRegistry } from "./registry";
import type { ActionDefinition } from "./types";
import { debugLog } from "@/stores/debug-log-store";
import {
  getApi,
  getSnapGrids,
  resolveBeat,
  setPendingSelection,
  formatPitch,
  snapPositionToPitch,
  gp7IdToPercussionArticulation,
  DRUM_STAFFLINE_DEFAULTS,
  GP7_STAFF_LINE_MAP,
} from "@/stores/player-internals";
import { usePlayerStore } from "@/stores/player-store";
import { createBeat, createNote } from "@/core/schema";
import {
  transact,
  resolveYBeat,
  resolveYVoice,
} from "@/core/sync";

function applyBeatUpdates(updates: Record<string, unknown>): void {
  const sel = usePlayerStore.getState().selectedBeat;
  if (!sel) {
    debugLog("debug", "edit.beat.applyBeatUpdates", "no selection", { updates });
    return;
  }
  const yBeat = resolveYBeat(
    sel.trackIndex,
    sel.staffIndex,
    sel.barIndex,
    sel.voiceIndex,
    sel.beatIndex,
  );
  if (!yBeat) {
    debugLog("debug", "edit.beat.applyBeatUpdates", "no Y.Beat resolved", { updates, sel });
    return;
  }
  setPendingSelection({
    trackIndex: sel.trackIndex,
    barIndex: sel.barIndex,
    beatIndex: sel.beatIndex,
    staffIndex: sel.staffIndex,
    voiceIndex: sel.voiceIndex,
    string: sel.string,
  });
  transact(() => {
    for (const [key, value] of Object.entries(updates)) {
      yBeat.set(key, value);
    }
  });
}

const placeNoteAction: ActionDefinition<number | void> = {
  id: "edit.beat.placeNote",
  i18nKey: "actions.edit.beat.placeNote",
  category: "edit.beat",
  params: [{ name: "targetValue", type: "number", i18nKey: "actions.edit.beat.placeNote.params.targetValue" }],
  execute: (targetValue, _context) => {
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

    const yBeat = resolveYBeat(
      sel.trackIndex,
      sel.staffIndex,
      sel.barIndex,
      sel.voiceIndex,
      sel.beatIndex,
    );
    if (!yBeat) return;
    const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;

    setPendingSelection({
      trackIndex: sel.trackIndex,
      barIndex: sel.barIndex,
      beatIndex: sel.beatIndex,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      string: sel.string,
    });

    if (track.isPercussion) {
      const gridKey = `${sel.trackIndex}:${sel.staffIndex}`;
      const grid = getSnapGrids().get(gridKey);
      const observedArtic = grid?.percussionMap?.get(sel.string);

      let percArticulation: number;
      if (observedArtic !== undefined) {
        percArticulation = observedArtic;
      } else {
        const defaultGp7Id = DRUM_STAFFLINE_DEFAULTS[sel.string];
        if (defaultGp7Id !== undefined) {
          percArticulation = gp7IdToPercussionArticulation(track, defaultGp7Id);
        } else {
          const idsAtLine = GP7_STAFF_LINE_MAP.get(sel.string);
          const fallbackId = idsAtLine?.[0] ?? 42;
          percArticulation = gp7IdToPercussionArticulation(track, fallbackId);
        }
      }

      const yNote = createNote(-1, -1);
      yNote.set("percussionArticulation", percArticulation);

      transact(() => {
        yNotes.push([yNote]);
        yBeat.set("isEmpty", false);
      });
    } else if (staff.showTablature && staff.tuning.length > 0) {
      const fret = typeof targetValue === "number" ? targetValue : 1;
      let existingIdx = -1;
      for (let i = 0; i < yNotes.length; i++) {
        if ((yNotes.get(i).get("string") as number) === sel.string) {
          existingIdx = i;
          break;
        }
      }

      transact(() => {
        if (existingIdx >= 0) {
          yNotes.get(existingIdx).set("fret", fret);
        } else {
          const yNote = createNote(fret, sel.string!);
          yNotes.push([yNote]);
        }
        yBeat.set("isEmpty", false);
      });
    } else {
      const position = typeof targetValue === "number" ? targetValue : sel.string;
      const pitch = snapPositionToPitch(beat.voice.bar.clef, position);

      const yNote = createNote(-1, -1);
      yNote.set("octave", pitch.octave);
      yNote.set("tone", pitch.tone);

      debugLog("info", "edit.beat.placeNote", "piano note", {
        trackIndex: sel.trackIndex,
        staffIndex: sel.staffIndex,
        barIndex: sel.barIndex,
        beatIndex: sel.beatIndex,
        snapPosition: position,
        clef: beat.voice.bar.clef as unknown as number,
        octave: pitch.octave,
        tone: pitch.tone,
        pitch: formatPitch(pitch.octave, pitch.tone),
      });

      transact(() => {
        yNotes.push([yNote]);
        yBeat.set("isEmpty", false);
      });
    }
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

    const yVoice = resolveYVoice(
      sel.trackIndex,
      sel.staffIndex,
      sel.barIndex,
      sel.voiceIndex,
    );
    const yBeat = resolveYBeat(
      sel.trackIndex,
      sel.staffIndex,
      sel.barIndex,
      sel.voiceIndex,
      sel.beatIndex,
    );
    if (!yVoice || !yBeat) return false;

    const yBeats = yVoice.get("beats") as Y.Array<Y.Map<unknown>>;
    const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
    const noteIdx = usePlayerStore.getState().selectedNoteIndex;

    if (beat.notes.length === 0 || beat.isRest) {
      if (yBeats.length <= 1) return false;

      const newBeatIdx = Math.min(sel.beatIndex, yBeats.length - 2);
      setPendingSelection({
        trackIndex: sel.trackIndex,
        barIndex: sel.barIndex,
        beatIndex: newBeatIdx,
        staffIndex: sel.staffIndex,
        voiceIndex: sel.voiceIndex,
        string: sel.string,
      });

      transact(() => {
        yBeats.delete(sel.beatIndex, 1);
      });
      return true;
    }

    if (noteIdx < 0 || noteIdx >= beat.notes.length) return false;

    if (beat.notes.length > 1) {
      const newNoteIdx = Math.min(noteIdx, beat.notes.length - 2);
      const nextNote = beat.notes[newNoteIdx >= noteIdx ? newNoteIdx + 1 : newNoteIdx];

      setPendingSelection({
        trackIndex: sel.trackIndex,
        barIndex: sel.barIndex,
        beatIndex: sel.beatIndex,
        staffIndex: sel.staffIndex,
        voiceIndex: sel.voiceIndex,
        string: nextNote?.string ?? sel.string,
      });

      transact(() => {
        yNotes.delete(noteIdx, 1);
      });
    } else {
      setPendingSelection({
        trackIndex: sel.trackIndex,
        barIndex: sel.barIndex,
        beatIndex: sel.beatIndex,
        staffIndex: sel.staffIndex,
        voiceIndex: sel.voiceIndex,
        string: sel.string,
      });

      transact(() => {
        yNotes.delete(0, yNotes.length);
      });
    }

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
    if (!sel) return;

    const beat = resolveBeat(
      sel.trackIndex,
      sel.barIndex,
      sel.beatIndex,
      sel.staffIndex,
      sel.voiceIndex,
    );
    if (!beat) return;

    const yVoice = resolveYVoice(
      sel.trackIndex,
      sel.staffIndex,
      sel.barIndex,
      sel.voiceIndex,
    );
    if (!yVoice) return;

    const dur = typeof duration === "number" ? duration : (beat.duration as unknown as number);
    const restBeat = createBeat(dur);
    restBeat.set("isEmpty", false);

    setPendingSelection({
      trackIndex: sel.trackIndex,
      barIndex: sel.barIndex,
      beatIndex: sel.beatIndex,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      string: sel.string,
    });

    transact(() => {
      const yBeats = yVoice.get("beats") as Y.Array<Y.Map<unknown>>;
      yBeats.insert(sel.beatIndex, [restBeat]);
    });
  },
};

const insertRestAfterAction: ActionDefinition<number | void> = {
  id: "edit.beat.insertRestAfter",
  i18nKey: "actions.edit.beat.insertRestAfter",
  category: "edit.beat",
  params: [{ name: "duration", type: "number", i18nKey: "actions.edit.beat.insertRestAfter.params.duration" }],
  execute: (duration, _context) => {
    const sel = usePlayerStore.getState().selectedBeat;
    if (!sel) return;

    const beat = resolveBeat(
      sel.trackIndex,
      sel.barIndex,
      sel.beatIndex,
      sel.staffIndex,
      sel.voiceIndex,
    );
    if (!beat) return;

    const yVoice = resolveYVoice(
      sel.trackIndex,
      sel.staffIndex,
      sel.barIndex,
      sel.voiceIndex,
    );
    if (!yVoice) return;

    const dur = typeof duration === "number" ? duration : (beat.duration as unknown as number);
    const restBeat = createBeat(dur);
    restBeat.set("isEmpty", false);

    const yBeats = yVoice.get("beats") as Y.Array<Y.Map<unknown>>;
    const insertIdx = sel.beatIndex + 1;

    setPendingSelection({
      trackIndex: sel.trackIndex,
      barIndex: sel.barIndex,
      beatIndex: insertIdx,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      string: sel.string,
    });

    transact(() => {
      yBeats.insert(insertIdx, [restBeat]);
    });
  },
};

const setRestAction: ActionDefinition<boolean> = {
  id: "edit.beat.setRest",
  i18nKey: "actions.edit.beat.setRest",
  category: "edit.beat",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.beat.setRest.params.value" }],
  execute: (value, _context) => {
    const sel = usePlayerStore.getState().selectedBeat;
    const api = getApi();
    if (!sel || !api) return;

    const yBeat = resolveYBeat(
      sel.trackIndex,
      sel.staffIndex,
      sel.barIndex,
      sel.voiceIndex,
      sel.beatIndex,
    );
    if (!yBeat) return;

    setPendingSelection({
      trackIndex: sel.trackIndex,
      barIndex: sel.barIndex,
      beatIndex: sel.beatIndex,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      string: sel.string,
    });

    if (value) {
      transact(() => {
        const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
        if (yNotes.length > 0) {
          yNotes.delete(0, yNotes.length);
        }
        yBeat.set("isEmpty", false);
      });
    } else {
      const track = api.score?.tracks[sel.trackIndex];
      const staff = track?.staves[sel.staffIndex];

      transact(() => {
        if (staff?.showTablature && staff.tuning.length > 0 && sel.string !== null) {
          const yNote = createNote(0, sel.string);
          const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
          yNotes.push([yNote]);
        }
        yBeat.set("isEmpty", false);
      });
    }
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
    if (!sel) return;

    const yBeat = resolveYBeat(
      sel.trackIndex,
      sel.staffIndex,
      sel.barIndex,
      sel.voiceIndex,
      sel.beatIndex,
    );
    if (!yBeat) return;

    const current = (yBeat.get("isEmpty") as boolean) ?? true;

    setPendingSelection({
      trackIndex: sel.trackIndex,
      barIndex: sel.barIndex,
      beatIndex: sel.beatIndex,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      string: sel.string,
    });

    transact(() => {
      yBeat.set("isEmpty", !current);
    });
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
    "edit.beat.placeNote": { args: number | void; result: void };
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
