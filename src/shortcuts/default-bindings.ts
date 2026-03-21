import type { ShortcutBinding, ShortcutBehavior } from "./types";

const direct: ShortcutBehavior = { type: "direct" };
const digitAccum: ShortcutBehavior = { type: "digitAccumulator" };

/**
 * All default shortcut bindings, derived from wiki/Keyboard-Shortcuts.md.
 * Digit keys (0-9) for placeNote are registered separately via getDigitBindings().
 */
export const DEFAULT_BINDINGS: readonly ShortcutBinding[] = [
  // ── File ────────────────────────────────────────────────────────────────
  {
    id: "file.exportGp",
    actionId: "file.exportGp",
    i18nKey: "shortcuts.file.exportGp",
    category: "file",
    defaultKeys: "",
    keys: "",
    behavior: direct,
  },

  // ── Playback ──────────────────────────────────────────────────────────────
  {
    id: "playback.togglePlaying",
    actionId: "playback.setPlaying",
    i18nKey: "shortcuts.playback.togglePlaying",
    category: "playback",
    defaultKeys: "space",
    keys: "space",
    behavior: { type: "toggle", getCurrentValue: () => false },
  },

  // ── Navigation ────────────────────────────────────────────────────────────
  {
    id: "nav.nextBeat",
    actionId: "nav.setSelection",
    i18nKey: "shortcuts.nav.nextBeat",
    category: "navigation",
    defaultKeys: "arrowright",
    keys: "arrowright",
    behavior: { type: "navigate", direction: "nextBeat" },
  },
  {
    id: "nav.prevBeat",
    actionId: "nav.setSelection",
    i18nKey: "shortcuts.nav.prevBeat",
    category: "navigation",
    defaultKeys: "arrowleft",
    keys: "arrowleft",
    behavior: { type: "navigate", direction: "prevBeat" },
  },
  {
    id: "nav.moveUp",
    actionId: "nav.setSelection",
    i18nKey: "shortcuts.nav.moveUp",
    category: "navigation",
    defaultKeys: "arrowup",
    keys: "arrowup",
    behavior: { type: "navigate", direction: "moveUp" },
  },
  {
    id: "nav.moveDown",
    actionId: "nav.setSelection",
    i18nKey: "shortcuts.nav.moveDown",
    category: "navigation",
    defaultKeys: "arrowdown",
    keys: "arrowdown",
    behavior: { type: "navigate", direction: "moveDown" },
  },
  {
    id: "nav.nextBar",
    actionId: "nav.setSelection",
    i18nKey: "shortcuts.nav.nextBar",
    category: "navigation",
    defaultKeys: "mod+arrowright",
    keys: "mod+arrowright",
    behavior: { type: "navigate", direction: "nextBar" },
  },
  {
    id: "nav.prevBar",
    actionId: "nav.setSelection",
    i18nKey: "shortcuts.nav.prevBar",
    category: "navigation",
    defaultKeys: "mod+arrowleft",
    keys: "mod+arrowleft",
    behavior: { type: "navigate", direction: "prevBar" },
  },
  {
    id: "nav.nextStaff",
    actionId: "nav.setSelection",
    i18nKey: "shortcuts.nav.nextStaff",
    category: "navigation",
    defaultKeys: "mod+arrowdown",
    keys: "mod+arrowdown",
    behavior: { type: "navigate", direction: "nextStaff" },
  },
  {
    id: "nav.prevStaff",
    actionId: "nav.setSelection",
    i18nKey: "shortcuts.nav.prevStaff",
    category: "navigation",
    defaultKeys: "mod+arrowup",
    keys: "mod+arrowup",
    behavior: { type: "navigate", direction: "prevStaff" },
  },

  // ── Editing: Beat ─────────────────────────────────────────────────────────
  {
    id: "edit.beat.toggleRest",
    actionId: "edit.beat.setRest",
    i18nKey: "shortcuts.edit.beat.toggleRest",
    category: "editing.beat",
    defaultKeys: "r",
    keys: "r",
    behavior: { type: "toggle", getCurrentValue: () => false },
  },
  {
    id: "edit.beat.insertRestBefore",
    actionId: "edit.beat.insertRestBefore",
    i18nKey: "shortcuts.edit.beat.insertRestBefore",
    category: "editing.beat",
    defaultKeys: "shift+[",
    keys: "shift+[",
    behavior: direct,
  },
  {
    id: "edit.beat.insertRestAfter",
    actionId: "edit.beat.insertRestAfter",
    i18nKey: "shortcuts.edit.beat.insertRestAfter",
    category: "editing.beat",
    defaultKeys: "shift+]",
    keys: "shift+]",
    behavior: direct,
  },
  {
    id: "edit.beat.deleteNote",
    actionId: "edit.beat.deleteNote",
    i18nKey: "shortcuts.edit.beat.deleteNote",
    category: "editing.beat",
    defaultKeys: "backspace",
    keys: "backspace",
    behavior: direct,
  },
  {
    id: "edit.beat.cycleDurationUp",
    actionId: "edit.beat.setDuration",
    i18nKey: "shortcuts.edit.beat.cycleDurationUp",
    category: "editing.beat",
    defaultKeys: "=",
    keys: "=",
    behavior: {
      type: "cycle",
      values: [1, 2, 4, 8, 16, 32, 64],
      direction: "forward",
      getCurrentValue: () => 4,
    },
  },
  {
    id: "edit.beat.cycleDurationDown",
    actionId: "edit.beat.setDuration",
    i18nKey: "shortcuts.edit.beat.cycleDurationDown",
    category: "editing.beat",
    defaultKeys: "-",
    keys: "-",
    behavior: {
      type: "cycle",
      values: [1, 2, 4, 8, 16, 32, 64],
      direction: "backward",
      getCurrentValue: () => 4,
    },
  },
  {
    id: "edit.beat.cycleDots",
    actionId: "edit.beat.setDots",
    i18nKey: "shortcuts.edit.beat.cycleDots",
    category: "editing.beat",
    defaultKeys: ".",
    keys: ".",
    behavior: {
      type: "cycle",
      values: [0, 1, 2],
      direction: "forward",
      getCurrentValue: () => 0,
    },
  },

  // ── Editing: Bar ──────────────────────────────────────────────────────────
  {
    id: "edit.bar.insertBefore",
    actionId: "edit.bar.insertBefore",
    i18nKey: "shortcuts.edit.bar.insertBefore",
    category: "editing.bar",
    defaultKeys: "mod+alt+[",
    keys: "mod+alt+[",
    behavior: direct,
  },
  {
    id: "edit.bar.insertAfter",
    actionId: "edit.bar.insertAfter",
    i18nKey: "shortcuts.edit.bar.insertAfter",
    category: "editing.bar",
    defaultKeys: "mod+alt+]",
    keys: "mod+alt+]",
    behavior: direct,
  },
  {
    id: "edit.bar.delete",
    actionId: "edit.bar.delete",
    i18nKey: "shortcuts.edit.bar.delete",
    category: "editing.bar",
    defaultKeys: "mod+backspace",
    keys: "mod+backspace",
    behavior: direct,
  },

  // ── Editing: Track ────────────────────────────────────────────────────────
  {
    id: "edit.track.delete",
    actionId: "edit.track.delete",
    i18nKey: "shortcuts.edit.track.delete",
    category: "editing.track",
    defaultKeys: "mod+shift+backspace",
    keys: "mod+shift+backspace",
    behavior: direct,
  },

  // ── History ─────────────────────────────────────────────────────────────
  {
    id: "edit.undo",
    actionId: "edit.undo",
    i18nKey: "shortcuts.history.undo",
    category: "history",
    defaultKeys: "mod+z",
    keys: "mod+z",
    behavior: direct,
  },
  {
    id: "edit.redo",
    actionId: "edit.redo",
    i18nKey: "shortcuts.history.redo",
    category: "history",
    defaultKeys: "mod+shift+z",
    keys: "mod+shift+z",
    behavior: direct,
  },

  // ── Clipboard (placeholder) ───────────────────────────────────────────────
  {
    id: "edit.copy",
    actionId: "edit.copy",
    i18nKey: "shortcuts.clipboard.copy",
    category: "clipboard",
    defaultKeys: "mod+c",
    keys: "mod+c",
    behavior: direct,
  },
  {
    id: "edit.paste",
    actionId: "edit.paste",
    i18nKey: "shortcuts.clipboard.paste",
    category: "clipboard",
    defaultKeys: "mod+v",
    keys: "mod+v",
    behavior: direct,
  },
  {
    id: "edit.cut",
    actionId: "edit.cut",
    i18nKey: "shortcuts.clipboard.cut",
    category: "clipboard",
    defaultKeys: "mod+x",
    keys: "mod+x",
    behavior: direct,
  },

];

/**
 * Generate digit-key bindings (0-9) for placeNote with digitAccumulator behavior.
 */
export function getDigitBindings(): ShortcutBinding[] {
  return Array.from({ length: 10 }, (_, i) => ({
    id: `edit.beat.placeNote.${i}`,
    actionId: "edit.beat.placeNote",
    i18nKey: "shortcuts.edit.beat.placeNote",
    category: "editing.beat" as const,
    defaultKeys: `${i}`,
    keys: `${i}`,
    behavior: digitAccum,
    hidden: true,
  }));
}

export function getAllDefaultBindings(): ShortcutBinding[] {
  return [...DEFAULT_BINDINGS.map((b) => ({ ...b })), ...getDigitBindings()];
}
