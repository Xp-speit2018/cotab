import * as Y from "yjs";
import { debugLog } from "@/core/editor/action-log";
import { engine, EditorEngine } from "@/core/engine";
import { createMasterBar } from "@/core/schema";
import { actionArgs, defineDocumentAction, emptyActionArgs } from "./definition";
import { integer, valueIntegerArgs } from "./args-schema";

const transact = (fn: () => void) => engine.localEditYDoc(fn);
const getScoreMap = () => engine.getScoreMap();

function applyBarUpdates(updates: Record<string, unknown>): void {
  const { trackIndex, staffIndex, barIndex } = engine.selector;
  if (trackIndex === null || staffIndex === null || barIndex === null) return;
  const yBar = engine.resolveYBar(trackIndex, staffIndex, barIndex);
  if (!yBar) return;
  transact(() => {
    for (const [field, value] of Object.entries(updates)) {
      yBar.set(field, value);
    }
  });
}

function isBarEmptyAllTracksY(yScore: Y.Map<unknown>, barIndex: number): boolean {
  const yTracks = yScore.get("tracks") as Y.Array<Y.Map<unknown>> | undefined;
  if (!yTracks) return false;

  for (let ti = 0; ti < yTracks.length; ti++) {
    const yStaves = yTracks.get(ti).get("staves") as Y.Array<Y.Map<unknown>> | undefined;
    if (!yStaves) continue;

    for (let si = 0; si < yStaves.length; si++) {
      const yBars = yStaves.get(si).get("bars") as Y.Array<Y.Map<unknown>> | undefined;
      const yBar = yBars?.get(barIndex);
      if (!yBar) continue;

      const yVoices = yBar.get("voices") as Y.Array<Y.Map<unknown>> | undefined;
      if (!yVoices) continue;

      for (let vi = 0; vi < yVoices.length; vi++) {
        const yBeats = yVoices.get(vi).get("beats") as Y.Array<Y.Map<unknown>> | undefined;
        if (!yBeats) continue;

        for (let bi = 0; bi < yBeats.length; bi++) {
          const yNotes = yBeats.get(bi).get("notes") as Y.Array<Y.Map<unknown>> | undefined;
          if (yNotes && yNotes.length > 0) return false;
        }
      }
    }
  }

  return true;
}

const insertBarBeforeAction = defineDocumentAction({
  id: "document.bar.insertBefore",
  i18nKey: "actions.edit.bar.insertBefore",
  category: "document.bar",
  argsSchema: emptyActionArgs,
  execute: () => {
    const { barIndex } = engine.selector;
    if (barIndex === null) {
      debugLog("warn", "document.bar.insertBefore", "no selection");
      return;
    }
    const yScore = getScoreMap();
    if (!yScore) return;

    const yMasterBars = yScore.get("masterBars") as Y.Array<Y.Map<unknown>>;
    const refIndex = Math.min(barIndex, yMasterBars.length - 1);
    const refMb = yMasterBars.get(refIndex);
    const num = (refMb.get("timeSignatureNumerator") as number) ?? 4;
    const den = (refMb.get("timeSignatureDenominator") as number) ?? 4;

    transact(() => {
      yMasterBars.insert(barIndex, [createMasterBar(num, den)]);

      const yTracks = yScore.get("tracks") as Y.Array<Y.Map<unknown>>;
      for (let ti = 0; ti < yTracks.length; ti++) {
        const yStaves = yTracks.get(ti).get("staves") as Y.Array<Y.Map<unknown>>;
        for (let si = 0; si < yStaves.length; si++) {
          const yBars = yStaves.get(si).get("bars") as Y.Array<Y.Map<unknown>>;
          const refBarIdx = Math.min(barIndex, yBars.length - 1);
          const clef = (yBars.get(refBarIdx).get("clef") as number) ?? 4;
          EditorEngine.pushDefaultBar(yBars, barIndex, clef);
        }
      }
    });

    debugLog("info", "document.bar.insertBefore", "complete");
  },
});

