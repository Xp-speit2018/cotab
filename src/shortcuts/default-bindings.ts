import type { ShortcutBinding, ShortcutBehavior } from "./types";

const direct: ShortcutBehavior = { type: "direct" };
const digitAccum: ShortcutBehavior = { type: "digitAccumulator" };

/**
 * All default shortcut bindings, derived from wiki/Keyboard-Shortcuts.md.
 * Digit keys (0-9) for placeNote are registered separately via getDigitBindings().
 */
export const DEFAULT_BINDINGS: readonly ShortcutBinding[] = [
  // ── Navigation ────────────────────────────────────────────────────────────
  {
    id: "nav.nextBeat",
    actionId: "selector.set",
    i18nKey: "shortcuts.nav.nextBeat",
    category: "navigation",
    defaultKeys: "arrowright",
    keys: "arrowright",
    behavior: { type: "navigate", direction: "nextBeat" },
  },
  {
    id: "nav.prevBeat",
    actionId: "selector.set",
    i18nKey: "shortcuts.nav.prevBeat",
    category: "navigation",
    defaultKeys: "arrowleft",
    keys: "arrowleft",
    behavior: { type: "navigate", direction: "prevBeat" },
  },
  {
    id: "nav.moveUp",
    actionId: "selector.set",
    i18nKey: "shortcuts.nav.moveUp",
    category: "navigation",
    defaultKeys: "arrowup",
    keys: "arrowup",
    behavior: { type: "navigate", direction: "moveUp" },
  },
  {
    id: "nav.moveDown",
    actionId: "selector.set",
    i18nKey: "shortcuts.nav.moveDown",
    category: "navigation",
    defaultKeys: "arrowdown",
    keys: "arrowdown",
    behavior: { type: "navigate", direction: "moveDown" },
  },
  {
    id: "nav.nextBar",
    actionId: "selector.set",
    i18nKey: "shortcuts.nav.nextBar",
    category: "navigation",
    defaultKeys: "mod+arrowright",
    keys: "mod+arrowright",
    behavior: { type: "navigate", direction: "nextBar" },
  },
  {
    id: "nav.prevBar",
    actionId: "selector.set",
    i18nKey: "shortcuts.nav.prevBar",
    category: "navigation",
    defaultKeys: "mod+arrowleft",
    keys: "mod+arrowleft",
    behavior: { type: "navigate", direction: "prevBar" },
  },
  {
    id: "nav.nextStaff",
    actionId: "selector.set",
    i18nKey: "shortcuts.nav.nextStaff",
    category: "navigation",
    defaultKeys: "mod+arrowdown",
    keys: "mod+arrowdown",
    behavior: { type: "navigate", direction: "nextStaff" },
  },
  {
    id: "nav.prevStaff",
    actionId: "selector.set",
    i18nKey: "shortcuts.nav.prevStaff",
    category: "navigation",
    defaultKeys: "mod+arrowup",
    keys: "mod+arrowup",
    behavior: { type: "navigate", direction: "prevStaff" },
  },

  // ── Transport ────────────────────────────────────────────────────────────
  {
    id: "transport.playPause",
    actionId: "transport.playPause",
    i18nKey: "shortcuts.transport.playPause",
    category: "transport",
    defaultKeys: "space",
    keys: "space",
    behavior: direct,
  },

  // ── Editing: Beat ─────────────────────────────────────────────────────────
  {
    id: "document.beat.toggleRest",
    actionId: "document.beat.setRest",
    i18nKey: "shortcuts.edit.beat.toggleRest",
    category: "editing.beat",
    defaultKeys: "r",
    keys: "r",
    behavior: { type: "toggle", getCurrentValue: () => false },
  },
  {
    id: "document.beat.insertRestBefore",
    actionId: "document.beat.insertRestBefore",
    i18nKey: "shortcuts.edit.beat.insertRestBefore",
    category: "editing.beat",
    defaultKeys: "shift+[",
    keys: "shift+[",
    behavior: direct,
  },
  {
    id: "document.beat.insertRestAfter",
    actionId: "document.beat.insertRestAfter",
    i18nKey: "shortcuts.edit.beat.insertRestAfter",
    category: "editing.beat",
    defaultKeys: "shift+]",
    keys: "shift+]",
    behavior: direct,
  },
  {
    id: "document.beat.deleteNote",
    actionId: "document.beat.deleteNote",
    i18nKey: "shortcuts.edit.beat.deleteNote",
    category: "editing.beat",
    defaultKeys: "backspace",
    keys: "backspace",
    behavior: direct,
  },
  {
    id: "document.beat.cycleDurationUp",
    actionId: "document.beat.setDuration",
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
    id: "document.beat.cycleDurationDown",
    actionId: "document.beat.setDuration",
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
    id: "document.beat.cycleDots",
    actionId: "document.beat.setDots",
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
    id: "document.bar.insertBefore",
    actionId: "document.bar.insertBefore",
    i18nKey: "shortcuts.edit.bar.insertBefore",
    category: "editing.bar",
    defaultKeys: "mod+alt+[",
    keys: "mod+alt+[",
    behavior: direct,
  },
  {
    id: "document.bar.insertAfter",
    actionId: "document.bar.insertAfter",
    i18nKey: "shortcuts.edit.bar.insertAfter",
    category: "editing.bar",
    defaultKeys: "mod+alt+]",
    keys: "mod+alt+]",
    behavior: direct,
  },
  {
    id: "document.bar.delete",
    actionId: "document.bar.delete",
    i18nKey: "shortcuts.edit.bar.delete",
    category: "editing.bar",
    defaultKeys: "mod+backspace",
    keys: "mod+backspace",
    behavior: direct,
  },
  {
    id: "layout.forceSystemBreak",
    actionId: "document.score.forceSystemBreak",
    i18nKey: "shortcuts.edit.bar.forceSystemBreak",
    category: "editing.bar",
    defaultKeys: "mod+enter",
    keys: "mod+enter",
    behavior: { type: "systemLayout", operation: "forceBreak" },
  },
  {
    id: "layout.preventSystemBreak",
    actionId: "document.score.preventSystemBreak",
    i18nKey: "shortcuts.edit.bar.preventSystemBreak",
    category: "editing.bar",
    defaultKeys: "shift+7",
    keys: "shift+7",
    behavior: { type: "systemLayout", operation: "preventBreak" },
  },

  // ── Editing: Track ────────────────────────────────────────────────────────
  {
    id: "document.track.delete",
    actionId: "document.track.delete",
    i18nKey: "shortcuts.edit.track.delete",
    category: "editing.track",
    defaultKeys: "mod+shift+backspace",
    keys: "mod+shift+backspace",
    behavior: direct,
  },

  // ── History ─────────────────────────────────────────────────────────────
  {
    id: "document.undo",
    actionId: "document.undo",
    i18nKey: "shortcuts.history.undo",
    category: "history",
    defaultKeys: "mod+z",
    keys: "mod+z",
    behavior: direct,
  },
  {
    id: "document.redo",
    actionId: "document.redo",
    i18nKey: "shortcuts.history.redo",
    category: "history",
    defaultKeys: "mod+shift+z",
    keys: "mod+shift+z",
    behavior: direct,
  },

  // ── Clipboard (placeholder) ───────────────────────────────────────────────
  {
    id: "document.copy",
    actionId: "document.copy",
    i18nKey: "shortcuts.clipboard.copy",
    category: "clipboard",
    defaultKeys: "mod+c",
    keys: "mod+c",
    behavior: direct,
  },
  {
    id: "document.paste",
    actionId: "document.paste",
    i18nKey: "shortcuts.clipboard.paste",
    category: "clipboard",
    defaultKeys: "mod+v",
    keys: "mod+v",
    behavior: direct,
  },
  {
    id: "document.cut",
    actionId: "document.cut",
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
    id: `document.beat.placeNote.${i}`,
    actionId: "document.beat.placeNote",
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
