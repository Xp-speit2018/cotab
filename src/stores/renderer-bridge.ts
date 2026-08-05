/**
 * Bridge between the shared Y.Doc and the AlphaTab renderer.
 *
 * Every Y.Doc rebuild receives a monotonically increasing revision. The bridge
 * keeps the complete lifecycle for that revision so UI diagnostics and Agent
 * actions can distinguish a document mutation from a visible render.
 */

import * as Y from "yjs";
import { LayoutMode, ScrollMode } from "@coderline/alphatab";
import { buildAlphaTabScore } from "@/core/converters";
import {
  FULL_DOCUMENT_CHANGE,
  type DocumentChange,
} from "@/core/editor/document-change";
import { engine } from "@/core/engine";
import { debugLog } from "@/core/editor/action-log";
import { getApi, getMainElement } from "./render-api";

export type RendererPipelinePhase =
  | "unavailable"
  | "idle"
  | "scheduled"
  | "building"
  | "loading"
  | "rendering"
  | "succeeded"
  | "failed";

export type RendererFailureStage =
  | "precondition"
  | "model-build"
  | "load"
  | "alphatab"
  | "shutdown"
  | "timeout";

export interface RendererErrorSnapshot {
  readonly name: string;
  readonly message: string;
  readonly stack: string | null;
  readonly cause: string | null;
}

export interface RendererScoreSnapshot {
  readonly masterBarCount: number;
  readonly trackCount: number;
  readonly staffCount: number;
  readonly renderedTrackIndexes: readonly number[];
}

export interface RendererRevisionOutcome {
  readonly status: "succeeded" | "failed";
  readonly revision: number;
  readonly stage: "render" | RendererFailureStage;
  readonly requestedAt: number;
  readonly startedAt: number;
  readonly settledAt: number;
  readonly durationMs: number;
  readonly firstChangedMasterBar: number | null;
  readonly score: RendererScoreSnapshot | null;
  readonly error: RendererErrorSnapshot | null;
}

export interface RendererDiagnosticsSnapshot {
  readonly installed: boolean;
  readonly phase: RendererPipelinePhase;
  readonly requestedRevision: number;
  readonly pendingRevision: number | null;
  readonly activeRevision: number | null;
  readonly settledRevision: number;
  readonly lastSuccessfulRevision: number;
  readonly lastFailedRevision: number;
  readonly activeUpdateKind: "source" | "ydoc" | null;
  readonly pendingFirstChangedMasterBar: number | null;
  readonly activeFirstChangedMasterBar: number | null;
  readonly lastFirstChangedMasterBar: number | null;
  readonly rendererBusy: boolean;
  readonly rebuildPending: boolean;
  readonly sourceLoadPending: boolean;
  readonly requestedCount: number;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly coalescedCount: number;
  readonly lastRequestedAt: number | null;
  readonly lastStartedAt: number | null;
  readonly lastSettledAt: number | null;
  readonly lastDurationMs: number | null;
  readonly currentError: RendererErrorSnapshot | null;
  readonly lastError: RendererErrorSnapshot | null;
  readonly lastOutcome: RendererRevisionOutcome | null;
  readonly lastSuccess: RendererRevisionOutcome | null;
  readonly lastFailure: RendererRevisionOutcome | null;
  readonly recentOutcomes: readonly RendererRevisionOutcome[];
}

type YDocRender = {
  kind: "ydoc";
  revision: number;
  requestedAt: number;
  startedAt: number;
  firstChangedMasterBar: number | null;
  score: RendererScoreSnapshot;
};

type SourceLoad = {
  kind: "source";
  document: Y.Doc | null;
  startedAt: number;
};

type ActiveRendererUpdate = YDocRender | SourceLoad;

type RevisionWaiter = {
  resolve: (outcome: RendererRevisionOutcome) => void;
  timeout: ReturnType<typeof setTimeout>;
};

const REVISION_OUTCOME_LIMIT = 100;
const DEFAULT_WAIT_TIMEOUT_MS = 20_000;

