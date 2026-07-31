/**
 * player-store.ts — Zustand store wrapping the AlphaTab API.
 *
 * Shared mutable state (api, DOM refs) lives in player-api.ts.
 * Types, percussion data, helpers, and snap grid are in dedicated modules.
 * This file contains only the store, selection helpers, and lifecycle.
 */

import * as alphaTab from "@coderline/alphatab";
import { create } from "zustand";

import { useEditorStore } from "@/stores/editor-store";
import type {
  AccentuationType,
  BendType,
  BendStyle,
  VibratoType,
  SlideInType,
  SlideOutType,
  HarmonicType,
  Fingers,
  NoteAccidentalMode,
  NoteOrnament,
  Duration,
  DynamicValue,
  GraceType,
  PickStroke,
  BrushType,
  CrescendoType,
  FadeType,
  WhammyType,
  GolpeType,
  WahPedal,
  FermataType,
  Ottavia,
  AutomationType,
  TremoloPickingStyle,
  Rasgueado,
} from "@/core/schema";

import {
  getApi,
  setApi,
  setMainElement,
  setViewportElement,
  setCursorElement,
  getMainElement,
  getViewportElement,
  getCursorElement,
  getDragState,
  setDragState,
  getDragMoveHandler,
  setDragMoveHandler,
  getDragEndHandler,
  setDragEndHandler,
} from "./render-api";
import type {
  BeatAddress,
  BeatPositionArgs,
  LoopRange,
  PlaybackState,
  PlayerState,
  RenderSelectorState,
  RenderTransportState,
  RenderedStave,
  ScoreLayout,
  SelectionRange,
  SelectedBeat,
  SelectedBeatInfo,
  SelectedNoteInfo,
  SystemLayoutRow,
  TrackInfo,
} from "./render-types";
import { GP7_DEF_BY_ID } from "./percussion-data";
import { resolveGp7Id } from "./percussion-data";
import {
  getTrack,
  resolveBeat,
  extractTrackInfo,
  extractStaffInfo,
  extractBarInfo,
  extractMasterBarInfo,
  extractTempoMap,
  extractVoiceInfo,
  applyBarWarningStyles,
} from "./render-helpers";
import {
  getSnapGrids,
  getSnapGridForBar,
  getRenderedStaveForBarBounds,
  buildSnapGrids,
  updateSnapGridOverlay,
  setSnapGridSelection,
  findNearestSnap,
  destroySnapGridOverlay,
} from "./snap-grid";
import { importScoreToYDoc } from "@/core/converters";
import { engine } from "@/core/engine";
import { FILE_IMPORT_ORIGIN } from "@/core/origins";
import { eventMatchesTransportModifier } from "@/shortcuts/transport-modifier";
import {
  createWebCollaborationAdapter,
  parseIceServers,
} from "@/adapters/web/collaboration";
import {
  getRendererDiagnostics,
  isRebuildingFromYDoc,
  installRendererObserver,
  loadAlphaTabSource,
  shouldImportLoadedScore,
  uninstallRendererObserver,
} from "./renderer-bridge";
import {
  createRenderLoadingController,
  type RenderLoadingController,
} from "./render-loading";
import {
  resolvePlaybackFinishedState,
  togglePlayback as toggleApiPlayback,
} from "./playback-control";

// Unsubscribe function for engine hooks
let _unsubscribeHooks: (() => void) | null = null;
let _processingHook = false; // Guard against circular calls
let _selectorMouseDownTarget: HTMLElement | null = null;
let _selectorMouseDownHandler: ((event: MouseEvent) => void) | null = null;
let _selectorFocusAnimationFrame: number | null = null;
let _renderLoadingController: RenderLoadingController | null = null;
const LOOP_RANGE_BEAT_LEFT_PADDING = 8;
const LOOP_RANGE_BEAT_RIGHT_PADDING = 18;
const RANGE_PREVIEW_THRESHOLD_PX = 4;
const TRANSPORT_DRAG_THRESHOLD_PX = 4;
const SELECTOR_RANGE_SNAP_THRESHOLD_PX = 12;
const SELECTOR_FOCUS_MARGIN_PX = 32;
const SELECTOR_FOCUS_MIN_DURATION_MS = 90;
const SELECTOR_FOCUS_MAX_DURATION_MS = 180;

function finishRenderLoadingWhenRendererSettles(): void {
  queueMicrotask(() => {
    if (getRendererDiagnostics().rendererBusy) return;
    _renderLoadingController?.finish();
  });
}

function loadScoreSource(scoreData: unknown): boolean {
  _renderLoadingController?.start();
  const started = loadAlphaTabSource(scoreData);
  if (!started) _renderLoadingController?.finish();
  return started;
}

function removeSelectorMouseDownHandler(): void {
  if (_selectorMouseDownTarget && _selectorMouseDownHandler) {
    _selectorMouseDownTarget.removeEventListener(
      "mousedown",
      _selectorMouseDownHandler,
      { capture: true },
    );
  }
  _selectorMouseDownTarget = null;
  _selectorMouseDownHandler = null;
}

function cancelSelectorFocusAnimation(): void {
  if (_selectorFocusAnimationFrame !== null) {
    cancelAnimationFrame(_selectorFocusAnimationFrame);
    _selectorFocusAnimationFrame = null;
  }
}

// Re-export for consumers that still import from player-store
export type { PendingSelection } from "./render-types";
export type {
  SnapGrid,
  PercSnapGroup,
  TrackInfo,
  SelectedBeat,
  SelectionRange,
  SelectedNoteInfo,
  SelectedBeatInfo,
  SelectedBarInfo,
  SelectedMasterBarInfo,
  SelectedTrackInfo,
  SelectedStaffInfo,
  TuningPresetInfo,
  SelectedVoiceInfo,
  ScoreMetadataField,
  ScoreLayout,
  SystemLayoutRow,
  PlayerState,
  PercArticulationDef,
  DrumCategoryId,
} from "./render-types";
export { SCORE_FIELD_TO_STATE } from "./render-types";
export { getApi } from "./render-api";
export { getSnapGrids } from "./snap-grid";

// ─── Selection helpers (use getApi / getCursorElement / getSnapGrids) ────────

function findBeatBounds(
  trackIndex: number,
  staffIndex: number,
  barIndex: number,
  beatIndex: number,
  renderedStave?: RenderedStave,
): alphaTab.rendering.BeatBounds | null {
  const api = getApi();
  const lookup = api?.boundsLookup;
  if (!lookup) return null;

  for (const system of lookup.staffSystems) {
    for (const masterBar of system.bars) {
      for (const barBounds of masterBar.bars) {
        if (barBounds.beats.length === 0) continue;
        const refBar = barBounds.beats[0].beat.voice.bar;
        if (
          refBar.staff.track.index !== trackIndex ||
          refBar.staff.index !== staffIndex ||
          refBar.index !== barIndex
        ) continue;
        if (
          renderedStave
          && getRenderedStaveForBarBounds(barBounds) !== renderedStave
        ) continue;
        for (const bb of barBounds.beats) {
          if (bb.beat.index === beatIndex) return bb;
        }
      }
    }
  }
  return null;
}

/** Resolve bar/beat at a given point (in unscaled AlphaTab coords). */
function resolveBarAtPoint(
  x: number,
  y: number,
): {
  trackIndex: number;
  staffIndex: number;
  voiceIndex: number;
  barIndex: number;
  beatIndex: number;
  beat: alphaTab.model.Beat;
  snappedString: number | null;
  renderedStave: RenderedStave;
} | null {
  const api = getApi();
  if (!api) return null;
  const lookup = api.boundsLookup;
  if (!lookup) return null;

  for (const system of lookup.staffSystems) {
    const sb = system.realBounds;
    if (y < sb.y || y > sb.y + sb.h) continue;

    for (const masterBar of system.bars) {
      const mb = masterBar.realBounds;
      if (x < mb.x || x > mb.x + mb.w) continue;

      let closestBarBounds: (typeof masterBar.bars)[number] | null = null;
      let closestBarDist = Infinity;
      for (const barBounds of masterBar.bars) {
        const bb = barBounds.realBounds;
        const centerY = bb.y + bb.h / 2;
        const dist = Math.abs(y - centerY);
        if (dist < closestBarDist) {
          closestBarDist = dist;
          closestBarBounds = barBounds;
        }
      }

      if (!closestBarBounds) return null;

      let targetBeat: alphaTab.model.Beat | null = null;
      let bestBeatDist = Infinity;
      for (const beatBounds of closestBarBounds.beats) {
        const bx = beatBounds.realBounds;
        const dist = Math.abs(x - (bx.x + bx.w / 2));
        if (dist < bestBeatDist) {
          bestBeatDist = dist;
          targetBeat = beatBounds.beat;
        }
      }

      if (!targetBeat) return null;

      const bar = targetBeat.voice.bar;
      const staff = bar.staff;
      const track = staff.track;
      const renderedStave = getRenderedStaveForBarBounds(closestBarBounds)
        ?? (staff.showTablature ? "tablature" : "standard");
      const grid = getSnapGridForBar(
        track.index,
        staff.index,
        bar.index,
        renderedStave,
      );
      let snappedString: number | null = null;
      if (grid) {
        const snap = findNearestSnap(grid, y);
        if (snap) snappedString = snap.string;
      }
      if (snappedString === null) {
        snappedString = track.isPercussion ? 3 : 11;
      }

      return {
        trackIndex: track.index,
        staffIndex: staff.index,
        voiceIndex: targetBeat.voice.index,
        barIndex: bar.index,
        beatIndex: targetBeat.index,
        beat: targetBeat,
        snappedString,
        renderedStave,
      };
    }
  }
  return null;
}

