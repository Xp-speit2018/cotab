/**
 * renderer-bridge.ts — Bridge between Y.Doc and AlphaTab API for rendering.
 *
 * These functions require the AlphaTab API instance, so they live in stores
 * rather than core. They handle the Y.Doc → AlphaTab sync for the renderer.
 *
 * Functions:
 *   rebuildFromYDoc:           Y.Doc → Score → api.load()
 *   loadAlphaTabSource:        File/URL → api.load() without racing Y.Doc
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
let _rendererApi: ReturnType<typeof getApi> = null;
let _unsubscribeRenderStarted: (() => void) | null = null;
let _unsubscribePostRenderFinished: (() => void) | null = null;
let _unsubscribeRendererError: (() => void) | null = null;
let _rendererBusy = false;
let _rebuildPending = false;
let _flushScheduled = false;
let _schedulerVersion = 0;
let _activeLoad: { kind: "source"; document: Y.Doc | null } | { kind: "ydoc" } | null = null;
let _pendingSourceLoad: {
  scoreData: unknown;
  trackIndexes: number[];
  document: Y.Doc | null;
} | null = null;

function finishRendererLoad(): void {
  if (!_rendererBusy && !_activeLoad) return;
  _rendererBusy = false;
  _activeLoad = null;

  const sourceLoad = _pendingSourceLoad;
  _pendingSourceLoad = null;
  if (sourceLoad && sourceLoad.document === engine.getDoc()) {
    const api = getApi();
    if (api) {
      startRendererLoad(api, sourceLoad.scoreData, sourceLoad.trackIndexes, {
        kind: "source",
        document: sourceLoad.document,
      });
      return;
    }
  }
  if (_rebuildPending) scheduleRebuild();
}

function startRendererLoad(
  api: NonNullable<ReturnType<typeof getApi>>,
  scoreData: unknown,
  trackIndexes: number[],
  load: NonNullable<typeof _activeLoad>,
): boolean {
  _rendererBusy = true;
  _activeLoad = load;
  try {
    const started = api.load(scoreData, trackIndexes);
    if (!started && _activeLoad === load) finishRendererLoad();
    return started;
  } catch (error) {
    if (_activeLoad === load) finishRendererLoad();
    throw error;
  }
}

function scheduleRebuild(): void {
  if (_flushScheduled) return;
  _flushScheduled = true;
  const version = _schedulerVersion;
  queueMicrotask(() => {
    if (version !== _schedulerVersion) return;
    _flushScheduled = false;
    flushRebuild();
  });
}

function bindRenderer(api: NonNullable<ReturnType<typeof getApi>>): void {
  if (_rendererApi === api) return;

  _unsubscribeRenderStarted?.();
  _unsubscribePostRenderFinished?.();
  _unsubscribeRendererError?.();
  _rendererApi = api;
  _rendererBusy = false;
  _unsubscribeRenderStarted = api.renderStarted.on(() => {
    _rendererBusy = true;
  });
  _unsubscribePostRenderFinished = api.postRenderFinished.on(() => {
    finishRendererLoad();
  });
  _unsubscribeRendererError = api.error.on(() => finishRendererLoad());
}

function flushRebuild(): void {
  const api = getApi();
  const scoreMap = engine.getScoreMap();
  if (!scoreMap || !api) {
    _rebuildPending = false;
    return;
  }

  bindRenderer(api);
  if (_rendererBusy) return;

  const yTracks = scoreMap.get("tracks") as Y.Array<unknown> | undefined;
  if (!yTracks || yTracks.length === 0) {
    _rebuildPending = false;
    return;
  }

  _rebuildPending = false;
  _rebuildingFromYDoc = true;
  try {
    const score = buildAlphaTabScore(scoreMap, api.settings);
    const previousTrackCount = api.score?.tracks.length ?? 0;
    const trackIndexes = api.tracks
      .map((track) => track.index)
      .filter((index) => index < score.tracks.length);
    for (let index = previousTrackCount; index < score.tracks.length; index++) {
      trackIndexes.push(index);
    }
    startRendererLoad(
      api,
      score,
      trackIndexes.length > 0
        ? [...new Set(trackIndexes)].sort((left, right) => left - right)
        : score.tracks.map((track) => track.index),
      { kind: "ydoc" },
    );
  } finally {
    _rebuildingFromYDoc = false;
  }
}

// ─── Renderer bridge functions ──────────────────────────────────────────────

/**
 * Rebuild a complete AlphaTab Score from Y.Doc and load it into the API.
 * Sets _rebuildingFromYDoc so the scoreLoaded handler knows not to re-import.
 */
export function rebuildFromYDoc(): void {
  _rebuildPending = true;
  scheduleRebuild();
}

/**
 * Load a user-facing score source through the same queue as Y.Doc rebuilds.
 * The source may parse asynchronously, so it keeps the originating document
 * identity and must not be imported after a room connection replaces that doc.
 */
export function loadAlphaTabSource(
  scoreData: unknown,
  trackIndexes: number[] = [-1],
): boolean {
  const api = getApi();
  if (!api) return false;
  bindRenderer(api);

  const sourceLoad = {
    scoreData,
    trackIndexes,
    document: engine.getDoc(),
  };
  if (_rendererBusy) {
    _pendingSourceLoad = sourceLoad;
    return true;
  }
  return startRendererLoad(api, scoreData, trackIndexes, {
    kind: "source",
    document: sourceLoad.document,
  });
}

export function shouldImportLoadedScore(): boolean {
  return _activeLoad?.kind === "source"
    && _activeLoad.document === engine.getDoc();
}

/**
 * Install the renderer observer. Call once during app initialization.
 * This wires up the Y.Doc → AlphaTab rebuild pipeline using engine hooks.
 */
export function installRendererObserver(): void {
  const api = getApi();
  if (api) bindRenderer(api);

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
  _schedulerVersion += 1;
  _unsubscribeHooks?.();
  _unsubscribeHooks = null;
  _unsubscribeRenderStarted?.();
  _unsubscribeRenderStarted = null;
  _unsubscribePostRenderFinished?.();
  _unsubscribePostRenderFinished = null;
  _unsubscribeRendererError?.();
  _unsubscribeRendererError = null;
  _rendererApi = null;
  _rendererBusy = false;
  _activeLoad = null;
  _pendingSourceLoad = null;
  _rebuildPending = false;
  _flushScheduled = false;
}

/**
 * Check if the current rebuild originated from Y.Doc.
 */
export function isRebuildingFromYDoc(): boolean {
  return _rebuildingFromYDoc;
}
