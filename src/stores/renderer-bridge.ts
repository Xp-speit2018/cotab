/**
 * Bridge between the shared Y.Doc and the AlphaTab renderer.
 *
 * Every Y.Doc rebuild receives a monotonically increasing revision. The bridge
 * keeps the complete lifecycle for that revision so UI diagnostics and Agent
 * actions can distinguish a document mutation from a visible render.
 */

import * as Y from "yjs";
import { engine, buildAlphaTabScore } from "@/core/engine";
import { debugLog } from "@/core/editor/action-log";
import { getApi } from "./render-api";

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
  readonly activeLoadKind: "source" | "ydoc" | null;
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

type YDocLoad = {
  kind: "ydoc";
  revision: number;
  requestedAt: number;
  startedAt: number;
  score: RendererScoreSnapshot;
};

type SourceLoad = {
  kind: "source";
  document: Y.Doc | null;
  startedAt: number;
};

type ActiveLoad = YDocLoad | SourceLoad;

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
let _flushScheduled = false;
let _schedulerVersion = 0;
let _pendingRevision: number | null = null;
let _activeLoad: ActiveLoad | null = null;
let _pendingSourceLoad: {
  scoreData: unknown;
  trackIndexes: number[];
  document: Y.Doc | null;
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
  activeLoadKind: null,
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

function settleSuccess(load: YDocLoad): void {
  const settledAt = Date.now();
  const outcome: RendererRevisionOutcome = {
    status: "succeeded",
    revision: load.revision,
    stage: "render",
    requestedAt: load.requestedAt,
    startedAt: load.startedAt,
    settledAt,
    durationMs: settledAt - load.startedAt,
    score: load.score,
    error: null,
  };
  rememberOutcome(outcome);
  publishDiagnostics({
    phase: "succeeded",
    activeRevision: null,
    settledRevision: Math.max(_diagnostics.settledRevision, load.revision),
    lastSuccessfulRevision: load.revision,
    activeLoadKind: null,
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
    revision: load.revision,
    durationMs: outcome.durationMs,
    score: load.score,
  });
}

function settleFailure(
  revision: number,
  stage: RendererFailureStage,
  error: unknown,
  startedAt: number,
  score: RendererScoreSnapshot | null = null,
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
    score,
    error: serialized,
  };
  rememberOutcome(outcome);
  publishDiagnostics({
    phase: "failed",
    activeRevision: null,
    settledRevision: Math.max(_diagnostics.settledRevision, revision),
    lastFailedRevision: revision,
    activeLoadKind: null,
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

function continueQueuedLoads(): void {
  const sourceLoad = _pendingSourceLoad;
  _pendingSourceLoad = null;
  publishDiagnostics({ sourceLoadPending: false });
  if (sourceLoad && sourceLoad.document === engine.getDoc()) {
    const api = getApi();
    if (api) {
      startRendererLoad(api, sourceLoad.scoreData, sourceLoad.trackIndexes, {
        kind: "source",
        document: sourceLoad.document,
        startedAt: Date.now(),
      });
      return;
    }
  }
  if (_rebuildPending) scheduleRebuild();
}

function finishRendererLoad(error?: unknown): void {
  if (!_rendererBusy && !_activeLoad) {
    if (error !== undefined) recordUnscopedError("alphatab", error);
    return;
  }
  const load = _activeLoad;
  _rendererBusy = false;
  _activeLoad = null;

  if (load?.kind === "ydoc") {
    if (error === undefined) {
      settleSuccess(load);
    } else {
      settleFailure(load.revision, "alphatab", error, load.startedAt, load.score);
    }
  } else if (error !== undefined) {
    recordUnscopedError("alphatab", error);
  } else {
    publishDiagnostics({
      phase: "idle",
      activeLoadKind: null,
      rendererBusy: false,
      currentError: null,
    });
  }

  continueQueuedLoads();
}

function startRendererLoad(
  api: NonNullable<ReturnType<typeof getApi>>,
  scoreData: unknown,
  trackIndexes: number[],
  load: ActiveLoad,
): boolean {
  _rendererBusy = true;
  _activeLoad = load;
  publishDiagnostics({
    phase: "loading",
    activeRevision: load.kind === "ydoc" ? load.revision : null,
    activeLoadKind: load.kind,
    rendererBusy: true,
    lastStartedAt: load.startedAt,
    currentError: null,
  });

  try {
    const started = api.load(scoreData, trackIndexes);
    if (!started) {
      const error = new Error("AlphaTab rejected the score data passed to api.load().");
      if (load.kind === "ydoc") {
        _rendererBusy = false;
        _activeLoad = null;
        settleFailure(load.revision, "load", error, load.startedAt, load.score);
        continueQueuedLoads();
      } else {
        finishRendererLoad(error);
      }
    }
    return started;
  } catch (error) {
    _rendererBusy = false;
    _activeLoad = null;
    if (load.kind === "ydoc") {
      settleFailure(load.revision, "load", error, load.startedAt, load.score);
    } else {
      recordUnscopedError("load", error);
    }
    continueQueuedLoads();
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
      activeLoadKind: _activeLoad?.kind ?? null,
    });
  });
  _unsubscribePostRenderFinished = api.postRenderFinished.on(() => {
    finishRendererLoad();
  });
  _unsubscribeRendererError = api.error.on((error) => {
    finishRendererLoad(error);
  });
}

