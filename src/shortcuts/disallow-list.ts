import type { KeyCombo } from "./types";

export interface DisallowedEntry {
  readonly combo: KeyCombo;
  readonly i18nReasonKey: string;
}

/**
 * Key combos that cannot be reliably intercepted across browsers/OS.
 * The config panel rejects these when a user tries to rebind.
 */
export const DISALLOWED_SHORTCUTS: readonly DisallowedEntry[] = [
  { combo: "mod+shift+t", i18nReasonKey: "shortcuts.conflict.reopenTab" },
  { combo: "mod+shift+[", i18nReasonKey: "shortcuts.conflict.prevTab" },
  { combo: "mod+shift+]", i18nReasonKey: "shortcuts.conflict.nextTab" },
  { combo: "mod+w", i18nReasonKey: "shortcuts.conflict.closeTab" },
  { combo: "mod+n", i18nReasonKey: "shortcuts.conflict.newWindow" },
  { combo: "mod+t", i18nReasonKey: "shortcuts.conflict.newTab" },
  { combo: "mod+q", i18nReasonKey: "shortcuts.conflict.quitBrowser" },
];

const disallowedSet = new Set(DISALLOWED_SHORTCUTS.map((e) => e.combo));

export function isDisallowed(combo: KeyCombo): boolean {
  return disallowedSet.has(combo.toLowerCase());
}

export function getDisallowReason(combo: KeyCombo): string | null {
  const entry = DISALLOWED_SHORTCUTS.find((e) => e.combo === combo.toLowerCase());
  return entry?.i18nReasonKey ?? null;
}

/**
 * Combos that override a browser default but CAN be intercepted via preventDefault.
 * Shown as informational warnings in the config panel.
 */
export interface SoftOverrideEntry {
  readonly combo: KeyCombo;
  readonly i18nBrowserActionKey: string;
}

export const SOFT_OVERRIDES: readonly SoftOverrideEntry[] = [
  { combo: "space", i18nBrowserActionKey: "shortcuts.softOverride.scrollDown" },
  { combo: "arrowup", i18nBrowserActionKey: "shortcuts.softOverride.scrollUp" },
  { combo: "arrowdown", i18nBrowserActionKey: "shortcuts.softOverride.scrollDown" },
  { combo: "arrowleft", i18nBrowserActionKey: "shortcuts.softOverride.scrollLeft" },
  { combo: "arrowright", i18nBrowserActionKey: "shortcuts.softOverride.scrollRight" },
  { combo: "backspace", i18nBrowserActionKey: "shortcuts.softOverride.navigateBack" },
  { combo: "mod+b", i18nBrowserActionKey: "shortcuts.softOverride.bookmarks" },
  { combo: "mod+z", i18nBrowserActionKey: "shortcuts.softOverride.undo" },
  { combo: "mod+shift+z", i18nBrowserActionKey: "shortcuts.softOverride.redo" },
  { combo: "mod+c", i18nBrowserActionKey: "shortcuts.softOverride.copy" },
  { combo: "mod+v", i18nBrowserActionKey: "shortcuts.softOverride.paste" },
  { combo: "mod+x", i18nBrowserActionKey: "shortcuts.softOverride.cut" },
];

const softOverrideMap = new Map(SOFT_OVERRIDES.map((e) => [e.combo, e.i18nBrowserActionKey]));

export function getSoftOverride(combo: KeyCombo): string | null {
  return softOverrideMap.get(combo.toLowerCase()) ?? null;
}
