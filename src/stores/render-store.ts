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
} from "@/core/schema";

import {
  getApi,
  setApi,
  setMainElement,
  setViewportElement,
  setCursorElement,
  getMainElement,
  getCursorElement,
  getPendingSelection,
  setPendingSelection,
  getDragState,
  setDragState,
  getDragMoveHandler,
  setDragMoveHandler,
  getDragEndHandler,
  setDragEndHandler,
} from "./render-api";
import type { PlayerState, SelectionRange, SelectedBeatInfo, SelectedNoteInfo, TrackBounds, TrackInfo } from "./render-types";
import { GP7_DEF_BY_ID } from "./percussion-data";
import { resolveGp7Id } from "./percussion-data";
import {
  getTrack,
  resolveBeat,
  extractTrackInfo,
  extractStaffInfo,
  extractBarInfo,
  extractVoiceInfo,
  applyBarWarningStyles,
} from "./render-helpers";
import {
  getSnapGrids,
  buildSnapGrids,
  updateSnapGridOverlay,
  setSnapGridSelection,
  findNearestSnap,
  destroySnapGridOverlay,
} from "./snap-grid";
import {
  engine,
  importFromAlphaTab,
  type SignalingConfig,
} from "@/core/engine";
import { IndexeddbPersistence } from "y-indexeddb";
import {
  isRebuildingFromYDoc,
  installRendererObserver,
  uninstallRendererObserver,
} from "./renderer-bridge";

// Unsubscribe function for engine hooks
let _unsubscribeHooks: (() => void) | null = null;
let _processingHook = false; // Guard against circular calls

// Re-export for consumers that still import from player-store
export type { PendingSelection } from "./render-api";
export type {
  SnapGrid,
  PercSnapGroup,
  TrackInfo,
  TrackPreset,
  SelectedBeat,
  SelectionRange,
  TrackBounds,
  SelectedNoteInfo,
  SelectedBeatInfo,
  SelectedBarInfo,
  SelectedTrackInfo,
  SelectedStaffInfo,
  TuningPresetInfo,
  SelectedVoiceInfo,
  ScoreMetadataField,
  PlayerState,
  PercArticulationDef,
  DrumCategoryId,
} from "./render-types";
export { TRACK_PRESETS, SCORE_FIELD_TO_STATE } from "./render-types";
export { getApi, setPendingSelection } from "./render-api";
export { getSnapGrids } from "./snap-grid";

// ─── Selection helpers (use getApi / getCursorElement / getSnapGrids) ────────

function findBeatBounds(
  trackIndex: number,
  staffIndex: number,
  barIndex: number,
  beatIndex: number,
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
      const gridKey = `${track.index}:${staff.index}`;
      const grid = getSnapGrids().get(gridKey);
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
      };
    }
  }
  return null;
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

// ─── Bar selection overlay (multi-bar drag) ──────────────────────────────────

let barSelectionElements: HTMLDivElement[] = [];

