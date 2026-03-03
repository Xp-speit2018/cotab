import * as alphaTab from "@coderline/alphatab";
import { actionRegistry } from "./registry";
import type { ActionDefinition } from "./types";
import { getApi, getTrack, extractStaffInfo } from "@/stores/player-internals";
import { usePlayerStore } from "@/stores/player-store";

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
    const api = getApi();
    const track = getTrack(trackIndex);
    if (!api || !track) return;
    const staff = track.staves[staffIndex];
    if (!staff) return;
    staff.capo = capo;
    const sel = usePlayerStore.getState().selectedBeat;
    if (sel && sel.trackIndex === trackIndex) {
      usePlayerStore.setState({ selectedStaffInfo: extractStaffInfo(staff) });
    }
    api.render();
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
    const api = getApi();
    const track = getTrack(trackIndex);
    if (!api || !track) return;
    const staff = track.staves[staffIndex];
    if (!staff) return;
    staff.transpositionPitch = semitones;
    staff.displayTranspositionPitch = semitones;
    const sel = usePlayerStore.getState().selectedBeat;
    if (sel && sel.trackIndex === trackIndex) {
      usePlayerStore.setState({ selectedStaffInfo: extractStaffInfo(staff) });
    }
    api.render();
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
    { name: "tuningValues", type: "string", i18nKey: "actions.edit.staff.setTuning.params.tuningValues" }, // JSON array in docs
  ],
  execute: ({ trackIndex, staffIndex, tuningValues }, _context) => {
    const api = getApi();
    const track = getTrack(trackIndex);
    if (!api || !track) return;
    const staff = track.staves[staffIndex];
    if (!staff) return;
    const found = alphaTab.model.Tuning.findTuning(tuningValues);
    if (found) {
      staff.stringTuning = found;
    } else {
      staff.stringTuning = new alphaTab.model.Tuning(
        undefined,
        tuningValues,
        false,
      );
    }
    const sel = usePlayerStore.getState().selectedBeat;
    if (sel && sel.trackIndex === trackIndex) {
      usePlayerStore.setState({ selectedStaffInfo: extractStaffInfo(staff) });
    }
    api.render();
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

