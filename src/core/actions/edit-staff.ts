import * as Y from "yjs";
import * as z from "zod";
import { engine } from "@/core/engine";
import { actionArgs, defineDocumentAction } from "./definition";
import {
  chordSchema,
  integer,
  nonNegativeInteger,
  tuningSchema,
} from "./args-schema";

const transact = (fn: () => void) => engine.localEditYDoc(fn);

const setStaffCapoAction = defineDocumentAction({
  id: "document.staff.setCapo",
  i18nKey: "actions.edit.staff.setCapo",
  category: "document.staff",
  argsSchema: actionArgs({
    trackIndex: nonNegativeInteger,
    staffIndex: nonNegativeInteger,
    capo: integer,
  }),
  execute: ({ trackIndex, staffIndex, capo }) => {
    const yStaff = engine.resolveYStaff(trackIndex, staffIndex);
    if (!yStaff) return;
    transact(() => {
      yStaff.set("capo", capo);
    });
  },
});

const setStaffTranspositionPitchAction = defineDocumentAction({
  id: "document.staff.setTranspositionPitch",
  i18nKey: "actions.edit.staff.setTranspositionPitch",
  category: "document.staff",
  argsSchema: actionArgs({
    trackIndex: nonNegativeInteger,
    staffIndex: nonNegativeInteger,
    transpositionPitch: integer,
  }),
  execute: ({ trackIndex, staffIndex, transpositionPitch }) => {
    const yStaff = engine.resolveYStaff(trackIndex, staffIndex);
    if (!yStaff) return;
    transact(() => {
      yStaff.set("transpositionPitch", transpositionPitch);
    });
  },
});

const setStaffStringTuningAction = defineDocumentAction({
  id: "document.staff.setStringTuning",
  i18nKey: "actions.edit.staff.setStringTuning",
  category: "document.staff",
  argsSchema: actionArgs({
    trackIndex: nonNegativeInteger,
    staffIndex: nonNegativeInteger,
    stringTuning: tuningSchema,
  }),
  execute: ({ trackIndex, staffIndex, stringTuning }) => {
    const yStaff = engine.resolveYStaff(trackIndex, staffIndex);
    if (!yStaff) return;
    transact(() => {
      let yStringTuning = yStaff.get("stringTuning") as
        | Y.Map<unknown>
        | undefined;
      if (!yStringTuning) {
        yStringTuning = new Y.Map<unknown>();
        yStaff.set("stringTuning", yStringTuning);
      }
      const yTunings = new Y.Array<number>();
      yTunings.push(stringTuning.tunings);
      yStringTuning.set("tunings", yTunings);
      yStringTuning.set("name", stringTuning.name);
      yStringTuning.set("isStandard", stringTuning.isStandard);
    });
  },
});

const setStaffIsPercussionAction = defineDocumentAction({
  id: "document.staff.setIsPercussion",
  i18nKey: "actions.edit.staff.setIsPercussion",
  category: "document.staff",
  argsSchema: actionArgs({
    trackIndex: nonNegativeInteger,
    staffIndex: nonNegativeInteger,
    isPercussion: z.boolean(),
  }),
  execute: ({ trackIndex, staffIndex, isPercussion }) => {
    const yStaff = engine.resolveYStaff(trackIndex, staffIndex);
    if (!yStaff) return;
    transact(() => {
      yStaff.set("isPercussion", isPercussion);
    });
  },
});

const setStaffChordAction = defineDocumentAction({
  id: "document.staff.setChord",
  i18nKey: "actions.edit.staff.setChord",
  category: "document.staff",
  argsSchema: actionArgs({
    trackIndex: nonNegativeInteger,
    staffIndex: nonNegativeInteger,
    id: z.string(),
    chord: chordSchema.nullable(),
  }),
  execute: ({ trackIndex, staffIndex, id, chord }) => {
    const yStaff = engine.resolveYStaff(trackIndex, staffIndex);
    if (!yStaff) return;
    transact(() => {
      let yChords = yStaff.get("chords") as
        | Y.Map<Y.Map<unknown>>
        | null
        | undefined;
      if (chord === null) {
        yChords?.delete(id);
        if (yChords?.size === 0) yStaff.set("chords", null);
        return;
      }
      if (!yChords) {
        yChords = new Y.Map<Y.Map<unknown>>();
        yStaff.set("chords", yChords);
      }
      const yChord = new Y.Map<unknown>();
      yChord.set("name", chord.name);
      yChord.set("firstFret", chord.firstFret);
      const yStrings = new Y.Array<number>();
      yStrings.push(chord.strings);
      yChord.set("strings", yStrings);
      const yBarreFrets = new Y.Array<number>();
      yBarreFrets.push(chord.barreFrets);
      yChord.set("barreFrets", yBarreFrets);
      yChord.set("showName", chord.showName);
      yChord.set("showDiagram", chord.showDiagram);
      yChord.set("showFingering", chord.showFingering);
      yChords.set(id, yChord);
    });
  },
});

export const staffDocumentActions = [
  setStaffCapoAction,
  setStaffTranspositionPitchAction,
  setStaffStringTuningAction,
  setStaffIsPercussionAction,
  setStaffChordAction,
] as const;
