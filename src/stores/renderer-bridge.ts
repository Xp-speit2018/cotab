/**
 * renderer-bridge.ts — Bridge between Y.Doc and AlphaTab API for rendering.
 *
 * These functions require the AlphaTab API instance, so they live in stores
 * rather than core. They handle the Y.Doc → AlphaTab sync for the renderer.
 *
 * Functions:
 *   rebuildFromYDoc:           Y.Doc → Score → api.load()
 *   installRendererObserver:   Wire observeDeep for auto-rebuild
 *   uninstallRendererObserver: Tear down observer
 *   isRebuildingFromYDoc:      Guard flag for scoreLoaded handler
 */

import * as Y from "yjs";
import { getApi } from "./render-api";
import { engine, buildAlphaTabScore } from "@/core/engine";

// ─── State ──────────────────────────────────────────────────────────────────

let _rebuildingFromYDoc = false;
let _unsubscribeHooks: (() => void) | null = null;

// ─── Renderer bridge functions ──────────────────────────────────────────────

/**
 * Rebuild a complete AlphaTab Score from Y.Doc and load it into the API.
 * Sets _rebuildingFromYDoc so the scoreLoaded handler knows not to re-import.
 */
export function rebuildFromYDoc(): void {
  const api = getApi();
  const scoreMap = engine.getScoreMap();
  if (!scoreMap || !api) return;

  const yTracks = scoreMap.get("tracks") as Y.Array<unknown> | undefined;
  if (!yTracks || yTracks.length === 0) return;

  _rebuildingFromYDoc = true;
  try {
    const score = buildAlphaTabScore(scoreMap, api.settings);
    api.load(score);
  } finally {
    _rebuildingFromYDoc = false;
  }
}

/**
 * Install the renderer observer. Call once during app initialization.
 * This wires up the Y.Doc → AlphaTab rebuild pipeline using engine hooks.
 */
export function installRendererObserver(): void {
  // Register hooks for both local and peer edits
  _unsubscribeHooks = engine.registerHooks({
    onLocalYDocEdit: () => rebuildFromYDoc(),
    onPeerYDocEdit: () => rebuildFromYDoc(),
  });
}

/**
 * Remove the renderer observer (e.g., during teardown).
 */
export function uninstallRendererObserver(): void {
  _unsubscribeHooks?.();
  _unsubscribeHooks = null;
}

/**
 * Check if the current rebuild originated from Y.Doc.
 */
export function isRebuildingFromYDoc(): boolean {
  return _rebuildingFromYDoc;
}