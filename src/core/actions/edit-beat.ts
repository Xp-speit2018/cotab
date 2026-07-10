import * as Y from "yjs";
import { actionRegistry } from "@/core/actions/registry";
import type { ActionDefinition } from "@/core/actions/types";
import { debugLog } from "@/core/editor/action-log";
import { engine, type PendingSelection, type SelectedBeat } from "@/core/engine";
import {
  createBeat,
  createNote,
  type AutomationSchema,
  type BendPointSchema,
  type TremoloPickingEffectSchema,
} from "@/core/schema";
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
  const yStringTuning = yStaff.get("stringTuning") as
    | Y.Map<unknown>
    | undefined;
  const tunings = yStringTuning?.get("tunings") as
    | Y.Array<number>
    | undefined;
  return {
    isPercussion: (yStaff.get("isPercussion") as boolean) ?? false,
    showTablature: (yStaff.get("showTablature") as boolean) ?? true,
    tuningLength: tunings?.length ?? 0,
  };
}

function getClef(sel: SelectedBeat): number {
  const yBar = engine.resolveYBar(sel.trackIndex, sel.staffIndex, sel.barIndex);
  return (yBar?.get("clef") as number | undefined) ?? 4;
}

function getPercussionArticulation(
  trackIndex: number,
  staffLine: number,
): number {
  const gp7Id =
    DRUM_STAFFLINE_DEFAULTS[staffLine] ??
    STAFF_LINE_FIRST_GP7_ID[staffLine] ??
    42;
  const yTrack = engine.resolveYTrack(trackIndex);
  const yArticulations = yTrack?.get("percussionArticulations") as
    | Y.Array<Y.Map<unknown>>
    | undefined;
  if (yArticulations && yArticulations.length > 0) {
    for (let i = 0; i < yArticulations.length; i++) {
      if ((yArticulations.get(i).get("id") as number) === gp7Id) return i;
    }
  }
  return gp7Id;
}

function applyBeatUpdates(updates: Record<string, unknown>): void {
  const { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string } = engine.selector;
  if (
    trackIndex === null ||
    staffIndex === null ||
    barIndex === null ||
    voiceIndex === null ||
    beatIndex === null
  ) {
    debugLog("debug", "edit.beat.applyBeatUpdates", "no selection", { updates });
    return;
  }
  const sel: SelectedBeat = { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string };
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

function replaceWhammyBarPoints(
  yBeat: Y.Map<unknown>,
  points: readonly BendPointSchema[] | null,
): void {
  if (points === null) {
    yBeat.set("whammyBarPoints", null);
    return;
  }
  let yPoints = yBeat.get("whammyBarPoints") as
    | Y.Array<Y.Map<unknown>>
    | undefined;
  if (!yPoints) {
    yPoints = new Y.Array<Y.Map<unknown>>();
    yBeat.set("whammyBarPoints", yPoints);
  }
  yPoints.delete(0, yPoints.length);
  for (const point of points) {
    const yPoint = new Y.Map<unknown>();
    yPoint.set("offset", point.offset);
    yPoint.set("value", point.value);
    yPoints.push([yPoint]);
  }
}

const placeNoteAction: ActionDefinition<number | void> = {
  id: "edit.beat.placeNote",
  i18nKey: "actions.edit.beat.placeNote",
  category: "edit.beat",
  params: [{ name: "targetValue", type: "number", i18nKey: "actions.edit.beat.placeNote.params.targetValue" }],
  execute: (targetValue, _context) => {
    const { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string } = engine.selector;
    if (
      trackIndex === null ||
      staffIndex === null ||
      barIndex === null ||
      voiceIndex === null ||
      beatIndex === null ||
      string === null
    ) return;
    const sel: SelectedBeat = { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string };

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
      yNote.set(
        "percussionArticulation",
        getPercussionArticulation(sel.trackIndex, string),
      );

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
      const position = typeof targetValue === "number" ? targetValue : string;
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
    const { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string } = engine.selector;
    if (
      trackIndex === null ||
      staffIndex === null ||
      barIndex === null ||
      voiceIndex === null ||
      beatIndex === null
    ) return false;
    const sel: SelectedBeat = { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string };

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
    const noteIdx = engine.selector.noteIndex;

    if (yNotes.length === 0) {
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
    const { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string } = engine.selector;
    if (
      trackIndex === null ||
      staffIndex === null ||
      barIndex === null ||
      voiceIndex === null ||
      beatIndex === null
    ) return;
    const sel: SelectedBeat = { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string };

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
    const { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string } = engine.selector;
    if (
      trackIndex === null ||
      staffIndex === null ||
      barIndex === null ||
      voiceIndex === null ||
      beatIndex === null
    ) return;
    const sel: SelectedBeat = { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string };

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
    const { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string } = engine.selector;
    if (
      trackIndex === null ||
      staffIndex === null ||
      barIndex === null ||
      voiceIndex === null ||
      beatIndex === null
    ) return;
    const sel: SelectedBeat = { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string };

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

const setIsEmptyAction: ActionDefinition<boolean> = {
  id: "edit.beat.setIsEmpty",
  i18nKey: "actions.edit.beat.setIsEmpty",
  category: "edit.beat",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.beat.setIsEmpty.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ isEmpty: value });
  },
};

const setTupletNumeratorAction: ActionDefinition<number> = {
  id: "edit.beat.setTupletNumerator",
  i18nKey: "actions.edit.beat.setTupletNumerator",
  category: "edit.beat",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.beat.setTupletNumerator.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ tupletNumerator: value });
  },
};

