import * as Y from "yjs";
import { documentActionRegistry } from "@/core/actions/registry";
import type { DocumentActionDefinition } from "@/core/actions/types";
import { debugLog } from "@/core/editor/action-log";
import { engine, EditorEngine } from "@/core/engine";
import { createMasterBar } from "@/core/schema";

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

const insertBarBeforeAction: DocumentActionDefinition<void> = {
  id: "document.bar.insertBefore",
  i18nKey: "actions.edit.bar.insertBefore",
  category: "document.bar",
  execute: (_args, _context) => {
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
};

const insertBarAfterAction: DocumentActionDefinition<void> = {
  id: "document.bar.insertAfter",
  i18nKey: "actions.edit.bar.insertAfter",
  category: "document.bar",
  execute: (_args, _context) => {
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
};

const deleteBarAction: DocumentActionDefinition<void> = {
  id: "document.bar.delete",
  i18nKey: "actions.edit.bar.delete",
  category: "document.bar",
  execute: (_args, _context): boolean => {
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
};

const setClefAction: DocumentActionDefinition<number> = {
  id: "document.bar.setClef",
  i18nKey: "actions.edit.bar.setClef",
  category: "document.bar",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.bar.setClef.params.value" }],
  execute: (value, _context) => {
    applyBarUpdates({ clef: value });
  },
};

const setClefOttavaAction: DocumentActionDefinition<number> = {
  id: "document.bar.setClefOttava",
  i18nKey: "actions.edit.bar.setClefOttava",
  category: "document.bar",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.bar.setClefOttava.params.value" }],
  execute: (value, _context) => {
    applyBarUpdates({ clefOttava: value });
  },
};

const setSimileMarkAction: DocumentActionDefinition<number> = {
  id: "document.bar.setSimileMark",
  i18nKey: "actions.edit.bar.setSimileMark",
  category: "document.bar",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.bar.setSimileMark.params.value" }],
  execute: (value, _context) => {
    applyBarUpdates({ simileMark: value });
  },
};

const setKeySignatureAction: DocumentActionDefinition<number> = {
  id: "document.bar.setKeySignature",
  i18nKey: "actions.edit.bar.setKeySignature",
  category: "document.bar",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.bar.setKeySignature.params.value" }],
  execute: (value, _context) => {
    applyBarUpdates({ keySignature: value });
  },
};

const setKeySignatureTypeAction: DocumentActionDefinition<number> = {
  id: "document.bar.setKeySignatureType",
  i18nKey: "actions.edit.bar.setKeySignatureType",
  category: "document.bar",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.bar.setKeySignatureType.params.value" }],
  execute: (value, _context) => {
    applyBarUpdates({ keySignatureType: value });
  },
};

documentActionRegistry.register(insertBarBeforeAction);
documentActionRegistry.register(insertBarAfterAction);
documentActionRegistry.register(deleteBarAction);
documentActionRegistry.register(setClefAction);
documentActionRegistry.register(setClefOttavaAction);
documentActionRegistry.register(setSimileMarkAction);
documentActionRegistry.register(setKeySignatureAction);
documentActionRegistry.register(setKeySignatureTypeAction);

declare global {
  interface DocumentActionMap {
    "document.bar.insertBefore": { args: void; result: void };
    "document.bar.insertAfter": { args: void; result: void };
    "document.bar.delete": { args: void; result: boolean };
    "document.bar.setClef": { args: number; result: void };
    "document.bar.setClefOttava": { args: number; result: void };
    "document.bar.setSimileMark": { args: number; result: void };
    "document.bar.setKeySignature": { args: number; result: void };
    "document.bar.setKeySignatureType": { args: number; result: void };
  }
}

export {};