let _rebuildingFromYDoc = false;
let _unsubscribeHooks: (() => void) | null = null;
let _rendererApi: ReturnType<typeof getApi> = null;
let _unsubscribeRenderStarted: (() => void) | null = null;
let _unsubscribePostRenderFinished: (() => void) | null = null;
let _unsubscribeRendererError: (() => void) | null = null;
let _rendererBusy = false;
let _rebuildPending = false;
let _rendererSurfaceHidden = false;
let _flushScheduled = false;
let _schedulerVersion = 0;
let _pendingRevision: number | null = null;
let _pendingFirstChangedMasterBar: number | null = null;
let _activeUpdate: ActiveRendererUpdate | null = null;
let _pendingSourceLoad: {
  scoreData: unknown;
  trackIndexes: number[];
  document: Y.Doc | null;
} | null = null;
let _suppressedScroll: {
  api: NonNullable<ReturnType<typeof getApi>>;
  mode: ScrollMode;
} | null = null;

let _diagnostics: RendererDiagnosticsSnapshot = {
  installed: false,
  phase: "unavailable",
  requestedRevision: 0,
  pendingRevision: null,
  activeRevision: null,
  settledRevision: 0,
  lastSuccessfulRevision: 0,
  lastFailedRevision: 0,
  activeUpdateKind: null,
  pendingFirstChangedMasterBar: null,
  activeFirstChangedMasterBar: null,
  lastFirstChangedMasterBar: null,
  rendererBusy: false,
  rebuildPending: false,
  sourceLoadPending: false,
  requestedCount: 0,
  completedCount: 0,
  failedCount: 0,
  coalescedCount: 0,
  lastRequestedAt: null,
  lastStartedAt: null,
  lastSettledAt: null,
  lastDurationMs: null,
  currentError: null,
  lastError: null,
  lastOutcome: null,
  lastSuccess: null,
  lastFailure: null,
  recentOutcomes: [],
};

const _diagnosticListeners = new Set<() => void>();
const _revisionOutcomes = new Map<number, RendererRevisionOutcome>();
const _revisionWaiters = new Map<number, Set<RevisionWaiter>>();
const _revisionRequestedAt = new Map<number, number>();

function publishDiagnostics(
  patch: Partial<RendererDiagnosticsSnapshot>,
): void {
  _diagnostics = { ..._diagnostics, ...patch };
  for (const listener of _diagnosticListeners) listener();
}

function errorSnapshot(error: unknown): RendererErrorSnapshot {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    return {
      name: error.name || "Error",
      message: error.message || String(error),
      stack: error.stack ?? null,
      cause: cause == null
        ? null
        : cause instanceof Error
          ? `${cause.name}: ${cause.message}`
          : String(cause),
    };
  }
  return {
    name: "Error",
    message: String(error),
    stack: null,
    cause: null,
  };
}

function scoreSnapshot(
  score: ReturnType<typeof buildAlphaTabScore>,
  renderedTrackIndexes: readonly number[],
): RendererScoreSnapshot {
  return {
    masterBarCount: score.masterBars.length,
    trackCount: score.tracks.length,
    staffCount: score.tracks.reduce(
      (count, track) => count + track.staves.length,
      0,
    ),
    renderedTrackIndexes: [...renderedTrackIndexes],
  };
}

function rememberOutcome(outcome: RendererRevisionOutcome): void {
  const firstRevision = _diagnostics.settledRevision + 1;
  for (let revision = firstRevision; revision <= outcome.revision; revision++) {
    _revisionOutcomes.set(revision, outcome);
  }
  while (_revisionOutcomes.size > REVISION_OUTCOME_LIMIT) {
    const oldest = _revisionOutcomes.keys().next().value as number | undefined;
    if (oldest === undefined) break;
    _revisionOutcomes.delete(oldest);
    _revisionRequestedAt.delete(oldest);
  }

  for (const [revision, waiters] of _revisionWaiters) {
    if (revision > outcome.revision) continue;
    _revisionWaiters.delete(revision);
    for (const waiter of waiters) {
      clearTimeout(waiter.timeout);
      waiter.resolve(outcome);
    }
  }
}

