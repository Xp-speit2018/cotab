import * as Y from "yjs";
import { documentActionRegistry } from "@/core/actions/registry";
import type { DocumentActionDefinition } from "@/core/actions/types";
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
    debugLog("debug", "document.note.applyNoteUpdates", "no selection or note index", {
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
    debugLog("debug", "document.note.applyNoteUpdates", "no Y.Note resolved", {
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

const setIsTieDestinationAction: DocumentActionDefinition<boolean> = {
  id: "document.note.setIsTieDestination",
  i18nKey: "actions.edit.note.setIsTieDestination",
  category: "document.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setIsTieDestination.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ isTieDestination: value });
  },
};

const setIsGhostAction: DocumentActionDefinition<boolean> = {
  id: "document.note.setIsGhost",
  i18nKey: "actions.edit.note.setIsGhost",
  category: "document.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setIsGhost.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ isGhost: value });
  },
};

const setIsDeadAction: DocumentActionDefinition<boolean> = {
  id: "document.note.setIsDead",
  i18nKey: "actions.edit.note.setIsDead",
  category: "document.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setIsDead.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ isDead: value });
  },
};

const setAccentuatedAction: DocumentActionDefinition<number> = {
  id: "document.note.setAccentuated",
  i18nKey: "actions.edit.note.setAccentuated",
  category: "document.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setAccentuated.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ accentuated: value });
  },
};

const setIsStaccatoAction: DocumentActionDefinition<boolean> = {
  id: "document.note.setIsStaccato",
  i18nKey: "actions.edit.note.setIsStaccato",
  category: "document.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setIsStaccato.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ isStaccato: value });
  },
};

const setIsLetRingAction: DocumentActionDefinition<boolean> = {
  id: "document.note.setIsLetRing",
  i18nKey: "actions.edit.note.setIsLetRing",
  category: "document.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setIsLetRing.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ isLetRing: value });
  },
};

const setIsPalmMuteAction: DocumentActionDefinition<boolean> = {
  id: "document.note.setIsPalmMute",
  i18nKey: "actions.edit.note.setIsPalmMute",
  category: "document.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setIsPalmMute.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ isPalmMute: value });
  },
};

const setIsHammerPullOriginAction: DocumentActionDefinition<boolean> = {
  id: "document.note.setIsHammerPullOrigin",
  i18nKey: "actions.edit.note.setIsHammerPullOrigin",
  category: "document.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setIsHammerPullOrigin.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ isHammerPullOrigin: value });
  },
};

const setVibratoAction: DocumentActionDefinition<number> = {
  id: "document.note.setVibrato",
  i18nKey: "actions.edit.note.setVibrato",
  category: "document.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setVibrato.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ vibrato: value });
  },
};

const setBendTypeAction: DocumentActionDefinition<number> = {
  id: "document.note.setBendType",
  i18nKey: "actions.edit.note.setBendType",
  category: "document.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setBendType.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ bendType: value });
  },
};

const setBendStyleAction: DocumentActionDefinition<number> = {
  id: "document.note.setBendStyle",
  i18nKey: "actions.edit.note.setBendStyle",
  category: "document.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setBendStyle.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ bendStyle: value });
  },
};

const setIsContinuedBendAction: DocumentActionDefinition<boolean> = {
  id: "document.note.setIsContinuedBend",
  i18nKey: "actions.edit.note.setIsContinuedBend",
  category: "document.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setIsContinuedBend.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ isContinuedBend: value });
  },
};

const setBendPointsAction: DocumentActionDefinition<BendPointSchema[] | null> = {
  id: "document.note.setBendPoints",
  i18nKey: "actions.edit.note.setBendPoints",
  category: "document.note",
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

const setBendAction: DocumentActionDefinition<{
  bendType: number;
  bendStyle: number;
  isContinuedBend: boolean;
  bendPoints: BendPointSchema[] | null;
}> = {
  id: "document.note.setBend",
  i18nKey: "actions.edit.note.setBend",
  category: "document.note",
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

const setSlideOutTypeAction: DocumentActionDefinition<number> = {
  id: "document.note.setSlideOutType",
  i18nKey: "actions.edit.note.setSlideOutType",
  category: "document.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setSlideOutType.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ slideOutType: value });
  },
};

const setHarmonicTypeAction: DocumentActionDefinition<number> = {
  id: "document.note.setHarmonicType",
  i18nKey: "actions.edit.note.setHarmonicType",
  category: "document.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setHarmonicType.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ harmonicType: value });
  },
};

const setHarmonicValueAction: DocumentActionDefinition<number> = {
  id: "document.note.setHarmonicValue",
  i18nKey: "actions.edit.note.setHarmonicValue",
  category: "document.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setHarmonicValue.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ harmonicValue: value });
  },
};

const setDynamicsAction: DocumentActionDefinition<number> = {
  id: "document.note.setDynamics",
  i18nKey: "actions.edit.note.setDynamics",
  category: "document.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setDynamics.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ dynamics: value });
  },
};

const setFretAction: DocumentActionDefinition<number> = {
  id: "document.note.setFret",
  i18nKey: "actions.edit.note.setFret",
  category: "document.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setFret.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ fret: value });
  },
};

const setStringAction: DocumentActionDefinition<number> = {
  id: "document.note.setString",
  i18nKey: "actions.edit.note.setString",
  category: "document.note",
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

const setOctaveAction: DocumentActionDefinition<number> = {
  id: "document.note.setOctave",
  i18nKey: "actions.edit.note.setOctave",
  category: "document.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setOctave.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ octave: value });
  },
};

const setToneAction: DocumentActionDefinition<number> = {
  id: "document.note.setTone",
  i18nKey: "actions.edit.note.setTone",
  category: "document.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setTone.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ tone: value });
  },
};

