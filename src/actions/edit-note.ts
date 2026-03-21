import * as Y from "yjs";
import { actionRegistry } from "./registry";
import type { ActionDefinition } from "./types";
import {
  getApi,
  resolveBeat,
  gp7IdToPercussionArticulation,
  resolveGp7Id,
} from "@/stores/render-internals";
import { engine } from "@/core/engine";
import { useEditorStore } from "@/stores/editor-store";
import { debugLog } from "@/core/editor/action-log";
import { createNote } from "@/core/schema";

const transact = (fn: () => void) => engine.localEditYDoc(fn);

function applyNoteUpdates(updates: Record<string, unknown>): void {
  const sel = useEditorStore.getState().selectedBeat;
  const noteIndex = useEditorStore.getState().selectedNoteIndex;
  if (!sel || noteIndex < 0) {
    debugLog("debug", "edit.note.applyNoteUpdates", "no selection or note index", {
      updates,
      hasSelection: !!sel,
      noteIndex,
    });
    return;
  }
  const yNote = engine.resolveYNote(
    sel.trackIndex,
    sel.staffIndex,
    sel.barIndex,
    sel.voiceIndex,
    sel.beatIndex,
    noteIndex,
  );
  if (!yNote) {
    debugLog("debug", "edit.note.applyNoteUpdates", "no Y.Note resolved", {
      updates,
      sel,
      noteIndex,
    });
    return;
  }
  transact(() => {
    for (const [key, value] of Object.entries(updates)) {
      yNote.set(key, value);
    }
  });
}

const setTieAction: ActionDefinition<boolean> = {
  id: "edit.note.setTie",
  i18nKey: "actions.edit.note.setTie",
  category: "edit.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setTie.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ isTieDestination: value });
  },
};

const setGhostAction: ActionDefinition<boolean> = {
  id: "edit.note.setGhost",
  i18nKey: "actions.edit.note.setGhost",
  category: "edit.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setGhost.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ isGhost: value });
  },
};

const setDeadAction: ActionDefinition<boolean> = {
  id: "edit.note.setDead",
  i18nKey: "actions.edit.note.setDead",
  category: "edit.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setDead.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ isDead: value });
  },
};

const setAccentAction: ActionDefinition<number> = {
  id: "edit.note.setAccent",
  i18nKey: "actions.edit.note.setAccent",
  category: "edit.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setAccent.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ accentuated: value });
  },
};

const setStaccatoAction: ActionDefinition<boolean> = {
  id: "edit.note.setStaccato",
  i18nKey: "actions.edit.note.setStaccato",
  category: "edit.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setStaccato.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ isStaccato: value });
  },
};

const setLetRingAction: ActionDefinition<boolean> = {
  id: "edit.note.setLetRing",
  i18nKey: "actions.edit.note.setLetRing",
  category: "edit.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setLetRing.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ isLetRing: value });
  },
};

const setPalmMuteAction: ActionDefinition<boolean> = {
  id: "edit.note.setPalmMute",
  i18nKey: "actions.edit.note.setPalmMute",
  category: "edit.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setPalmMute.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ isPalmMute: value });
  },
};

const setHammerPullAction: ActionDefinition<boolean> = {
  id: "edit.note.setHammerPull",
  i18nKey: "actions.edit.note.setHammerPull",
  category: "edit.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setHammerPull.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ isHammerPullOrigin: value });
  },
};

const setVibratoAction: ActionDefinition<number> = {
  id: "edit.note.setVibrato",
  i18nKey: "actions.edit.note.setVibrato",
  category: "edit.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setVibrato.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ vibrato: value });
  },
};

const setBendTypeAction: ActionDefinition<number> = {
  id: "edit.note.setBendType",
  i18nKey: "actions.edit.note.setBendType",
  category: "edit.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setBendType.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ bendType: value });
  },
};

const setSlideOutAction: ActionDefinition<number> = {
  id: "edit.note.setSlideOut",
  i18nKey: "actions.edit.note.setSlideOut",
  category: "edit.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setSlideOut.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ slideOutType: value });
  },
};

const setHarmonicTypeAction: ActionDefinition<number> = {
  id: "edit.note.setHarmonicType",
  i18nKey: "actions.edit.note.setHarmonicType",
  category: "edit.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setHarmonicType.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ harmonicType: value });
  },
};

const setSlideInTypeAction: ActionDefinition<number> = {
  id: "edit.note.setSlideInType",
  i18nKey: "actions.edit.note.setSlideInType",
  category: "edit.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setSlideInType.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ slideInType: value });
  },
};