function settleSuccess(render: YDocRender): void {
  const settledAt = Date.now();
  const outcome: RendererRevisionOutcome = {
    status: "succeeded",
    revision: render.revision,
    stage: "render",
    requestedAt: render.requestedAt,
    startedAt: render.startedAt,
    settledAt,
    durationMs: settledAt - render.startedAt,
    firstChangedMasterBar: render.firstChangedMasterBar,
    score: render.score,
    error: null,
  };
  rememberOutcome(outcome);
  publishDiagnostics({
    phase: "succeeded",
    activeRevision: null,
    settledRevision: Math.max(_diagnostics.settledRevision, render.revision),
    lastSuccessfulRevision: render.revision,
    activeUpdateKind: null,
    activeFirstChangedMasterBar: null,
    lastFirstChangedMasterBar: render.firstChangedMasterBar,
    rendererBusy: false,
    completedCount: _diagnostics.completedCount + 1,
    lastSettledAt: settledAt,
    lastDurationMs: outcome.durationMs,
    currentError: null,
    lastOutcome: outcome,
    lastSuccess: outcome,
    recentOutcomes: [..._diagnostics.recentOutcomes, outcome].slice(-20),
  });
  debugLog("debug", "RendererBridge", "rebuild complete", {
    revision: render.revision,
    durationMs: outcome.durationMs,
    firstChangedMasterBar: render.firstChangedMasterBar,
    score: render.score,
  });
}

function settleFailure(
  revision: number,
  stage: RendererRevisionOutcome["stage"],
  error: unknown,
  startedAt: number,
  score: RendererScoreSnapshot | null = null,
  firstChangedMasterBar: number | null = null,
): void {
  const settledAt = Date.now();
  const serialized = errorSnapshot(error);
  const requestedAt = _revisionRequestedAt.get(revision) ?? startedAt;
  const outcome: RendererRevisionOutcome = {
    status: "failed",
    revision,
    stage,
    requestedAt,
    startedAt,
    settledAt,
    durationMs: settledAt - startedAt,
    firstChangedMasterBar,
    score,
    error: serialized,
  };
  rememberOutcome(outcome);
  publishDiagnostics({
    phase: "failed",
    activeRevision: null,
    settledRevision: Math.max(_diagnostics.settledRevision, revision),
    lastFailedRevision: revision,
    activeUpdateKind: null,
    activeFirstChangedMasterBar: null,
    lastFirstChangedMasterBar: firstChangedMasterBar,
    rendererBusy: false,
    failedCount: _diagnostics.failedCount + 1,
    lastSettledAt: settledAt,
    lastDurationMs: outcome.durationMs,
    currentError: serialized,
    lastError: serialized,
    lastOutcome: outcome,
    lastFailure: outcome,
    recentOutcomes: [..._diagnostics.recentOutcomes, outcome].slice(-20),
  });
  debugLog("error", "RendererBridge", "rebuild failed", {
    revision,
    stage,
    durationMs: outcome.durationMs,
    error: serialized,
    firstChangedMasterBar,
    score,
  });
}

function recordUnscopedError(
  stage: RendererFailureStage,
  error: unknown,
): void {
  const serialized = errorSnapshot(error);
  publishDiagnostics({
    phase: "failed",
    currentError: serialized,
    lastError: serialized,
    failedCount: _diagnostics.failedCount + 1,
    lastSettledAt: Date.now(),
  });
  debugLog("error", "RendererBridge", "renderer error", {
    stage,
    error: serialized,
  });
}

function continueQueuedUpdates(): void {
  const sourceLoad = _pendingSourceLoad;
  _pendingSourceLoad = null;
  publishDiagnostics({ sourceLoadPending: false });
  if (sourceLoad && sourceLoad.document === engine.getDoc()) {
    const api = getApi();
    if (api) {
      startRendererUpdate(api, sourceLoad.scoreData, sourceLoad.trackIndexes, {
        kind: "source",
        document: sourceLoad.document,
        startedAt: Date.now(),
      });
      return;
    }
  }
  if (_rebuildPending) scheduleRebuild();
}

function suppressRenderCursorScroll(
  api: NonNullable<ReturnType<typeof getApi>>,
): void {
  if (_suppressedScroll) return;
  _suppressedScroll = {
    api,
    mode: api.settings.player.scrollMode,
  };
  api.settings.player.scrollMode = ScrollMode.Off;
}

function restoreRenderCursorScroll(): void {
  if (!_suppressedScroll) return;
  const { api, mode } = _suppressedScroll;
  _suppressedScroll = null;
  api.settings.player.scrollMode = mode;
}

function hideRendererSurface(): void {
  const main = getMainElement();
  if (!main) return;
  main.style.display = "none";
  main.style.visibility = "hidden";
  main.setAttribute("aria-hidden", "true");
  _rendererSurfaceHidden = true;
}

function prepareRendererSurface(): void {
  if (!_rendererSurfaceHidden) return;
  const main = getMainElement();
  if (!main) return;
  main.style.removeProperty("display");
  void main.offsetWidth;
}

