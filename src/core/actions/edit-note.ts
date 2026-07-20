import * as Y from "yjs";
import * as z from "zod";
import {
  actionArgs,
  defineDocumentAction,
} from "@/core/actions/definition";
import {
  bendPointListSchema,
  finiteNumber,
  integer,
  valueBooleanArgs,
  valueIntegerArgs,
  valueNumberArgs,
} from "@/core/actions/args-schema";
import { engine } from "@/core/engine";
import { debugLog } from "@/core/editor/action-log";
import { BendType, createNote, type BendPointSchema } from "@/core/schema";

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

function noteI18nKey(id: `document.note.${string}`): string {
  return id.replace("document.note.", "actions.edit.note.");
}

function defineBooleanNoteFieldAction<const Id extends `document.note.${string}`>(
  id: Id,
  field: string,
) {
  return defineDocumentAction({
    id,
    i18nKey: noteI18nKey(id),
    category: "document.note",
    argsSchema: valueBooleanArgs,
    execute: ({ value }) => applyNoteUpdates({ [field]: value }),
  });
}

function defineIntegerNoteFieldAction<const Id extends `document.note.${string}`>(
  id: Id,
  field: string,
) {
  return defineDocumentAction({
    id,
    i18nKey: noteI18nKey(id),
    category: "document.note",
    argsSchema: valueIntegerArgs,
    execute: ({ value }) => applyNoteUpdates({ [field]: value }),
  });
}

const setIsTieDestinationAction = defineBooleanNoteFieldAction(
  "document.note.setIsTieDestination",
  "isTieDestination",
);
const setIsGhostAction = defineBooleanNoteFieldAction(
  "document.note.setIsGhost",
  "isGhost",
);
const setIsDeadAction = defineBooleanNoteFieldAction(
  "document.note.setIsDead",
  "isDead",
);
const setAccentuatedAction = defineIntegerNoteFieldAction(
  "document.note.setAccentuated",
  "accentuated",
);
const setIsStaccatoAction = defineBooleanNoteFieldAction(
  "document.note.setIsStaccato",
  "isStaccato",
);
const setIsLetRingAction = defineBooleanNoteFieldAction(
  "document.note.setIsLetRing",
  "isLetRing",
);
const setIsPalmMuteAction = defineBooleanNoteFieldAction(
  "document.note.setIsPalmMute",
  "isPalmMute",
);
const setIsHammerPullOriginAction = defineBooleanNoteFieldAction(
  "document.note.setIsHammerPullOrigin",
  "isHammerPullOrigin",
);
const setVibratoAction = defineIntegerNoteFieldAction(
  "document.note.setVibrato",
  "vibrato",
);
const setBendTypeAction = defineIntegerNoteFieldAction(
  "document.note.setBendType",
  "bendType",
);
const setBendStyleAction = defineIntegerNoteFieldAction(
  "document.note.setBendStyle",
  "bendStyle",
);
const setIsContinuedBendAction = defineBooleanNoteFieldAction(
  "document.note.setIsContinuedBend",
  "isContinuedBend",
);

const bendPointsArgs = actionArgs({
  points: bendPointListSchema.nullable(),
});

