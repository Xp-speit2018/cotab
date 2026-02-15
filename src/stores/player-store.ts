/**
 * player-store.ts — Zustand store wrapping the AlphaTab API.
 *
 * Follows the same module-level imperative pattern as core/store.ts:
 * a module-scoped `api` reference, with AlphaTab events wired into
 * reactive Zustand state. Components read via selectors and dispatch
 * actions through store methods.
 *
 * Track visibility: AlphaTab is the single source of truth.
 * `visibleTrackIndices` is derived from `api.tracks` on every
 * renderFinished. `setTrackVisible` tells AlphaTab what to render;
 * the event flow updates our state automatically.
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
  TripletFeel,
  KeySignatureType,
  BendPointSchema,
} from "@/core/schema";

// ─── Internal State ──────────────────────────────────────────────────────────

let api: alphaTab.AlphaTabApi | null = null;

/**
 * Captures the last mousedown coordinates (in AlphaTab rendering space)
 * so the beatMouseDown handler can use boundsLookup for precise per-track
 * and per-note resolution.  AlphaTab's built-in beat/note events sometimes
 * resolve to the wrong track in multi-track horizontal layout.
 */
let lastMouseDownX = 0;
let lastMouseDownY = 0;

/** References to DOM elements needed for coordinate conversion. */
let mainElement: HTMLElement | null = null;
let viewportElement: HTMLElement | null = null;

/** Cursor rectangle DOM element, appended to `.at-cursors`. */
let cursorElement: HTMLDivElement | null = null;

// ─── Snap Grid ───────────────────────────────────────────────────────────────

/** A single selectable position within a track's staff. */
interface SnapPosition {
  /** 1-based string number (tab) or line/space index (notation). */
  string: number;
  /** Center Y in bounds coordinate space. */
  y: number;
}

/** Per-track snap grid built from rendered NoteBounds. */
interface SnapGrid {
  positions: SnapPosition[]; // sorted by y (ascending)
  noteWidth: number; // typical note head width
  noteHeight: number; // typical note head height
}

/** Key = `${trackIndex}:${staffIndex}` → snap grid for that track/staff. */
const snapGrids = new Map<string, SnapGrid>();

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TrackInfo {
  index: number;
  name: string;
  volume: number;
  isMuted: boolean;
  isSolo: boolean;
  isPercussion: boolean;
}

export interface SelectedBeat {
  trackIndex: number;
  staffIndex: number;
  voiceIndex: number;
  barIndex: number;
  beatIndex: number;
  /** 1-based string (tab) or line/space index (notation), -1 if unknown. */
  string: number;
}

export interface TrackBounds {
  y: number;
  height: number;
}

// ─── Selected Element Info (read from AlphaTab model) ────────────────────────

export interface SelectedNoteInfo {
  index: number;
  fret: number;
  string: number;
  isDead: boolean;
  isGhost: boolean;
  isStaccato: boolean;
  isLetRing: boolean;
  isPalmMute: boolean;
  isTieDestination: boolean;
  isHammerPullOrigin: boolean;
  isLeftHandTapped: boolean;
  accentuated: AccentuationType;
  vibrato: VibratoType;
  slideInType: SlideInType;
  slideOutType: SlideOutType;
  harmonicType: HarmonicType;
  harmonicValue: number;
  bendType: BendType;
  bendStyle: BendStyle;
  bendPoints: BendPointSchema[];
  leftHandFinger: Fingers;
  rightHandFinger: Fingers;
  dynamics: DynamicValue;
  ornament: NoteOrnament;
  accidentalMode: NoteAccidentalMode;
  trillValue: number;
  trillSpeed: Duration;
  durationPercent: number;
  isPercussion: boolean;
  percussionArticulation: number;
  percussionArticulationName: string;
}

