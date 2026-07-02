import * as Y from "yjs";
import { actionRegistry } from "@/core/actions/registry";
import type { ActionDefinition } from "@/core/actions/types";
import { debugLog } from "@/core/editor/action-log";
import { engine, type PendingSelection, type SelectedBeat } from "@/core/engine";
import { createBeat, createNote } from "@/core/schema";
import { formatPitch, snapPositionToPitch } from "@/core/pitch";

const transact = (fn: () => void, nextSelection?: PendingSelection | null) => engine.localEditYDoc(fn, nextSelection);

const DRUM_STAFFLINE_DEFAULTS: Record<number, number> = {
  [-3]: 52,
  [-2]: 49,
  [-1]: 42,
  0: 51,
  1: 50,
  2: 48,
  3: 38,
  4: 47,
  5: 45,
  6: 43,
  7: 36,
  8: 35,
  9: 44,
};

const STAFF_LINE_FIRST_GP7_ID: Record<number, number> = {
  10: 66,
  11: 67,
  12: 68,
  13: 110,
  14: 63,
  15: 109,
  16: 108,
  17: 64,
  18: 115,
  19: 62,
  20: 75,
  21: 85,
  22: 117,
  23: 69,
  24: 116,
  25: 114,
  26: 80,
  27: 81,
  28: 58,
  29: 78,
  30: 79,
  35: 87,
  36: 86,
  37: 74,
  38: 73,
};

function pendingFromSelection(sel: SelectedBeat): PendingSelection {
  return {
    trackIndex: sel.trackIndex,
    barIndex: sel.barIndex,
    beatIndex: sel.beatIndex,
    staffIndex: sel.staffIndex,
    voiceIndex: sel.voiceIndex,
    string: sel.string,
  };
}

function getStaffMode(sel: SelectedBeat): {
  isPercussion: boolean;
  showTablature: boolean;
  tuningLength: number;
} | null {
  const yStaff = engine.resolveYStaff(sel.trackIndex, sel.staffIndex);
  if (!yStaff) return null;
  const tuning = yStaff.get("tuning") as Y.Array<number> | undefined;
  return {
    isPercussion: (yStaff.get("isPercussion") as boolean) ?? false,
    showTablature: (yStaff.get("showTablature") as boolean) ?? true,
    tuningLength: tuning?.length ?? 0,
  };
}

function getClef(sel: SelectedBeat): number {
  const yBar = engine.resolveYBar(sel.trackIndex, sel.staffIndex, sel.barIndex);
  return (yBar?.get("clef") as number | undefined) ?? 4;
}

function getPercussionArticulation(staffLine: number): number {
  return DRUM_STAFFLINE_DEFAULTS[staffLine] ?? STAFF_LINE_FIRST_GP7_ID[staffLine] ?? 42;
}