function collectRenderedSystemLayoutRows(): SystemLayoutRow[] {
  const lookup = getApi()?.boundsLookup;
  if (!lookup) return [];

  const rows: SystemLayoutRow[] = [];
  const signatures = new Set<string>();
  for (const system of lookup.staffSystems) {
    const firstBarIndex = system.bars[0]?.index;
    const lastBarIndex = system.bars.at(-1)?.index;
    if (firstBarIndex === undefined || lastBarIndex === undefined) continue;
    const bounds = system.realBounds;
    const signature = [
      firstBarIndex,
      lastBarIndex,
      bounds.x,
      bounds.y,
      bounds.w,
      bounds.h,
    ].join(":");
    if (signatures.has(signature)) continue;
    signatures.add(signature);
    rows.push({
      index: rows.length,
      startBarIndex: firstBarIndex,
      endBarIndex: lastBarIndex,
      bounds: {
        x: bounds.x,
        y: bounds.y,
        w: bounds.w,
        h: bounds.h,
      },
    });
  }
  return rows;
}

function createRenderSelectorState(): RenderSelectorState {
  return {
    track: null,
    staff: null,
    bar: null,
    voice: null,
    beat: null,
    note: null,
    trackIndex: null,
    staffIndex: null,
    voiceIndex: null,
    barIndex: null,
    beatIndex: null,
    string: null,
    renderedStave: null,
    beatUuid: null,
    noteIndex: -1,
    selectionRange: null,
  };
}

function createRenderTransportState(): RenderTransportState {
  return {
    playhead: null,
    playheadBeatUuid: null,
    loopRange: null,
    playerState: "stopped",
    currentTime: 0,
    endTime: 0,
    tickPosition: 0,
  };
}

function normalizeBeatPosition(args: BeatPositionArgs): SelectedBeat {
  return {
    trackIndex: args.trackIndex,
    staffIndex: args.staffIndex ?? 0,
    voiceIndex: args.voiceIndex ?? 0,
    barIndex: args.barIndex,
    beatIndex: args.beatIndex,
    string: args.string ?? null,
    ...(args.renderedStave ? { renderedStave: args.renderedStave } : {}),
  };
}

function beatPlaybackStartTick(beat: {
  absolutePlaybackStart?: number;
  playbackStart?: number;
}): number | null {
  const tick = beat.absolutePlaybackStart ?? beat.playbackStart;
  return typeof tick === "number" && Number.isFinite(tick) && tick >= 0
    ? tick
    : null;
}

type TransportPositionSnapshot = {
  currentTime: number;
  endTime: number;
  tickPosition: number;
};

function readApiTransportPosition(fallbackTickPosition = 0): TransportPositionSnapshot {
  const api = getApi();
  const position = (api as unknown as {
    currentPosition?: {
      currentTime?: number;
      endTime?: number;
      currentTick?: number;
    };
  } | null)?.currentPosition;
  const apiTick = api?.tickPosition;
  const apiTime = api?.timePosition;
  return {
    currentTime: typeof apiTime === "number" && Number.isFinite(apiTime)
      ? apiTime
      : typeof position?.currentTime === "number" && Number.isFinite(position.currentTime)
        ? position.currentTime
        : 0,
    endTime: typeof position?.endTime === "number" && Number.isFinite(position.endTime)
      ? position.endTime
      : 0,
    tickPosition: typeof apiTick === "number" && Number.isFinite(apiTick)
      ? apiTick
      : typeof position?.currentTick === "number" && Number.isFinite(position.currentTick)
        ? position.currentTick
        : fallbackTickPosition,
  };
}

function positionSnapshotFromEvent(
  e: alphaTab.synth.PositionChangedEventArgs,
): TransportPositionSnapshot {
  return {
    currentTime: e.currentTime,
    endTime: e.endTime,
    tickPosition: e.currentTick,
  };
}

function seekApiToBeatPosition(position: SelectedBeat): TransportPositionSnapshot | null {
  const api = getApi();
  if (!api) return null;
  const beat = resolveBeat(
    position.trackIndex,
    position.barIndex,
    position.beatIndex,
    position.staffIndex,
    position.voiceIndex,
  );
  if (!beat) return null;
  const tick = beatPlaybackStartTick(beat);
  if (tick === null) return null;
  api.tickPosition = tick;
  return readApiTransportPosition(tick);
}

function resolveBeatAddressTick(address: BeatAddress): number | null {
  const beat = resolveBeat(
    address.trackIndex,
    address.barIndex,
    address.beatIndex,
    address.staffIndex,
    address.voiceIndex,
  );
  return beat ? beatPlaybackStartTick(beat) : null;
}

function compareBeatAddresses(a: BeatAddress, b: BeatAddress): number {
  const aTick = resolveBeatAddressTick(a);
  const bTick = resolveBeatAddressTick(b);
  if (aTick !== null && bTick !== null && aTick !== bTick) {
    return aTick - bTick;
  }
  if (a.barIndex !== b.barIndex) return a.barIndex - b.barIndex;
  return a.beatIndex - b.beatIndex;
}

function normalizeLoopRange(start: BeatAddress, end: BeatAddress): LoopRange {
  return compareBeatAddresses(start, end) <= 0
    ? { start, end }
    : { start: end, end: start };
}

function resolveFollowingBeat(address: BeatAddress): alphaTab.model.Beat | null {
  const score = getApi()?.score;
  const bars = score?.tracks?.[address.trackIndex]?.staves?.[address.staffIndex]?.bars;
  if (!bars) return null;

  for (let barIndex = address.barIndex; barIndex < bars.length; barIndex++) {
    const beats = bars[barIndex]?.voices?.[address.voiceIndex]?.beats;
    if (!beats || beats.length === 0) continue;
    const firstBeatIndex = barIndex === address.barIndex ? address.beatIndex + 1 : 0;
    if (firstBeatIndex < beats.length) return beats[firstBeatIndex] ?? null;
  }
  return null;
}

function beatToAddress(beat: alphaTab.model.Beat): BeatAddress {
  const bar = beat.voice.bar;
  const staff = bar.staff;
  return {
    trackIndex: staff.track.index,
    staffIndex: staff.index,
    voiceIndex: beat.voice.index,
    barIndex: bar.index,
    beatIndex: beat.index,
  };
}

function resolveLoopRangeTicks(
  range: LoopRange,
): { startTick: number; endTick: number } | null {
  const startBeat = resolveBeat(
    range.start.trackIndex,
    range.start.barIndex,
    range.start.beatIndex,
    range.start.staffIndex,
    range.start.voiceIndex,
  );
  if (!startBeat) return null;
  const startTick = beatPlaybackStartTick(startBeat);
  if (startTick === null) return null;

  const endBeat = resolveBeat(
    range.end.trackIndex,
    range.end.barIndex,
    range.end.beatIndex,
    range.end.staffIndex,
    range.end.voiceIndex,
  );
  if (!endBeat) return null;

  const followingBeat = resolveFollowingBeat(range.end);
  if (followingBeat) {
    const endTick = beatPlaybackStartTick(followingBeat);
    if (endTick !== null && endTick > startTick) {
      return { startTick, endTick };
    }
  }

  const lastStartTick = beatPlaybackStartTick(endBeat);
  if (lastStartTick === null || lastStartTick < startTick) return null;
  const duration =
    typeof endBeat.playbackDuration === "number" && endBeat.playbackDuration > 0
      ? endBeat.playbackDuration
      : 1;
  return { startTick, endTick: lastStartTick + duration };
}

function clearNativePlaybackRange(): void {
  const api = getApi();
  if (!api) return;
  api.isLooping = false;
  api.playbackRange = null;
}

function updateCursorRect(
  beatBounds: alphaTab.rendering.BeatBounds | null,
  snap: { string: number; y: number } | null,
  grid: { positions: { string: number; y: number }[]; noteWidth: number; noteHeight: number } | null,
): void {
  const cursorElement = getCursorElement();
  if (!cursorElement) return;
  if (!beatBounds || !grid) {
    cursorElement.style.display = "none";
    return;
  }
  const w = grid.noteWidth;
  const h = grid.noteHeight;
  const x = beatBounds.onNotesX - w / 2;
  const y = snap
    ? snap.y - h / 2
    : beatBounds.visualBounds.y + beatBounds.visualBounds.h / 2 - h / 2;
  cursorElement.style.display = "";
  cursorElement.style.left = `${x}px`;
  cursorElement.style.top = `${y}px`;
  cursorElement.style.width = `${w}px`;
  cursorElement.style.height = `${h}px`;
}

function focusSelectorCursorInViewport(): void {
  cancelSelectorFocusAnimation();

  const viewportElement = getViewportElement();
  const cursorElement = getCursorElement();
  if (!viewportElement || !cursorElement || cursorElement.style.display === "none") {
    return;
  }

  _selectorFocusAnimationFrame = requestAnimationFrame((startTime) => {
    const viewportRect = viewportElement.getBoundingClientRect();
    const cursorRect = cursorElement.getBoundingClientRect();
    const horizontalMargin = Math.min(
      SELECTOR_FOCUS_MARGIN_PX,
      viewportRect.width / 4,
    );
    const verticalMargin = Math.min(
      SELECTOR_FOCUS_MARGIN_PX,
      viewportRect.height / 4,
    );

    let deltaX = 0;
    if (cursorRect.left < viewportRect.left + horizontalMargin) {
      deltaX = cursorRect.left - viewportRect.left - horizontalMargin;
    } else if (cursorRect.right > viewportRect.right - horizontalMargin) {
      deltaX = cursorRect.right - viewportRect.right + horizontalMargin;
    }

    let deltaY = 0;
    if (cursorRect.top < viewportRect.top + verticalMargin) {
      deltaY = cursorRect.top - viewportRect.top - verticalMargin;
    } else if (cursorRect.bottom > viewportRect.bottom - verticalMargin) {
      deltaY = cursorRect.bottom - viewportRect.bottom + verticalMargin;
    }

    const startLeft = viewportElement.scrollLeft;
    const startTop = viewportElement.scrollTop;
    const targetLeft = Math.max(
      0,
      Math.min(
        startLeft + deltaX,
        viewportElement.scrollWidth - viewportElement.clientWidth,
      ),
    );
    const targetTop = Math.max(
      0,
      Math.min(
        startTop + deltaY,
        viewportElement.scrollHeight - viewportElement.clientHeight,
      ),
    );
    const distance = Math.hypot(targetLeft - startLeft, targetTop - startTop);
    if (distance < 0.5) {
      _selectorFocusAnimationFrame = null;
      return;
    }

    const duration = Math.min(
      SELECTOR_FOCUS_MAX_DURATION_MS,
      Math.max(SELECTOR_FOCUS_MIN_DURATION_MS, distance * 0.35),
    );
    const animate = (currentTime: number) => {
      const progress = Math.min(1, (currentTime - startTime) / duration);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      viewportElement.scrollLeft = startLeft
        + (targetLeft - startLeft) * easedProgress;
      viewportElement.scrollTop = startTop
        + (targetTop - startTop) * easedProgress;

      if (progress < 1) {
        _selectorFocusAnimationFrame = requestAnimationFrame(animate);
      } else {
        _selectorFocusAnimationFrame = null;
      }
    };

    animate(startTime);
  });
}

