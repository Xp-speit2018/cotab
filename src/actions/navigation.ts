/**
 * navigation.ts — Headless navigation actions using Y.Doc.
 *
 * Single nav.setSelection action following the toggle/cycle pattern.
 * Target computation is done by callers using helpers from navigation-helpers.ts.
 */

import { actionRegistry } from "./registry";
import type { ActionDefinition } from "./types";
import { engine, type SelectedBeat } from "@/core/engine";

const navSetSelection: ActionDefinition<SelectedBeat> = {
  id: "nav.setSelection",
  i18nKey: "actions.nav.setSelection",
  category: "navigation",
  execute: (target) => {
    if (!target) return;
    engine.localSetSelection(target);
  },
};

actionRegistry.register(navSetSelection);

declare global {
  interface ActionMap {
    "nav.setSelection": { args: SelectedBeat; result: void };
  }
}

// Re-export Y.Doc navigators and target computation helpers for callers
export {
  getBeatsLength,
  getBarsLength,
  getStavesLength,
  getStringCount,
  computeNextBeat,
  computePrevBeat,
  computeMoveUp,
  computeMoveDown,
  computeNextBar,
  computePrevBar,
  computeNextStaff,
  computePrevStaff,
} from "@/components/navigation/navigation-helpers";

export {};
