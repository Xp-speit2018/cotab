import * as Y from "yjs";
import { documentActionRegistry } from "./registry";
import type { DocumentActionDefinition } from "./types";
import { engine } from "@/core/engine";
import type { ChordSchema, TuningSchema } from "@/core/schema";

const transact = (fn: () => void) => engine.localEditYDoc(fn);

const setStaffCapoAction: DocumentActionDefinition<{
  trackIndex: number;
  staffIndex: number;
  capo: number;
}> = {
  id: "document.staff.setCapo",
  i18nKey: "actions.edit.staff.setCapo",
  category: "document.staff",
  params: [
    { name: "trackIndex", type: "number", i18nKey: "actions.edit.staff.setCapo.params.trackIndex" },
    { name: "staffIndex", type: "number", i18nKey: "actions.edit.staff.setCapo.params.staffIndex" },
    { name: "capo", type: "number", i18nKey: "actions.edit.staff.setCapo.params.capo" },
  ],
  execute: ({ trackIndex, staffIndex, capo }, _context) => {
    const yStaff = engine.resolveYStaff(trackIndex, staffIndex);
    if (!yStaff) return;
    transact(() => {
      yStaff.set("capo", capo);
    });
  },
};

const setStaffTranspositionPitchAction: DocumentActionDefinition<{
  trackIndex: number;
  staffIndex: number;
  transpositionPitch: number;
}> = {
  id: "document.staff.setTranspositionPitch",
  i18nKey: "actions.edit.staff.setTranspositionPitch",
  category: "document.staff",
  params: [
    { name: "trackIndex", type: "number", i18nKey: "actions.edit.staff.setTranspositionPitch.params.trackIndex" },
    { name: "staffIndex", type: "number", i18nKey: "actions.edit.staff.setTranspositionPitch.params.staffIndex" },
    { name: "transpositionPitch", type: "number", i18nKey: "actions.edit.staff.setTranspositionPitch.params.transpositionPitch" },
  ],
  execute: ({ trackIndex, staffIndex, transpositionPitch }, _context) => {
    const yStaff = engine.resolveYStaff(trackIndex, staffIndex);
    if (!yStaff) return;
    transact(() => {
      yStaff.set("transpositionPitch", transpositionPitch);
    });
  },
};

const setStaffStringTuningAction: DocumentActionDefinition<{
  trackIndex: number;
  staffIndex: number;
  stringTuning: TuningSchema;
}> = {
  id: "document.staff.setStringTuning",
  i18nKey: "actions.edit.staff.setStringTuning",
  category: "document.staff",
  execute: ({ trackIndex, staffIndex, stringTuning }, _context) => {
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
};

const setStaffIsPercussionAction: DocumentActionDefinition<{
  trackIndex: number;
  staffIndex: number;
  isPercussion: boolean;
}> = {
  id: "document.staff.setIsPercussion",
  i18nKey: "actions.edit.staff.setIsPercussion",
  category: "document.staff",
  params: [
    { name: "trackIndex", type: "number", i18nKey: "actions.edit.staff.setIsPercussion.params.trackIndex" },
    { name: "staffIndex", type: "number", i18nKey: "actions.edit.staff.setIsPercussion.params.staffIndex" },
    { name: "isPercussion", type: "boolean", i18nKey: "actions.edit.staff.setIsPercussion.params.isPercussion" },
  ],
  execute: ({ trackIndex, staffIndex, isPercussion }, _context) => {
    const yStaff = engine.resolveYStaff(trackIndex, staffIndex);
    if (!yStaff) return;
    transact(() => {
      yStaff.set("isPercussion", isPercussion);
    });
  },
};

const setStaffChordAction: DocumentActionDefinition<{
  trackIndex: number;
  staffIndex: number;
  id: string;
  chord: ChordSchema | null;
}> = {
  id: "document.staff.setChord",
  i18nKey: "actions.edit.staff.setChord",
  category: "document.staff",
  execute: ({ trackIndex, staffIndex, id, chord }, _context) => {
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
};

documentActionRegistry.register(setStaffCapoAction);
documentActionRegistry.register(setStaffTranspositionPitchAction);
documentActionRegistry.register(setStaffStringTuningAction);
documentActionRegistry.register(setStaffIsPercussionAction);
documentActionRegistry.register(setStaffChordAction);

declare global {
  interface DocumentActionMap {
    "document.staff.setCapo": {
      args: { trackIndex: number; staffIndex: number; capo: number };
      result: void;
    };
    "document.staff.setTranspositionPitch": {
      args: {
        trackIndex: number;
        staffIndex: number;
        transpositionPitch: number;
      };
      result: void;
    };
    "document.staff.setStringTuning": {
      args: {
        trackIndex: number;
        staffIndex: number;
        stringTuning: TuningSchema;
      };
      result: void;
    };
    "document.staff.setIsPercussion": {
      args: { trackIndex: number; staffIndex: number; isPercussion: boolean };
      result: void;
    };
    "document.staff.setChord": {
      args: {
        trackIndex: number;
        staffIndex: number;
        id: string;
        chord: ChordSchema | null;
      };
      result: void;
    };
  }
}

export {};
