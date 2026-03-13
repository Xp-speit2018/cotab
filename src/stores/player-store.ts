/**
 * player-store.ts — Zustand store wrapping the AlphaTab API.
 *
 * Shared mutable state (api, DOM refs) lives in player-api.ts.
 * Types, percussion data, helpers, and snap grid are in dedicated modules.
 * This file contains only the store, selection helpers, and lifecycle.
 */

import * as alphaTab from "@coderline/alphatab";
import { create } from "zustand";

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
} from "./player-api";
import type { PlayerState, SelectedBeatInfo, SelectedNoteInfo, TrackBounds, TrackInfo } from "./player-types";
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
} from "./player-helpers";
import {
  getSnapGrids,
  buildSnapGrids,
  updateSnapGridOverlay,
  setSnapGridSelection,
  findNearestSnap,
  destroySnapGridOverlay,
} from "./snap-grid";
import {
  initDoc,
  destroyDoc,
  importFromAlphaTab,
  isRebuildingFromYDoc,
} from "@/core/sync";

// Re-export for consumers that still import from player-store
export type { PendingSelection } from "./player-api";
export type {
  SnapGrid,
  PercSnapGroup,
  TrackInfo,
  TrackPreset,
  SelectedBeat,
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
} from "./player-types";
export { TRACK_PRESETS, SCORE_FIELD_TO_STATE } from "./player-types";
export { getApi, setPendingSelection } from "./player-api";
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
  selectedTrackInfo: null,
  selectedStaffInfo: null,
  selectedBarInfo: null,
  selectedVoiceInfo: null,
  selectedBeatInfo: null,
  selectedNoteIndex: -1,
  selectedString: null,
  zoom: 1,
  sidebarVisible: true,
  editorMode: getInitialEditorMode(),
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

    initDoc();
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
    const onMouseDown = (e: MouseEvent) => {
      const api = getApi();
      const mainElement = getMainElement();
      if (!api || !mainElement) return;
      // .at-main's getBoundingClientRect already accounts for the viewport
      // scroll, so we just need the offset from its top-left corner,
      // divided by the display scale.
      const rect = mainElement.getBoundingClientRect();
      const scale = api.settings.display.scale;
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;

      const lookup = api.boundsLookup;
      if (!lookup) return; // No bounds yet — let AlphaTab handle it

      let targetBeat: alphaTab.model.Beat | null = null;
      let snappedString: number | null = null;

      // 1. Find the staff system that contains the Y position
      for (const system of lookup.staffSystems) {
        const sb = system.realBounds;
        if (y < sb.y || y > sb.y + sb.h) continue;

        // 2. Find the master bar whose X range contains the click
        for (const masterBar of system.bars) {
          const mb = masterBar.realBounds;
          if (x < mb.x || x > mb.x + mb.w) continue;

          // 3. Find the bar (= track) closest to the click Y
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

          if (closestBarBounds) {
            // 4. Find the beat closest by X
            let bestBeatDist = Infinity;
            for (const beatBounds of closestBarBounds.beats) {
              const bx = beatBounds.realBounds;
              const dist = Math.abs(x - (bx.x + bx.w / 2));
              if (dist < bestBeatDist) {
                bestBeatDist = dist;
                targetBeat = beatBounds.beat;
              }
            }

            if (targetBeat) {
              // 5. Snap to nearest string/line position
              const bar = targetBeat.voice.bar;
              const gridKey = `${bar.staff.track.index}:${bar.staff.index}`;
              const grid = getSnapGrids().get(gridKey);
              if (grid) {
                const snap = findNearestSnap(grid, y);
                if (snap) snappedString = snap.string;
              }
            }
          }
          break; // found the matching master bar
        }
        break; // found the matching system
      }

      if (!targetBeat) return; // Click missed all beats — let AlphaTab handle it

      // Prevent AlphaTab from processing this click (avoids tick-based
      // cursor positioning that breaks for overfull bars).
      e.stopPropagation();

      const bar = targetBeat.voice.bar;

      if (import.meta.env.DEV) {
        (window as unknown as Record<string, unknown>).__SELECTION_DEBUG__ = {
          mouseX: x,
          mouseY: y,
          hitSource: "bounds",
          trackIndex: bar.staff.track.index,
          staffIndex: bar.staff.index,
          voiceIndex: targetBeat.voice.index,
          barIndex: bar.index,
          beatIndex: targetBeat.index,
          noteCount: targetBeat.notes.length,
          snappedString,
        };
      }

      get().setSelection({
        trackIndex: bar.staff.track.index,
        staffIndex: bar.staff.index,
        voiceIndex: targetBeat.voice.index,
        barIndex: bar.index,
        beatIndex: targetBeat.index,
        string: snappedString,
      });
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
    destroyDoc();

    const cursor = getCursorElement();
    if (cursor) {
      cursor.remove();
      setCursorElement(null);
    }

    destroySnapGridOverlay();
    setPendingSelection(null);

    const api = getApi();
    if (api) {
      api.destroy();
      setApi(null);
    }

    setMainElement(null);
    setViewportElement(null);
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

      set({
        selectedBeat: {
          trackIndex,
          staffIndex,
          voiceIndex,
          barIndex,
          beatIndex,
          string: selectedStr,
        },
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
    set({
      selectedBeat: null,
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
