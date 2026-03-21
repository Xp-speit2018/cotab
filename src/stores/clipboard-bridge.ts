/**
 * clipboard-bridge.ts — Syncs engine clipboard buffer to system clipboard.
 *
 * The engine stores clipboard data as a text string internally.
 * This bridge listens for clipboard changes and writes them to the
 * system clipboard via the Clipboard API (browser only).
 */

import { engine } from "@/core/engine";

/**
 * Install the clipboard bridge. Returns an unsubscribe function.
 * Call once during app initialization alongside installRendererObserver.
 */
export function installClipboardBridge(): () => void {
  return engine.registerClipboardHook(async (text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Silent fail in non-browser environments or when permission denied
    }
  });
}
