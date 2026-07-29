/**
 * Platform-agnostic key combo stored as a normalized string.
 * Modifiers always appear in order: mod+alt+shift+<key>.
 * "mod" resolves to Cmd on macOS or Ctrl elsewhere at runtime.
 */
export type KeyCombo = string;
export type ShortcutScope = "editor" | "application";

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
      type: "systemLayout";
      operation: "forceBreak" | "preventBreak";
    }
  | {
      type: "navigate";
      direction: "nextBeat" | "prevBeat" | "moveUp" | "moveDown" | "nextBar" | "prevBar" | "nextVisibleStaff" | "previousVisibleStaff";
    };

export interface ShortcutBinding {
  /** Unique ID matching the shortcut, often mirroring the bound action ID. */
  readonly id: string;
  /** The AppAction ID to invoke when the shortcut fires. */
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
  /** Application shortcuts remain active while a text editor has focus. */
  readonly scope?: ShortcutScope;
  /** When true, the binding is shown in the panel but cannot be edited (e.g. clipboard). */
  readonly placeholder?: boolean;
  /** When true, the binding is functional but hidden from the config panel (e.g. digit keys). */
  readonly hidden?: boolean;
}

export type ShortcutCategory =
  | "file"
  | "navigation"
  | "transport"
  | "editing.beat"
  | "editing.bar"
  | "editing.track"
  | "history"
  | "clipboard";

export const SHORTCUT_CATEGORY_ORDER: readonly ShortcutCategory[] = [
  "file",
  "navigation",
  "transport",
  "editing.beat",
  "editing.bar",
  "editing.track",
  "history",
  "clipboard",
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
