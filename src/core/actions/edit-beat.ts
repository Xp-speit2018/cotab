import * as Y from "yjs";
import * as z from "zod";
import {
  actionArgs,
  defineDocumentAction,
  emptyActionArgs,
} from "@/core/actions/definition";
import {
  automationSchema,
  bendPointSchema,
  finiteNumber,
  integer,
  tremoloPickingSchema,
  valueBooleanArgs,
  valueIntegerArgs,
} from "@/core/actions/args-schema";
import { debugLog } from "@/core/editor/action-log";
import { engine, type PendingSelection, type SelectedBeat } from "@/core/engine";
import {
  createBeat,
  createNote,
  type BendPointSchema,
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
    debugLog("debug", "document.beat.applyBeatUpdates", "no selection", { updates });
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
    debugLog("debug", "document.beat.applyBeatUpdates", "no Y.Beat resolved", { updates, sel });
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

const placeNoteAction = defineDocumentAction({
  id: "document.beat.placeNote",
  i18nKey: "actions.edit.beat.placeNote",
  category: "document.beat",
  argsSchema: actionArgs({ targetValue: finiteNumber.optional() }),
  execute: ({ targetValue }) => {
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

      debugLog("info", "document.beat.placeNote", "piano note", {
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
});

const deleteNoteAction = defineDocumentAction({
  id: "document.beat.deleteNote",
  i18nKey: "actions.edit.beat.deleteNote",
  category: "document.beat",
  argsSchema: emptyActionArgs,
  execute: (): boolean => {
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
});

const insertRestBeforeAction = defineDocumentAction({
  id: "document.beat.insertRestBefore",
  i18nKey: "actions.edit.beat.insertRestBefore",
  category: "document.beat",
  argsSchema: actionArgs({ duration: integer.optional() }),
  execute: ({ duration }) => {
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
});

const insertRestAfterAction = defineDocumentAction({
  id: "document.beat.insertRestAfter",
  i18nKey: "actions.edit.beat.insertRestAfter",
  category: "document.beat",
  argsSchema: actionArgs({ duration: integer.optional() }),
  execute: ({ duration }) => {
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
});

const setRestAction = defineDocumentAction({
  id: "document.beat.setRest",
  i18nKey: "actions.edit.beat.setRest",
  category: "document.beat",
  argsSchema: valueBooleanArgs,
  execute: ({ value }) => {
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
});

function beatI18nKey(id: `document.beat.${string}`): string {
  return id.replace("document.beat.", "actions.edit.beat.");
}

function defineIntegerBeatFieldAction<const Id extends `document.beat.${string}`>(
  id: Id,
  field: string,
) {
  return defineDocumentAction({
    id,
    i18nKey: beatI18nKey(id),
    category: "document.beat",
    argsSchema: valueIntegerArgs,
    execute: ({ value }) => applyBeatUpdates({ [field]: value }),
  });
}

function defineBooleanBeatFieldAction<const Id extends `document.beat.${string}`>(
  id: Id,
  field: string,
) {
  return defineDocumentAction({
    id,
    i18nKey: beatI18nKey(id),
    category: "document.beat",
    argsSchema: valueBooleanArgs,
    execute: ({ value }) => applyBeatUpdates({ [field]: value }),
  });
}

const setDurationAction = defineIntegerBeatFieldAction(
  "document.beat.setDuration",
  "duration",
);
const setDotsAction = defineIntegerBeatFieldAction(
  "document.beat.setDots",
  "dots",
);
const setIsEmptyAction = defineBooleanBeatFieldAction(
  "document.beat.setIsEmpty",
  "isEmpty",
);
const setTupletNumeratorAction = defineIntegerBeatFieldAction(
  "document.beat.setTupletNumerator",
  "tupletNumerator",
);
const setTupletDenominatorAction = defineIntegerBeatFieldAction(
  "document.beat.setTupletDenominator",
  "tupletDenominator",
);

const setTupletAction = defineDocumentAction({
  id: "document.beat.setTuplet",
  i18nKey: "actions.edit.beat.setTuplet",
  category: "document.beat",
  argsSchema: actionArgs({ numerator: integer, denominator: integer }),
  execute: ({ numerator, denominator }) => {
    applyBeatUpdates({
      tupletNumerator: numerator,
      tupletDenominator: denominator,
    });
  },
});

const setGraceTypeAction = defineIntegerBeatFieldAction(
  "document.beat.setGraceType",
  "graceType",
);
const setDynamicsAction = defineIntegerBeatFieldAction(
  "document.beat.setDynamics",
  "dynamics",
);
const setVibratoAction = defineIntegerBeatFieldAction(
  "document.beat.setVibrato",
  "vibrato",
);
const setDeadSlappedAction = defineBooleanBeatFieldAction(
  "document.beat.setDeadSlapped",
  "deadSlapped",
);
const setWhammyBarTypeAction = defineIntegerBeatFieldAction(
  "document.beat.setWhammyBarType",
  "whammyBarType",
);
const setWhammyStyleAction = defineIntegerBeatFieldAction(
  "document.beat.setWhammyStyle",
  "whammyStyle",
);
const setIsContinuedWhammyAction = defineBooleanBeatFieldAction(
  "document.beat.setIsContinuedWhammy",
  "isContinuedWhammy",
);

const setWhammyBarPointsAction = defineDocumentAction({
  id: "document.beat.setWhammyBarPoints",
  i18nKey: "actions.edit.beat.setWhammyBarPoints",
  category: "document.beat",
  argsSchema: actionArgs({ points: z.array(bendPointSchema).nullable() }),
  execute: ({ points }) => {
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
});

const setWhammyBarAction = defineDocumentAction({
  id: "document.beat.setWhammyBar",
  i18nKey: "actions.edit.beat.setWhammyBar",
  category: "document.beat",
  argsSchema: actionArgs({
    whammyBarType: integer,
    whammyStyle: integer,
    isContinuedWhammy: z.boolean(),
    whammyBarPoints: z.array(bendPointSchema).nullable(),
  }),
  execute: ({
    whammyBarType,
    whammyStyle,
    isContinuedWhammy,
    whammyBarPoints,
  }) => {
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
});

const setBrushTypeAction = defineIntegerBeatFieldAction(
  "document.beat.setBrushType",
  "brushType",
);
const setBrushDurationAction = defineIntegerBeatFieldAction(
  "document.beat.setBrushDuration",
  "brushDuration",
);

const setBrushAction = defineDocumentAction({
  id: "document.beat.setBrush",
  i18nKey: "actions.edit.beat.setBrush",
  category: "document.beat",
  argsSchema: actionArgs({ brushType: integer, brushDuration: integer }),
  execute: ({ brushType, brushDuration }) => {
    applyBeatUpdates({ brushType, brushDuration });
  },
});

const setFadeAction = defineIntegerBeatFieldAction(
  "document.beat.setFade",
  "fade",
);

const setAutomationsAction = defineDocumentAction({
  id: "document.beat.setAutomations",
  i18nKey: "actions.edit.beat.setAutomations",
  category: "document.beat",
  argsSchema: actionArgs({ automations: z.array(automationSchema) }),
  execute: ({ automations }) => {
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
});

const setLyricsAction = defineDocumentAction({
  id: "document.beat.setLyrics",
  i18nKey: "actions.edit.beat.setLyrics",
  category: "document.beat",
  argsSchema: actionArgs({ lyrics: z.array(z.string()).nullable() }),
  execute: ({ lyrics }) => {
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
});

const setTextAction = defineDocumentAction({
  id: "document.beat.setText",
  i18nKey: "actions.edit.beat.setText",
  category: "document.beat",
  argsSchema: actionArgs({ value: z.string().nullable() }),
  execute: ({ value }) => {
    applyBeatUpdates({ text: value });
  },
});

const setChordIdAction = defineDocumentAction({
  id: "document.beat.setChordId",
  i18nKey: "actions.edit.beat.setChordId",
  category: "document.beat",
  argsSchema: actionArgs({ value: z.string().nullable() }),
  execute: ({ value }) => {
    applyBeatUpdates({ chordId: value });
  },
});

const setTremoloPickingAction = defineDocumentAction({
  id: "document.beat.setTremoloPicking",
  i18nKey: "actions.edit.beat.setTremoloPicking",
  category: "document.beat",
  argsSchema: actionArgs({ effect: tremoloPickingSchema.nullable() }),
  execute: ({ effect }) => {
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
});

const setRasgueadoAction = defineIntegerBeatFieldAction(
  "document.beat.setRasgueado",
  "rasgueado",
);

export const beatDocumentActions = [
  placeNoteAction,
  deleteNoteAction,
  insertRestBeforeAction,
  insertRestAfterAction,
  setRestAction,
  setDurationAction,
  setDotsAction,
  setIsEmptyAction,
  setTupletNumeratorAction,
  setTupletDenominatorAction,
  setTupletAction,
  setGraceTypeAction,
  setDynamicsAction,
  setVibratoAction,
  setDeadSlappedAction,
  setWhammyBarTypeAction,
  setWhammyStyleAction,
  setIsContinuedWhammyAction,
  setWhammyBarPointsAction,
  setWhammyBarAction,
  setBrushTypeAction,
  setBrushDurationAction,
  setBrushAction,
  setFadeAction,
  setAutomationsAction,
  setLyricsAction,
  setTextAction,
  setChordIdAction,
  setTremoloPickingAction,
  setRasgueadoAction,
] as const;
