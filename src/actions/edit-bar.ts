import * as Y from "yjs";
import { actionRegistry } from "./registry";
import type { ActionDefinition } from "./types";
import { debugLog } from "@/stores/debug-log-store";
import {
  isBarEmptyAllTracks,
  setPendingSelection,
} from "@/stores/player-internals";
import { usePlayerStore } from "@/stores/player-store";
import { createMasterBar } from "@/core/schema";
import { pushDefaultBar } from "@/core/store";
import { transact, getScoreMap } from "@/core/sync";

const insertBarBeforeAction: ActionDefinition<void> = {
  id: "edit.bar.insertBefore",
  i18nKey: "actions.edit.bar.insertBefore",
  category: "edit.bar",
  execute: (_args, _context) => {
    const sel = usePlayerStore.getState().selectedBeat;
    if (!sel) {
      debugLog("warn", "edit.bar.insertBefore", "no selection");
      return;
    }
    const yScore = getScoreMap();
    if (!yScore) return;

    const yMasterBars = yScore.get("masterBars") as Y.Array<Y.Map<unknown>>;
    const refIndex = Math.min(sel.barIndex, yMasterBars.length - 1);
    const refMb = yMasterBars.get(refIndex);
    const num = (refMb.get("timeSignatureNumerator") as number) ?? 4;
    const den = (refMb.get("timeSignatureDenominator") as number) ?? 4;

    setPendingSelection({
      trackIndex: sel.trackIndex,
      barIndex: sel.barIndex + 1,
      beatIndex: sel.beatIndex,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      string: sel.string,
    });

    transact(() => {
      yMasterBars.insert(sel.barIndex, [createMasterBar(num, den)]);

      const yTracks = yScore.get("tracks") as Y.Array<Y.Map<unknown>>;
      for (let ti = 0; ti < yTracks.length; ti++) {
        const yStaves = yTracks.get(ti).get("staves") as Y.Array<Y.Map<unknown>>;
        for (let si = 0; si < yStaves.length; si++) {
          const yBars = yStaves.get(si).get("bars") as Y.Array<Y.Map<unknown>>;
          const refBarIdx = Math.min(sel.barIndex, yBars.length - 1);
          const clef = (yBars.get(refBarIdx).get("clef") as number) ?? 4;
          pushDefaultBar(yBars, sel.barIndex, clef);
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
    const sel = usePlayerStore.getState().selectedBeat;
    if (!sel) {
      debugLog("warn", "edit.bar.insertAfter", "no selection");
      return;
    }
    const yScore = getScoreMap();
    if (!yScore) return;

    const yMasterBars = yScore.get("masterBars") as Y.Array<Y.Map<unknown>>;
    const refMb = yMasterBars.get(sel.barIndex);
    const num = (refMb.get("timeSignatureNumerator") as number) ?? 4;
    const den = (refMb.get("timeSignatureDenominator") as number) ?? 4;
    const insertIdx = sel.barIndex + 1;

    setPendingSelection({
      trackIndex: sel.trackIndex,
      barIndex: sel.barIndex,
      beatIndex: sel.beatIndex,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      string: sel.string,
    });

    transact(() => {
      yMasterBars.insert(insertIdx, [createMasterBar(num, den)]);

      const yTracks = yScore.get("tracks") as Y.Array<Y.Map<unknown>>;
      for (let ti = 0; ti < yTracks.length; ti++) {
        const yStaves = yTracks.get(ti).get("staves") as Y.Array<Y.Map<unknown>>;
        for (let si = 0; si < yStaves.length; si++) {
          const yBars = yStaves.get(si).get("bars") as Y.Array<Y.Map<unknown>>;
          const clef = (yBars.get(sel.barIndex).get("clef") as number) ?? 4;
          pushDefaultBar(yBars, insertIdx, clef);
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
    const sel = usePlayerStore.getState().selectedBeat;
    if (!sel) {
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

    if (!isBarEmptyAllTracks(sel.barIndex)) {
      debugLog("warn", "edit.bar.delete", "blocked — bar not empty");
      return false;
    }

    const newBarIndex = Math.min(sel.barIndex, yMasterBars.length - 2);
    setPendingSelection({
      trackIndex: sel.trackIndex,
      barIndex: newBarIndex,
      beatIndex: 0,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      string: sel.string,
    });

    transact(() => {
      yMasterBars.delete(sel.barIndex, 1);

      const yTracks = yScore.get("tracks") as Y.Array<Y.Map<unknown>>;
      for (let ti = 0; ti < yTracks.length; ti++) {
        const yStaves = yTracks.get(ti).get("staves") as Y.Array<Y.Map<unknown>>;
        for (let si = 0; si < yStaves.length; si++) {
          const yBars = yStaves.get(si).get("bars") as Y.Array<Y.Map<unknown>>;
          yBars.delete(sel.barIndex, 1);
        }
      }
    });

    debugLog("info", "edit.bar.delete", "complete");
    return true;
  },
};

actionRegistry.register(insertBarBeforeAction);
actionRegistry.register(insertBarAfterAction);
actionRegistry.register(deleteBarAction);

declare global {
  interface ActionMap {
    "edit.bar.insertBefore": { args: void; result: void };
    "edit.bar.insertAfter": { args: void; result: void };
    "edit.bar.delete": { args: void; result: boolean };
  }
}

export {};