export interface SelectedBeatInfo {
  index: number;
  duration: Duration;
  dots: number;
  isRest: boolean;
  isEmpty: boolean;
  tupletNumerator: number;
  tupletDenominator: number;
  graceType: GraceType;
  pickStroke: PickStroke;
  brushType: BrushType;
  dynamics: DynamicValue;
  crescendo: CrescendoType;
  vibrato: VibratoType;
  fade: FadeType;
  ottava: Ottavia;
  golpe: GolpeType;
  wahPedal: WahPedal;
  whammyBarType: WhammyType;
  whammyBarPoints: BendPointSchema[];
  text: string | null;
  chordId: string | null;
  tap: boolean;
  slap: boolean;
  pop: boolean;
  slashed: boolean;
  hasFermata: boolean;
  fermataType: FermataType | null;
  notes: SelectedNoteInfo[];
}

export interface SelectedBarInfo {
  index: number;
  timeSignatureNumerator: number;
  timeSignatureDenominator: number;
  keySignature: number;
  keySignatureType: KeySignatureType;
  isRepeatStart: boolean;
  repeatCount: number;
  alternateEndings: number;
  tripletFeel: TripletFeel;
  isFreeTime: boolean;
  isDoubleBar: boolean;
  hasSection: boolean;
  sectionText: string;
  sectionMarker: string;
  tempo: number | null;
}

export interface PlayerState {
  // Loading
  isLoading: boolean;
  isPlayerReady: boolean;
  soundFontProgress: number;

  // Playback
  playerState: "stopped" | "playing" | "paused";
  currentTime: number;
  endTime: number;
  playbackSpeed: number;
  isLooping: boolean;
  masterVolume: number;

  // Score info
  scoreTitle: string;
  scoreSubTitle: string;
  scoreArtist: string;
  scoreAlbum: string;
  scoreWords: string;
  scoreMusic: string;
  scoreCopyright: string;
  scoreTab: string;
  scoreInstructions: string;
  scoreNotices: string;
  scoreTempo: number;
  scoreTempoLabel: string;

  // Tracks
  tracks: TrackInfo[];
  /** Derived from api.tracks on every renderFinished — single source of truth. */
  visibleTrackIndices: number[];
  trackBounds: TrackBounds[];

  // Cursors
  selectedBeat: SelectedBeat | null;
  /** Detailed note-level properties of the selected beat's notes (from AlphaTab model). */
  selectedBeatInfo: SelectedBeatInfo | null;
  /** Detailed bar-level properties of the selected bar (from AlphaTab model). */
  selectedBarInfo: SelectedBarInfo | null;
  /** Index into selectedBeatInfo.notes[] for the actively selected note, or -1 if none. */
  selectedNoteIndex: number;
  /** The string/line the cursor is on, -1 = none. */
  selectedString: number;

  // View
  zoom: number;

  // Actions
  initialize: (mainEl: HTMLElement, viewportEl: HTMLElement) => void;
  destroy: () => void;
  loadFile: (data: File | ArrayBuffer | Uint8Array) => void;
  loadUrl: (url: string) => void;
  playPause: () => void;
  stop: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setMasterVolume: (volume: number) => void;
  toggleLoop: () => void;
  setTrackVolume: (trackIndex: number, volume: number) => void;
  setTrackMute: (trackIndex: number, muted: boolean) => void;
  setTrackSolo: (trackIndex: number, solo: boolean) => void;
  setTrackVisible: (trackIndex: number, visible: boolean) => void;
  setZoom: (zoom: number) => void;

  // Selection
  /** Programmatic selection — single entry point for any selection trigger. */
  setSelection: (args: {
    trackIndex: number;
    barIndex: number;
    beatIndex: number;
    staffIndex?: number;
    voiceIndex?: number;
    noteIndex?: number;
    string?: number;
  }) => void;
  /** Clear the current selection. */
  clearSelection: () => void;
}

// ─── GP7 Percussion Articulation IDs ─────────────────────────────────────────
// Set of valid GP7 articulation IDs (MIDI note numbers 29-127).
// The human-readable names live in the i18n files under "percussion.gp7.{id}".

const GP7_PERCUSSION_IDS = new Set([
  29, 30, 31, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
  48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65,
  66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83,
  84, 85, 86, 87, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103,
  104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118,
  119, 120, 122, 123, 124, 125, 126, 127,
]);