const setTrillAction: ActionDefinition<{ trillValue: number; trillSpeed: number }> = {
  id: "edit.note.setTrill",
  i18nKey: "actions.edit.note.setTrill",
  category: "edit.note",
  params: [
    { name: "trillValue", type: "number", i18nKey: "actions.edit.note.setTrill.params.trillValue" },
    { name: "trillSpeed", type: "number", i18nKey: "actions.edit.note.setTrill.params.trillSpeed" },
  ],
  execute: ({ trillValue, trillSpeed }, _context) => {
    applyNoteUpdates({ trillValue, trillSpeed });
  },
};

const setOrnamentAction: ActionDefinition<number> = {
  id: "edit.note.setOrnament",
  i18nKey: "actions.edit.note.setOrnament",
  category: "edit.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setOrnament.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ ornament: value });
  },
};

const setLeftHandTappedAction: ActionDefinition<boolean> = {
  id: "edit.note.setLeftHandTapped",
  i18nKey: "actions.edit.note.setLeftHandTapped",
  category: "edit.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setLeftHandTapped.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ isLeftHandTapped: value });
  },
};

const togglePercussionArticulationAction: ActionDefinition<number> = {
  id: "edit.beat.togglePercussionArticulation",
  i18nKey: "actions.edit.beat.togglePercussionArticulation",
  category: "edit.beat",
  params: [{ name: "gp7Id", type: "number", i18nKey: "actions.edit.beat.togglePercussionArticulation.params.gp7Id" }],
  execute: (gp7Id, _context) => {
    const sel = useEditorStore.getState().selectedBeat;
    const api = getApi();
    if (!sel || !api) return;

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
    if (!track?.isPercussion) return;

    const yBeat = engine.resolveYBeat(
      sel.trackIndex,
      sel.staffIndex,
      sel.barIndex,
      sel.voiceIndex,
      sel.beatIndex,
    );
    if (!yBeat) return;
    const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;

    let existingIdx = -1;
    for (let i = 0; i < beat.notes.length; i++) {
      if (resolveGp7Id(beat.notes[i]) === gp7Id) {
        existingIdx = i;
        break;
      }
    }

    transact(() => {
      if (existingIdx >= 0) {
        yNotes.delete(existingIdx, 1);
      } else {
        const yNote = createNote(-1, -1);
        yNote.set("percussionArticulation", gp7IdToPercussionArticulation(track, gp7Id));
        yNotes.push([yNote]);
        yBeat.set("isEmpty", false);
      }
    });
  },
};

actionRegistry.register(setTieAction);
actionRegistry.register(setGhostAction);
actionRegistry.register(setDeadAction);
actionRegistry.register(setAccentAction);
actionRegistry.register(setStaccatoAction);
actionRegistry.register(setLetRingAction);
actionRegistry.register(setPalmMuteAction);
actionRegistry.register(setHammerPullAction);
actionRegistry.register(setVibratoAction);
actionRegistry.register(setBendTypeAction);
actionRegistry.register(setSlideOutAction);
actionRegistry.register(setHarmonicTypeAction);
actionRegistry.register(setSlideInTypeAction);
actionRegistry.register(setTrillAction);
actionRegistry.register(setOrnamentAction);
actionRegistry.register(setLeftHandTappedAction);
actionRegistry.register(togglePercussionArticulationAction);

declare global {
  interface ActionMap {
    "edit.note.setTie": { args: boolean; result: void };
    "edit.note.setGhost": { args: boolean; result: void };
    "edit.note.setDead": { args: boolean; result: void };
    "edit.note.setAccent": { args: number; result: void };
    "edit.note.setStaccato": { args: boolean; result: void };
    "edit.note.setLetRing": { args: boolean; result: void };
    "edit.note.setPalmMute": { args: boolean; result: void };
    "edit.note.setHammerPull": { args: boolean; result: void };
    "edit.note.setVibrato": { args: number; result: void };
    "edit.note.setBendType": { args: number; result: void };
    "edit.note.setSlideOut": { args: number; result: void };
    "edit.note.setHarmonicType": { args: number; result: void };
    "edit.note.setSlideInType": { args: number; result: void };
    "edit.note.setTrill": {
      args: { trillValue: number; trillSpeed: number };
      result: void;
    };
    "edit.note.setOrnament": { args: number; result: void };
    "edit.note.setLeftHandTapped": { args: boolean; result: void };
    "edit.beat.togglePercussionArticulation": { args: number; result: void };
  }
}

export {};