function showRendererSurface(): void {
  const main = getMainElement();
  if (main) {
    main.style.removeProperty("display");
    main.style.removeProperty("visibility");
    main.removeAttribute("aria-hidden");
  }
  _rendererSurfaceHidden = false;
}

function finishRendererUpdate(error?: unknown): void {
  if (!_rendererBusy && !_activeUpdate) {
    if (error !== undefined) recordUnscopedError("alphatab", error);
    return;
  }
  const update = _activeUpdate;
  _rendererBusy = false;
  _activeUpdate = null;
  restoreRenderCursorScroll();

  if (update?.kind === "ydoc") {
    if (error === undefined) {
      showRendererSurface();
      settleSuccess(update);
    } else {
      if (_rendererSurfaceHidden) hideRendererSurface();
      settleFailure(
        update.revision,
        "alphatab",
        error,
        update.startedAt,
        update.score,
        update.firstChangedMasterBar,
      );
    }
  } else if (error !== undefined) {
    if (_rendererSurfaceHidden) hideRendererSurface();
    recordUnscopedError("alphatab", error);
  } else {
    showRendererSurface();
    publishDiagnostics({
      phase: "idle",
      activeUpdateKind: null,
      rendererBusy: false,
      currentError: null,
    });
  }

  continueQueuedUpdates();
}