// ─── Transport playhead cursor ───────────────────────────────────────────────

type TransportCursorBounds = { x: number; y: number; h: number };
let transportPlayheadElement: HTMLDivElement | null = null;

function hideAlphaTabPlaybackCursor(): void {
  const mainElement = getMainElement();
  const cursorBar = mainElement?.querySelector(".at-cursor-bar") as HTMLElement | null;
  const cursorBeat = mainElement?.querySelector(".at-cursor-beat") as HTMLElement | null;
  if (cursorBar) cursorBar.style.display = "none";
  if (cursorBeat) cursorBeat.style.display = "none";
}

function findTransportCursorBoundsForTick(tick: number): TransportCursorBounds | null {
  const lookup = getApi()?.boundsLookup;
  if (!lookup) return null;
  let first: (TransportCursorBounds & { tick: number }) | null = null;
  let best: (TransportCursorBounds & { tick: number }) | null = null;
  for (const system of lookup.staffSystems) {
    for (const masterBarBounds of system.bars) {
      const vb = masterBarBounds.visualBounds;
      for (const barBounds of masterBarBounds.bars) {
        for (const beatBounds of barBounds.beats) {
          const beatTick = beatPlaybackStartTick(beatBounds.beat);
          if (beatTick === null) continue;
          const candidate = {
            tick: beatTick,
            x: beatBounds.onNotesX,
            y: vb.y,
            h: vb.h,
          };
          first ??= candidate;
          if (beatTick <= tick && (!best || beatTick > best.tick)) {
            best = candidate;
          }
        }
      }
    }
  }

  return best ?? first;
}

function updateTransportPlayheadOverlay(tickPosition: number | null): void {
  hideAlphaTabPlaybackCursor();
  if (tickPosition === null) {
    if (transportPlayheadElement) transportPlayheadElement.style.display = "none";
    return;
  }

  const bounds = findTransportCursorBoundsForTick(tickPosition);
  if (!bounds) {
    if (transportPlayheadElement) transportPlayheadElement.style.display = "none";
    return;
  }

  const mainElement = getMainElement();
  const cursorsWrapper = mainElement?.querySelector(".at-cursors");
  if (!cursorsWrapper) return;

  if (!transportPlayheadElement) {
    transportPlayheadElement = document.createElement("div");
    transportPlayheadElement.classList.add("at-transport-playhead");
    cursorsWrapper.appendChild(transportPlayheadElement);
  }

  transportPlayheadElement.style.display = "";
  transportPlayheadElement.style.left = `${bounds.x}px`;
  transportPlayheadElement.style.top = `${bounds.y}px`;
  transportPlayheadElement.style.height = `${bounds.h}px`;
}

function destroyTransportPlayheadOverlay(): void {
  transportPlayheadElement?.remove();
  transportPlayheadElement = null;
  hideAlphaTabPlaybackCursor();
}

// ─── Range overlays ─────────────────────────────────────────────────────────

type RangeOverlayKind = "selector" | "transport";
type OverlayRect = { x: number; y: number; w: number; h: number };

const rangeOverlayElements: Record<RangeOverlayKind, HTMLDivElement[]> = {
  selector: [],
  transport: [],
};
let rangeBackgroundLayer: HTMLDivElement | null = null;

function getCursorsWrapper(): Element | null {
  const mainElement = getMainElement();
  return mainElement?.querySelector(".at-cursors") ?? null;
}

function normalizeRangeBackgroundLayerStyle(layer: HTMLDivElement): void {
  layer.style.position = "absolute";
  layer.style.left = "0";
  layer.style.top = "0";
  layer.style.right = "0";
  layer.style.bottom = "0";
  layer.style.width = "";
  layer.style.height = "";
  layer.style.display = "block";
  layer.style.zIndex = "0";
}

function getRangeBackgroundLayer(): HTMLElement | null {
  const mainElement = getMainElement();
  if (!mainElement) return null;
  const host = mainElement;
  if (rangeBackgroundLayer?.isConnected && rangeBackgroundLayer.parentElement === host) {
    normalizeRangeBackgroundLayerStyle(rangeBackgroundLayer);
    return rangeBackgroundLayer;
  }

  rangeBackgroundLayer?.remove();
  rangeBackgroundLayer = document.createElement("div");
  rangeBackgroundLayer.classList.add("cotab-range-background-layer");
  host.prepend(rangeBackgroundLayer);
  normalizeRangeBackgroundLayerStyle(rangeBackgroundLayer);
  return rangeBackgroundLayer;
}

function hideOverlayElements(elements: HTMLDivElement[]): void {
  for (const el of elements) el.style.display = "none";
}

function renderRangeOverlay(kind: RangeOverlayKind, rects: OverlayRect[]): void {
  const rangeLayer = getRangeBackgroundLayer();
  const elements = rangeOverlayElements[kind];
  if (!rangeLayer) {
    hideOverlayElements(elements);
    return;
  }

  while (elements.length < rects.length) {
    const el = document.createElement("div");
    el.classList.add(kind === "selector" ? "at-bar-selection" : "at-loop-range");
    rangeLayer.appendChild(el);
    elements.push(el);
  }

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (i < rects.length) {
      if (el.parentElement !== rangeLayer) {
        rangeLayer.appendChild(el);
      }
      const r = rects[i];
      el.style.display = "";
      el.style.left = `${r.x}px`;
      el.style.top = `${r.y}px`;
      el.style.width = `${r.w}px`;
      el.style.height = `${r.h}px`;
    } else {
      el.style.display = "none";
    }
  }
}

function buildSelectorRangeRects(range: SelectionRange): OverlayRect[] {
  const api = getApi();
  const lookup = api?.boundsLookup;
  if (!lookup) return [];

  const rects: OverlayRect[] = [];

  for (const system of lookup.staffSystems) {
    let rowFirstX: number | null = null;
    let rowLastXW: number | null = null;
    let rowY = 0;
    let rowH = 0;

    for (const masterBar of system.bars) {
      if (masterBar.bars.length === 0) continue;
      const barIdx = masterBar.index;

      if (barIdx < range.startBarIndex || barIdx > range.endBarIndex) continue;

      for (const barBounds of masterBar.bars) {
        if (barBounds.beats.length === 0) continue;
        const bb = barBounds.beats[0].beat.voice.bar;
        if (
          bb.staff.track.index !== range.trackIndex ||
          bb.staff.index !== range.staffIndex
        ) continue;

        const rb = barBounds.realBounds;
        if (rowFirstX === null) {
          rowFirstX = rb.x;
          rowY = rb.y;
          rowH = rb.h;
        }
        rowLastXW = rb.x + rb.w;
        if (rb.h > rowH) rowH = rb.h;
        break;
      }
    }

    if (rowFirstX !== null && rowLastXW !== null) {
      rects.push({ x: rowFirstX, y: rowY, w: rowLastXW - rowFirstX, h: rowH });
    }
  }

  return rects;
}

function getBeatContentXRange(address: BeatAddress): { left: number; right: number } | null {
  const beatBounds = findBeatBounds(
    address.trackIndex,
    address.staffIndex,
    address.barIndex,
    address.beatIndex,
  );
  if (!beatBounds) return null;

  const noteBounds = Array.from(beatBounds.notes ?? [])
    .map((noteBounds) => noteBounds.noteHeadBounds)
    .filter((bounds) =>
      Boolean(bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.w) && bounds.w > 0),
    );
  if (noteBounds.length > 0) {
    const left = Math.min(...noteBounds.map((bounds) => bounds.x));
    const right = Math.max(...noteBounds.map((bounds) => bounds.x + bounds.w));
    return { left, right };
  }

  const rb = beatBounds.realBounds;
  const vb = beatBounds.visualBounds;
  const visualLeft = Number.isFinite(vb.x)
    ? vb.x
    : Number.isFinite(rb.x)
      ? rb.x
      : beatBounds.onNotesX;
  const visualRight =
    Number.isFinite(vb.x) && Number.isFinite(vb.w) && vb.w > 0
      ? vb.x + vb.w
      : Number.isFinite(rb.x) && Number.isFinite(rb.w) && rb.w > 0
        ? rb.x + rb.w
      : beatBounds.onNotesX;

  return {
    left: Math.min(visualLeft, beatBounds.onNotesX),
    right: Math.max(visualRight, beatBounds.onNotesX),
  };
}

function getLoopBeatXRange(address: BeatAddress): { left: number; right: number } | null {
  const contentRange = getBeatContentXRange(address);
  if (!contentRange) return null;

  return {
    left: contentRange.left - LOOP_RANGE_BEAT_LEFT_PADDING,
    right: contentRange.right + LOOP_RANGE_BEAT_RIGHT_PADDING,
  };
}

function resolveBarBoundaryBeatAddress(
  reference: BeatAddress,
  barIndex: number,
  boundary: "first" | "last",
): BeatAddress | null {
  const score = getApi()?.score;
  const beats =
    score?.tracks?.[reference.trackIndex]?.staves?.[reference.staffIndex]?.bars?.[barIndex]
      ?.voices?.[reference.voiceIndex]?.beats;
  if (!beats || beats.length === 0) return null;
  return {
    ...reference,
    barIndex,
    beatIndex: boundary === "first" ? 0 : beats.length - 1,
  };
}