function applyBeatUpdates(updates: Record<string, unknown>): void {
  const sel = engine.selectedBeat;
  if (!sel) {
    debugLog("debug", "edit.beat.applyBeatUpdates", "no selection", { updates });
    return;
  }
  const yBeat = engine.resolveYBeat(
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
  transact(() => {
    for (const [key, value] of Object.entries(updates)) {
      yBeat.set(key, value);
    }
  }, sel);
}

const placeNoteAction: ActionDefinition<number | void> = {
  id: "edit.beat.placeNote",
  i18nKey: "actions.edit.beat.placeNote",
  category: "edit.beat",
  params: [{ name: "targetValue", type: "number", i18nKey: "actions.edit.beat.placeNote.params.targetValue" }],
  execute: (targetValue, _context) => {
    const sel = engine.selectedBeat;
    if (!sel || sel.string === null) return;

    const staffMode = getStaffMode(sel);
    if (!staffMode) return;

    const yBeat = engine.resolveYBeat(
      sel.trackIndex,
      sel.staffIndex,
      sel.barIndex,
      sel.voiceIndex,
      sel.beatIndex,
    );
    if (!yBeat) return;
    const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
    const pendingSel = pendingFromSelection(sel);

    if (staffMode.isPercussion) {
      const yNote = createNote(-1, -1);
      yNote.set("percussionArticulation", getPercussionArticulation(sel.string));

      transact(() => {
        yNotes.push([yNote]);
        yBeat.set("isEmpty", false);
      }, pendingSel);
    } else if (staffMode.showTablature && staffMode.tuningLength > 0) {
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
      }, pendingSel);
    } else {
      const position = typeof targetValue === "number" ? targetValue : sel.string;
      const clef = getClef(sel);
      const pitch = snapPositionToPitch(clef, position);

      const yNote = createNote(-1, -1);
      yNote.set("octave", pitch.octave);
      yNote.set("tone", pitch.tone);

      debugLog("info", "edit.beat.placeNote", "piano note", {
        trackIndex: sel.trackIndex,
        staffIndex: sel.staffIndex,
        barIndex: sel.barIndex,
        beatIndex: sel.beatIndex,
        snapPosition: position,
        clef,
        octave: pitch.octave,
        tone: pitch.tone,
        pitch: formatPitch(pitch.octave, pitch.tone),
      });

      transact(() => {
        yNotes.push([yNote]);
        yBeat.set("isEmpty", false);
      }, pendingSel);
    }
  },
};