function startRendererUpdate(
  api: NonNullable<ReturnType<typeof getApi>>,
  scoreData: unknown,
  trackIndexes: number[],
  update: ActiveRendererUpdate,
): boolean {
  const reuseViewport = !_rendererSurfaceHidden;
  prepareRendererSurface();
  _rendererBusy = true;
  _activeUpdate = update;
  publishDiagnostics({
    phase: update.kind === "ydoc" ? "rendering" : "loading",
    activeRevision: update.kind === "ydoc" ? update.revision : null,
    activeUpdateKind: update.kind,
    rendererBusy: true,
    lastStartedAt: update.startedAt,
    currentError: null,
  });

  try {
    if (update.kind === "ydoc") {
      // AlphaTab reconciles its playback cursor after every render and scrolls
      // to the previous playback tick even while stopped. CoTab owns the
      // transport cursor, so suppress that render-only scroll without changing
      // AlphaTab's normal playback-follow behavior.
      suppressRenderCursorScroll(api);
      const renderHints: {
        reuseViewport: boolean;
        firstChangedMasterBar?: number;
      } = { reuseViewport };
      if (
        update.firstChangedMasterBar !== null
        && api.settings.display.layoutMode === LayoutMode.Parchment
      ) {
        renderHints.firstChangedMasterBar = update.firstChangedMasterBar;
      }
      api.renderScore(
        scoreData as ReturnType<typeof buildAlphaTabScore>,
        trackIndexes,
        renderHints,
      );
      return true;
    }

    const started = api.load(scoreData, trackIndexes);
    if (!started) {
      const error = new Error("AlphaTab rejected the score data passed to api.load().");
      finishRendererUpdate(error);
    }
    return started;
  } catch (error) {
    _rendererBusy = false;
    _activeUpdate = null;
    restoreRenderCursorScroll();
    if (update.kind === "ydoc") {
      settleFailure(
        update.revision,
        "render",
        error,
        update.startedAt,
        update.score,
        update.firstChangedMasterBar,
      );
    } else {
      recordUnscopedError("load", error);
    }
    continueQueuedUpdates();
    return false;
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
  publishDiagnostics({
    installed: true,
    phase: "idle",
    rendererBusy: false,
    currentError: null,
  });
  _unsubscribeRenderStarted = api.renderStarted.on(() => {
    _rendererBusy = true;
    publishDiagnostics({
      phase: "rendering",
      rendererBusy: true,
      activeUpdateKind: _activeUpdate?.kind ?? null,
    });
  });
  _unsubscribePostRenderFinished = api.postRenderFinished.on(() => {
    finishRendererUpdate();
  });
  _unsubscribeRendererError = api.error.on((error) => {
    finishRendererUpdate(error);
  });
}

function flushRebuild(): void {
  const revision = _pendingRevision ?? _diagnostics.requestedRevision;
  const firstChangedMasterBar = _pendingFirstChangedMasterBar;
  const requestedAt = _revisionRequestedAt.get(revision) ?? Date.now();
  const api = getApi();
  const scoreMap = engine.getScoreMap();
  if (!scoreMap || !api) {
    _rebuildPending = false;
    _pendingRevision = null;
    _pendingFirstChangedMasterBar = null;
    publishDiagnostics({
      rebuildPending: false,
      pendingRevision: null,
      pendingFirstChangedMasterBar: null,
    });
    settleFailure(
      revision,
      "precondition",
      new Error("Renderer rebuild requested without an active Y.Doc and AlphaTab API."),
      Date.now(),
      null,
      firstChangedMasterBar,
    );
    return;
  }

  bindRenderer(api);
  if (_rendererBusy) return;

  const yTracks = scoreMap.get("tracks") as Y.Array<unknown> | undefined;
  if (!yTracks || yTracks.length === 0) {
    _rebuildPending = false;
    _pendingRevision = null;
    _pendingFirstChangedMasterBar = null;
    const startedAt = Date.now();
    publishDiagnostics({
      phase: "rendering",
      rebuildPending: false,
      pendingRevision: null,
      pendingFirstChangedMasterBar: null,
      activeRevision: revision,
      activeUpdateKind: "ydoc",
      activeFirstChangedMasterBar: firstChangedMasterBar,
      lastStartedAt: startedAt,
      currentError: null,
    });
    try {
      api.pause();
      hideRendererSurface();
      const yMasterBars = scoreMap.get("masterBars") as
        | Y.Array<unknown>
        | undefined;
      settleSuccess({
        kind: "ydoc",
        revision,
        requestedAt,
        startedAt,
        firstChangedMasterBar,
        score: {
          masterBarCount: yMasterBars?.length ?? 0,
          trackCount: 0,
          staffCount: 0,
          renderedTrackIndexes: [],
        },
      });
    } catch (error) {
      settleFailure(
        revision,
        "render",
        error,
        startedAt,
        null,
        firstChangedMasterBar,
      );
    }
    continueQueuedUpdates();
    return;
  }

  _rebuildPending = false;
  _pendingRevision = null;
  _pendingFirstChangedMasterBar = null;
  const startedAt = Date.now();
  publishDiagnostics({
    phase: "building",
    pendingRevision: null,
    activeRevision: revision,
    activeUpdateKind: "ydoc",
    pendingFirstChangedMasterBar: null,
    activeFirstChangedMasterBar: firstChangedMasterBar,
    rebuildPending: false,
    lastStartedAt: startedAt,
    currentError: null,
  });
  debugLog("debug", "RendererBridge", "rebuild started", {
    revision,
    firstChangedMasterBar,
  });

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
    const renderedTrackIndexes = trackIndexes.length > 0
      ? [...new Set(trackIndexes)].sort((left, right) => left - right)
      : score.tracks.map((track) => track.index);
    startRendererUpdate(api, score, renderedTrackIndexes, {
      kind: "ydoc",
      revision,
      requestedAt,
      startedAt,
      firstChangedMasterBar,
      score: scoreSnapshot(score, renderedTrackIndexes),
    });
  } catch (error) {
    settleFailure(
      revision,
      "model-build",
      error,
      startedAt,
      null,
      firstChangedMasterBar,
    );
    continueQueuedUpdates();
  } finally {
    _rebuildingFromYDoc = false;
  }
}

export function getRendererDiagnostics(): RendererDiagnosticsSnapshot {
  return _diagnostics;
}

export function subscribeRendererDiagnostics(listener: () => void): () => void {
  _diagnosticListeners.add(listener);
  return () => _diagnosticListeners.delete(listener);
}

export function waitForRendererRevision(
  revision: number,
  timeoutMs: number = DEFAULT_WAIT_TIMEOUT_MS,
): Promise<RendererRevisionOutcome> {
  const existing = _revisionOutcomes.get(revision);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const waiters = _revisionWaiters.get(revision) ?? new Set<RevisionWaiter>();
    const waiter: RevisionWaiter = {
      resolve,
      timeout: setTimeout(() => {
        waiters.delete(waiter);
        if (waiters.size === 0) _revisionWaiters.delete(revision);
        const now = Date.now();
        resolve({
          status: "failed",
          revision,
          stage: "timeout",
          requestedAt: _revisionRequestedAt.get(revision) ?? now,
          startedAt: now,
          settledAt: now,
          durationMs: timeoutMs,
          firstChangedMasterBar: null,
          score: null,
          error: errorSnapshot(
            new Error(`Timed out waiting for renderer revision ${revision}.`),
          ),
        });
      }, timeoutMs),
    };
    waiters.add(waiter);
    _revisionWaiters.set(revision, waiters);
  });
}

