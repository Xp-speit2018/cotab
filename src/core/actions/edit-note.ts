import * as Y from "yjs";
import { actionRegistry } from "@/core/actions/registry";
import type { ActionDefinition } from "@/core/actions/types";
import { engine } from "@/core/engine";
import { debugLog } from "@/core/editor/action-log";
import { createNote, type BendPointSchema } from "@/core/schema";

const transact = (fn: () => void) => engine.localEditYDoc(fn);

function applyNoteUpdates(updates: Record<string, unknown>): void {
  const {
    trackIndex,
    staffIndex,
    barIndex,
    voiceIndex,
    beatIndex,
    noteIndex,
  } = engine.selector;
  if (
    trackIndex === null ||
    staffIndex === null ||
    barIndex === null ||
    voiceIndex === null ||
    beatIndex === null ||
    noteIndex < 0
  ) {
    debugLog("debug", "edit.note.applyNoteUpdates", "no selection or note index", {
      updates,
      hasSelection: trackIndex !== null && staffIndex !== null && barIndex !== null && voiceIndex !== null && beatIndex !== null,
      noteIndex,
    });
    return;
  }
  const yNote = engine.resolveYNote(
    trackIndex,
    staffIndex,
    barIndex,
    voiceIndex,
    beatIndex,
    noteIndex,
  );
  if (!yNote) {
    debugLog("debug", "edit.note.applyNoteUpdates", "no Y.Note resolved", {
      updates,
      trackIndex,
      staffIndex,
      barIndex,
      voiceIndex,
      beatIndex,
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

function replaceBendPoints(
  yNote: Y.Map<unknown>,
  points: readonly BendPointSchema[] | null,
): void {
  if (points === null) {
    yNote.set("bendPoints", null);
    return;
  }
  let yPoints = yNote.get("bendPoints") as
    | Y.Array<Y.Map<unknown>>
    | undefined;
  if (!yPoints) {
    yPoints = new Y.Array<Y.Map<unknown>>();
    yNote.set("bendPoints", yPoints);
  }
  yPoints.delete(0, yPoints.length);
  for (const point of points) {
    const yPoint = new Y.Map<unknown>();
    yPoint.set("offset", point.offset);
    yPoint.set("value", point.value);
    yPoints.push([yPoint]);
  }
}

const setIsTieDestinationAction: ActionDefinition<boolean> = {
  id: "edit.note.setIsTieDestination",
  i18nKey: "actions.edit.note.setIsTieDestination",
  category: "edit.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setIsTieDestination.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ isTieDestination: value });
  },
};

const setIsGhostAction: ActionDefinition<boolean> = {
  id: "edit.note.setIsGhost",
  i18nKey: "actions.edit.note.setIsGhost",
  category: "edit.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setIsGhost.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ isGhost: value });
  },
};

const setIsDeadAction: ActionDefinition<boolean> = {
  id: "edit.note.setIsDead",
  i18nKey: "actions.edit.note.setIsDead",
  category: "edit.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setIsDead.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ isDead: value });
  },
};

const setAccentuatedAction: ActionDefinition<number> = {
  id: "edit.note.setAccentuated",
  i18nKey: "actions.edit.note.setAccentuated",
  category: "edit.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setAccentuated.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ accentuated: value });
  },
};

const setIsStaccatoAction: ActionDefinition<boolean> = {
  id: "edit.note.setIsStaccato",
  i18nKey: "actions.edit.note.setIsStaccato",
  category: "edit.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setIsStaccato.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ isStaccato: value });
  },
};

const setIsLetRingAction: ActionDefinition<boolean> = {
  id: "edit.note.setIsLetRing",
  i18nKey: "actions.edit.note.setIsLetRing",
  category: "edit.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setIsLetRing.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ isLetRing: value });
  },
};

const setIsPalmMuteAction: ActionDefinition<boolean> = {
  id: "edit.note.setIsPalmMute",
  i18nKey: "actions.edit.note.setIsPalmMute",
  category: "edit.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setIsPalmMute.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ isPalmMute: value });
  },
};

const setIsHammerPullOriginAction: ActionDefinition<boolean> = {
  id: "edit.note.setIsHammerPullOrigin",
  i18nKey: "actions.edit.note.setIsHammerPullOrigin",
  category: "edit.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setIsHammerPullOrigin.params.value" }],
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

const setBendStyleAction: ActionDefinition<number> = {
  id: "edit.note.setBendStyle",
  i18nKey: "actions.edit.note.setBendStyle",
  category: "edit.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setBendStyle.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ bendStyle: value });
  },
};

const setIsContinuedBendAction: ActionDefinition<boolean> = {
  id: "edit.note.setIsContinuedBend",
  i18nKey: "actions.edit.note.setIsContinuedBend",
  category: "edit.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setIsContinuedBend.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ isContinuedBend: value });
  },
};

