import { engine, type SelectedBeat } from "@/core/engine";
import { registerAppAction } from "./registry";

declare global {
  interface AppActionMap {
    "selector.set": { args: SelectedBeat; result: void };
  }
}

export function registerSelectorActions(): void {
  registerAppAction<SelectedBeat>({
    id: "selector.set",
    domain: "selector",
    i18nKey: "actions.selector.set",
    category: "selector",
    execute: (target) => {
      if (target) engine.localSetSelection(target);
    },
  });
}
