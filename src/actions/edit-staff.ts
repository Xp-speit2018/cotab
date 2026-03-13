import * as Y from "yjs";
import { actionRegistry } from "./registry";
import type { ActionDefinition } from "./types";
import { transact, resolveYStaff } from "@/core/sync";

const setStaffCapoAction: ActionDefinition<{
  trackIndex: number;
  staffIndex: number;
  capo: number;
}> = {
  id: "edit.staff.setCapo",
  i18nKey: "actions.edit.staff.setCapo",
  category: "edit.staff",
  params: [
    { name: "trackIndex", type: "number", i18nKey: "actions.edit.staff.setCapo.params.trackIndex" },
    { name: "staffIndex", type: "number", i18nKey: "actions.edit.staff.setCapo.params.staffIndex" },
    { name: "capo", type: "number", i18nKey: "actions.edit.staff.setCapo.params.capo" },
  ],
  execute: ({ trackIndex, staffIndex, capo }, _context) => {
    const yStaff = resolveYStaff(trackIndex, staffIndex);
    if (!yStaff) return;
    transact(() => {
      yStaff.set("capo", capo);
    });
  },
};

const setStaffTranspositionAction: ActionDefinition<{
  trackIndex: number;
  staffIndex: number;
  semitones: number;
}> = {
  id: "edit.staff.setTransposition",
  i18nKey: "actions.edit.staff.setTransposition",
  category: "edit.staff",
  params: [
    { name: "trackIndex", type: "number", i18nKey: "actions.edit.staff.setTransposition.params.trackIndex" },
    { name: "staffIndex", type: "number", i18nKey: "actions.edit.staff.setTransposition.params.staffIndex" },
    { name: "semitones", type: "number", i18nKey: "actions.edit.staff.setTransposition.params.semitones" },
  ],
  execute: ({ trackIndex, staffIndex, semitones }, _context) => {
    const yStaff = resolveYStaff(trackIndex, staffIndex);
    if (!yStaff) return;
    transact(() => {
      yStaff.set("transpositionPitch", semitones);
    });
  },
};

const setStaffTuningAction: ActionDefinition<{
  trackIndex: number;
  staffIndex: number;
  tuningValues: number[];
}> = {
  id: "edit.staff.setTuning",
  i18nKey: "actions.edit.staff.setTuning",
  category: "edit.staff",
  params: [
    { name: "trackIndex", type: "number", i18nKey: "actions.edit.staff.setTuning.params.trackIndex" },
    { name: "staffIndex", type: "number", i18nKey: "actions.edit.staff.setTuning.params.staffIndex" },
    { name: "tuningValues", type: "string", i18nKey: "actions.edit.staff.setTuning.params.tuningValues" },
  ],
  execute: ({ trackIndex, staffIndex, tuningValues }, _context) => {
    const yStaff = resolveYStaff(trackIndex, staffIndex);
    if (!yStaff) return;
    transact(() => {
      const yTuning = new Y.Array<number>();
      yTuning.push(tuningValues);
      yStaff.set("tuning", yTuning);
    });
  },
};

actionRegistry.register(setStaffCapoAction);
actionRegistry.register(setStaffTranspositionAction);
actionRegistry.register(setStaffTuningAction);

declare global {
  interface ActionMap {
    "edit.staff.setCapo": {
      args: { trackIndex: number; staffIndex: number; capo: number };
      result: void;
    };
    "edit.staff.setTransposition": {
      args: { trackIndex: number; staffIndex: number; semitones: number };
      result: void;
    };
    "edit.staff.setTuning": {
      args: { trackIndex: number; staffIndex: number; tuningValues: number[] };
      result: void;
    };
  }
}

export {};