function beatAddressFromHit(hit: {
  trackIndex: number;
  staffIndex: number;
  voiceIndex: number;
  barIndex: number;
  beatIndex: number;
}): BeatAddress {
  return {
    trackIndex: hit.trackIndex,
    staffIndex: hit.staffIndex,
    voiceIndex: hit.voiceIndex,
    barIndex: hit.barIndex,
    beatIndex: hit.beatIndex,
  };
}

function collectBeatAnchors(
  reference: BeatAddress,
): Array<{
  address: BeatAddress;
  left: number;
  right: number;
  systemIndex: number;
}> {
  const api = getApi();
  const lookup = api?.boundsLookup;
  if (!lookup) return [];

  const anchors: Array<{
    address: BeatAddress;
    left: number;
    right: number;
    systemIndex: number;
  }> = [];
  for (const system of lookup.staffSystems) {
    for (const masterBar of system.bars) {
      for (const barBounds of masterBar.bars) {
        for (const beatBounds of barBounds.beats) {
          const beat = beatBounds.beat;
          const bar = beat.voice.bar;
          const staff = bar.staff;
          if (
            staff.track.index !== reference.trackIndex ||
            staff.index !== reference.staffIndex ||
            beat.voice.index !== reference.voiceIndex
          ) continue;
          const address = beatToAddress(beat);
          const contentRange = getBeatContentXRange(address);
          if (!contentRange) continue;
          anchors.push({
            address,
            left: contentRange.left,
            right: contentRange.right,
            systemIndex: system.index,
          });
        }
      }
    }
  }

  return anchors.sort((a, b) => compareBeatAddresses(a.address, b.address));
}

function resolveTransportLoopEndpointAtPoint(
  hit: {
    trackIndex: number;
    staffIndex: number;
    voiceIndex: number;
    barIndex: number;
    beatIndex: number;
  },
  x: number,
  anchorX: number,
  anchorAddress: BeatAddress,
): BeatAddress {
  const address = beatAddressFromHit(hit);
  const anchors = collectBeatAnchors(address);
  if (anchors.length === 0) return address;

  const hitAnchor = anchors.find(
    (anchor) => compareBeatAddresses(anchor.address, address) === 0,
  );
  if (!hitAnchor) return address;

  const localAnchors = anchors.filter(
    (anchor) => anchor.systemIndex === hitAnchor.systemIndex,
  );
  if (localAnchors.length === 0) return address;

  const firstLocalIndex = anchors.indexOf(localAnchors[0]);
  const lastLocalIndex = anchors.indexOf(
    localAnchors[localAnchors.length - 1],
  );
  const addressOrder = compareBeatAddresses(address, anchorAddress);
  const isForward = addressOrder > 0 || (addressOrder === 0 && x >= anchorX);

  if (isForward) {
    let endpoint =
      anchors[firstLocalIndex - 1]?.address ?? localAnchors[0].address;
    for (const anchor of localAnchors) {
      if (anchor.left > x) break;
      endpoint = anchor.address;
    }
    return endpoint;
  }

  for (const anchor of localAnchors) {
    if (anchor.right >= x) return anchor.address;
  }
  return anchors[lastLocalIndex + 1]?.address ?? localAnchors.at(-1)!.address;
}

function buildLoopRangeRects(range: LoopRange): OverlayRect[] {
  const api = getApi();
  const lookup = api?.boundsLookup;
  if (!lookup) return [];

  const rects: OverlayRect[] = [];
  const startBarIndex = range.start.barIndex;
  const endBarIndex = range.end.barIndex;

  for (const system of lookup.staffSystems) {
    let rowFirstX: number | null = null;
    let rowLastXW: number | null = null;
    let rowY = 0;
    let rowH = 0;

    for (const masterBar of system.bars) {
      if (masterBar.bars.length === 0) continue;
      const masterBarIndex = masterBar.index;
      if (masterBarIndex < startBarIndex || masterBarIndex > endBarIndex) continue;

      const leftAddress =
        masterBarIndex === startBarIndex
          ? range.start
          : resolveBarBoundaryBeatAddress(range.start, masterBarIndex, "first");
      const rightAddress =
        masterBarIndex === endBarIndex
          ? range.end
          : resolveBarBoundaryBeatAddress(range.start, masterBarIndex, "last");
      if (!leftAddress || !rightAddress) continue;

      const leftRange = getLoopBeatXRange(leftAddress);
      const rightRange = getLoopBeatXRange(rightAddress);
      if (!leftRange || !rightRange) continue;

      const rb = masterBar.visualBounds;
      const left = leftRange.left;
      let right = rightRange.right;
      if (right <= left) right = left + 4;

      if (rowFirstX === null) {
        rowFirstX = left;
        rowY = rb.y;
        rowH = rb.h;
      }
      rowLastXW = right;
      const bottom = rb.y + rb.h;
      const currentBottom = rowY + rowH;
      if (rb.y < rowY) {
        rowH = currentBottom - rb.y;
        rowY = rb.y;
      }
      if (bottom > rowY + rowH) rowH = bottom - rowY;
    }

    if (rowFirstX !== null && rowLastXW !== null) {
      rects.push({ x: rowFirstX, y: rowY, w: rowLastXW - rowFirstX, h: rowH });
    }
  }

  return rects;
}

let dragRangePreviewElement: HTMLDivElement | null = null;

function updateDragRangePreviewOverlay(
  anchor: { x: number; y: number },
  current: { x: number; y: number },
): void {
  const cursorsWrapper = getCursorsWrapper();
  if (!cursorsWrapper) return;

  if (!dragRangePreviewElement) {
    dragRangePreviewElement = document.createElement("div");
    dragRangePreviewElement.classList.add("at-drag-range-preview");
    cursorsWrapper.appendChild(dragRangePreviewElement);
  }

  const x = Math.min(anchor.x, current.x);
  let y = Math.min(anchor.y, current.y);
  const centerY = (anchor.y + current.y) / 2;
  const w = Math.max(4, Math.abs(current.x - anchor.x));
  let h = Math.abs(current.y - anchor.y);
  if (h < 28) {
    h = 28;
    y = centerY - h / 2;
  }
  y = Math.max(0, y);

  dragRangePreviewElement.style.display = "";
  dragRangePreviewElement.style.left = `${x}px`;
  dragRangePreviewElement.style.top = `${y}px`;
  dragRangePreviewElement.style.width = `${w}px`;
  dragRangePreviewElement.style.height = `${h}px`;
}

function hideDragRangePreviewOverlay(): void {
  if (dragRangePreviewElement) dragRangePreviewElement.style.display = "none";
}

function destroyDragRangePreviewOverlay(): void {
  dragRangePreviewElement?.remove();
  dragRangePreviewElement = null;
}

function updateBarSelectionOverlay(range: SelectionRange | null): void {
  renderRangeOverlay("selector", range ? buildSelectorRangeRects(range) : []);
}

function hideBarSelectionOverlay(): void {
  renderRangeOverlay("selector", []);
}

function updateTransportLoopOverlay(range: LoopRange | null): void {
  renderRangeOverlay("transport", range ? buildLoopRangeRects(range) : []);
}

function destroyRangeOverlays(): void {
  for (const elements of Object.values(rangeOverlayElements)) {
    for (const el of elements) el.remove();
    elements.length = 0;
  }
  rangeBackgroundLayer?.remove();
  rangeBackgroundLayer = null;
  destroyDragRangePreviewOverlay();
}

/**
 * AlphaTab replaces its surface and cursor containers when layout settings
 * change. CoTab overlays cache DOM nodes in those containers, so they must be
 * discarded before the render and recreated from fresh bounds afterwards.
 */
function invalidateCoTabRenderOverlays(): void {
  destroySnapGridOverlay();
  destroyRangeOverlays();
  destroyTransportPlayheadOverlay();
}

function readVisibleIndices(): number[] {
  const api = getApi();
  if (!api?.tracks) return [];
  return api.tracks.map((t) => t.index);
}

function resolvePercussionName(note: alphaTab.model.Note): string {
  const idx = note.percussionArticulation;
  const track = note.beat.voice.bar.staff.track;
  const articulations = track.percussionArticulations;
  if (articulations && idx >= 0 && idx < articulations.length) {
    return articulations[idx].elementType;
  }
  const def = GP7_DEF_BY_ID.get(idx);
  if (def) return `${def.elementType} (${def.technique})`;
  return String(idx);
}

function extractNoteInfo(note: alphaTab.model.Note): SelectedNoteInfo {
  const perc = note.isPercussion;
  return {
    index: note.index,
    fret: note.fret,
    string: note.string,
    stringCount: note.beat.voice.bar.staff.tuning.length,
    octave: note.octave,
    tone: note.tone,
    isDead: note.isDead,
    isGhost: note.isGhost,
    isStaccato: note.isStaccato,
    isLetRing: note.isLetRing,
    isPalmMute: note.isPalmMute,
    isTieDestination: note.isTieDestination,
    isHammerPullOrigin: note.isHammerPullOrigin,
    isLeftHandTapped: note.isLeftHandTapped,
    isContinuedBend: note.isContinuedBend,
    accentuated: note.accentuated as unknown as AccentuationType,
    vibrato: note.vibrato as unknown as VibratoType,
    slideInType: note.slideInType as unknown as SlideInType,
    slideOutType: note.slideOutType as unknown as SlideOutType,
    harmonicType: note.harmonicType as unknown as HarmonicType,
    harmonicValue: note.harmonicValue,
    bendType: note.bendType as unknown as BendType,
    bendStyle: note.bendStyle as unknown as BendStyle,
    bendPoints: note.bendPoints
      ? note.bendPoints.map((p) => ({ offset: p.offset, value: p.value }))
      : null,
    leftHandFinger: note.leftHandFinger as unknown as Fingers,
    rightHandFinger: note.rightHandFinger as unknown as Fingers,
    dynamics: note.dynamics as unknown as DynamicValue,
    ornament: note.ornament as unknown as NoteOrnament,
    accidentalMode: note.accidentalMode as unknown as NoteAccidentalMode,
    trillValue: note.trillValue,
    trillSpeed: note.trillSpeed as unknown as Duration,
    durationPercent: note.durationPercent,
    isPercussion: perc,
    percussionArticulation: perc ? note.percussionArticulation : -1,
    percussionArticulationName: perc ? resolvePercussionName(note) : "",
    percussionGp7Id: perc ? resolveGp7Id(note) : -1,
  };
}