/** Schedule a Y.Doc to AlphaTab rebuild and return its renderer revision. */
export function rebuildFromYDoc(
  change: DocumentChange = FULL_DOCUMENT_CHANGE,
): number {
  const revision = _diagnostics.requestedRevision + 1;
  const requestedAt = Date.now();
  _revisionRequestedAt.set(revision, requestedAt);
  const coalesced = _rebuildPending;
  if (!coalesced) {
    _pendingFirstChangedMasterBar = change.firstChangedMasterBar;
  } else if (
    _pendingFirstChangedMasterBar !== null
    && change.firstChangedMasterBar !== null
  ) {
    _pendingFirstChangedMasterBar = Math.min(
      _pendingFirstChangedMasterBar,
      change.firstChangedMasterBar,
    );
  } else {
    _pendingFirstChangedMasterBar = null;
  }
  _rebuildPending = true;
  _pendingRevision = revision;
  publishDiagnostics({
    phase: _rendererBusy ? _diagnostics.phase : "scheduled",
    requestedRevision: revision,
    pendingRevision: revision,
    pendingFirstChangedMasterBar: _pendingFirstChangedMasterBar,
    rebuildPending: true,
    requestedCount: _diagnostics.requestedCount + 1,
    coalescedCount: _diagnostics.coalescedCount + (coalesced ? 1 : 0),
    lastRequestedAt: requestedAt,
    currentError: null,
  });
  scheduleRebuild();
  return revision;
}

/** Load a user-facing source through the same serialized renderer queue. */
export function loadAlphaTabSource(
  scoreData: unknown,
  trackIndexes: number[] = [-1],
): boolean {
  const api = getApi();
  if (!api) {
    recordUnscopedError(
      "precondition",
      new Error("Score source load requested without an AlphaTab API."),
    );
    return false;
  }
  bindRenderer(api);

  const sourceLoad = {
    scoreData,
    trackIndexes,
    document: engine.getDoc(),
  };
  if (_rendererBusy) {
    _pendingSourceLoad = sourceLoad;
    publishDiagnostics({ sourceLoadPending: true });
    return true;
  }
  return startRendererUpdate(api, scoreData, trackIndexes, {
    kind: "source",
    document: sourceLoad.document,
    startedAt: Date.now(),
  });
}

export function shouldImportLoadedScore(): boolean {
  return _activeUpdate?.kind === "source"
    && _activeUpdate.document === engine.getDoc();
}

export function installRendererObserver(): void {
  const api = getApi();
  if (api) bindRenderer(api);
  publishDiagnostics({
    installed: true,
    phase: api ? "idle" : "unavailable",
  });

  _unsubscribeHooks = engine.registerHooks({
    onLocalYDocEdit: (change) => rebuildFromYDoc(change),
    onPeerYDocEdit: (change) => rebuildFromYDoc(change),
  });
}

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
  restoreRenderCursorScroll();

  const outstandingRevision = _pendingRevision
    ?? (_activeUpdate?.kind === "ydoc" ? _activeUpdate.revision : null);
  const outstandingFirstChangedMasterBar = _pendingRevision !== null
    ? _pendingFirstChangedMasterBar
    : _activeUpdate?.kind === "ydoc"
      ? _activeUpdate.firstChangedMasterBar
      : null;
  if (outstandingRevision !== null) {
    settleFailure(
      outstandingRevision,
      "shutdown",
      new Error("Renderer bridge stopped before the rebuild settled."),
      Date.now(),
      null,
      outstandingFirstChangedMasterBar,
    );
  }

  _rendererApi = null;
  _rendererBusy = false;
  showRendererSurface();
  _activeUpdate = null;
  _pendingSourceLoad = null;
  _pendingRevision = null;
  _pendingFirstChangedMasterBar = null;
  _rebuildPending = false;
  _flushScheduled = false;
  publishDiagnostics({
    installed: false,
    phase: "unavailable",
    pendingRevision: null,
    pendingFirstChangedMasterBar: null,
    activeFirstChangedMasterBar: null,
    activeRevision: null,
    activeUpdateKind: null,
    rendererBusy: false,
    rebuildPending: false,
    sourceLoadPending: false,
  });
}

export function isRebuildingFromYDoc(): boolean {
  return _rebuildingFromYDoc;
}