const insertBarAfterAction = defineDocumentAction({
  id: "document.bar.insertAfter",
  i18nKey: "actions.edit.bar.insertAfter",
  category: "document.bar",
  argsSchema: emptyActionArgs,
  execute: () => {
    const { barIndex } = engine.selector;
    if (barIndex === null) {
      debugLog("warn", "document.bar.insertAfter", "no selection");
      return;
    }
    const yScore = getScoreMap();
    if (!yScore) return;

    const yMasterBars = yScore.get("masterBars") as Y.Array<Y.Map<unknown>>;
    const refMb = yMasterBars.get(barIndex);
    const num = (refMb.get("timeSignatureNumerator") as number) ?? 4;
    const den = (refMb.get("timeSignatureDenominator") as number) ?? 4;
    const insertIdx = barIndex + 1;

    transact(() => {
      yMasterBars.insert(insertIdx, [createMasterBar(num, den)]);

      const yTracks = yScore.get("tracks") as Y.Array<Y.Map<unknown>>;
      for (let ti = 0; ti < yTracks.length; ti++) {
        const yStaves = yTracks.get(ti).get("staves") as Y.Array<Y.Map<unknown>>;
        for (let si = 0; si < yStaves.length; si++) {
          const yBars = yStaves.get(si).get("bars") as Y.Array<Y.Map<unknown>>;
          const clef = (yBars.get(barIndex).get("clef") as number) ?? 4;
          EditorEngine.pushDefaultBar(yBars, insertIdx, clef);
        }
      }
    });

    debugLog("info", "document.bar.insertAfter", "complete");
  },
});

const deleteBarAction = defineDocumentAction({
  id: "document.bar.delete",
  i18nKey: "actions.edit.bar.delete",
  category: "document.bar",
  argsSchema: emptyActionArgs,
  execute: (): boolean => {
    const { barIndex } = engine.selector;
    if (barIndex === null) {
      debugLog("warn", "document.bar.delete", "no selection");
      return false;
    }
    const yScore = getScoreMap();
    if (!yScore) return false;

    const yMasterBars = yScore.get("masterBars") as Y.Array<Y.Map<unknown>>;
    if (yMasterBars.length <= 1) {
      debugLog("warn", "document.bar.delete", "blocked — only bar remaining");
      return false;
    }

    if (!isBarEmptyAllTracksY(yScore, barIndex)) {
      debugLog("warn", "document.bar.delete", "blocked — bar not empty");
      return false;
    }

    transact(() => {
      yMasterBars.delete(barIndex, 1);

      const yTracks = yScore.get("tracks") as Y.Array<Y.Map<unknown>>;
      for (let ti = 0; ti < yTracks.length; ti++) {
        const yStaves = yTracks.get(ti).get("staves") as Y.Array<Y.Map<unknown>>;
        for (let si = 0; si < yStaves.length; si++) {
          const yBars = yStaves.get(si).get("bars") as Y.Array<Y.Map<unknown>>;
          yBars.delete(barIndex, 1);
        }
      }
    });

    debugLog("info", "document.bar.delete", "complete");
    return true;
  },
});

const setClefAction = defineDocumentAction({
  id: "document.bar.setClef",
  i18nKey: "actions.edit.bar.setClef",
  category: "document.bar",
  argsSchema: valueIntegerArgs,
  execute: ({ value }) => {
    applyBarUpdates({ clef: value });
  },
});

const setClefOttavaAction = defineDocumentAction({
  id: "document.bar.setClefOttava",
  i18nKey: "actions.edit.bar.setClefOttava",
  category: "document.bar",
  argsSchema: valueIntegerArgs,
  execute: ({ value }) => {
    applyBarUpdates({ clefOttava: value });
  },
});

const setSimileMarkAction = defineDocumentAction({
  id: "document.bar.setSimileMark",
  i18nKey: "actions.edit.bar.setSimileMark",
  category: "document.bar",
  argsSchema: valueIntegerArgs,
  execute: ({ value }) => {
    applyBarUpdates({ simileMark: value });
  },
});

const setKeySignatureAction = defineDocumentAction({
  id: "document.bar.setKeySignature",
  i18nKey: "actions.edit.bar.setKeySignature",
  category: "document.bar",
  argsSchema: valueIntegerArgs,
  execute: ({ value }) => {
    applyBarUpdates({ keySignature: value });
  },
});

const setKeySignatureTypeAction = defineDocumentAction({
  id: "document.bar.setKeySignatureType",
  i18nKey: "actions.edit.bar.setKeySignatureType",
  category: "document.bar",
  argsSchema: valueIntegerArgs,
  execute: ({ value }) => {
    applyBarUpdates({ keySignatureType: value });
  },
});

const setKeyAction = defineDocumentAction({
  id: "document.bar.setKey",
  i18nKey: "actions.edit.bar.setKey",
  category: "document.bar",
  argsSchema: actionArgs({
    keySignature: integer.min(-7).max(7),
    keySignatureType: integer.min(0).max(1),
  }),
  execute: ({ keySignature, keySignatureType }) => {
    applyBarUpdates({ keySignature, keySignatureType });
  },
});

export const barDocumentActions = [
  insertBarBeforeAction,
  insertBarAfterAction,
  deleteBarAction,
  setClefAction,
  setClefOttavaAction,
  setSimileMarkAction,
  setKeySignatureAction,
  setKeySignatureTypeAction,
  setKeyAction,
] as const;