const setBendPointsAction: ActionDefinition<BendPointSchema[] | null> = {
  id: "edit.note.setBendPoints",
  i18nKey: "actions.edit.note.setBendPoints",
  category: "edit.note",
  execute: (points, _context) => {
    const {
      trackIndex,
      staffIndex,
      barIndex,
      voiceIndex,
      beatIndex,
      noteIndex,
    } = engine.selector;
    if (
      trackIndex === null ||
      staffIndex === null ||
      barIndex === null ||
      voiceIndex === null ||
      beatIndex === null ||
      noteIndex < 0
    ) return;

    const yNote = engine.resolveYNote(
      trackIndex,
      staffIndex,
      barIndex,
      voiceIndex,
      beatIndex,
      noteIndex,
    );
    if (!yNote) return;

    transact(() => {
      replaceBendPoints(yNote, points);
    });
  },
};

const setBendAction: ActionDefinition<{
  bendType: number;
  bendStyle: number;
  isContinuedBend: boolean;
  bendPoints: BendPointSchema[] | null;
}> = {
  id: "edit.note.setBend",
  i18nKey: "actions.edit.note.setBend",
  category: "edit.note",
  execute: ({ bendType, bendStyle, isContinuedBend, bendPoints }, _context) => {
    const {
      trackIndex,
      staffIndex,
      barIndex,
      voiceIndex,
      beatIndex,
      noteIndex,
    } = engine.selector;
    if (
      trackIndex === null ||
      staffIndex === null ||
      barIndex === null ||
      voiceIndex === null ||
      beatIndex === null ||
      noteIndex < 0
    ) return;
    const yNote = engine.resolveYNote(
      trackIndex,
      staffIndex,
      barIndex,
      voiceIndex,
      beatIndex,
      noteIndex,
    );
    if (!yNote) return;
    transact(() => {
      yNote.set("bendType", bendType);
      yNote.set("bendStyle", bendStyle);
      yNote.set("isContinuedBend", isContinuedBend);
      replaceBendPoints(yNote, bendPoints);
    });
  },
};

const setSlideOutTypeAction: ActionDefinition<number> = {
  id: "edit.note.setSlideOutType",
  i18nKey: "actions.edit.note.setSlideOutType",
  category: "edit.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setSlideOutType.params.value" }],
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

const setHarmonicValueAction: ActionDefinition<number> = {
  id: "edit.note.setHarmonicValue",
  i18nKey: "actions.edit.note.setHarmonicValue",
  category: "edit.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setHarmonicValue.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ harmonicValue: value });
  },
};

const setDynamicsAction: ActionDefinition<number> = {
  id: "edit.note.setDynamics",
  i18nKey: "actions.edit.note.setDynamics",
  category: "edit.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setDynamics.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ dynamics: value });
  },
};

const setFretAction: ActionDefinition<number> = {
  id: "edit.note.setFret",
  i18nKey: "actions.edit.note.setFret",
  category: "edit.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setFret.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ fret: value });
  },
};

const setStringAction: ActionDefinition<number> = {
  id: "edit.note.setString",
  i18nKey: "actions.edit.note.setString",
  category: "edit.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setString.params.value" }],
  execute: (value, _context) => {
    const {
      trackIndex,
      staffIndex,
      barIndex,
      voiceIndex,
      beatIndex,
      noteIndex,
    } = engine.selector;
    if (
      trackIndex === null ||
      staffIndex === null ||
      barIndex === null ||
      voiceIndex === null ||
      beatIndex === null ||
      noteIndex < 0
    ) return;
    const yNote = engine.resolveYNote(
      trackIndex,
      staffIndex,
      barIndex,
      voiceIndex,
      beatIndex,
      noteIndex,
    );
    if (!yNote) return;
    engine.localEditYDoc(() => {
      yNote.set("string", value);
    }, {
      trackIndex,
      staffIndex,
      barIndex,
      voiceIndex,
      beatIndex,
      string: value,
    });
  },
};

const setOctaveAction: ActionDefinition<number> = {
  id: "edit.note.setOctave",
  i18nKey: "actions.edit.note.setOctave",
  category: "edit.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setOctave.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ octave: value });
  },
};

const setToneAction: ActionDefinition<number> = {
  id: "edit.note.setTone",
  i18nKey: "actions.edit.note.setTone",
  category: "edit.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setTone.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ tone: value });
  },
};