/**
 * Resolve percussion articulation name for a note.
 *
 * `note.percussionArticulation` is the **array index** into
 * `track.percussionArticulations`.  If the track defines articulations
 * and the index is valid, the raw `elementType` from the score file is returned.
 *
 * Otherwise the value is treated as a GP7 articulation ID and an i18n key
 * `"percussion.gp7.{id}"` is returned so the UI layer can resolve it via `t()`.
 */
function resolvePercussionName(
  note: alphaTab.model.Note,
): string {
  const idx = note.percussionArticulation;
  const track = note.beat.voice.bar.staff.track;
  const articulations = track.percussionArticulations;
  if (articulations && idx >= 0 && idx < articulations.length) {
    return articulations[idx].elementType;
  }
  // Return i18n key for GP7 fallback — resolved in the component via t()
  if (GP7_PERCUSSION_IDS.has(idx)) {
    return `percussion.gp7.${idx}`;
  }
  return String(idx);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTrack(index: number): alphaTab.model.Track | undefined {
  return api?.score?.tracks[index];
}

/**
 * Navigate the AlphaTab score model to retrieve the Beat at the given indices.
 * Returns `null` if any index is out of range or the score is not loaded.
 */
function resolveBeat(
  trackIndex: number,
  barIndex: number,
  beatIndex: number,
  staffIndex: number = 0,
  voiceIndex: number = 0,
): alphaTab.model.Beat | null {
  const score = api?.score;
  if (!score) return null;
  const track = score.tracks[trackIndex];
  if (!track) return null;
  const staff = track.staves[staffIndex];
  if (!staff) return null;
  const bar = staff.bars[barIndex];
  if (!bar) return null;
  const voice = bar.voices[voiceIndex];
  if (!voice) return null;
  const beat = voice.beats[beatIndex];
  return beat ?? null;
}

/**
 * Walk boundsLookup to find the BeatBounds for a given beat.
 * Returns `null` if the beat isn't in the current bounds.
 *
 * We navigate via `beatBounds.beat.voice.bar` rather than `barBounds.bar`
 * because AlphaTab's runtime BarBounds may not expose a direct `.bar` ref.
 */
function findBeatBounds(
  trackIndex: number,
  staffIndex: number,
  barIndex: number,
  beatIndex: number,
): alphaTab.rendering.BeatBounds | null {
  const lookup = api?.boundsLookup;
  if (!lookup) return null;

  for (const system of lookup.staffSystems) {
    for (const masterBar of system.bars) {
      for (const barBounds of masterBar.bars) {
        // Use first beat to identify the bar's track/staff
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

/**
 * Build snap grids for all visible tracks by scanning NoteBounds from the
 * first staff system.  For tablature tracks the positions correspond to
 * string lines; for standard notation they correspond to staff lines and
 * spaces.
 */
function buildSnapGrids(): void {
  snapGrids.clear();
  const lookup = api?.boundsLookup;
  const score = api?.score;
  if (!lookup || !score || lookup.staffSystems.length === 0) return;

  // Collect note head positions across ALL systems / master bars so that
  // even tracks whose first system is rests still get a grid.
  const collected = new Map<
    string,
    {
      stringYs: Map<number, number>; // string → centerY
      widths: number[];
      heights: number[];
      trackIndex: number;
      staffIndex: number;
    }
  >();

  for (const system of lookup.staffSystems) {
    for (const masterBar of system.bars) {
      for (const barBounds of masterBar.bars) {
        // Navigate via first beat — barBounds.bar may not exist at runtime
        if (barBounds.beats.length === 0) continue;
        const refBar = barBounds.beats[0].beat.voice.bar;
        const ti = refBar.staff.track.index;
        const si = refBar.staff.index;
        const key = `${ti}:${si}`;
        let entry = collected.get(key);
        if (!entry) {
          entry = {
            stringYs: new Map(),
            widths: [],
            heights: [],
            trackIndex: ti,
            staffIndex: si,
          };
          collected.set(key, entry);
        }

        for (const beatBounds of barBounds.beats) {
          if (!beatBounds.notes) continue;
          for (const nb of beatBounds.notes) {
            const s = nb.note.string;
            if (!entry.stringYs.has(s)) {
              const centerY = nb.noteHeadBounds.y + nb.noteHeadBounds.h / 2;
              entry.stringYs.set(s, centerY);
            }
            entry.widths.push(nb.noteHeadBounds.w);
            entry.heights.push(nb.noteHeadBounds.h);
          }
        }
      }
    }
  }

  // For each track/staff, build a complete grid.
  for (const [key, entry] of collected) {
    if (entry.stringYs.size === 0) continue;

    const track = score.tracks[entry.trackIndex];
    if (!track) continue;
    const staff = track.staves[entry.staffIndex];
    if (!staff) continue;

    const isTab = staff.showTablature;
    const medianW = median(entry.widths);
    const medianH = median(entry.heights);

    const positions: SnapPosition[] = [];

    if (isTab) {
      // ── Tablature: one position per string ──
      const numStrings = staff.tuning.length || 6;
      if (entry.stringYs.size >= 2) {
        // Compute spacing from known data points
        const sorted = [...entry.stringYs.entries()].sort(
          (a, b) => a[0] - b[0],
        );
        // String numbers increase from top to bottom in tab
        // Y should also increase top to bottom.  Use linear fit.
        const firstS = sorted[0][0];
        const firstY = sorted[0][1];
        const lastS = sorted[sorted.length - 1][0];
        const lastY = sorted[sorted.length - 1][1];
        const spacing = (lastY - firstY) / (lastS - firstS);

        for (let s = 1; s <= numStrings; s++) {
          const y = firstY + (s - firstS) * spacing;
          positions.push({ string: s, y });
        }
      } else {
        // Only 1 data point — use it and assume default spacing
        const [knownS, knownY] = [...entry.stringYs.entries()][0];
        const defaultSpacing = medianH * 1.5;
        for (let s = 1; s <= numStrings; s++) {
          positions.push({
            string: s,
            y: knownY + (s - knownS) * defaultSpacing,
          });
        }
      }
    } else {
      // ── Standard notation: staff lines + spaces ──
      // Standard staff = 5 lines.  Lines and spaces alternate.
      // Positions: line 5 (top), space 4-5, line 4, space 3-4, line 3,
      //   space 2-3, line 2, space 1-2, line 1 (bottom)
      // = 9 core positions.  Add 2 ledger positions above + 2 below = 13.
      if (entry.stringYs.size >= 2) {
        const sorted = [...entry.stringYs.entries()].sort(
          (a, b) => a[1] - b[1],
        );
        // Estimate half-step spacing from 2+ different Y values
        // Use the minimum positive Y gap as the half-step
        let minGap = Infinity;
        for (let i = 1; i < sorted.length; i++) {
          const gap = sorted[i][1] - sorted[i - 1][1];
          if (gap > 0.5 && gap < minGap) minGap = gap;
        }
        if (!isFinite(minGap)) minGap = medianH * 1.2;

        // Midpoint of the staff
        const topY = sorted[0][1];

        // Generate 13 positions centered around the known range
        for (let i = -2; i <= 10; i++) {
          positions.push({ string: i + 1, y: topY + i * minGap });
        }
      } else {
        // Only 1 data point
        const [, knownY] = [...entry.stringYs.entries()][0];
        const defaultSpacing = medianH * 1.2;
        for (let i = -2; i <= 10; i++) {
          positions.push({ string: i + 1, y: knownY + i * defaultSpacing });
        }
      }
    }

    // Sort by Y ascending
    positions.sort((a, b) => a.y - b.y);

    snapGrids.set(key, {
      positions,
      noteWidth: medianW,
      noteHeight: medianH,
    });
  }
}

/** Compute the median of an array of numbers. */
function median(arr: number[]): number {
  if (arr.length === 0) return 10;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Find the nearest snap position to a given Y coordinate.
 * Returns the SnapPosition or `null` if the grid is empty.
 */
function findNearestSnap(
  grid: SnapGrid,
  y: number,
): SnapPosition | null {
  if (grid.positions.length === 0) return null;
  let best: SnapPosition = grid.positions[0];
  let bestDist = Math.abs(y - best.y);
  for (let i = 1; i < grid.positions.length; i++) {
    const d = Math.abs(y - grid.positions[i].y);
    if (d < bestDist) {
      bestDist = d;
      best = grid.positions[i];
    }
  }
  return best;
}

/**
 * Position the cursor rectangle element at the given beat + snap position.
 */
function updateCursorRect(
  beatBounds: alphaTab.rendering.BeatBounds | null,
  snap: SnapPosition | null,
  grid: SnapGrid | null,
): void {
  if (!cursorElement) return;

  if (!beatBounds || !snap || !grid) {
    cursorElement.style.display = "none";
    return;
  }

  const w = grid.noteWidth;
  const h = grid.noteHeight;
  const x = beatBounds.onNotesX - w / 2;
  const y = snap.y - h / 2;

  cursorElement.style.display = "";
  cursorElement.style.left = `${x}px`;
  cursorElement.style.top = `${y}px`;
  cursorElement.style.width = `${w}px`;
  cursorElement.style.height = `${h}px`;
}

/** Read which track indices AlphaTab is currently rendering. */
function readVisibleIndices(): number[] {
  if (!api?.tracks) return [];
  return api.tracks.map((t) => t.index);
}

/** Extract detailed note info from an AlphaTab Note model object. */
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
  };
}

/** Extract detailed beat info from an AlphaTab Beat model object. */
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
    notes: beat.notes.map(extractNoteInfo),
  };
}

/** Extract detailed bar info from an AlphaTab Bar + MasterBar. */
function extractBarInfo(bar: alphaTab.model.Bar): SelectedBarInfo {
  const mb = bar.masterBar;
  const tempoAuto = mb.tempoAutomation;
  return {
    index: bar.index,
    timeSignatureNumerator: mb.timeSignatureNumerator,
    timeSignatureDenominator: mb.timeSignatureDenominator,
    keySignature: mb.keySignature as unknown as number,
    keySignatureType: mb.keySignatureType as unknown as KeySignatureType,
    isRepeatStart: mb.isRepeatStart,
    repeatCount: mb.repeatCount,
    alternateEndings: mb.alternateEndings,
    tripletFeel: mb.tripletFeel as unknown as TripletFeel,
    isFreeTime: mb.isFreeTime,
    isDoubleBar: mb.isDoubleBar,
    hasSection: mb.section !== null,
    sectionText: mb.section?.text ?? "",
    sectionMarker: mb.section?.marker ?? "",
    tempo: tempoAuto ? tempoAuto.value : null,
  };
}

// ─── Store ───────────────────────────────────────────────────────────────────

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
  selectedBeatInfo: null,
  selectedBarInfo: null,
  selectedNoteIndex: -1,
  selectedString: -1,
  zoom: 1,

  // ── Lifecycle ────────────────────────────────────────────────────────────

  initialize: (mainEl, viewportEl) => {
    // Tear down any previous instance
    get().destroy();

    set({ isLoading: true });

    mainElement = mainEl;
    viewportElement = viewportEl;

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

    api = new alphaTab.AlphaTabApi(mainEl, settings);

    // ── Capture mousedown coordinates for custom hit-testing ─────────
    // AlphaTab's beatMouseDown/noteMouseDown events don't always resolve
    // to the correct track in multi-track horizontal layout.  We capture
    // coordinates here and use boundsLookup in the beatMouseDown handler
    // for accurate per-track resolution.
    const onMouseDown = (e: MouseEvent) => {
      if (!api || !mainElement) return;
      // .at-main's getBoundingClientRect already accounts for the viewport
      // scroll, so we just need the offset from its top-left corner,
      // divided by the display scale.
      const rect = mainElement.getBoundingClientRect();
      const scale = api.settings.display.scale;
      lastMouseDownX = (e.clientX - rect.left) / scale;
      lastMouseDownY = (e.clientY - rect.top) / scale;
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

      set({
        isLoading: false,
        visibleTrackIndices,
        trackBounds: newTrackBounds,
      });
    });

    api.scoreLoaded.on((score: alphaTab.model.Score) => {
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

      // Render ALL tracks by default so visibility list matches
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

    // ── Click-to-position selection via boundsLookup + snap grid ─────
    // Instead of selecting an existing note, we select the nearest
    // "snap position" (string line for tab, staff line/space for
    // notation) and position a cursor rectangle there.

    api.beatMouseDown.on((eventBeat: alphaTab.model.Beat) => {
      let targetBeat = eventBeat;
      let snappedString = -1;
      let hitSource = "event";

      const lookup = api?.boundsLookup;
      if (lookup) {
        const x = lastMouseDownX;
        const y = lastMouseDownY;

        // 1. Find the staff system that contains the Y position
        for (const system of lookup.staffSystems) {
          const sb = system.realBounds;
          if (y < sb.y || y > sb.y + sb.h) continue;

          // 2. Find the master bar whose X range contains the click
          for (const masterBar of system.bars) {
            const mb = masterBar.realBounds;
            if (x < mb.x || x > mb.x + mb.w) continue;

            // 3. Find the bar (= track) closest to the click Y
            //    (nearest-center instead of strict containment so that
            //    notes above/below the staff, e.g. hi-hat, are reachable)
            let closestBarBounds: (typeof masterBar.bars)[number] | null =
              null;
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
              let bestBeat: alphaTab.model.Beat | null = null;
              let bestBeatDist = Infinity;

              for (const beatBounds of closestBarBounds.beats) {
                const bx = beatBounds.realBounds;
                const dist = Math.abs(x - (bx.x + bx.w / 2));
                if (dist < bestBeatDist) {
                  bestBeatDist = dist;
                  bestBeat = beatBounds.beat;
                }
              }

              if (bestBeat) {
                targetBeat = bestBeat;
                hitSource = "bounds";

                // 5. Snap to nearest string/line position
                const bar = bestBeat.voice.bar;
                const gridKey = `${bar.staff.track.index}:${bar.staff.index}`;
                const grid = snapGrids.get(gridKey);
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
      }

      const bar = targetBeat.voice.bar;
      const staffIndex = bar.staff.index;
      const voiceIndex = targetBeat.voice.index;

      // Expose debug info for e2e tests
      if (import.meta.env.DEV) {
        (window as unknown as Record<string, unknown>).__SELECTION_DEBUG__ = {
          mouseX: lastMouseDownX,
          mouseY: lastMouseDownY,
          hitSource,
          trackIndex: bar.staff.track.index,
          staffIndex,
          voiceIndex,
          barIndex: bar.index,
          beatIndex: targetBeat.index,
          noteCount: targetBeat.notes.length,
          snappedString,
        };
      }

      // Delegate to the programmatic selection API
      get().setSelection({
        trackIndex: bar.staff.track.index,
        staffIndex,
        voiceIndex,
        barIndex: bar.index,
        beatIndex: targetBeat.index,
        string: snappedString,
      });
    });

    // Load the demo file
    api.load("/demos/Taijin_kyofusho.gp");
  },

  destroy: () => {
    // Remove cursor element
    if (cursorElement) {
      cursorElement.remove();
      cursorElement = null;
    }
    snapGrids.clear();

    if (api) {
      api.destroy();
      api = null;
    }
    mainElement = null;
    viewportElement = null;
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
      selectedBeatInfo: null,
      selectedBarInfo: null,
      selectedNoteIndex: -1,
      selectedString: -1,
    });
  },

  // ── File Loading ─────────────────────────────────────────────────────────

  loadFile: (data) => {
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
    if (!api) return;
    api.load(url);
  },

  // ── Playback Controls ────────────────────────────────────────────────────

  playPause: () => {
    api?.playPause();
  },

  stop: () => {
    api?.stop();
    set({ playerState: "stopped", currentTime: 0 });
  },

  setPlaybackSpeed: (speed) => {
    if (!api) return;
    api.playbackSpeed = speed;
    set({ playbackSpeed: speed });
  },

  setMasterVolume: (volume) => {
    if (!api) return;
    api.masterVolume = volume;
    set({ masterVolume: volume });
  },

  toggleLoop: () => {
    if (!api) return;
    const newLooping = !get().isLooping;
    api.isLooping = newLooping;
    set({ isLooping: newLooping });
  },

  // ── Track Controls ───────────────────────────────────────────────────────

  setTrackVolume: (trackIndex, volume) => {
    const track = getTrack(trackIndex);
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
    if (!api || !track) return;
    api.changeTrackSolo([track], solo);
    set({
      tracks: get().tracks.map((t) =>
        t.index === trackIndex ? { ...t, isSolo: solo } : t,
      ),
    });
  },

  setTrackVisible: (trackIndex, visible) => {
    if (!api?.score) return;

    // Compute the new set of visible indices
    const current = new Set(get().visibleTrackIndices);
    if (visible) {
      current.add(trackIndex);
    } else {
      current.delete(trackIndex);
    }

    // Must keep at least one track visible
    if (current.size === 0) return;

    // Tell AlphaTab to render exactly these tracks.
    // renderFinished will update visibleTrackIndices + trackBounds.
    const tracksToRender = [...current]
      .sort((a, b) => a - b)
      .map((i) => api!.score!.tracks[i])
      .filter(Boolean);

    api.renderTracks(tracksToRender);
  },

  // ── View Controls ────────────────────────────────────────────────────────

  setZoom: (zoom) => {
    if (!api) return;
    api.settings.display.scale = zoom;
    api.updateSettings();
    api.render();
    set({ zoom });
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

      const bar = beat.voice.bar;
      const selectedStr = stringArg ?? -1;

      // Derive noteIndex from string: find a note on the selected string
      let resolvedNoteIndex: number;
      if (noteIndex !== undefined && noteIndex >= 0 && noteIndex < beat.notes.length) {
        resolvedNoteIndex = noteIndex;
      } else if (selectedStr > 0 && beat.notes.length > 0) {
        const idx = beat.notes.findIndex((n) => n.string === selectedStr);
        resolvedNoteIndex = idx >= 0 ? idx : -1;
      } else if (beat.notes.length > 0) {
        resolvedNoteIndex = 0;
      } else {
        resolvedNoteIndex = -1;
      }

      // Lazily create the cursor element inside .at-cursors
      if (!cursorElement && mainElement) {
        const cursorsWrapper = mainElement.querySelector(".at-cursors");
        if (cursorsWrapper) {
          cursorElement = document.createElement("div");
          cursorElement.classList.add("at-edit-cursor");
          cursorsWrapper.appendChild(cursorElement);
        }
      }

      // Position the cursor rectangle
      const gridKey = `${trackIndex}:${staffIndex}`;
      const grid = snapGrids.get(gridKey) ?? null;
      const snap =
        grid && selectedStr > 0
          ? grid.positions.find((p) => p.string === selectedStr) ?? null
          : null;
      const bb = findBeatBounds(trackIndex, staffIndex, barIndex, beatIndex);
      updateCursorRect(bb, snap, grid);

      set({
        selectedBeat: {
          trackIndex,
          staffIndex,
          voiceIndex,
          barIndex,
          beatIndex,
          string: selectedStr,
        },
        selectedBeatInfo: extractBeatInfo(beat),
        selectedBarInfo: extractBarInfo(bar),
        selectedNoteIndex: resolvedNoteIndex,
        selectedString: selectedStr,
      });
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
      selectedBeatInfo: null,
      selectedBarInfo: null,
      selectedNoteIndex: -1,
      selectedString: -1,
    });
  },
}));

// Expose store on window for e2e diagnostics (dev only)
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__PLAYER_STORE__ =
    usePlayerStore;
  // Also expose a getter for the module-scoped api (useful for headless debugging)
  Object.defineProperty(window, "__ALPHATAB_API__", {
    get: () => api,
    configurable: true,
  });
}
