import { actionRegistry } from "./registry";
import type { ActionDefinition } from "./types";
import { debugLog } from "@/stores/debug-log-store";
import {
  getApi,
  insertBarAtIndex,
  isBarEmptyAllTracks,
  applyBarWarningStyles,
  setPendingSelection,
} from "@/stores/player-internals";
import { usePlayerStore } from "@/stores/player-store";

const insertBarBeforeAction: ActionDefinition<void> = {
  id: "edit.bar.insertBefore",
  i18nKey: "actions.edit.bar.insertBefore",
  category: "edit.bar",
  execute: (_args, _context) => {
    const sel = usePlayerStore.getState().selectedBeat;
    const api = getApi();
    if (!sel || !api) {
      debugLog("warn", "edit.bar.insertBefore", "no selection or API");
      return;
    }
    const score = api.score;
    if (!score) {
      debugLog("warn", "edit.bar.insertBefore", "no score");
      return;
    }

    debugLog("info", "edit.bar.insertBefore", "start", {
      barIndex: sel.barIndex,
      trackCount: score.tracks.length,
      masterBarCount: score.masterBars.length,
    });

    insertBarAtIndex(score, sel.barIndex);

    setPendingSelection({
      trackIndex: sel.trackIndex,
      barIndex: sel.barIndex + 1,
      beatIndex: sel.beatIndex,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      string: sel.string,
    });

    debugLog("info", "edit.bar.insertBefore", "complete", {
      newBarCount: score.masterBars.length,
      newSelectionBarIndex: sel.barIndex + 1,
    });

    api.render();
  },
};

const insertBarAfterAction: ActionDefinition<void> = {
  id: "edit.bar.insertAfter",
  i18nKey: "actions.edit.bar.insertAfter",
  category: "edit.bar",
  execute: (_args, _context) => {
    const sel = usePlayerStore.getState().selectedBeat;
    const api = getApi();
    if (!sel || !api) {
      debugLog("warn", "edit.bar.insertAfter", "no selection or API");
      return;
    }
    const score = api.score;
    if (!score) {
      debugLog("warn", "edit.bar.insertAfter", "no score");
      return;
    }

    debugLog("info", "edit.bar.insertAfter", "start", {
      barIndex: sel.barIndex,
      insertIndex: sel.barIndex + 1,
      trackCount: score.tracks.length,
      masterBarCount: score.masterBars.length,
    });

    insertBarAtIndex(score, sel.barIndex + 1);

    setPendingSelection({
      trackIndex: sel.trackIndex,
      barIndex: sel.barIndex,
      beatIndex: sel.beatIndex,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      string: sel.string,
    });

    debugLog("info", "edit.bar.insertAfter", "complete", {
      newBarCount: score.masterBars.length,
      selectionBarIndex: sel.barIndex,
    });

    api.render();
  },
};

const deleteBarAction: ActionDefinition<void> = {
  id: "edit.bar.delete",
  i18nKey: "actions.edit.bar.delete",
  category: "edit.bar",
  execute: (_args, _context): boolean => {
    try {
      const sel = usePlayerStore.getState().selectedBeat;
      const api = getApi();
      if (!sel || !api) {
        debugLog("warn", "edit.bar.delete", "no selection or API");
        return false;
      }
      const score = api.score;
      if (!score) {
        debugLog("warn", "edit.bar.delete", "no score");
        return false;
      }

      debugLog("info", "edit.bar.delete", "start", {
        barIndex: sel.barIndex,
        masterBarCount: score.masterBars.length,
      });

      if (score.masterBars.length <= 1) {
        debugLog("warn", "edit.bar.delete", "blocked — only bar remaining");
        return false;
      }

      const isEmpty = isBarEmptyAllTracks(sel.barIndex);
      debugLog("debug", "edit.bar.delete", "bar empty check", {
        barIndex: sel.barIndex,
        isEmpty,
      });

      if (!isEmpty) {
        debugLog("warn", "edit.bar.delete", "blocked — bar not empty");
        return false;
      }

      debugLog("debug", "edit.bar.delete", "splicing masterBars and staff bars");
      score.masterBars.splice(sel.barIndex, 1);
      for (const track of score.tracks) {
        for (const staff of track.staves) {
          staff.bars.splice(sel.barIndex, 1);
        }
      }

      for (let i = 0; i < score.masterBars.length; i++) {
        const masterBar = score.masterBars[i];
        masterBar.index = i;
        masterBar.previousMasterBar = i > 0 ? score.masterBars[i - 1] : null;
        masterBar.nextMasterBar = i < score.masterBars.length - 1 ? score.masterBars[i + 1] : null;
      }
      debugLog("debug", "edit.bar.delete", "masterBar indices and links updated");

      for (const track of score.tracks) {
        for (const staff of track.staves) {
          for (let i = 0; i < staff.bars.length; i++) {
            const bar = staff.bars[i];
            bar.staff = staff;
            bar.index = i;
            bar.previousBar = i > 0 ? staff.bars[i - 1] : null;
            bar.nextBar = i < staff.bars.length - 1 ? staff.bars[i + 1] : null;
          }
        }
      }
      debugLog("debug", "edit.bar.delete", "bar indices and links updated");

      debugLog("debug", "edit.bar.delete", "calling score.finish()");
      score.finish(api.settings);
      debugLog("debug", "edit.bar.delete", "score.finish() completed");

      debugLog("debug", "edit.bar.delete", "calling applyBarWarningStyles()");
      applyBarWarningStyles();

      const newBarIndex = Math.min(sel.barIndex, score.masterBars.length - 1);
      setPendingSelection({
        trackIndex: sel.trackIndex,
        barIndex: newBarIndex,
        beatIndex: 0,
        staffIndex: sel.staffIndex,
        voiceIndex: sel.voiceIndex,
        string: sel.string,
      });

      debugLog("info", "edit.bar.delete", "complete", {
        newBarCount: score.masterBars.length,
        newSelectionBarIndex: newBarIndex,
      });

      api.render();
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw err;
    }
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