const setTupletDenominatorAction: ActionDefinition<number> = {
  id: "edit.beat.setTupletDenominator",
  i18nKey: "actions.edit.beat.setTupletDenominator",
  category: "edit.beat",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.beat.setTupletDenominator.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ tupletDenominator: value });
  },
};

const setTupletAction: ActionDefinition<{
  numerator: number;
  denominator: number;
}> = {
  id: "edit.beat.setTuplet",
  i18nKey: "actions.edit.beat.setTuplet",
  category: "edit.beat",
  params: [
    { name: "numerator", type: "number", i18nKey: "actions.edit.beat.setTuplet.params.numerator" },
    { name: "denominator", type: "number", i18nKey: "actions.edit.beat.setTuplet.params.denominator" },
  ],
  execute: ({ numerator, denominator }, _context) => {
    applyBeatUpdates({
      tupletNumerator: numerator,
      tupletDenominator: denominator,
    });
  },
};

const setGraceTypeAction: ActionDefinition<number> = {
  id: "edit.beat.setGraceType",
  i18nKey: "actions.edit.beat.setGraceType",
  category: "edit.beat",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.beat.setGraceType.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ graceType: value });
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

const setWhammyBarTypeAction: ActionDefinition<number> = {
  id: "edit.beat.setWhammyBarType",
  i18nKey: "actions.edit.beat.setWhammyBarType",
  category: "edit.beat",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.beat.setWhammyBarType.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ whammyBarType: value });
  },
};

const setWhammyStyleAction: ActionDefinition<number> = {
  id: "edit.beat.setWhammyStyle",
  i18nKey: "actions.edit.beat.setWhammyStyle",
  category: "edit.beat",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.beat.setWhammyStyle.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ whammyStyle: value });
  },
};

const setIsContinuedWhammyAction: ActionDefinition<boolean> = {
  id: "edit.beat.setIsContinuedWhammy",
  i18nKey: "actions.edit.beat.setIsContinuedWhammy",
  category: "edit.beat",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.beat.setIsContinuedWhammy.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ isContinuedWhammy: value });
  },
};

const setWhammyBarPointsAction: ActionDefinition<BendPointSchema[] | null> = {
  id: "edit.beat.setWhammyBarPoints",
  i18nKey: "actions.edit.beat.setWhammyBarPoints",
  category: "edit.beat",
  execute: (points, _context) => {
    const { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string } = engine.selector;
    if (
      trackIndex === null ||
      staffIndex === null ||
      barIndex === null ||
      voiceIndex === null ||
      beatIndex === null
    ) return;
    const selection: SelectedBeat = {
      trackIndex,
      staffIndex,
      barIndex,
      voiceIndex,
      beatIndex,
      string,
    };
    const yBeat = engine.resolveYBeat(
      trackIndex,
      staffIndex,
      barIndex,
      voiceIndex,
      beatIndex,
    );
    if (!yBeat) return;

    transact(() => {
      replaceWhammyBarPoints(yBeat, points);
    }, selection);
  },
};

const setWhammyBarAction: ActionDefinition<{
  whammyBarType: number;
  whammyStyle: number;
  isContinuedWhammy: boolean;
  whammyBarPoints: BendPointSchema[] | null;
}> = {
  id: "edit.beat.setWhammyBar",
  i18nKey: "actions.edit.beat.setWhammyBar",
  category: "edit.beat",
  execute: ({
    whammyBarType,
    whammyStyle,
    isContinuedWhammy,
    whammyBarPoints,
  }, _context) => {
    const { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string } = engine.selector;
    if (
      trackIndex === null ||
      staffIndex === null ||
      barIndex === null ||
      voiceIndex === null ||
      beatIndex === null
    ) return;
    const selection: SelectedBeat = {
      trackIndex,
      staffIndex,
      barIndex,
      voiceIndex,
      beatIndex,
      string,
    };
    const yBeat = engine.resolveYBeat(
      trackIndex,
      staffIndex,
      barIndex,
      voiceIndex,
      beatIndex,
    );
    if (!yBeat) return;
    transact(() => {
      yBeat.set("whammyBarType", whammyBarType);
      yBeat.set("whammyStyle", whammyStyle);
      yBeat.set("isContinuedWhammy", isContinuedWhammy);
      replaceWhammyBarPoints(yBeat, whammyBarPoints);
    }, selection);
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

const setBrushDurationAction: ActionDefinition<number> = {
  id: "edit.beat.setBrushDuration",
  i18nKey: "actions.edit.beat.setBrushDuration",
  category: "edit.beat",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.beat.setBrushDuration.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ brushDuration: value });
  },
};

