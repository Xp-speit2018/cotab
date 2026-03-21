import type { ActionCategory } from "@/actions/types";

/**
 * Platform-agnostic key combo stored as a normalized string.
 * Modifiers always appear in order: mod+alt+shift+<key>.
 * "mod" resolves to Cmd on macOS or Ctrl elsewhere at runtime.
 */
export type KeyCombo = string;

export type ShortcutBehavior =
  | { type: "direct" }
  | { type: "toggle"; getCurrentValue: () => boolean }
  | {
      type: "cycle";
      values: readonly number[];
      direction: "forward" | "backward";
      getCurrentValue: () => number;
    }
  | { type: "digitAccumulator" }
  | {
      type: "navigate";
      direction: "nextBeat" | "prevBeat" | "moveUp" | "moveDown" | "nextBar" | "prevBar" | "nextStaff" | "prevStaff";
    };

export interface ShortcutBinding {
  /** Unique ID matching the shortcut — typically mirrors the action ID, with a suffix for variants. */
  readonly id: string;
  /** The action to invoke when the shortcut fires. */
  readonly actionId: string;
  /** Human-readable i18n key for display in the config panel. */
  readonly i18nKey: string;
  /** Category used for grouping in the config panel. */
  readonly category: ShortcutCategory;
  /** Default key combo (platform-agnostic). */
  readonly defaultKeys: KeyCombo;
  /** Current key combo (user may have changed it). Empty string = unbound. */
  keys: KeyCombo;
  /** How this shortcut transforms its input before dispatching. */
  readonly behavior: ShortcutBehavior;
  /** When true, the binding is shown in the panel but cannot be edited (e.g. clipboard). */
  readonly placeholder?: boolean;
  /** When true, the binding is functional but hidden from the config panel (e.g. digit keys). */
  readonly hidden?: boolean;
}

export type ShortcutCategory =
  | "file"
  | "playback"
  | "navigation"
  | "editing.beat"
  | "editing.bar"
  | "editing.track"
  | "history"
  | "clipboard"
  | "view";

export const SHORTCUT_CATEGORY_ORDER: readonly ShortcutCategory[] = [
  "file",
  "playback",
  "navigation",
  "editing.beat",
  "editing.bar",
  "editing.track",
  "history",
  "clipboard",
  "view",
];

export interface ParsedKeyCombo {
  mod: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
}

export function parseKeyCombo(combo: KeyCombo): ParsedKeyCombo {
  const parts = combo.toLowerCase().split("+");
  return {
    mod: parts.includes("mod"),
    alt: parts.includes("alt"),
    shift: parts.includes("shift"),
    key: parts.filter((p) => p !== "mod" && p !== "alt" && p !== "shift").join("+") || "",
  };
}

/** Normalize a set of modifier flags + key into a canonical combo string. */
export function buildKeyCombo(mod: boolean, alt: boolean, shift: boolean, key: string): KeyCombo {
  const parts: string[] = [];
  if (mod) parts.push("mod");
  if (alt) parts.push("alt");
  if (shift) parts.push("shift");
  parts.push(key.toLowerCase());
  return parts.join("+");
}

/**
 * Maps ShortcutCategory to ActionCategory for looking up action definitions.
 */
export function shortcutCategoryToActionCategory(cat: ShortcutCategory): ActionCategory | null {
  switch (cat) {
    case "playback":
      return "playback";
    case "navigation":
      return "navigation";
    case "editing.beat":
      return "edit.beat";
    case "editing.bar":
      return "edit.bar";
    case "editing.track":
      return "edit.track";
    case "file":
      return "file";
    case "history":
      return null;
    case "clipboard":
      return "edit.clipboard";
    case "view":
      return "view";
  }
}
