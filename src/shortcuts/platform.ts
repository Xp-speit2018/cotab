import type { KeyCombo } from "./types";
import { parseKeyCombo } from "./types";

export type Platform = "mac" | "windows" | "linux";

let cachedPlatform: Platform | null = null;

export function getPlatform(): Platform {
  if (cachedPlatform) return cachedPlatform;
  if (typeof navigator === "undefined") {
    cachedPlatform = "windows";
    return cachedPlatform;
  }
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) cachedPlatform = "mac";
  else if (ua.includes("linux")) cachedPlatform = "linux";
  else cachedPlatform = "windows";
  return cachedPlatform;
}

export function isMac(): boolean {
  return getPlatform() === "mac";
}

const MAC_SYMBOLS: Record<string, string> = {
  mod: "⌘",
  alt: "⌥",
  shift: "⇧",
  backspace: "⌫",
  delete: "⌦",
  enter: "↩",
  escape: "⎋",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  space: "Space",
  tab: "⇥",
};

const PC_LABELS: Record<string, string> = {
  mod: "Ctrl",
  alt: "Alt",
  shift: "Shift",
  backspace: "Backspace",
  delete: "Delete",
  enter: "Enter",
  escape: "Esc",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  space: "Space",
  tab: "Tab",
};

function formatKeyPart(part: string, mac: boolean): string {
  const table = mac ? MAC_SYMBOLS : PC_LABELS;
  const lower = part.toLowerCase();
  if (table[lower]) return table[lower];
  if (lower.length === 1) return lower.toUpperCase();
  return part.charAt(0).toUpperCase() + part.slice(1);
}

/**
 * Format a platform-agnostic KeyCombo into a human-readable, platform-specific label.
 * On macOS: "⌘⇧T", on Windows/Linux: "Ctrl+Shift+T".
 */
export function formatShortcut(combo: KeyCombo): string {
  if (!combo) return "";
  const parsed = parseKeyCombo(combo);
  const mac = isMac();
  const parts: string[] = [];

  if (parsed.mod) parts.push(formatKeyPart("mod", mac));
  if (parsed.alt) parts.push(formatKeyPart("alt", mac));
  if (parsed.shift) parts.push(formatKeyPart("shift", mac));
  if (parsed.key) parts.push(formatKeyPart(parsed.key, mac));

  return mac ? parts.join("") : parts.join("+");
}

/**
 * Map KeyboardEvent.code to a logical key name.
 * Uses `code` (physical key) so that shifted characters like `{` (Shift+[)
 * resolve back to the base key `[`.
 */
const CODE_TO_KEY: Record<string, string> = {
  Backspace: "backspace",
  Delete: "delete",
  Enter: "enter",
  Escape: "escape",
  Space: "space",
  Tab: "tab",
  ArrowUp: "arrowup",
  ArrowDown: "arrowdown",
  ArrowLeft: "arrowleft",
  ArrowRight: "arrowright",
  BracketLeft: "[",
  BracketRight: "]",
  Minus: "-",
  Equal: "=",
  Period: ".",
  Comma: ",",
  Slash: "/",
  Backslash: "\\",
  Backquote: "`",
  Semicolon: ";",
  Quote: "'",
};

function codeToKey(code: string): string {
  if (CODE_TO_KEY[code]) return CODE_TO_KEY[code];
  if (code.startsWith("Key")) return code.slice(3).toLowerCase();
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return code.slice(6).toLowerCase();
  return code.toLowerCase();
}

const MODIFIER_CODES = new Set([
  "ControlLeft", "ControlRight", "MetaLeft", "MetaRight",
  "AltLeft", "AltRight", "ShiftLeft", "ShiftRight",
]);

/**
 * Convert a raw DOM KeyboardEvent into a normalized KeyCombo string.
 */
export function keyboardEventToCombo(e: KeyboardEvent): KeyCombo {
  if (MODIFIER_CODES.has(e.code)) return "";

  const mac = isMac();
  const mod = mac ? e.metaKey : e.ctrlKey;
  const alt = e.altKey;
  const shift = e.shiftKey;

  const key = codeToKey(e.code);
  if (!key) return "";

  const parts: string[] = [];
  if (mod) parts.push("mod");
  if (alt) parts.push("alt");
  if (shift) parts.push("shift");
  parts.push(key);
  return parts.join("+");
}

/**
 * Check if a KeyboardEvent matches a given KeyCombo.
 */
export function eventMatchesCombo(e: KeyboardEvent, combo: KeyCombo): boolean {
  if (!combo) return false;
  const parsed = parseKeyCombo(combo);
  const mac = isMac();

  const mod = mac ? e.metaKey : e.ctrlKey;
  if (parsed.mod !== mod) return false;
  if (parsed.alt !== e.altKey) return false;
  if (parsed.shift !== e.shiftKey) return false;

  let key = e.key.toLowerCase();
  if (key === " ") key = "space";

  return key === parsed.key;
}
