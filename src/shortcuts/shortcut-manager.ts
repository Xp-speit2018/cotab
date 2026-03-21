import type { TFunction } from "i18next";
import type { ActionExecutionContext } from "@/actions/types";
import { executeActionUnsafe } from "@/actions/registry";
import { useShortcutStore } from "./shortcut-store";
import { keyboardEventToCombo } from "./platform";
import { handleDigitInput, cancelDigitInput } from "./fret-input";
import { getNextCycleValue } from "./behaviors";
import { debugLog } from "@/core/editor/action-log";
import { engine } from "@/core/engine";
import {
  computeNextBeat,
  computePrevBeat,
  computeMoveUp,
  computeMoveDown,
  computeNextBar,
  computePrevBar,
  computeNextStaff,
  computePrevStaff,
} from "@/components/navigation/navigation-helpers";
let installed = false;
let tFunction: TFunction | null = null;

function getContext(): ActionExecutionContext {
  return { t: tFunction! };
}

/** Map navigation direction to target computation function. */
function computeNavigationTarget(
  direction: "nextBeat" | "prevBeat" | "moveUp" | "moveDown" | "nextBar" | "prevBar" | "nextStaff" | "prevStaff",
  current: import("@/core/engine").SelectedBeat,
): import("@/core/engine").SelectedBeat | null {
  switch (direction) {
    case "nextBeat": return computeNextBeat(current);
    case "prevBeat": return computePrevBeat(current);
    case "moveUp": return computeMoveUp(current);
    case "moveDown": return computeMoveDown(current);
    case "nextBar": return computeNextBar(current);
    case "prevBar": return computePrevBar(current);
    case "nextStaff": return computeNextStaff(current);
    case "prevStaff": return computePrevStaff(current);
    default: return null;
  }
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  return (el as HTMLElement).isContentEditable === true;
}

function handleKeyDown(e: KeyboardEvent): void {
  if (!tFunction) return;
  if (useShortcutStore.getState().isConfigPanelOpen) return;
  if (isInputFocused()) return;

  const combo = keyboardEventToCombo(e);
  if (!combo) return;

  const binding = useShortcutStore.getState().getBinding(combo);
  if (!binding) {
    cancelDigitInput();
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  const context = getContext();
  const { behavior, actionId } = binding;

  switch (behavior.type) {
    case "direct": {
      cancelDigitInput();
      executeActionUnsafe(actionId, undefined, context);
      break;
    }

    case "toggle": {
      cancelDigitInput();
      const current = behavior.getCurrentValue();
      executeActionUnsafe(actionId, !current, context);
      break;
    }

    case "cycle": {
      cancelDigitInput();
      const current = behavior.getCurrentValue();
      const next = getNextCycleValue(behavior.values, current, behavior.direction);
      executeActionUnsafe(actionId, next, context);
      break;
    }

    case "digitAccumulator": {
      const digitMatch = binding.keys.match(/^(\d)$/);
      if (digitMatch) {
        const digit = parseInt(digitMatch[1], 10);
        handleDigitInput(digit, context);
      }
      break;
    }

    case "navigate": {
      cancelDigitInput();
      const current = engine.selectedBeat;
      if (!current) return;

      const target = computeNavigationTarget(behavior.direction, current);
      if (target) {
        executeActionUnsafe("nav.setSelection", target, context);
      }
      break;
    }

    default:
      debugLog("warn", "shortcutManager", "unknown behavior type", { binding: binding.id });
  }
}

export function installShortcutManager(t: TFunction): void {
  if (installed) return;
  tFunction = t;
  document.addEventListener("keydown", handleKeyDown, { capture: true });
  installed = true;
  debugLog("info", "shortcutManager", "installed");
}

export function uninstallShortcutManager(): void {
  if (!installed) return;
  document.removeEventListener("keydown", handleKeyDown, { capture: true });
  installed = false;
  tFunction = null;
  debugLog("info", "shortcutManager", "uninstalled");
}

export function updateTranslation(t: TFunction): void {
  tFunction = t;
}