function extractBeatInfo(beat: alphaTab.model.Beat): SelectedBeatInfo {
  const fermata = beat.fermata;
  return {
    index: beat.index,
    duration: beat.duration as unknown as Duration,
    dots: beat.dots,
    isRest: beat.isRest,
    isEmpty: beat.isEmpty,
    tupletNumerator: beat.tupletNumerator,
    tupletDenominator: beat.tupletDenominator,
    graceType: beat.graceType as unknown as GraceType,
    pickStroke: beat.pickStroke as unknown as PickStroke,
    brushType: beat.brushType as unknown as BrushType,
    brushDuration: beat.brushDuration,
    dynamics: beat.dynamics as unknown as DynamicValue,
    crescendo: beat.crescendo as unknown as CrescendoType,
    vibrato: beat.vibrato as unknown as VibratoType,
    fade: beat.fade as unknown as FadeType,
    ottava: beat.ottava as unknown as Ottavia,
    golpe: beat.golpe as unknown as GolpeType,
    wahPedal: beat.wahPedal as unknown as WahPedal,
    whammyStyle: beat.whammyStyle as unknown as BendStyle,
    isContinuedWhammy: beat.isContinuedWhammy,
    whammyBarType: beat.whammyBarType as unknown as WhammyType,
    whammyBarPoints: beat.whammyBarPoints
      ? beat.whammyBarPoints.map((p) => ({ offset: p.offset, value: p.value }))
      : null,
    automations: beat.automations.map((automation) => ({
      isLinear: automation.isLinear,
      type: automation.type as unknown as AutomationType,
      value: automation.value,
      ratioPosition: automation.ratioPosition,
      text: automation.text,
      isVisible: automation.isVisible,
    })),
    lyrics: beat.lyrics ? [...beat.lyrics] : null,
    tremoloPicking: beat.tremoloPicking
      ? {
          marks: beat.tremoloPicking.marks,
          style: beat.tremoloPicking.style as unknown as TremoloPickingStyle,
        }
      : null,
    rasgueado: beat.rasgueado as unknown as Rasgueado,
    text: beat.text ?? null,
    chordId: beat.chordId ?? null,
    tap: beat.tap,
    slap: beat.slap,
    pop: beat.pop,
    slashed: beat.slashed,
    hasFermata: fermata !== null,
    fermataType: fermata ? (fermata.type as unknown as FermataType) : null,
    deadSlapped: beat.deadSlapped,
    isLegatoOrigin: beat.isLegatoOrigin,
    notes: beat.notes.map(extractNoteInfo),
  };
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  // Initial state
  isRendering: false,
  showLoadingOverlay: false,
  isPlayerReady: false,
  soundFontProgress: 0,
  selector: createRenderSelectorState(),
  transport: createRenderTransportState(),
  playerState: "stopped",
  currentTime: 0,
  endTime: 0,
  playbackSpeed: 1,
  isLooping: false,
  masterVolume: 1,
  scoreTitle: "",
  scoreSubTitle: "",
  scoreArtist: "",
  scoreAlbum: "",
  scoreWords: "",
  scoreMusic: "",
  scoreCopyright: "",
  scoreTab: "",
  scoreInstructions: "",
  scoreNotices: "",
  scoreTempo: 0,
  scoreTempoLabel: "",
  scoreMasterBarCount: 0,
  scoreTempoMap: [],
  tracks: [],
  visibleTrackIndices: [],
  selectedBeat: null,
  selectionRange: null,
  selectedTrackInfo: null,
  selectedStaffInfo: null,
  selectedBarInfo: null,
  selectedMasterBarInfo: null,
  selectedVoiceInfo: null,
  selectedBeatInfo: null,
  selectedNoteIndex: -1,
  selectedString: null,
  zoom: 1,
  scoreLayout: "horizontal",
  layoutDesignMode: false,
  systemLayoutRows: [],
  sidebarVisible: true,
  roomDialogOpen: false,
  showSnapGrid: false,

  // ── Lifecycle ────────────────────────────────────────────────────────────

  initialize: (mainEl, viewportEl) => {
    // Tear down any previous instance
    get().destroy();

    engine.initDoc();

    engine.setCollaborationAdapter(createWebCollaborationAdapter({
      signalingUrl: import.meta.env.VITE_SIGNALING_URL,
      iceServers: parseIceServers(import.meta.env.VITE_WEBRTC_ICE_SERVERS),
    }));

    _unsubscribeHooks = engine.registerHooks({
      onLocalSelectionSet: (sel) => {
        _processingHook = true;
        try {
          get().setSelection(sel);
        } finally {
          _processingHook = false;
        }
      },
      onPeerSelectionSet: (_sel) => {
        // Future: show peer cursor
      },
      onLocalTransportChange: (transport) => {
        set((state) => ({
          transport: {
            ...state.transport,
            playhead: transport.playhead,
            playheadBeatUuid: transport.playheadBeatUuid,
            loopRange: transport.loopRange,
          },
        }));
        updateTransportPlayheadOverlay(get().transport.tickPosition);
        updateTransportLoopOverlay(transport.loopRange);
      },
    });
    _renderLoadingController = createRenderLoadingController({
      publish: (state) => set(state),
    });
    _renderLoadingController.start();

    setMainElement(mainEl);
    setViewportElement(viewportEl);

    const settings = new alphaTab.Settings();
    settings.core.fontDirectory = "/font/";
    settings.core.includeNoteBounds = true; // Enable per-note hit testing
    settings.player.enablePlayer = true;
    settings.player.soundFont = "/soundfont/sonivox.sf2";
    settings.player.scrollElement = viewportEl;
    settings.player.enableCursor = true;
    settings.player.enableElementHighlighting = true;
    settings.player.enableUserInteraction = true;
    settings.display.layoutMode = get().scoreLayout === "parchment"
      ? alphaTab.LayoutMode.Parchment
      : alphaTab.LayoutMode.Horizontal;

    const api = new alphaTab.AlphaTabApi(mainEl, settings);
    setApi(api);
    installRendererObserver();

    // ── Click-to-select via mousedown + boundsLookup ────────────────
    // We handle beat selection entirely in our own mousedown handler
    // (capture phase) and stop propagation so AlphaTab's internal click
    // handling never fires.  This prevents AlphaTab's tick-based cursor
    // from jumping to the wrong bar in overfull bars.

    /** Convert a MouseEvent to unscaled AlphaTab coords. */
    const toAlphaTabCoords = (e: MouseEvent): { x: number; y: number } | null => {
      const api = getApi();
      const mainElement = getMainElement();
      if (!api || !mainElement) return null;
      const rect = mainElement.getBoundingClientRect();
      const scale = api.settings.display.scale;
      return {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale,
      };
    };

    const onDragMove = (e: MouseEvent) => {
      const ds = getDragState();
      if (!ds) return;
      e.preventDefault();

      const coords = toAlphaTabCoords(e);
      if (!coords) return;

      ds.currentX = coords.x;
      ds.currentY = coords.y;
      const dragDistance = Math.hypot(coords.x - ds.anchorX, coords.y - ds.anchorY);
      if (dragDistance < RANGE_PREVIEW_THRESHOLD_PX) return;

      ds.hasMoved = true;
      updateDragRangePreviewOverlay(
        { x: ds.anchorX, y: ds.anchorY },
        { x: ds.currentX, y: ds.currentY },
      );

      const hit = resolveBarAtPoint(coords.x, coords.y);
      if (!hit) return;
      const snapThreshold =
        ds.mode === "selector" ? SELECTOR_RANGE_SNAP_THRESHOLD_PX : TRANSPORT_DRAG_THRESHOLD_PX;
      if (dragDistance < snapThreshold) return;

      if (
        ds.mode === "selector" &&
        (
          hit.trackIndex !== ds.anchorTrackIndex ||
          hit.staffIndex !== ds.anchorStaffIndex
        )
      ) return;

      ds.currentBarIndex = hit.barIndex;
      ds.currentBeatIndex = hit.beatIndex;
      const startBarIndex = Math.min(ds.anchorBarIndex, ds.currentBarIndex);
      const endBarIndex = Math.max(ds.anchorBarIndex, ds.currentBarIndex);

      if (ds.mode === "transport") {
        const anchorAddress: BeatAddress = {
          trackIndex: ds.anchorTrackIndex,
          staffIndex: ds.anchorStaffIndex,
          voiceIndex: ds.anchorVoiceIndex,
          barIndex: ds.anchorBarIndex,
          beatIndex: ds.anchorBeatIndex,
        };
        const endpoint = resolveTransportLoopEndpointAtPoint(
          hit,
          coords.x,
          ds.anchorX,
          anchorAddress,
        );
        const range = normalizeLoopRange(
          anchorAddress,
          endpoint,
        );
        get().setTransportLoopRange(range);
        return;
      }

      const range: SelectionRange = {
        trackIndex: ds.anchorTrackIndex,
        staffIndex: ds.anchorStaffIndex,
        voiceIndex: ds.anchorVoiceIndex,
        startBarIndex,
        endBarIndex,
      };

      engine.localSetSelectionRange(range);
      useEditorStore.setState({
        selector: engine.selector,
      });
      set((state) => ({
        selectionRange: range,
        selector: {
          ...state.selector,
          selectionRange: range,
        },
      }));
      updateBarSelectionOverlay(range);
    };

    const onDragEnd = (_e: MouseEvent) => {
      // Remove document listeners
      const moveH = getDragMoveHandler();
      const endH = getDragEndHandler();
      if (moveH) document.removeEventListener("mousemove", moveH);
      if (endH) document.removeEventListener("mouseup", endH);
      setDragMoveHandler(null);
      setDragEndHandler(null);

      const ds = getDragState();
      if (ds) {
        // Plain selector click clears selector range. Transport click only
        // moves the playhead; loop range changes require an actual drag.
        if (ds.mode === "selector" && !ds.hasMoved) {
          engine.localSetSelectionRange(null);
          useEditorStore.setState({
            selector: engine.selector,
          });
          set((state) => ({
            selectionRange: null,
            selector: {
              ...state.selector,
              selectionRange: null,
            },
          }));
          hideBarSelectionOverlay();
        }
      }
      hideDragRangePreviewOverlay();
      setDragState(null);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (
        e.target instanceof Element
        && e.target.closest("[data-cotab-layout-control]")
      ) {
        return;
      }
      const coords = toAlphaTabCoords(e);
      if (!coords) return;

      const hit = resolveBarAtPoint(coords.x, coords.y);
      if (!hit) return; // Click missed all beats — let AlphaTab handle it

      const mode = eventMatchesTransportModifier(e) ? "transport" : "selector";

      // Prevent AlphaTab from processing this click
      e.stopPropagation();
      // Prevent text selection during drag
      e.preventDefault();

      if (import.meta.env.DEV) {
        (window as unknown as Record<string, unknown>).__SELECTION_DEBUG__ = {
          mouseX: coords.x,
          mouseY: coords.y,
          hitSource: "bounds",
          trackIndex: hit.trackIndex,
          staffIndex: hit.staffIndex,
          voiceIndex: hit.voiceIndex,
          barIndex: hit.barIndex,
          beatIndex: hit.beatIndex,
          noteCount: hit.beat.notes.length,
          snappedString: hit.snappedString,
          renderedStave: hit.renderedStave,
          pointerMode: mode,
        };
      }

      if (mode === "transport") {
        get().setTransportLoopRange(null);
        hideDragRangePreviewOverlay();
        get().setTransportPlayhead({
          trackIndex: hit.trackIndex,
          staffIndex: hit.staffIndex,
          voiceIndex: hit.voiceIndex,
          barIndex: hit.barIndex,
          beatIndex: hit.beatIndex,
          string: hit.snappedString,
          renderedStave: hit.renderedStave,
        });

        setDragState({
          mode,
          anchorBarIndex: hit.barIndex,
          anchorBeatIndex: hit.beatIndex,
          anchorTrackIndex: hit.trackIndex,
          anchorStaffIndex: hit.staffIndex,
          anchorVoiceIndex: hit.voiceIndex,
          currentBarIndex: hit.barIndex,
          currentBeatIndex: hit.beatIndex,
          anchorX: coords.x,
          anchorY: coords.y,
          currentX: coords.x,
          currentY: coords.y,
          hasMoved: false,
        });

        setDragMoveHandler(onDragMove);
        setDragEndHandler(onDragEnd);
        document.addEventListener("mousemove", onDragMove);
        document.addEventListener("mouseup", onDragEnd);
        return;
      }

      // Clear any existing selection range
      engine.localSetSelectionRange(null);
      useEditorStore.setState({
        selector: engine.selector,
      });
      set((state) => ({
        selectionRange: null,
        selector: {
          ...state.selector,
          selectionRange: null,
        },
      }));
      hideBarSelectionOverlay();
      hideDragRangePreviewOverlay();

      get().setSelection({
        trackIndex: hit.trackIndex,
        staffIndex: hit.staffIndex,
        voiceIndex: hit.voiceIndex,
        barIndex: hit.barIndex,
        beatIndex: hit.beatIndex,
        string: hit.snappedString,
        renderedStave: hit.renderedStave,
      });
      get().focusSelection();

      // Initialize drag tracking
      setDragState({
        mode,
        anchorBarIndex: hit.barIndex,
        anchorBeatIndex: hit.beatIndex,
        anchorTrackIndex: hit.trackIndex,
        anchorStaffIndex: hit.staffIndex,
        anchorVoiceIndex: hit.voiceIndex,
        currentBarIndex: hit.barIndex,
        currentBeatIndex: hit.beatIndex,
        anchorX: coords.x,
        anchorY: coords.y,
        currentX: coords.x,
        currentY: coords.y,
        hasMoved: false,
      });

      // Attach drag listeners to document (so drag works outside viewport)
      setDragMoveHandler(onDragMove);
      setDragEndHandler(onDragEnd);
      document.addEventListener("mousemove", onDragMove);
      document.addEventListener("mouseup", onDragEnd);
    };
    removeSelectorMouseDownHandler();
    viewportEl.addEventListener("mousedown", onMouseDown, { capture: true });
    _selectorMouseDownTarget = viewportEl;
    _selectorMouseDownHandler = onMouseDown;

    // ── Wire Events ──────────────────────────────────────────────────────

    api.renderStarted.on(() => {
      _renderLoadingController?.start();
    });

    // boundsLookup is only guaranteed populated after postRenderFinished.
    api.postRenderFinished.on(() => {
      // 1. Derive visibility from AlphaTab (single source of truth)
      const visibleTrackIndices = readVisibleIndices();

      // 2. Build snap grids for click-to-position resolution
      try {
        buildSnapGrids();
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn("[player-store] buildSnapGrids failed:", e);
        }
      }

      // 3. Refresh snap-grid debug overlay if enabled
      const currentSelection = get().selectedBeat;
      updateSnapGridOverlay(get().showSnapGrid, currentSelection
        ? {
            selectedString: currentSelection.string ?? null,
            trackIndex: currentSelection.trackIndex,
            staffIndex: currentSelection.staffIndex,
            renderedStave: currentSelection.renderedStave ?? null,
          }
        : undefined);

      set({
        visibleTrackIndices,
        systemLayoutRows: collectRenderedSystemLayoutRows(),
      });

      // 4. Apply pending selection (from rest insertion) with fresh bounds,
      //    or re-position the existing cursor if no pending change.
      const pending = engine.pendingSelection;
      if (pending) {
        engine.pendingSelection = null;
        get().setSelection(pending);
      } else {
        const sel = get().selectedBeat;
        if (sel) {
          get().setSelection({
            ...sel,
            noteIndex: get().selectedNoteIndex,
            preserveSelectionRange: true,
          });
        }
      }

      // 5. Reposition range and transport overlays after re-render
      updateBarSelectionOverlay(get().selectionRange);
      updateTransportPlayheadOverlay(get().transport.tickPosition);
      updateTransportLoopOverlay(get().transport.loopRange);
      clearNativePlaybackRange();
      finishRenderLoadingWhenRendererSettles();
    });

    api.error.on(() => {
      finishRenderLoadingWhenRendererSettles();
    });

    api.scoreLoaded.on((score: alphaTab.model.Score) => {
      // Import into Y.Doc for CRDT sync (skipped when the load
      // originated from a Y.Doc rebuild to prevent infinite loops).
      const rebuildingFromYDoc = isRebuildingFromYDoc();
      if (shouldImportLoadedScore()) {
        const doc = engine.getDoc();
        if (doc) {
          importScoreToYDoc(score, doc, FILE_IMPORT_ORIGIN);
          engine.getUndoManager()?.clear();
        }
      }

      const existing = get().tracks;
      const allTrackIndices = score.tracks.map((track) => track.index);
      const retainedVisibleIndices = rebuildingFromYDoc
        ? get().visibleTrackIndices.filter((index) => index < score.tracks.length)
        : [];
      if (rebuildingFromYDoc && score.tracks.length > existing.length) {
        for (let index = existing.length; index < score.tracks.length; index++) {
          retainedVisibleIndices.push(index);
        }
      }
      const visibleTrackIndices = retainedVisibleIndices.length > 0
        ? [...new Set(retainedVisibleIndices)].sort((left, right) => left - right)
        : allTrackIndices;
      const tracks: TrackInfo[] = score.tracks.map((track) =>
        extractTrackInfo(track));

      set({
        scoreTitle: score.title || "",
        scoreSubTitle: score.subTitle || "",
        scoreArtist: score.artist || "",
        scoreAlbum: score.album || "",
        scoreWords: score.words || "",
        scoreMusic: score.music || "",
        scoreCopyright: score.copyright || "",
        scoreTab: score.tab || "",
        scoreInstructions: score.instructions || "",
        scoreNotices: score.notices || "",
        scoreTempo: score.tempo,
        scoreTempoLabel: score.tempoLabel || "",
        scoreMasterBarCount: score.masterBars.length,
        scoreTempoMap: extractTempoMap(score),
        tracks,
        visibleTrackIndices,
      });

      applyBarWarningStyles();
    });

    api.playerReady.on(() => {
      set({ isPlayerReady: true });
    });

    api.soundFontLoad.on((e: alphaTab.ProgressEventArgs) => {
      const progress = e.total > 0 ? e.loaded / e.total : 0;
      set({ soundFontProgress: progress });
    });

    api.playerStateChanged.on(
      (e: alphaTab.synth.PlayerStateChangedEventArgs) => {
        const position = readApiTransportPosition(api.tickPosition);
        if (e.state === alphaTab.synth.PlayerState.Playing) {
          set((state) => ({
            playerState: "playing",
            currentTime: position.currentTime,
            endTime: position.endTime,
            transport: {
              ...state.transport,
              playerState: "playing",
              currentTime: position.currentTime,
              endTime: position.endTime,
              tickPosition: position.tickPosition,
            },
          }));
          updateTransportPlayheadOverlay(position.tickPosition);
          return;
        }

        set((state) => ({
          playerState: (state.playerState === "playing"
            ? "paused"
            : state.playerState) as PlaybackState,
          currentTime: position.currentTime,
          endTime: position.endTime,
          transport: {
            ...state.transport,
            playerState: state.playerState === "playing"
              ? "paused"
              : state.transport.playerState,
            currentTime: position.currentTime,
            endTime: position.endTime,
            tickPosition: position.tickPosition,
          },
        }));
        updateTransportPlayheadOverlay(position.tickPosition);
      },
    );

    api.playerPositionChanged.on(
      (e: alphaTab.synth.PositionChangedEventArgs) => {
        const position = positionSnapshotFromEvent(e);
        const stateBeforeUpdate = get();
        const loopTicks = stateBeforeUpdate.transport.loopRange
          ? resolveLoopRangeTicks(stateBeforeUpdate.transport.loopRange)
          : null;
        if (
          stateBeforeUpdate.playerState === "playing" &&
          loopTicks &&
          stateBeforeUpdate.transport.tickPosition < loopTicks.endTick &&
          position.tickPosition >= loopTicks.endTick
        ) {
          if (stateBeforeUpdate.isLooping) {
            api.tickPosition = loopTicks.startTick;
            const loopStartPosition = readApiTransportPosition(loopTicks.startTick);
            set((state) => ({
              currentTime: loopStartPosition.currentTime,
              endTime: loopStartPosition.endTime,
              transport: {
                ...state.transport,
                currentTime: loopStartPosition.currentTime,
                endTime: loopStartPosition.endTime,
                tickPosition: loopStartPosition.tickPosition,
              },
            }));
            hideAlphaTabPlaybackCursor();
            updateTransportPlayheadOverlay(loopStartPosition.tickPosition);
            return;
          }

          api.tickPosition = loopTicks.endTick;
          api.pause();
          const loopEndPosition = readApiTransportPosition(loopTicks.endTick);
          set((state) => ({
            playerState: "paused",
            currentTime: loopEndPosition.currentTime,
            endTime: loopEndPosition.endTime,
            transport: {
              ...state.transport,
              playerState: "paused",
              currentTime: loopEndPosition.currentTime,
              endTime: loopEndPosition.endTime,
              tickPosition: loopEndPosition.tickPosition,
            },
          }));
          hideAlphaTabPlaybackCursor();
          updateTransportPlayheadOverlay(loopEndPosition.tickPosition);
          return;
        }

        set((state) => ({
          currentTime: position.currentTime,
          endTime: position.endTime,
          transport: {
            ...state.transport,
            currentTime: position.currentTime,
            endTime: position.endTime,
            tickPosition: position.tickPosition,
          },
        }));
        hideAlphaTabPlaybackCursor();
        updateTransportPlayheadOverlay(position.tickPosition);
      },
    );

    api.playerFinished.on(() => {
      let finishedTickPosition = 0;
      set((state) => {
        const finished = resolvePlaybackFinishedState(state, api);
        finishedTickPosition = finished.transportTickPosition;
        return {
          playerState: finished.playerState,
          currentTime: finished.currentTime,
          transport: {
            ...state.transport,
            playerState: finished.transportPlayerState,
            currentTime: finished.transportCurrentTime,
            tickPosition: finished.transportTickPosition,
          },
        };
      });
      updateTransportPlayheadOverlay(finishedTickPosition);
    });

    // Load the demo file
    loadScoreSource("/demos/Taijin_kyofusho.gp");
  },

  destroy: () => {
    _renderLoadingController?.dispose();
    _renderLoadingController = null;
    uninstallRendererObserver();
    removeSelectorMouseDownHandler();
    cancelSelectorFocusAnimation();
    _unsubscribeHooks?.();
    _unsubscribeHooks = null;
    engine.destroyDoc();

    const cursor = getCursorElement();
    if (cursor) {
      cursor.remove();
      setCursorElement(null);
    }

    destroySnapGridOverlay();
    destroyRangeOverlays();
    destroyTransportPlayheadOverlay();
    engine.pendingSelection = null;

    // Clean up drag listeners
    const moveH = getDragMoveHandler();
    const endH = getDragEndHandler();
    if (moveH) document.removeEventListener("mousemove", moveH);
    if (endH) document.removeEventListener("mouseup", endH);
    setDragMoveHandler(null);
    setDragEndHandler(null);
    setDragState(null);

    const api = getApi();
    if (api) {
      api.destroy();
      setApi(null);
    }

    setMainElement(null);
    setViewportElement(null);
    useEditorStore.setState({
      selector: engine.selector,
      transport: engine.transport,
    });
    set({
      isRendering: false,
      showLoadingOverlay: false,
      isPlayerReady: false,
      soundFontProgress: 0,
      selector: createRenderSelectorState(),
      transport: createRenderTransportState(),
      playerState: "stopped",
      currentTime: 0,
      endTime: 0,
      scoreTitle: "",
      scoreSubTitle: "",
      scoreArtist: "",
      scoreAlbum: "",
      scoreWords: "",
      scoreMusic: "",
      scoreCopyright: "",
      scoreTab: "",
      scoreInstructions: "",
      scoreNotices: "",
      scoreTempo: 0,
      scoreTempoLabel: "",
      scoreMasterBarCount: 0,
      scoreTempoMap: [],
      tracks: [],
      visibleTrackIndices: [],
      selectedBeat: null,
      selectionRange: null,
      selectedTrackInfo: null,
      selectedStaffInfo: null,
      selectedBarInfo: null,
      selectedMasterBarInfo: null,
      selectedVoiceInfo: null,
      selectedBeatInfo: null,
      selectedNoteIndex: -1,
      selectedString: null,
      layoutDesignMode: false,
      systemLayoutRows: [],
    });
  },

  // ── File Loading ─────────────────────────────────────────────────────────

  loadFile: (data) => {
    const api = getApi();
    if (!api) return;
    if (data instanceof File) {
      _renderLoadingController?.start();
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          loadScoreSource(new Uint8Array(reader.result));
        } else {
          _renderLoadingController?.finish();
        }
      };
      reader.onerror = () => _renderLoadingController?.finish();
      reader.readAsArrayBuffer(data);
    } else {
      loadScoreSource(data instanceof ArrayBuffer ? new Uint8Array(data) : data);
    }
  },

  loadUrl: (url) => {
    const api = getApi();
    if (!api) return;
    loadScoreSource(url);
  },

  // ── Playback Controls ────────────────────────────────────────────────────

  togglePlayback: () => {
    const api = getApi();
    if (!api) return;
    toggleApiPlayback(api, get(), resolveBeat);
  },

  stopTransport: () => {
    const api = getApi();
    if (!api) return;
    api.pause();
    const playhead = get().transport.playhead;
    const position = playhead
      ? seekApiToBeatPosition(playhead)
      : (() => {
          api.tickPosition = 0;
          return readApiTransportPosition(0);
        })();
    const nextPosition = position ?? readApiTransportPosition(api.tickPosition);
    set((state) => ({
      playerState: "stopped",
      currentTime: nextPosition.currentTime,
      endTime: nextPosition.endTime,
      transport: {
        ...state.transport,
        playerState: "stopped",
        currentTime: nextPosition.currentTime,
        endTime: nextPosition.endTime,
        tickPosition: nextPosition.tickPosition,
      },
    }));
    updateTransportPlayheadOverlay(nextPosition.tickPosition);
  },

  setTransportPlayhead: (args) => {
    const playhead = args ? normalizeBeatPosition(args) : null;
    if (playhead) {
      const position = seekApiToBeatPosition(playhead);
      engine.localSetTransportPlayhead(playhead);
      set((state) => ({
        currentTime: position?.currentTime ?? state.currentTime,
        endTime: position?.endTime ?? state.endTime,
        transport: {
          ...state.transport,
          playhead,
          playheadBeatUuid: engine.transport.playheadBeatUuid,
          currentTime: position?.currentTime ?? state.transport.currentTime,
          endTime: position?.endTime ?? state.transport.endTime,
          tickPosition: position?.tickPosition ?? state.transport.tickPosition,
        },
      }));
      updateTransportPlayheadOverlay(position?.tickPosition ?? get().transport.tickPosition);
      return;
    }

    engine.localSetTransportPlayhead(null);
    set((state) => ({
      transport: {
        ...state.transport,
        playhead: null,
        playheadBeatUuid: null,
      },
    }));
    updateTransportPlayheadOverlay(get().transport.tickPosition);
  },

  setTransportPlayheadToSelection: () => {
    const {
      trackIndex,
      staffIndex,
      voiceIndex,
      barIndex,
      beatIndex,
      string,
      beatUuid,
    } = engine.selector;
    if (
      trackIndex === null ||
      staffIndex === null ||
      voiceIndex === null ||
      barIndex === null ||
      beatIndex === null
    ) {
      get().setTransportPlayhead(null);
      return;
    }
    get().setTransportPlayhead({
      trackIndex,
      staffIndex,
      voiceIndex,
      barIndex,
      beatIndex,
      string,
      ...(beatUuid ? { beatUuid } : {}),
    });
  },

  setPlaybackSpeed: (speed) => {
    const api = getApi();
    if (!api) return;
    api.playbackSpeed = speed;
    set({ playbackSpeed: speed });
  },

  setMasterVolume: (volume) => {
    const api = getApi();
    if (!api) return;
    api.masterVolume = volume;
    set({ masterVolume: volume });
  },

  toggleLoop: () => {
    const newLooping = !get().isLooping;
    clearNativePlaybackRange();
    set({ isLooping: newLooping });
  },

  setTransportLoopRange: (range) => {
    engine.localSetTransportLoopRange(range);
    useEditorStore.setState({
      transport: engine.transport,
    });
    set((state) => ({
      transport: {
        ...state.transport,
        loopRange: range,
      },
    }));
    clearNativePlaybackRange();
    updateTransportLoopOverlay(range);
  },

  setTrackColor: (trackIndex, r, g, b) => {
    const track = getTrack(trackIndex);
    const api = getApi();
    if (!api || !track) return;
    track.color = new alphaTab.model.Color(r, g, b, 255);
    const sel = get().selectedBeat;
    if (sel && sel.trackIndex === trackIndex) {
      set({ selectedTrackInfo: extractTrackInfo(track) });
    }
    api.render();
  },

  setTrackProgram: (trackIndex, program) => {
    const track = getTrack(trackIndex);
    const api = getApi();
    if (!api || !track) return;
    track.playbackInfo.program = program;
    const sel = get().selectedBeat;
    if (sel && sel.trackIndex === trackIndex) {
      set({ selectedTrackInfo: extractTrackInfo(track) });
    }
  },

  getTuningPresets: (stringCount) => {
    const presets = alphaTab.model.Tuning.getPresetsFor(stringCount);
    return presets.map((p) => ({
      name: p.name,
      isStandard: p.isStandard,
      tunings: [...p.tunings],
    }));
  },

  formatTuningNote: (midiValue) => {
    return alphaTab.model.Tuning.getTextForTuning(midiValue, true);
  },

  // ── View Controls ────────────────────────────────────────────────────────

  setZoom: (zoom) => {
    const api = getApi();
    if (!api) return;
    if (zoom === get().zoom) return;

    // The postRenderFinished handler rebuilds every CoTab overlay after
    // AlphaTab has produced the new boundsLookup for this scale.
    invalidateCoTabRenderOverlays();
    api.settings.display.scale = zoom;
    api.updateSettings();
    api.render();
    set({ zoom });
  },

  setScoreLayout: (scoreLayout: ScoreLayout) => {
    if (scoreLayout === get().scoreLayout) return;
    set({
      scoreLayout,
      ...(scoreLayout === "horizontal" ? { layoutDesignMode: false } : {}),
    });

    const api = getApi();
    if (!api) return;

    invalidateCoTabRenderOverlays();
    api.settings.display.layoutMode = scoreLayout === "parchment"
      ? alphaTab.LayoutMode.Parchment
      : alphaTab.LayoutMode.Horizontal;
    api.updateSettings();
    api.render();
  },

  setLayoutDesignMode: (layoutDesignMode) => {
    if (get().scoreLayout !== "parchment" && layoutDesignMode) return;
    set({ layoutDesignMode });
  },

  setShowSnapGrid: (show) => {
    set({ showSnapGrid: show });
    const sel = get().selectedBeat;
    updateSnapGridOverlay(
      show,
      sel
        ? {
            selectedString: sel.string ?? null,
            trackIndex: sel.trackIndex,
            staffIndex: sel.staffIndex,
            renderedStave: sel.renderedStave ?? null,
          }
        : undefined,
    );
  },

  // ── Selection ───────────────────────────────────────────────────────────

  setSelection: ({
    trackIndex,
    barIndex,
    beatIndex,
    staffIndex = 0,
    voiceIndex = 0,
    noteIndex,
    string: stringArg,
    renderedStave: renderedStaveArg,
    preserveSelectionRange = false,
  }) => {
    try {
      const beat = resolveBeat(
        trackIndex,
        barIndex,
        beatIndex,
        staffIndex,
        voiceIndex,
      );
      if (!beat) {
        get().clearSelection();
        return;
      }

      const selectedStr = stringArg ?? null;

      const staff = beat.voice.bar.staff;
      const renderedStave: RenderedStave = renderedStaveArg
        ?? (staff.showTablature ? "tablature" : "standard");

      // Look up grid and beat bounds (needed for both cursor and note matching)
      const grid = getSnapGridForBar(
        trackIndex,
        staffIndex,
        barIndex,
        renderedStave,
      );
      const snap =
        grid && selectedStr !== null
          ? grid.positions.find((p) => p.string === selectedStr) ?? null
          : null;
      const bb = findBeatBounds(
        trackIndex,
        staffIndex,
        barIndex,
        beatIndex,
        renderedStave,
      );

      // Determine if this track uses a notation grid (not tab)
      const isNotationGrid = renderedStave === "standard"
        || staff.track.isPercussion;

      // Derive noteIndex from the selected position
      let resolvedNoteIndex: number;
      if (noteIndex !== undefined && noteIndex >= 0 && noteIndex < beat.notes.length) {
        resolvedNoteIndex = noteIndex;
      } else if (selectedStr !== null && beat.notes.length > 0) {
        if (isNotationGrid && snap && bb?.notes) {
          let bestIdx = -1;
          let bestDist = Infinity;
          for (const noteBounds of bb.notes) {
            const noteY =
              noteBounds.noteHeadBounds.y + noteBounds.noteHeadBounds.h / 2;
            const dist = Math.abs(noteY - snap.y);
            if (dist < bestDist) {
              bestDist = dist;
              bestIdx = beat.notes.indexOf(noteBounds.note);
            }
          }
          const halfSpace =
            grid && grid.positions.length >= 2
              ? Math.abs(grid.positions[1].y - grid.positions[0].y)
              : Infinity;
          resolvedNoteIndex = bestDist < halfSpace * 0.75 ? bestIdx : -1;
        } else {
          const idx = beat.notes.findIndex((n) => n.string === selectedStr);
          resolvedNoteIndex = idx >= 0 ? idx : -1;
        }
      } else if (beat.notes.length > 0) {
        resolvedNoteIndex = 0;
      } else {
        resolvedNoteIndex = -1;
      }

      // Lazily create the cursor element inside .at-cursors
      const currentCursor = getCursorElement();
      const mainElement = getMainElement();
      if (!currentCursor && mainElement) {
        const cursorsWrapper = mainElement.querySelector(".at-cursors");
        if (cursorsWrapper) {
          const cursor = document.createElement("div");
          cursor.classList.add("at-edit-cursor");
          cursorsWrapper.appendChild(cursor);
          setCursorElement(cursor);
        }
      }

      // Position the cursor rectangle
      updateCursorRect(bb, snap, grid);

      const track = beat.voice.bar.staff.track;
      const selectorPointers = {
        track,
        staff: beat.voice.bar.staff,
        bar: beat.voice.bar,
        voice: beat.voice,
        beat,
        note: resolvedNoteIndex >= 0 ? beat.notes[resolvedNoteIndex] ?? null : null,
      };

      // Clear selection range when not actively dragging
      const retainedSelectionRange = preserveSelectionRange
        ? get().selectionRange
        : null;
      const rangeUpdate = preserveSelectionRange
        ? {}
        : getDragState() === null
          ? { selectionRange: null as SelectionRange | null }
          : {};
      if (!preserveSelectionRange && !getDragState()) {
        hideBarSelectionOverlay();
      }

      const newBeat = {
        trackIndex,
        staffIndex,
        voiceIndex,
        barIndex,
        beatIndex,
        string: selectedStr,
        renderedStave,
      };

      // Selector and transport are separate local states. Selection updates the
      // edit cursor only; playback starts from transport.playhead.
      if (!_processingHook) {
        engine.localSetSelection(
          newBeat,
          resolvedNoteIndex,
          selectorPointers,
          preserveSelectionRange,
        );
      } else {
        engine.localSetSelectorPointers(selectorPointers);
      }
      const nextSelectionRange = preserveSelectionRange
        ? retainedSelectionRange
        : getDragState() === null
          ? null
          : get().selector.selectionRange;
      const nextSelector: RenderSelectorState = {
        ...selectorPointers,
        trackIndex,
        staffIndex,
        voiceIndex,
        barIndex,
        beatIndex,
        string: selectedStr,
        renderedStave,
        beatUuid: engine.selector.beatUuid,
        noteIndex: resolvedNoteIndex,
        selectionRange: nextSelectionRange,
      };

      // Write base selection to headless editor-store
      useEditorStore.setState({
        selector: {
          track: nextSelector.track,
          staff: nextSelector.staff,
          bar: nextSelector.bar,
          voice: nextSelector.voice,
          beat: nextSelector.beat,
          note: nextSelector.note,
          trackIndex: nextSelector.trackIndex,
          staffIndex: nextSelector.staffIndex,
          voiceIndex: nextSelector.voiceIndex,
          barIndex: nextSelector.barIndex,
          beatIndex: nextSelector.beatIndex,
          string: nextSelector.string,
          renderedStave: nextSelector.renderedStave,
          beatUuid: nextSelector.beatUuid,
          noteIndex: nextSelector.noteIndex,
          selectionRange: nextSelector.selectionRange,
        },
      });

      set({
        ...rangeUpdate,
        selector: nextSelector,
        selectedBeat: newBeat,
        selectedTrackInfo: extractTrackInfo(track),
        selectedStaffInfo: extractStaffInfo(beat.voice.bar.staff),
        selectedBarInfo: extractBarInfo(beat.voice.bar),
        selectedMasterBarInfo: extractMasterBarInfo(beat.voice.bar.masterBar),
        selectedVoiceInfo: extractVoiceInfo(beat.voice),
        selectedBeatInfo: extractBeatInfo(beat),
        selectedNoteIndex: resolvedNoteIndex,
        selectedString: selectedStr,
      });

      if (get().showSnapGrid) {
        setSnapGridSelection(
          selectedStr,
          trackIndex,
          staffIndex,
          renderedStave,
        );
      }
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error("[setSelection] error:", e);
      }
    }
  },

  focusSelection: () => {
    focusSelectorCursorInViewport();
  },

  clearSelection: () => {
    cancelSelectorFocusAnimation();
    updateCursorRect(null, null, null);
    hideBarSelectionOverlay();
    engine.localClearSelection();
    useEditorStore.setState({
      selector: engine.selector,
    });
    set({
      selector: createRenderSelectorState(),
      selectedBeat: null,
      selectionRange: null,
      selectedTrackInfo: null,
      selectedStaffInfo: null,
      selectedBarInfo: null,
      selectedMasterBarInfo: null,
      selectedVoiceInfo: null,
      selectedBeatInfo: null,
      selectedNoteIndex: -1,
      selectedString: null,
    });
    if (get().showSnapGrid) {
      setSnapGridSelection(null, null, null);
    }
  },

  clearSelectionRange: () => {
    hideBarSelectionOverlay();
    engine.localSetSelectionRange(null);
    useEditorStore.setState({
      selector: engine.selector,
    });
    set((state) => ({
      selectionRange: null,
      selector: {
        ...state.selector,
        selectionRange: null,
      },
    }));
  },
}));

// Expose store on window for e2e diagnostics (dev only)
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__PLAYER_STORE__ =
    usePlayerStore;
  // Also expose a getter for the AlphaTab API (useful for headless debugging)
  Object.defineProperty(window, "__ALPHATAB_API__", {
    get: () => getApi(),
    configurable: true,
  });
  // Expose snap grids for e2e testing
  Object.defineProperty(window, "__SNAP_GRIDS__", {
    get: () => Object.fromEntries(getSnapGrids()),
    configurable: true,
  });
}