const setPercussionArticulationAction: ActionDefinition<number> = {
  id: "edit.note.setPercussionArticulation",
  i18nKey: "actions.edit.note.setPercussionArticulation",
  category: "edit.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setPercussionArticulation.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ percussionArticulation: value });
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

const setIsLeftHandTappedAction: ActionDefinition<boolean> = {
  id: "edit.note.setIsLeftHandTapped",
  i18nKey: "actions.edit.note.setIsLeftHandTapped",
  category: "edit.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setIsLeftHandTapped.params.value" }],
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
    const { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex } = engine.selector;
    if (
      trackIndex === null ||
      staffIndex === null ||
      barIndex === null ||
      voiceIndex === null ||
      beatIndex === null
    ) return;

    const yStaff = engine.resolveYStaff(trackIndex, staffIndex);
    if (!((yStaff?.get("isPercussion") as boolean | undefined) ?? false)) return;

    const yBeat = engine.resolveYBeat(
      trackIndex,
      staffIndex,
      barIndex,
      voiceIndex,
      beatIndex,
    );
    if (!yBeat) return;
    const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
    const yTrack = engine.resolveYTrack(trackIndex);
    const yArticulations = yTrack?.get("percussionArticulations") as
      | Y.Array<Y.Map<unknown>>
      | undefined;
    let percussionArticulation = gp7Id;
    if (yArticulations && yArticulations.length > 0) {
      for (let i = 0; i < yArticulations.length; i++) {
        if ((yArticulations.get(i).get("id") as number) === gp7Id) {
          percussionArticulation = i;
          break;
        }
      }
    }

    let existingIdx = -1;
    for (let i = 0; i < yNotes.length; i++) {
      if (
        ((yNotes.get(i).get("percussionArticulation") as
          | number
          | undefined) ?? -1) === percussionArticulation
      ) {
        existingIdx = i;
        break;
      }
    }

    transact(() => {
      if (existingIdx >= 0) {
        yNotes.delete(existingIdx, 1);
      } else {
        const yNote = createNote(-1, -1);
        yNote.set("percussionArticulation", percussionArticulation);
        yNotes.push([yNote]);
        yBeat.set("isEmpty", false);
      }
    });
  },
};

actionRegistry.register(setIsTieDestinationAction);
actionRegistry.register(setIsGhostAction);
actionRegistry.register(setIsDeadAction);
actionRegistry.register(setAccentuatedAction);
actionRegistry.register(setIsStaccatoAction);
actionRegistry.register(setIsLetRingAction);
actionRegistry.register(setIsPalmMuteAction);
actionRegistry.register(setIsHammerPullOriginAction);
actionRegistry.register(setVibratoAction);
actionRegistry.register(setBendTypeAction);
actionRegistry.register(setBendStyleAction);
actionRegistry.register(setIsContinuedBendAction);
actionRegistry.register(setBendPointsAction);
actionRegistry.register(setBendAction);
actionRegistry.register(setSlideOutTypeAction);
actionRegistry.register(setHarmonicTypeAction);
actionRegistry.register(setHarmonicValueAction);
actionRegistry.register(setDynamicsAction);
actionRegistry.register(setFretAction);
actionRegistry.register(setStringAction);
actionRegistry.register(setOctaveAction);
actionRegistry.register(setToneAction);
actionRegistry.register(setPercussionArticulationAction);
actionRegistry.register(setSlideInTypeAction);
actionRegistry.register(setTrillAction);
actionRegistry.register(setOrnamentAction);
actionRegistry.register(setIsLeftHandTappedAction);
actionRegistry.register(togglePercussionArticulationAction);

declare global {
  interface ActionMap {
    "edit.note.setIsTieDestination": { args: boolean; result: void };
    "edit.note.setIsGhost": { args: boolean; result: void };
    "edit.note.setIsDead": { args: boolean; result: void };
    "edit.note.setAccentuated": { args: number; result: void };
    "edit.note.setIsStaccato": { args: boolean; result: void };
    "edit.note.setIsLetRing": { args: boolean; result: void };
    "edit.note.setIsPalmMute": { args: boolean; result: void };
    "edit.note.setIsHammerPullOrigin": { args: boolean; result: void };
    "edit.note.setVibrato": { args: number; result: void };
    "edit.note.setBendType": { args: number; result: void };
    "edit.note.setBendStyle": { args: number; result: void };
    "edit.note.setIsContinuedBend": { args: boolean; result: void };
    "edit.note.setBendPoints": {
      args: BendPointSchema[] | null;
      result: void;
    };
    "edit.note.setBend": {
      args: {
        bendType: number;
        bendStyle: number;
        isContinuedBend: boolean;
        bendPoints: BendPointSchema[] | null;
      };
      result: void;
    };
    "edit.note.setSlideOutType": { args: number; result: void };
    "edit.note.setHarmonicType": { args: number; result: void };
    "edit.note.setHarmonicValue": { args: number; result: void };
    "edit.note.setDynamics": { args: number; result: void };
    "edit.note.setFret": { args: number; result: void };
    "edit.note.setString": { args: number; result: void };
    "edit.note.setOctave": { args: number; result: void };
    "edit.note.setTone": { args: number; result: void };
    "edit.note.setPercussionArticulation": { args: number; result: void };
    "edit.note.setSlideInType": { args: number; result: void };
    "edit.note.setTrill": {
      args: { trillValue: number; trillSpeed: number };
      result: void;
    };
    "edit.note.setOrnament": { args: number; result: void };
    "edit.note.setIsLeftHandTapped": { args: boolean; result: void };
    "edit.beat.togglePercussionArticulation": { args: number; result: void };
  }
}

export {};