const setBrushAction: ActionDefinition<{
  brushType: number;
  brushDuration: number;
}> = {
  id: "edit.beat.setBrush",
  i18nKey: "actions.edit.beat.setBrush",
  category: "edit.beat",
  params: [
    { name: "brushType", type: "number", i18nKey: "actions.edit.beat.setBrush.params.brushType" },
    { name: "brushDuration", type: "number", i18nKey: "actions.edit.beat.setBrush.params.brushDuration" },
  ],
  execute: ({ brushType, brushDuration }, _context) => {
    applyBeatUpdates({ brushType, brushDuration });
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

const setAutomationsAction: ActionDefinition<AutomationSchema[]> = {
  id: "edit.beat.setAutomations",
  i18nKey: "actions.edit.beat.setAutomations",
  category: "edit.beat",
  execute: (automations, _context) => {
    const { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string } = engine.selector;
    if (
      trackIndex === null ||
      staffIndex === null ||
      barIndex === null ||
      voiceIndex === null ||
      beatIndex === null
    ) return;
    const selection: SelectedBeat = {
      trackIndex,
      staffIndex,
      barIndex,
      voiceIndex,
      beatIndex,
      string,
    };
    const yBeat = engine.resolveYBeat(
      trackIndex,
      staffIndex,
      barIndex,
      voiceIndex,
      beatIndex,
    );
    if (!yBeat) return;

    transact(() => {
      let yAutomations = yBeat.get("automations") as
        | Y.Array<Y.Map<unknown>>
        | undefined;
      if (!yAutomations) {
        yAutomations = new Y.Array<Y.Map<unknown>>();
        yBeat.set("automations", yAutomations);
      }
      yAutomations.delete(0, yAutomations.length);
      for (const automation of automations) {
        const yAutomation = new Y.Map<unknown>();
        for (const [field, value] of Object.entries(automation)) {
          yAutomation.set(field, value);
        }
        yAutomations.push([yAutomation]);
      }
    }, selection);
  },
};

const setLyricsAction: ActionDefinition<string[] | null> = {
  id: "edit.beat.setLyrics",
  i18nKey: "actions.edit.beat.setLyrics",
  category: "edit.beat",
  execute: (lyrics, _context) => {
    const { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string } = engine.selector;
    if (
      trackIndex === null ||
      staffIndex === null ||
      barIndex === null ||
      voiceIndex === null ||
      beatIndex === null
    ) return;
    const selection: SelectedBeat = {
      trackIndex,
      staffIndex,
      barIndex,
      voiceIndex,
      beatIndex,
      string,
    };
    const yBeat = engine.resolveYBeat(
      trackIndex,
      staffIndex,
      barIndex,
      voiceIndex,
      beatIndex,
    );
    if (!yBeat) return;

    transact(() => {
      if (lyrics === null) {
        yBeat.set("lyrics", null);
        return;
      }
      const yLyrics = new Y.Array<string>();
      yLyrics.push(lyrics);
      yBeat.set("lyrics", yLyrics);
    }, selection);
  },
};

const setTextAction: ActionDefinition<string | null> = {
  id: "edit.beat.setText",
  i18nKey: "actions.edit.beat.setText",
  category: "edit.beat",
  execute: (value, _context) => {
    applyBeatUpdates({ text: value });
  },
};

const setChordIdAction: ActionDefinition<string | null> = {
  id: "edit.beat.setChordId",
  i18nKey: "actions.edit.beat.setChordId",
  category: "edit.beat",
  execute: (value, _context) => {
    applyBeatUpdates({ chordId: value });
  },
};

const setTremoloPickingAction: ActionDefinition<TremoloPickingEffectSchema | null> = {
  id: "edit.beat.setTremoloPicking",
  i18nKey: "actions.edit.beat.setTremoloPicking",
  category: "edit.beat",
  execute: (effect, _context) => {
    const { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string } = engine.selector;
    if (
      trackIndex === null ||
      staffIndex === null ||
      barIndex === null ||
      voiceIndex === null ||
      beatIndex === null
    ) return;
    const selection: SelectedBeat = {
      trackIndex,
      staffIndex,
      barIndex,
      voiceIndex,
      beatIndex,
      string,
    };
    const yBeat = engine.resolveYBeat(
      trackIndex,
      staffIndex,
      barIndex,
      voiceIndex,
      beatIndex,
    );
    if (!yBeat) return;

    transact(() => {
      if (effect === null) {
        yBeat.set("tremoloPicking", null);
        return;
      }
      const yEffect = new Y.Map<unknown>();
      yEffect.set("marks", effect.marks);
      yEffect.set("style", effect.style);
      yBeat.set("tremoloPicking", yEffect);
    }, selection);
  },
};

const setRasgueadoAction: ActionDefinition<number> = {
  id: "edit.beat.setRasgueado",
  i18nKey: "actions.edit.beat.setRasgueado",
  category: "edit.beat",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.beat.setRasgueado.params.value" }],
  execute: (value, _context) => {
    applyBeatUpdates({ rasgueado: value });
  },
};

actionRegistry.register(placeNoteAction);
actionRegistry.register(deleteNoteAction);
actionRegistry.register(insertRestBeforeAction);
actionRegistry.register(insertRestAfterAction);
actionRegistry.register(setRestAction);
actionRegistry.register(setDurationAction);
actionRegistry.register(setDotsAction);
actionRegistry.register(setIsEmptyAction);
actionRegistry.register(setTupletNumeratorAction);
actionRegistry.register(setTupletDenominatorAction);
actionRegistry.register(setTupletAction);
actionRegistry.register(setGraceTypeAction);
actionRegistry.register(setDynamicsAction);
actionRegistry.register(setVibratoAction);
actionRegistry.register(setDeadSlappedAction);
actionRegistry.register(setWhammyBarTypeAction);
actionRegistry.register(setWhammyStyleAction);
actionRegistry.register(setIsContinuedWhammyAction);
actionRegistry.register(setWhammyBarPointsAction);
actionRegistry.register(setWhammyBarAction);
actionRegistry.register(setBrushTypeAction);
actionRegistry.register(setBrushDurationAction);
actionRegistry.register(setBrushAction);
actionRegistry.register(setFadeAction);
actionRegistry.register(setAutomationsAction);
actionRegistry.register(setLyricsAction);
actionRegistry.register(setTextAction);
actionRegistry.register(setChordIdAction);
actionRegistry.register(setTremoloPickingAction);
actionRegistry.register(setRasgueadoAction);

declare global {
  interface ActionMap {
    "edit.beat.placeNote": { args: number | void; result: void };
    "edit.beat.deleteNote": { args: void; result: boolean };
    "edit.beat.insertRestBefore": { args: number | void; result: void };
    "edit.beat.insertRestAfter": { args: number | void; result: void };
    "edit.beat.setRest": { args: boolean; result: void };
    "edit.beat.setDuration": { args: number; result: void };
    "edit.beat.setDots": { args: number; result: void };
    "edit.beat.setIsEmpty": { args: boolean; result: void };
    "edit.beat.setTupletNumerator": { args: number; result: void };
    "edit.beat.setTupletDenominator": { args: number; result: void };
    "edit.beat.setTuplet": {
      args: { numerator: number; denominator: number };
      result: void;
    };
    "edit.beat.setGraceType": { args: number; result: void };
    "edit.beat.setDynamics": { args: number; result: void };
    "edit.beat.setVibrato": { args: number; result: void };
    "edit.beat.setDeadSlapped": { args: boolean; result: void };
    "edit.beat.setWhammyBarType": { args: number; result: void };
    "edit.beat.setWhammyStyle": { args: number; result: void };
    "edit.beat.setIsContinuedWhammy": { args: boolean; result: void };
    "edit.beat.setWhammyBarPoints": {
      args: BendPointSchema[] | null;
      result: void;
    };
    "edit.beat.setWhammyBar": {
      args: {
        whammyBarType: number;
        whammyStyle: number;
        isContinuedWhammy: boolean;
        whammyBarPoints: BendPointSchema[] | null;
      };
      result: void;
    };
    "edit.beat.setBrushType": { args: number; result: void };
    "edit.beat.setBrushDuration": { args: number; result: void };
    "edit.beat.setBrush": {
      args: { brushType: number; brushDuration: number };
      result: void;
    };
    "edit.beat.setFade": { args: number; result: void };
    "edit.beat.setAutomations": { args: AutomationSchema[]; result: void };
    "edit.beat.setLyrics": { args: string[] | null; result: void };
    "edit.beat.setText": { args: string | null; result: void };
    "edit.beat.setChordId": { args: string | null; result: void };
    "edit.beat.setTremoloPicking": {
      args: TremoloPickingEffectSchema | null;
      result: void;
    };
    "edit.beat.setRasgueado": { args: number; result: void };
  }
}

export {};