function updateBarSelectionOverlay(range: SelectionRange | null): void {
  const api = getApi();
  const mainElement = getMainElement();

  if (!range || !api || !mainElement) {
    for (const el of barSelectionElements) el.style.display = "none";
    return;
  }

  const lookup = api.boundsLookup;
  if (!lookup) {
    for (const el of barSelectionElements) el.style.display = "none";
    return;
  }

  const cursorsWrapper = mainElement.querySelector(".at-cursors");
  if (!cursorsWrapper) return;

  // Collect rectangles per staff system row
  const rects: { x: number; y: number; w: number; h: number }[] = [];

  for (const system of lookup.staffSystems) {
    let rowFirstX: number | null = null;
    let rowLastXW: number | null = null;
    let rowY = 0;
    let rowH = 0;

    for (const masterBar of system.bars) {
      // Check if this master bar's index is in our range
      // Get bar index from the first barBounds
      if (masterBar.bars.length === 0) continue;
      const refBar = masterBar.bars[0].beats.length > 0
        ? masterBar.bars[0].beats[0].beat.voice.bar
        : null;
      if (!refBar) continue;
      const barIdx = refBar.index;

      if (barIdx < range.startBarIndex || barIdx > range.endBarIndex) continue;

      // Find the BarBounds for the target track/staff
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
        // Update height to cover the tallest bar
        if (rb.h > rowH) rowH = rb.h;
        break;
      }
    }

    if (rowFirstX !== null && rowLastXW !== null) {
      rects.push({ x: rowFirstX, y: rowY, w: rowLastXW - rowFirstX, h: rowH });
    }
  }

  // Create/reuse elements
  while (barSelectionElements.length < rects.length) {
    const el = document.createElement("div");
    el.classList.add("at-bar-selection");
    cursorsWrapper.appendChild(el);
    barSelectionElements.push(el);
  }

  for (let i = 0; i < barSelectionElements.length; i++) {
    const el = barSelectionElements[i];
    if (i < rects.length) {
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

function hideBarSelectionOverlay(): void {
  for (const el of barSelectionElements) el.style.display = "none";
}

function destroyBarSelectionOverlay(): void {
  for (const el of barSelectionElements) el.remove();
  barSelectionElements = [];
}

// Monkey-patch: AlphaTab mis-positions its built-in bar/beat cursors on
// overfull bars. We override the CSS transforms using the correct bounds.
function fixAlphaTabCursors(
  trackIndex: number,
  staffIndex: number,
  barIndex: number,
  beatBounds: alphaTab.rendering.BeatBounds | null,
): void {
  const mainElement = getMainElement();
  const api = getApi();
  if (!mainElement) return;
  const lookup = api?.boundsLookup;
  if (!lookup) return;

  for (const system of lookup.staffSystems) {
    for (const masterBarBounds of system.bars) {
      let found = false;
      for (const barBounds of masterBarBounds.bars) {
        if (barBounds.beats.length === 0) continue;
        const refBar = barBounds.beats[0].beat.voice.bar;
        if (
          refBar.staff.track.index === trackIndex &&
          refBar.staff.index === staffIndex &&
          refBar.index === barIndex
        ) {
          found = true;
          break;
        }
      }
      if (!found) continue;

      const cursorBar = mainElement.querySelector(".at-cursor-bar") as HTMLElement | null;
      if (cursorBar) {
        const vb = masterBarBounds.visualBounds;
        cursorBar.style.transform =
          `translate(${vb.x}px, ${vb.y}px) scale(${vb.w / 100}, ${vb.h / 100})`;
      }
      const cursorBeat = mainElement.querySelector(".at-cursor-beat") as HTMLElement | null;
      if (cursorBeat && beatBounds) {
        const vb = masterBarBounds.visualBounds;
        cursorBeat.style.transform =
          `translate(${beatBounds.onNotesX}px, ${vb.y}px) scale(0.01, ${vb.h / 100}) translateX(-50%)`;
      }
      return;
    }
  }
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
    isDead: note.isDead,
    isGhost: note.isGhost,
    isStaccato: note.isStaccato,
    isLetRing: note.isLetRing,
    isPalmMute: note.isPalmMute,
    isTieDestination: note.isTieDestination,
    isHammerPullOrigin: note.isHammerPullOrigin,
    isLeftHandTapped: note.isLeftHandTapped,
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
      : [],
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
    dynamics: beat.dynamics as unknown as DynamicValue,
    crescendo: beat.crescendo as unknown as CrescendoType,
    vibrato: beat.vibrato as unknown as VibratoType,
    fade: beat.fade as unknown as FadeType,
    ottava: beat.ottava as unknown as Ottavia,
    golpe: beat.golpe as unknown as GolpeType,
    wahPedal: beat.wahPedal as unknown as WahPedal,
    whammyBarType: beat.whammyBarType as unknown as WhammyType,
    whammyBarPoints: beat.whammyBarPoints
      ? beat.whammyBarPoints.map((p) => ({ offset: p.offset, value: p.value }))
      : [],
    text: beat.text ?? null,
    chordId: beat.chordId ?? null,
    tap: beat.tap,
    slap: beat.slap,
    pop: beat.pop,
    slashed: beat.slashed,
    hasFermata: fermata !== null,
    fermataType: fermata ? (fermata.type as unknown as FermataType) : null,
    deadSlapped: (beat as unknown as Record<string, boolean>).deadSlapped ?? false,
    isLegatoOrigin: (beat as unknown as Record<string, boolean>).isLegatoOrigin ?? false,
    notes: beat.notes.map(extractNoteInfo),
  };
}

const EDITOR_MODE_STORAGE_KEY = "cotab:editorMode";
const DRUM_ICON_STYLE_STORAGE_KEY = "cotab:drumIconStyle";

function getInitialEditorMode(): "essentials" | "advanced" {
  if (typeof localStorage === "undefined") return "essentials";
  const raw = localStorage.getItem(EDITOR_MODE_STORAGE_KEY);
  if (raw === "essentials" || raw === "advanced") return raw;
  return "essentials";
}

function getInitialDrumIconStyle(): "notation" | "instrument" {
  if (typeof localStorage === "undefined") return "notation";
  const raw = localStorage.getItem(DRUM_ICON_STYLE_STORAGE_KEY);
  if (raw === "notation" || raw === "instrument") return raw;
  return "notation";
}


export const usePlayerStore = create<PlayerState>((set, get) => ({
  // Initial state
  isLoading: false,
  isPlayerReady: false,
  soundFontProgress: 0,
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
  tracks: [],
  visibleTrackIndices: [],
  trackBounds: [],
  selectedBeat: null,
  selectionRange: null,
  selectedTrackInfo: null,
  selectedStaffInfo: null,
  selectedBarInfo: null,
  selectedVoiceInfo: null,
  selectedBeatInfo: null,
  selectedNoteIndex: -1,
  selectedString: null,
  zoom: 1,
  editorMode: getInitialEditorMode(),
  sidebarVisible: true,
  roomDialogOpen: false,
  drumIconStyle: getInitialDrumIconStyle(),
  showSnapGrid: false,
  addTrackDialogOpen: false,

  setDrumIconStyle: (style) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(DRUM_ICON_STYLE_STORAGE_KEY, style);
    }
    set({ drumIconStyle: style });
  },

  // ── Lifecycle ────────────────────────────────────────────────────────────

  initialize: (mainEl, viewportEl) => {
    // Tear down any previous instance
    get().destroy();

    engine.initDoc();

    // Configure signaling with browser-specific persistence
    const signalingConfig: SignalingConfig = {
      signalingUrl: import.meta.env.VITE_SIGNALING_URL,
      persistence: IndexeddbPersistence,
    };
    engine.setSignalingConfig(signalingConfig);

    installRendererObserver();
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
    });
    set({ isLoading: true });

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
    settings.display.layoutMode = alphaTab.LayoutMode.Horizontal;

    const api = new alphaTab.AlphaTabApi(mainEl, settings);
    setApi(api);

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

      const hit = resolveBarAtPoint(coords.x, coords.y);
      if (!hit) return;

      // Only update if same track/staff and bar index changed
      if (
        hit.trackIndex !== ds.anchorTrackIndex ||
        hit.staffIndex !== ds.anchorStaffIndex
      ) return;
      if (hit.barIndex === ds.currentBarIndex) return;

      ds.currentBarIndex = hit.barIndex;
      const startBarIndex = Math.min(ds.anchorBarIndex, ds.currentBarIndex);
      const endBarIndex = Math.max(ds.anchorBarIndex, ds.currentBarIndex);
      const range: SelectionRange = {
        trackIndex: ds.anchorTrackIndex,
        staffIndex: ds.anchorStaffIndex,
        voiceIndex: ds.anchorVoiceIndex,
        startBarIndex,
        endBarIndex,
      };
      useEditorStore.setState({ selectionRange: range });
      set({ selectionRange: range });
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
        // If single bar (click, no real drag), clear range
        if (ds.anchorBarIndex === ds.currentBarIndex) {
          useEditorStore.setState({ selectionRange: null });
          set({ selectionRange: null });
          hideBarSelectionOverlay();
        }
      }
      setDragState(null);
    };

    const onMouseDown = (e: MouseEvent) => {
      const coords = toAlphaTabCoords(e);
      if (!coords) return;

      const hit = resolveBarAtPoint(coords.x, coords.y);
      if (!hit) return; // Click missed all beats — let AlphaTab handle it

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
        };
      }

      // Clear any existing selection range
      useEditorStore.setState({ selectionRange: null });
      set({ selectionRange: null });
      hideBarSelectionOverlay();

      get().setSelection({
        trackIndex: hit.trackIndex,
        staffIndex: hit.staffIndex,
        voiceIndex: hit.voiceIndex,
        barIndex: hit.barIndex,
        beatIndex: hit.beatIndex,
        string: hit.snappedString,
      });

      // Initialize drag tracking
      setDragState({
        anchorBarIndex: hit.barIndex,
        anchorTrackIndex: hit.trackIndex,
        anchorStaffIndex: hit.staffIndex,
        anchorVoiceIndex: hit.voiceIndex,
        currentBarIndex: hit.barIndex,
      });

      // Attach drag listeners to document (so drag works outside viewport)
      setDragMoveHandler(onDragMove);
      setDragEndHandler(onDragEnd);
      document.addEventListener("mousemove", onDragMove);
      document.addEventListener("mouseup", onDragEnd);
    };
    viewportEl.addEventListener("mousedown", onMouseDown, { capture: true });

    // ── Wire Events ──────────────────────────────────────────────────────

    api.renderStarted.on(() => {
      set({ isLoading: true });
    });

    // IMPORTANT: use postRenderFinished, NOT renderFinished.
    // boundsLookup is only guaranteed populated after postRenderFinished.
    // Using renderFinished causes a "one step behind" bug where trackBounds
    // contains data from the previous render.
    api.postRenderFinished.on(() => {
      const api = getApi();
      // 1. Derive visibility from AlphaTab (single source of truth)
      const visibleTrackIndices = readVisibleIndices();

      // 2. Extract per-track Y positions from boundsLookup
      const lookup = api?.boundsLookup;
      const newTrackBounds: TrackBounds[] = [];
      if (lookup && lookup.staffSystems.length > 0) {
        const firstSystem = lookup.staffSystems[0];
        if (firstSystem.bars.length > 0) {
          const firstMasterBar = firstSystem.bars[0];
          for (const barBounds of firstMasterBar.bars) {
            newTrackBounds.push({
              y: barBounds.realBounds.y,
              height: barBounds.realBounds.h,
            });
          }
        }
      }

      // 3. Build snap grids for click-to-position resolution
      try {
        buildSnapGrids();
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn("[player-store] buildSnapGrids failed:", e);
        }
      }

      // 4. Refresh snap-grid debug overlay if enabled
      const currentSelection = get().selectedBeat;
      updateSnapGridOverlay(get().showSnapGrid, currentSelection
        ? {
            selectedString: currentSelection.string ?? null,
            trackIndex: currentSelection.trackIndex,
            staffIndex: currentSelection.staffIndex,
          }
        : undefined);

      set({
        isLoading: false,
        visibleTrackIndices,
        trackBounds: newTrackBounds,
      });

      // 6. Apply pending selection (from rest insertion) with fresh bounds,
      //    or re-position the existing cursor if no pending change.
      const pending = getPendingSelection();
      if (pending) {
        setPendingSelection(null);
        get().setSelection(pending);
      } else {
        const sel = get().selectedBeat;
        if (sel) {
          const freshBB = findBeatBounds(
            sel.trackIndex,
            sel.staffIndex,
            sel.barIndex,
            sel.beatIndex,
          );
          const gridKey = `${sel.trackIndex}:${sel.staffIndex}`;
          const freshGrid = getSnapGrids().get(gridKey) ?? null;
          const freshSnap =
            freshGrid && sel.string !== null
              ? freshGrid.positions.find((p) => p.string === sel.string) ?? null
              : null;
          updateCursorRect(freshBB, freshSnap, freshGrid);
          fixAlphaTabCursors(sel.trackIndex, sel.staffIndex, sel.barIndex, freshBB);
        }
      }

      // 7. Reposition bar selection overlay after re-render
      updateBarSelectionOverlay(get().selectionRange);
    });

    api.scoreLoaded.on((score: alphaTab.model.Score) => {
      // Import into Y.Doc for CRDT sync (skipped when the load
      // originated from a Y.Doc rebuild to prevent infinite loops).
      if (!isRebuildingFromYDoc()) {
        importFromAlphaTab(score);
      }

      const existing = get().tracks;
      const tracks: TrackInfo[] = score.tracks.map((t, i) => ({
        index: i,
        name: t.name,
        volume: existing[i]?.volume ?? 1,
        isMuted: existing[i]?.isMuted ?? false,
        isSolo: existing[i]?.isSolo ?? false,
        isPercussion: t.isPercussion,
      }));

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
        tracks,
      });

      applyBarWarningStyles();
      api!.renderTracks(score.tracks);
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
        const state =
          e.state === alphaTab.synth.PlayerState.Playing
            ? "playing"
            : "paused";
        set({ playerState: state });
      },
    );

    api.playerPositionChanged.on(
      (e: alphaTab.synth.PositionChangedEventArgs) => {
        set({
          currentTime: e.currentTime,
          endTime: e.endTime,
        });
      },
    );

    api.playerFinished.on(() => {
      set({ playerState: "stopped", currentTime: 0 });
    });

    // Load the demo file
    api.load("/demos/Taijin_kyofusho.gp");
  },

  destroy: () => {
    uninstallRendererObserver();
    _unsubscribeHooks?.();
    _unsubscribeHooks = null;
    engine.destroyDoc();

    const cursor = getCursorElement();
    if (cursor) {
      cursor.remove();
      setCursorElement(null);
    }

    destroySnapGridOverlay();
    destroyBarSelectionOverlay();
    setPendingSelection(null);

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
      selectedBeat: null,
      selectedNoteIndex: -1,
      selectionRange: null,
    });
    set({
      isLoading: false,
      isPlayerReady: false,
      soundFontProgress: 0,
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
      tracks: [],
      visibleTrackIndices: [],
      trackBounds: [],
      selectedBeat: null,
      selectionRange: null,
      selectedTrackInfo: null,
      selectedStaffInfo: null,
      selectedBarInfo: null,
      selectedVoiceInfo: null,
      selectedBeatInfo: null,
      selectedNoteIndex: -1,
      selectedString: null,
    });
  },

  // ── File Loading ─────────────────────────────────────────────────────────

  loadFile: (data) => {
    const api = getApi();
    if (!api) return;
    if (data instanceof File) {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          api!.load(new Uint8Array(reader.result));
        }
      };
      reader.readAsArrayBuffer(data);
    } else {
      api.load(data instanceof ArrayBuffer ? new Uint8Array(data) : data);
    }
  },

  loadUrl: (url) => {
    const api = getApi();
    if (!api) return;
    api.load(url);
  },

  // ── Playback Controls ────────────────────────────────────────────────────

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
    const api = getApi();
    if (!api) return;
    const newLooping = !get().isLooping;
    api.isLooping = newLooping;
    set({ isLooping: newLooping });
  },

  // ── Track Controls ───────────────────────────────────────────────────────

  setTrackVolume: (trackIndex, volume) => {
    const track = getTrack(trackIndex);
    const api = getApi();
    if (!api || !track) return;
    api.changeTrackVolume([track], volume);
    set({
      tracks: get().tracks.map((t) =>
        t.index === trackIndex ? { ...t, volume } : t,
      ),
    });
  },

  setTrackMute: (trackIndex, muted) => {
    const track = getTrack(trackIndex);
    const api = getApi();
    if (!api || !track) return;
    api.changeTrackMute([track], muted);
    set({
      tracks: get().tracks.map((t) =>
        t.index === trackIndex ? { ...t, isMuted: muted } : t,
      ),
    });
  },

  setTrackSolo: (trackIndex, solo) => {
    const track = getTrack(trackIndex);
    const api = getApi();
    if (!api || !track) return;
    api.changeTrackSolo([track], solo);
    set({
      tracks: get().tracks.map((t) =>
        t.index === trackIndex ? { ...t, isSolo: solo } : t,
      ),
    });
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
    api.settings.display.scale = zoom;
    api.updateSettings();
    api.render();
    set({ zoom });
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

      // Look up grid and beat bounds (needed for both cursor and note matching)
      const gridKey = `${trackIndex}:${staffIndex}`;
      const grid = getSnapGrids().get(gridKey) ?? null;
      const snap =
        grid && selectedStr !== null
          ? grid.positions.find((p) => p.string === selectedStr) ?? null
          : null;
      const bb = findBeatBounds(
        trackIndex,
        staffIndex,
        barIndex,
        beatIndex,
      );

      // Determine if this track uses a notation grid (not tab)
      const staff = beat.voice.bar.staff;
      const isNotationGrid = !staff.showTablature || staff.track.isPercussion;

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

      // Fix AlphaTab's built-in bar/beat cursor for overfull bars
      fixAlphaTabCursors(trackIndex, staffIndex, barIndex, bb);

      const track = beat.voice.bar.staff.track;

      // Clear selection range when not actively dragging
      const rangeUpdate = getDragState() === null
        ? { selectionRange: null as SelectionRange | null }
        : {};
      if (!getDragState()) hideBarSelectionOverlay();

      const newBeat = {
        trackIndex,
        staffIndex,
        voiceIndex,
        barIndex,
        beatIndex,
        string: selectedStr,
      };

      // Write base selection to headless editor-store
      useEditorStore.setState({
        selectedBeat: newBeat,
        selectedNoteIndex: resolvedNoteIndex,
        ...(getDragState() === null ? { selectionRange: null } : {}),
      });

      // Only update engine if not processing a hook (prevents circular calls)
      if (!_processingHook) {
        engine.localSetSelection(newBeat);
      }

      set({
        ...rangeUpdate,
        selectedBeat: newBeat,
        selectedTrackInfo: extractTrackInfo(track),
        selectedStaffInfo: extractStaffInfo(beat.voice.bar.staff),
        selectedBarInfo: extractBarInfo(beat.voice.bar),
        selectedVoiceInfo: extractVoiceInfo(beat.voice),
        selectedBeatInfo: extractBeatInfo(beat),
        selectedNoteIndex: resolvedNoteIndex,
        selectedString: selectedStr,
      });

      if (get().showSnapGrid) {
        setSnapGridSelection(selectedStr, trackIndex, staffIndex);
      }
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error("[setSelection] error:", e);
      }
    }
  },

  clearSelection: () => {
    updateCursorRect(null, null, null);
    hideBarSelectionOverlay();
    useEditorStore.setState({
      selectedBeat: null,
      selectedNoteIndex: -1,
      selectionRange: null,
    });
    set({
      selectedBeat: null,
      selectionRange: null,
      selectedTrackInfo: null,
      selectedStaffInfo: null,
      selectedBarInfo: null,
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
    useEditorStore.setState({ selectionRange: null });
    set({ selectionRange: null });
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