const deleteNoteAction: ActionDefinition<void> = {
  id: "edit.beat.deleteNote",
  i18nKey: "actions.edit.beat.deleteNote",
  category: "edit.beat",
  execute: (_args, _context): boolean => {
    const sel = engine.selectedBeat;
    if (!sel) return false;

    const yVoice = engine.resolveYVoice(
      sel.trackIndex,
      sel.staffIndex,
      sel.barIndex,
      sel.voiceIndex,
    );
    const yBeat = engine.resolveYBeat(
      sel.trackIndex,
      sel.staffIndex,
      sel.barIndex,
      sel.voiceIndex,
      sel.beatIndex,
    );
    if (!yVoice || !yBeat) return false;

    const yBeats = yVoice.get("beats") as Y.Array<Y.Map<unknown>>;
    const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
    const noteIdx = engine.selectedNoteIndex;

    if (yNotes.length === 0 || ((yBeat.get("isRest") as boolean) ?? false)) {
      if (yBeats.length <= 1) return false;

      const newBeatIdx = Math.min(sel.beatIndex, yBeats.length - 2);
      transact(() => {
        yBeats.delete(sel.beatIndex, 1);
      }, {
        trackIndex: sel.trackIndex,
        barIndex: sel.barIndex,
        beatIndex: newBeatIdx,
        staffIndex: sel.staffIndex,
        voiceIndex: sel.voiceIndex,
        string: sel.string,
      });
      return true;
    }

    if (noteIdx < 0 || noteIdx >= yNotes.length) return false;

    if (yNotes.length > 1) {
      const newNoteIdx = Math.min(noteIdx, yNotes.length - 2);
      const nextNote = yNotes.get(newNoteIdx >= noteIdx ? newNoteIdx + 1 : newNoteIdx);

      transact(() => {
        yNotes.delete(noteIdx, 1);
      }, {
        trackIndex: sel.trackIndex,
        barIndex: sel.barIndex,
        beatIndex: sel.beatIndex,
        staffIndex: sel.staffIndex,
        voiceIndex: sel.voiceIndex,
        string: (nextNote?.get("string") as number | undefined) ?? sel.string,
      });
    } else {
      transact(() => {
        yNotes.delete(0, yNotes.length);
      }, {
        trackIndex: sel.trackIndex,
        barIndex: sel.barIndex,
        beatIndex: sel.beatIndex,
        staffIndex: sel.staffIndex,
        voiceIndex: sel.voiceIndex,
        string: sel.string,
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
    const sel = engine.selectedBeat;
    if (!sel) return;

    const yBeat = engine.resolveYBeat(
      sel.trackIndex,
      sel.staffIndex,
      sel.barIndex,
      sel.voiceIndex,
      sel.beatIndex,
    );
    if (!yBeat) return;

    const yVoice = engine.resolveYVoice(
      sel.trackIndex,
      sel.staffIndex,
      sel.barIndex,
      sel.voiceIndex,
    );
    if (!yVoice) return;

    const dur = typeof duration === "number" ? duration : ((yBeat.get("duration") as number | undefined) ?? 4);
    const restBeat = createBeat(dur);
    restBeat.set("isEmpty", false);

    transact(() => {
      const yBeats = yVoice.get("beats") as Y.Array<Y.Map<unknown>>;
      yBeats.insert(sel.beatIndex, [restBeat]);
    }, sel);
  },
};

const insertRestAfterAction: ActionDefinition<number | void> = {
  id: "edit.beat.insertRestAfter",
  i18nKey: "actions.edit.beat.insertRestAfter",
  category: "edit.beat",
  params: [{ name: "duration", type: "number", i18nKey: "actions.edit.beat.insertRestAfter.params.duration" }],
  execute: (duration, _context) => {
    const sel = engine.selectedBeat;
    if (!sel) return;

    const yBeat = engine.resolveYBeat(
      sel.trackIndex,
      sel.staffIndex,
      sel.barIndex,
      sel.voiceIndex,
      sel.beatIndex,
    );
    if (!yBeat) return;

    const yVoice = engine.resolveYVoice(
      sel.trackIndex,
      sel.staffIndex,
      sel.barIndex,
      sel.voiceIndex,
    );
    if (!yVoice) return;

    const dur = typeof duration === "number" ? duration : ((yBeat.get("duration") as number | undefined) ?? 4);
    const restBeat = createBeat(dur);
    restBeat.set("isEmpty", false);

    const yBeats = yVoice.get("beats") as Y.Array<Y.Map<unknown>>;
    const insertIdx = sel.beatIndex + 1;

    transact(() => {
      yBeats.insert(insertIdx, [restBeat]);
    }, {
      trackIndex: sel.trackIndex,
      barIndex: sel.barIndex,
      beatIndex: insertIdx,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      string: sel.string,
    });
  },
};

const setRestAction: ActionDefinition<boolean> = {
  id: "edit.beat.setRest",
  i18nKey: "actions.edit.beat.setRest",
  category: "edit.beat",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.beat.setRest.params.value" }],
  execute: (value, _context) => {
    const sel = engine.selectedBeat;
    if (!sel) return;

    const yBeat = engine.resolveYBeat(
      sel.trackIndex,
      sel.staffIndex,
      sel.barIndex,
      sel.voiceIndex,
      sel.beatIndex,
    );
    if (!yBeat) return;

    const pendingSel = pendingFromSelection(sel);

    if (value) {
      transact(() => {
        const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
        if (yNotes.length > 0) {
          yNotes.delete(0, yNotes.length);
        }
        yBeat.set("isEmpty", false);
      }, pendingSel);
    } else {
      const staffMode = getStaffMode(sel);

      transact(() => {
        if (staffMode?.showTablature && staffMode.tuningLength > 0 && sel.string !== null) {
          const yNote = createNote(0, sel.string);
          const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
          yNotes.push([yNote]);
        }
        yBeat.set("isEmpty", false);
      }, pendingSel);
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
    const sel = engine.selectedBeat;
    if (!sel) return;

    const yBeat = engine.resolveYBeat(
      sel.trackIndex,
      sel.staffIndex,
      sel.barIndex,
      sel.voiceIndex,
      sel.beatIndex,
    );
    if (!yBeat) return;

    const current = (yBeat.get("isEmpty") as boolean) ?? true;

    transact(() => {
      yBeat.set("isEmpty", !current);
    }, sel);
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