const setPercussionArticulationAction: DocumentActionDefinition<number> = {
  id: "document.note.setPercussionArticulation",
  i18nKey: "actions.edit.note.setPercussionArticulation",
  category: "document.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setPercussionArticulation.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ percussionArticulation: value });
  },
};

const setSlideInTypeAction: DocumentActionDefinition<number> = {
  id: "document.note.setSlideInType",
  i18nKey: "actions.edit.note.setSlideInType",
  category: "document.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setSlideInType.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ slideInType: value });
  },
};

const setTrillAction: DocumentActionDefinition<{ trillValue: number; trillSpeed: number }> = {
  id: "document.note.setTrill",
  i18nKey: "actions.edit.note.setTrill",
  category: "document.note",
  params: [
    { name: "trillValue", type: "number", i18nKey: "actions.edit.note.setTrill.params.trillValue" },
    { name: "trillSpeed", type: "number", i18nKey: "actions.edit.note.setTrill.params.trillSpeed" },
  ],
  execute: ({ trillValue, trillSpeed }, _context) => {
    applyNoteUpdates({ trillValue, trillSpeed });
  },
};

const setOrnamentAction: DocumentActionDefinition<number> = {
  id: "document.note.setOrnament",
  i18nKey: "actions.edit.note.setOrnament",
  category: "document.note",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.note.setOrnament.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ ornament: value });
  },
};

const setIsLeftHandTappedAction: DocumentActionDefinition<boolean> = {
  id: "document.note.setIsLeftHandTapped",
  i18nKey: "actions.edit.note.setIsLeftHandTapped",
  category: "document.note",
  params: [{ name: "value", type: "boolean", i18nKey: "actions.edit.note.setIsLeftHandTapped.params.value" }],
  execute: (value, _context) => {
    applyNoteUpdates({ isLeftHandTapped: value });
  },
};

const togglePercussionArticulationAction: DocumentActionDefinition<number> = {
  id: "document.beat.togglePercussionArticulation",
  i18nKey: "actions.edit.beat.togglePercussionArticulation",
  category: "document.beat",
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

documentActionRegistry.register(setIsTieDestinationAction);
documentActionRegistry.register(setIsGhostAction);
documentActionRegistry.register(setIsDeadAction);
documentActionRegistry.register(setAccentuatedAction);
documentActionRegistry.register(setIsStaccatoAction);
documentActionRegistry.register(setIsLetRingAction);
documentActionRegistry.register(setIsPalmMuteAction);
documentActionRegistry.register(setIsHammerPullOriginAction);
documentActionRegistry.register(setVibratoAction);
documentActionRegistry.register(setBendTypeAction);
documentActionRegistry.register(setBendStyleAction);
documentActionRegistry.register(setIsContinuedBendAction);
documentActionRegistry.register(setBendPointsAction);
documentActionRegistry.register(setBendAction);
documentActionRegistry.register(setSlideOutTypeAction);
documentActionRegistry.register(setHarmonicTypeAction);
documentActionRegistry.register(setHarmonicValueAction);
documentActionRegistry.register(setDynamicsAction);
documentActionRegistry.register(setFretAction);
documentActionRegistry.register(setStringAction);
documentActionRegistry.register(setOctaveAction);
documentActionRegistry.register(setToneAction);
documentActionRegistry.register(setPercussionArticulationAction);
documentActionRegistry.register(setSlideInTypeAction);
documentActionRegistry.register(setTrillAction);
documentActionRegistry.register(setOrnamentAction);
documentActionRegistry.register(setIsLeftHandTappedAction);
documentActionRegistry.register(togglePercussionArticulationAction);

declare global {
  interface DocumentActionMap {
    "document.note.setIsTieDestination": { args: boolean; result: void };
    "document.note.setIsGhost": { args: boolean; result: void };
    "document.note.setIsDead": { args: boolean; result: void };
    "document.note.setAccentuated": { args: number; result: void };
    "document.note.setIsStaccato": { args: boolean; result: void };
    "document.note.setIsLetRing": { args: boolean; result: void };
    "document.note.setIsPalmMute": { args: boolean; result: void };
    "document.note.setIsHammerPullOrigin": { args: boolean; result: void };
    "document.note.setVibrato": { args: number; result: void };
    "document.note.setBendType": { args: number; result: void };
    "document.note.setBendStyle": { args: number; result: void };
    "document.note.setIsContinuedBend": { args: boolean; result: void };
    "document.note.setBendPoints": {
      args: BendPointSchema[] | null;
      result: void;
    };
    "document.note.setBend": {
      args: {
        bendType: number;
        bendStyle: number;
        isContinuedBend: boolean;
        bendPoints: BendPointSchema[] | null;
      };
      result: void;
    };
    "document.note.setSlideOutType": { args: number; result: void };
    "document.note.setHarmonicType": { args: number; result: void };
    "document.note.setHarmonicValue": { args: number; result: void };
    "document.note.setDynamics": { args: number; result: void };
    "document.note.setFret": { args: number; result: void };
    "document.note.setString": { args: number; result: void };
    "document.note.setOctave": { args: number; result: void };
    "document.note.setTone": { args: number; result: void };
    "document.note.setPercussionArticulation": { args: number; result: void };
    "document.note.setSlideInType": { args: number; result: void };
    "document.note.setTrill": {
      args: { trillValue: number; trillSpeed: number };
      result: void;
    };
    "document.note.setOrnament": { args: number; result: void };
    "document.note.setIsLeftHandTapped": { args: boolean; result: void };
    "document.beat.togglePercussionArticulation": { args: number; result: void };
  }
}

export {};
