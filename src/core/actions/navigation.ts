/**
 * navigation.ts — Headless navigation action.
 *
 * Target computation is done by callers (UI layer) before invoking this action.
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

export {};