function flushRebuild(): void {
  const revision = _pendingRevision ?? _diagnostics.requestedRevision;
  const requestedAt = _revisionRequestedAt.get(revision) ?? Date.now();
  const api = getApi();
  const scoreMap = engine.getScoreMap();
  if (!scoreMap || !api) {
    _rebuildPending = false;
    _pendingRevision = null;
    publishDiagnostics({
      rebuildPending: false,
      pendingRevision: null,
    });
    settleFailure(
      revision,
      "precondition",
      new Error("Renderer rebuild requested without an active Y.Doc and AlphaTab API."),
      Date.now(),
    );
    return;
  }

  bindRenderer(api);
  if (_rendererBusy) return;

  const yTracks = scoreMap.get("tracks") as Y.Array<unknown> | undefined;
  if (!yTracks || yTracks.length === 0) {
    _rebuildPending = false;
    _pendingRevision = null;
    publishDiagnostics({
      rebuildPending: false,
      pendingRevision: null,
    });
    settleFailure(
      revision,
      "precondition",
      new Error("Renderer rebuild requested for a score without tracks."),
      Date.now(),
    );
    return;
  }

  _rebuildPending = false;
  _pendingRevision = null;
  const startedAt = Date.now();
  publishDiagnostics({
    phase: "building",
    pendingRevision: null,
    activeRevision: revision,
    activeLoadKind: "ydoc",
    rebuildPending: false,
    lastStartedAt: startedAt,
    currentError: null,
  });
  debugLog("debug", "RendererBridge", "rebuild started", { revision });

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
    startRendererLoad(api, score, renderedTrackIndexes, {
      kind: "ydoc",
      revision,
      requestedAt,
      startedAt,
      score: scoreSnapshot(score, renderedTrackIndexes),
    });
  } catch (error) {
    settleFailure(revision, "model-build", error, startedAt);
    continueQueuedLoads();
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

/** Schedule a full Y.Doc to AlphaTab rebuild and return its revision. */
export function rebuildFromYDoc(): number {
  const revision = _diagnostics.requestedRevision + 1;
  const requestedAt = Date.now();
  _revisionRequestedAt.set(revision, requestedAt);
  const coalesced = _rebuildPending;
  _rebuildPending = true;
  _pendingRevision = revision;
  publishDiagnostics({
    phase: _rendererBusy ? _diagnostics.phase : "scheduled",
    requestedRevision: revision,
    pendingRevision: revision,
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
  return startRendererLoad(api, scoreData, trackIndexes, {
    kind: "source",
    document: sourceLoad.document,
    startedAt: Date.now(),
  });
}

export function shouldImportLoadedScore(): boolean {
  return _activeLoad?.kind === "source"
    && _activeLoad.document === engine.getDoc();
}

export function installRendererObserver(): void {
  const api = getApi();
  if (api) bindRenderer(api);
  publishDiagnostics({
    installed: true,
    phase: api ? "idle" : "unavailable",
  });

  _unsubscribeHooks = engine.registerHooks({
    onLocalYDocEdit: () => rebuildFromYDoc(),
    onPeerYDocEdit: () => rebuildFromYDoc(),
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

  const outstandingRevision = _pendingRevision
    ?? (_activeLoad?.kind === "ydoc" ? _activeLoad.revision : null);
  if (outstandingRevision !== null) {
    settleFailure(
      outstandingRevision,
      "shutdown",
      new Error("Renderer bridge stopped before the rebuild settled."),
      Date.now(),
    );
  }

  _rendererApi = null;
  _rendererBusy = false;
  _activeLoad = null;
  _pendingSourceLoad = null;
  _pendingRevision = null;
  _rebuildPending = false;
  _flushScheduled = false;
  publishDiagnostics({
    installed: false,
    phase: "unavailable",
    pendingRevision: null,
    activeRevision: null,
    activeLoadKind: null,
    rendererBusy: false,
    rebuildPending: false,
    sourceLoadPending: false,
  });
}

export function isRebuildingFromYDoc(): boolean {
  return _rebuildingFromYDoc;
}
