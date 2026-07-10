import * as Y from "yjs";
import { actionRegistry } from "@/core/actions/registry";
import type { ActionDefinition } from "@/core/actions/types";
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

const insertBarBeforeAction: ActionDefinition<void> = {
  id: "edit.bar.insertBefore",
  i18nKey: "actions.edit.bar.insertBefore",
  category: "edit.bar",
  execute: (_args, _context) => {
    const { barIndex } = engine.selector;
    if (barIndex === null) {
      debugLog("warn", "edit.bar.insertBefore", "no selection");
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

    debugLog("info", "edit.bar.insertBefore", "complete");
  },
};

const insertBarAfterAction: ActionDefinition<void> = {
  id: "edit.bar.insertAfter",
  i18nKey: "actions.edit.bar.insertAfter",
  category: "edit.bar",
  execute: (_args, _context) => {
    const { barIndex } = engine.selector;
    if (barIndex === null) {
      debugLog("warn", "edit.bar.insertAfter", "no selection");
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

    debugLog("info", "edit.bar.insertAfter", "complete");
  },
};

const deleteBarAction: ActionDefinition<void> = {
  id: "edit.bar.delete",
  i18nKey: "actions.edit.bar.delete",
  category: "edit.bar",
  execute: (_args, _context): boolean => {
    const { barIndex } = engine.selector;
    if (barIndex === null) {
      debugLog("warn", "edit.bar.delete", "no selection");
      return false;
    }
    const yScore = getScoreMap();
    if (!yScore) return false;

    const yMasterBars = yScore.get("masterBars") as Y.Array<Y.Map<unknown>>;
    if (yMasterBars.length <= 1) {
      debugLog("warn", "edit.bar.delete", "blocked — only bar remaining");
      return false;
    }

    if (!isBarEmptyAllTracksY(yScore, barIndex)) {
      debugLog("warn", "edit.bar.delete", "blocked — bar not empty");
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

    debugLog("info", "edit.bar.delete", "complete");
    return true;
  },
};

const setClefAction: ActionDefinition<number> = {
  id: "edit.bar.setClef",
  i18nKey: "actions.edit.bar.setClef",
  category: "edit.bar",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.bar.setClef.params.value" }],
  execute: (value, _context) => {
    applyBarUpdates({ clef: value });
  },
};

const setClefOttavaAction: ActionDefinition<number> = {
  id: "edit.bar.setClefOttava",
  i18nKey: "actions.edit.bar.setClefOttava",
  category: "edit.bar",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.bar.setClefOttava.params.value" }],
  execute: (value, _context) => {
    applyBarUpdates({ clefOttava: value });
  },
};

const setSimileMarkAction: ActionDefinition<number> = {
  id: "edit.bar.setSimileMark",
  i18nKey: "actions.edit.bar.setSimileMark",
  category: "edit.bar",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.bar.setSimileMark.params.value" }],
  execute: (value, _context) => {
    applyBarUpdates({ simileMark: value });
  },
};

const setKeySignatureAction: ActionDefinition<number> = {
  id: "edit.bar.setKeySignature",
  i18nKey: "actions.edit.bar.setKeySignature",
  category: "edit.bar",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.bar.setKeySignature.params.value" }],
  execute: (value, _context) => {
    applyBarUpdates({ keySignature: value });
  },
};

const setKeySignatureTypeAction: ActionDefinition<number> = {
  id: "edit.bar.setKeySignatureType",
  i18nKey: "actions.edit.bar.setKeySignatureType",
  category: "edit.bar",
  params: [{ name: "value", type: "number", i18nKey: "actions.edit.bar.setKeySignatureType.params.value" }],
  execute: (value, _context) => {
    applyBarUpdates({ keySignatureType: value });
  },
};

actionRegistry.register(insertBarBeforeAction);
actionRegistry.register(insertBarAfterAction);
actionRegistry.register(deleteBarAction);
actionRegistry.register(setClefAction);
actionRegistry.register(setClefOttavaAction);
actionRegistry.register(setSimileMarkAction);
actionRegistry.register(setKeySignatureAction);
actionRegistry.register(setKeySignatureTypeAction);

declare global {
  interface ActionMap {
    "edit.bar.insertBefore": { args: void; result: void };
    "edit.bar.insertAfter": { args: void; result: void };
    "edit.bar.delete": { args: void; result: boolean };
    "edit.bar.setClef": { args: number; result: void };
    "edit.bar.setClefOttava": { args: number; result: void };
    "edit.bar.setSimileMark": { args: number; result: void };
    "edit.bar.setKeySignature": { args: number; result: void };
    "edit.bar.setKeySignatureType": { args: number; result: void };
  }
}

export {};