const setBendPointsAction = defineDocumentAction({
  id: "document.note.setBendPoints",
  i18nKey: "actions.edit.note.setBendPoints",
  category: "document.note",
  argsSchema: bendPointsArgs,
  execute: ({ points }) => {
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
});

const bendArgs = actionArgs({
  bendType: integer.min(BendType.None).max(BendType.PrebendRelease),
  bendStyle: integer.min(0).max(2),
  isContinuedBend: z.boolean().describe("Whether the curve continues from a previous tied note"),
  bendPoints: bendPointListSchema.nullable().describe(
    "Null for None; BendRelease requires 4 points; Custom accepts 2-16 points; all other enabled bend types require 2 points",
  ),
}).superRefine(({ bendType, bendPoints }, context) => {
  if (bendType === BendType.None) {
    if (bendPoints !== null) {
      context.addIssue({
        code: "custom",
        path: ["bendPoints"],
        message: "A disabled bend must not have points",
      });
    }
    return;
  }
  if (bendPoints === null) {
    context.addIssue({
      code: "custom",
      path: ["bendPoints"],
      message: "An enabled bend requires points",
    });
    return;
  }
  const expectedCount = bendType === BendType.BendRelease ? 4
    : bendType === BendType.Custom ? null
    : 2;
  if (expectedCount !== null && bendPoints.length !== expectedCount) {
    context.addIssue({
      code: "custom",
      path: ["bendPoints"],
      message: `Bend type ${bendType} requires ${expectedCount} points`,
    });
  }
});

const setBendAction = defineDocumentAction({
  id: "document.note.setBend",
  i18nKey: "actions.edit.note.setBend",
  category: "document.note",
  argsSchema: bendArgs,
  execute: ({ bendType, bendStyle, isContinuedBend, bendPoints }) => {
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
});

const setSlideOutTypeAction = defineIntegerNoteFieldAction(
  "document.note.setSlideOutType",
  "slideOutType",
);
const setHarmonicTypeAction = defineIntegerNoteFieldAction(
  "document.note.setHarmonicType",
  "harmonicType",
);
const setHarmonicValueAction = defineDocumentAction({
  id: "document.note.setHarmonicValue",
  i18nKey: "actions.edit.note.setHarmonicValue",
  category: "document.note",
  argsSchema: valueNumberArgs,
  execute: ({ value }) => applyNoteUpdates({ harmonicValue: value }),
});
const setHarmonicAction = defineDocumentAction({
  id: "document.note.setHarmonic",
  i18nKey: "actions.edit.note.setHarmonic",
  category: "document.note",
  argsSchema: actionArgs({
    harmonicType: integer,
    harmonicValue: finiteNumber,
  }),
  execute: ({ harmonicType, harmonicValue }) => {
    applyNoteUpdates({ harmonicType, harmonicValue });
  },
});
const setDynamicsAction = defineIntegerNoteFieldAction(
  "document.note.setDynamics",
  "dynamics",
);
const setFretAction = defineIntegerNoteFieldAction(
  "document.note.setFret",
  "fret",
);

const setStringAction = defineDocumentAction({
  id: "document.note.setString",
  i18nKey: "actions.edit.note.setString",
  category: "document.note",
  argsSchema: valueIntegerArgs,
  execute: ({ value }) => {
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
});

const setOctaveAction = defineIntegerNoteFieldAction(
  "document.note.setOctave",
  "octave",
);
const setToneAction = defineIntegerNoteFieldAction(
  "document.note.setTone",
  "tone",
);
const setPercussionArticulationAction = defineIntegerNoteFieldAction(
  "document.note.setPercussionArticulation",
  "percussionArticulation",
);
const setSlideInTypeAction = defineIntegerNoteFieldAction(
  "document.note.setSlideInType",
  "slideInType",
);

const setTrillAction = defineDocumentAction({
  id: "document.note.setTrill",
  i18nKey: "actions.edit.note.setTrill",
  category: "document.note",
  argsSchema: actionArgs({
    trillValue: finiteNumber,
    trillSpeed: integer,
  }),
  execute: ({ trillValue, trillSpeed }) => {
    applyNoteUpdates({ trillValue, trillSpeed });
  },
});

const setOrnamentAction = defineIntegerNoteFieldAction(
  "document.note.setOrnament",
  "ornament",
);
const setIsLeftHandTappedAction = defineBooleanNoteFieldAction(
  "document.note.setIsLeftHandTapped",
  "isLeftHandTapped",
);

const togglePercussionArticulationAction = defineDocumentAction({
  id: "document.beat.togglePercussionArticulation",
  i18nKey: "actions.edit.beat.togglePercussionArticulation",
  category: "document.beat",
  argsSchema: actionArgs({ gp7Id: integer }),
  execute: ({ gp7Id }) => {
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
});

export const noteDocumentActions = [
  setIsTieDestinationAction,
  setIsGhostAction,
  setIsDeadAction,
  setAccentuatedAction,
  setIsStaccatoAction,
  setIsLetRingAction,
  setIsPalmMuteAction,
  setIsHammerPullOriginAction,
  setVibratoAction,
  setBendTypeAction,
  setBendStyleAction,
  setIsContinuedBendAction,
  setBendPointsAction,
  setBendAction,
  setSlideOutTypeAction,
  setHarmonicTypeAction,
  setHarmonicValueAction,
  setHarmonicAction,
  setDynamicsAction,
  setFretAction,
  setStringAction,
  setOctaveAction,
  setToneAction,
  setPercussionArticulationAction,
  setSlideInTypeAction,
  setTrillAction,
  setOrnamentAction,
  setIsLeftHandTappedAction,
  togglePercussionArticulationAction,
] as const;
