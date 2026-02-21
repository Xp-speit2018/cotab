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

import { debugLog } from "./debug-log-store";

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

/** References to DOM elements needed for coordinate conversion. */
let mainElement: HTMLElement | null = null;
let viewportElement: HTMLElement | null = null;

/** Cursor rectangle DOM element, appended to `.at-cursors`. */
let cursorElement: HTMLDivElement | null = null;

/** Container for snap-grid debug overlay markers, appended to `.at-cursors`. */
let snapGridOverlayContainer: HTMLDivElement | null = null;

/** Container for snap-grid ID labels, appended to the viewport wrapper. */
let snapGridLabelContainer: HTMLDivElement | null = null;
/** Cached overlay entries (markers + labels) for dimming and repositioning. */
let snapGridEntries: { marker: HTMLElement; label: HTMLElement; string: number; y: number; trackIndex: number; staffIndex: number }[] = [];
/** Scroll handler reference for cleanup. */
let snapGridScrollHandler: (() => void) | null = null;

/**
 * Pending selection to apply after the next render completes.
 * Used by rest insertion actions so the cursor is positioned with
 * fresh boundsLookup instead of stale pre-render data.
 */
let pendingSelection: {
  trackIndex: number;
  barIndex: number;
  beatIndex: number;
  staffIndex: number;
  voiceIndex: number;
  string: number | null;
} | null = null;

/** Quarter-note tick constant (AlphaTab uses 960 ticks per quarter). */
const QUARTER_TICKS = 960;

// ─── Snap Grid ───────────────────────────────────────────────────────────────

/** A single selectable position within a track's staff. */
interface SnapPosition {
  /**
   * Position identifier:
   * - Tab tracks: 1-based string number.
   * - Standard notation: line/space index (1–21).
   * - Percussion: alphaTab staffLine value (from InstrumentArticulation).
   */
  string: number;
  /** Center Y in bounds coordinate space. */
  y: number;
}

/** Per-track snap grid built from rendered NoteBounds. */
interface SnapGrid {
  positions: SnapPosition[]; // sorted by y (ascending)
  noteWidth: number; // typical note head width
  noteHeight: number; // typical note head height
  /**
   * For percussion tracks only: maps staffLine → default
   * percussionArticulation value, derived from observed notes in the score.
   */
  percussionMap?: Map<number, number>;
}

/** Key = `${trackIndex}:${staffIndex}` → snap grid for that track/staff. */
const snapGrids = new Map<string, SnapGrid>();

/** A group of percussion articulations sharing the same staff line. */
export interface PercSnapGroup {
  /** AlphaTab staffLine value. */
  staffLine: number;
  /** All articulation definitions at this staff line. */
  entries: PercArticulationDef[];
}

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
  /**
   * Position identifier, or null if no position is selected.
   * - Tab: 1-based string number.
   * - Standard notation: line/space index (1–21).
   * - Percussion: alphaTab staffLine value.
   */
  string: number | null;
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
  /** Resolved GP7 articulation ID (from the constant map, not from runtime data). */
  percussionGp7Id: number;
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
  deadSlapped: boolean;
  isLegatoOrigin: boolean;
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

export interface SelectedTrackInfo {
  index: number;
  name: string;
  shortName: string;
  isPercussion: boolean;
  staffCount: number;
  playbackChannel: number;
  playbackProgram: number;
  playbackPort: number;
}

export interface SelectedStaffInfo {
  index: number;
  showTablature: boolean;
  showStandardNotation: boolean;
  stringCount: number;
  capo: number;
  transpositionPitch: number;
  displayTranspositionPitch: number;
}

export interface SelectedVoiceInfo {
  index: number;
  isEmpty: boolean;
  beatCount: number;
}

export type ScoreMetadataField =
  | "title"
  | "subTitle"
  | "artist"
  | "album"
  | "words"
  | "music"
  | "copyright"
  | "tab"
  | "instructions"
  | "notices"
  | "tempoLabel";

/** Maps alphaTab Score field names to player-store state keys. */
const SCORE_FIELD_TO_STATE: Record<ScoreMetadataField, keyof PlayerState> = {
  title: "scoreTitle",
  subTitle: "scoreSubTitle",
  artist: "scoreArtist",
  album: "scoreAlbum",
  words: "scoreWords",
  music: "scoreMusic",
  copyright: "scoreCopyright",
  tab: "scoreTab",
  instructions: "scoreInstructions",
  notices: "scoreNotices",
  tempoLabel: "scoreTempoLabel",
};

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

  // Score metadata editing
  setScoreMetadata: (field: ScoreMetadataField, value: string) => void;
  setScoreTempo: (tempo: number) => void;

  // Tracks
  tracks: TrackInfo[];
  /** Derived from api.tracks on every renderFinished — single source of truth. */
  visibleTrackIndices: number[];
  trackBounds: TrackBounds[];

  // Cursors
  selectedBeat: SelectedBeat | null;
  /** Detailed track-level properties of the selected track (from AlphaTab model). */
  selectedTrackInfo: SelectedTrackInfo | null;
  /** Detailed staff-level properties of the selected staff (from AlphaTab model). */
  selectedStaffInfo: SelectedStaffInfo | null;
  /** Detailed bar-level properties of the selected bar (from AlphaTab model). */
  selectedBarInfo: SelectedBarInfo | null;
  /** Detailed voice-level properties of the selected voice (from AlphaTab model). */
  selectedVoiceInfo: SelectedVoiceInfo | null;
  /** Detailed note-level properties of the selected beat's notes (from AlphaTab model). */
  selectedBeatInfo: SelectedBeatInfo | null;
  /** Index into selectedBeatInfo.notes[] for the actively selected note, or -1 if none. */
  selectedNoteIndex: number;
  /** The string/line the cursor is on, null = none. */
  selectedString: number | null;
  // View
  zoom: number;

  /** Sidebar NOTE/EFFECTS display mode: essentials (common) or advanced (full). Persisted in localStorage. */
  editorMode: "essentials" | "advanced";

  // Debug
  /** When true, renders horizontal markers at each snap grid position on the score. */
  showSnapGrid: boolean;

  // Actions
  setEditorMode: (mode: "essentials" | "advanced") => void;
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
  setShowSnapGrid: (show: boolean) => void;

  // Rest insertion
  /** Insert a rest beat before the currently selected beat. */
  appendRestBefore: (duration?: alphaTab.model.Duration) => void;
  /** Insert a rest beat after the currently selected beat. */
  appendRestAfter: (duration?: alphaTab.model.Duration) => void;

  // Beat manipulation
  /** Toggle the `isEmpty` flag on the selected beat and re-render. */
  toggleBeatIsEmpty: () => void;

  /**
   * Apply property updates to the currently selected beat and re-render.
   * Use for NOTE/EFFECTS sidebar reactivity (duration, dots, dynamics, etc.).
   */
  updateBeat: (updates: Record<string, unknown>) => void;

  /**
   * Apply property updates to the currently selected note and re-render.
   * No-op if no note is selected. Use for note-level effects and articulation.
   */
  updateNote: (updates: Record<string, unknown>) => void;

  // Note placement
  /** Place a quarter note at the selected beat + string position. */
  placeNote: () => void;

  // Note deletion
  /**
   * Delete the selected note/rest programmatically.
   *
   * 1. Note shares a beat with other notes → remove just that note.
   * 2. Note is the only one on its beat → clear notes so the beat becomes a rest.
   * 3. Selected beat is a rest → remove it from the voice.
   *    Returns `false` (and does nothing) when the rest is the last beat
   *    in the bar, since removing it would leave the voice in an invalid state.
   */
  deleteNote: () => boolean;

  // Bar manipulation
  /** Insert an empty (rest-filled) bar before the selected bar, across all tracks. */
  insertBarBefore: () => void;
  /** Insert an empty (rest-filled) bar after the selected bar, across all tracks. */
  insertBarAfter: () => void;
  /**
   * Delete the selected bar across all tracks.
   * Returns `false` (and does nothing) when any track's bar contains notes,
   * or when it is the only bar in the score.
   */
  deleteBar: () => boolean;

  // Percussion articulation
  /**
   * Toggle a GP7 percussion articulation on the selected beat.
   * Mutual exclusion: only one articulation per staffLine is allowed.
   */
  togglePercussionArticulation: (gp7Id: number) => void;

  // Selection
  /** Programmatic selection — single entry point for any selection trigger. */
  setSelection: (args: {
    trackIndex: number;
    barIndex: number;
    beatIndex: number;
    staffIndex?: number;
    voiceIndex?: number;
    noteIndex?: number;
    string?: number | null;
  }) => void;
  /** Clear the current selection. */
  clearSelection: () => void;
}

// ─── AlphaTab Percussion Articulation Definitions ────────────────────────────
// Extracted from alphaTab PercussionMapper.instrumentArticulations +
// _instrumentArticulationNames.  This is the single source of truth for
// every GP7 percussion articulation: ID, element type, staff line,
// and technique name.

export interface PercArticulationDef {
  /** GP7 articulation ID. */
  id: number;
  /** Element type from alphaTab, e.g. "Snare", "Charley". */
  elementType: string;
  /** Staff line position from alphaTab InstrumentArticulation. */
  staffLine: number;
  /** Playing technique, e.g. "hit", "side stick", "mute". */
  technique: string;
}

export const ALPHATAB_PERCUSSION_DEFS: readonly PercArticulationDef[] = [
  // Snare (staffLine 3)
  { id: 38, elementType: "Snare", staffLine: 3, technique: "hit" },
  { id: 37, elementType: "Snare", staffLine: 3, technique: "side stick" },
  { id: 91, elementType: "Snare", staffLine: 3, technique: "rim shot" },
  { id: 39, elementType: "Hand Clap", staffLine: 3, technique: "hit" },
  { id: 40, elementType: "Electric Snare", staffLine: 3, technique: "hit" },
  { id: 31, elementType: "Sticks", staffLine: 3, technique: "hit" },
  { id: 33, elementType: "Metronome", staffLine: 3, technique: "hit" },
  { id: 34, elementType: "Metronome", staffLine: 3, technique: "bell" },
  { id: 54, elementType: "Tambourine", staffLine: 3, technique: "hit" },
  // Charley — Hi-Hat (staffLine -1)
  { id: 42, elementType: "Charley", staffLine: -1, technique: "closed" },
  { id: 92, elementType: "Charley", staffLine: -1, technique: "half" },
  { id: 46, elementType: "Charley", staffLine: -1, technique: "open" },
  // Crash Medium (staffLine -1)
  { id: 57, elementType: "Crash Medium", staffLine: -1, technique: "hit" },
  { id: 98, elementType: "Crash Medium", staffLine: -1, technique: "choke" },
  // Cowbell High (staffLine -1)
  { id: 102, elementType: "Cowbell High", staffLine: -1, technique: "hit" },
  { id: 103, elementType: "Cowbell High", staffLine: -1, technique: "tip" },
  // Charley — Pedal Hi-Hat (staffLine 9)
  { id: 44, elementType: "Charley", staffLine: 9, technique: "hit" },
  // Ride (staffLine 0)
  { id: 93, elementType: "Ride", staffLine: 0, technique: "edge" },
  { id: 51, elementType: "Ride", staffLine: 0, technique: "middle" },
  { id: 53, elementType: "Ride", staffLine: 0, technique: "bell" },
  { id: 94, elementType: "Ride", staffLine: 0, technique: "choke" },
  // Cowbell Medium (staffLine 0)
  { id: 56, elementType: "Cowbell Medium", staffLine: 0, technique: "hit" },
  { id: 101, elementType: "Cowbell Medium", staffLine: 0, technique: "tip" },
  // Splash (staffLine -2)
  { id: 55, elementType: "Splash", staffLine: -2, technique: "hit" },
  { id: 95, elementType: "Splash", staffLine: -2, technique: "choke" },
  // Crash High (staffLine -2)
  { id: 49, elementType: "Crash High", staffLine: -2, technique: "hit" },
  { id: 97, elementType: "Crash High", staffLine: -2, technique: "choke" },
  // China (staffLine -3)
  { id: 52, elementType: "China", staffLine: -3, technique: "hit" },
  { id: 96, elementType: "China", staffLine: -3, technique: "choke" },
  // Reverse Cymbal (staffLine -3)
  { id: 30, elementType: "Reverse Cymbal", staffLine: -3, technique: "hit" },
  // Toms
  { id: 50, elementType: "Tom Very High", staffLine: 1, technique: "hit" },
  // Cowbell Low (staffLine 1)
  { id: 99, elementType: "Cowbell Low", staffLine: 1, technique: "hit" },
  { id: 100, elementType: "Cowbell Low", staffLine: 1, technique: "tip" },
  // Tambourine roll (staffLine 1)
  { id: 112, elementType: "Tambourine", staffLine: 1, technique: "roll" },
  // Tom High (staffLine 2)
  { id: 48, elementType: "Tom High", staffLine: 2, technique: "hit" },
  // Tambourine return (staffLine 2)
  { id: 111, elementType: "Tambourine", staffLine: 2, technique: "return" },
  // Ride Cymbal 2 (staffLine 2)
  { id: 59, elementType: "Ride Cymbal 2", staffLine: 2, technique: "edge" },
  { id: 126, elementType: "Ride Cymbal 2", staffLine: 2, technique: "middle" },
  { id: 127, elementType: "Ride Cymbal 2", staffLine: 2, technique: "bell" },
  { id: 29, elementType: "Ride Cymbal 2", staffLine: 2, technique: "choke" },
  // Tom Medium (staffLine 4)
  { id: 47, elementType: "Tom Medium", staffLine: 4, technique: "hit" },
  // Tom Low + Very Low Floor Tom (staffLine 5)
  { id: 45, elementType: "Tom Low", staffLine: 5, technique: "hit" },
  { id: 41, elementType: "Very Low Floor Tom", staffLine: 5, technique: "hit" },
  // Tom Very Low (staffLine 6)
  { id: 43, elementType: "Tom Very Low", staffLine: 6, technique: "hit" },
  // Kick Drum (staffLine 7)
  { id: 36, elementType: "Kick Drum", staffLine: 7, technique: "hit" },
  // Acoustic Kick Drum (staffLine 8)
  { id: 35, elementType: "Acoustic Kick Drum", staffLine: 8, technique: "hit" },
  // Timbale High (staffLine 9)
  { id: 65, elementType: "Timbale High", staffLine: 9, technique: "hit" },
  // Timbale Low (staffLine 10)
  { id: 66, elementType: "Timbale Low", staffLine: 10, technique: "hit" },
  // Agogo High (staffLine 11)
  { id: 67, elementType: "Agogo High", staffLine: 11, technique: "hit" },
  // Agogo Low (staffLine 12)
  { id: 68, elementType: "Agogo Low", staffLine: 12, technique: "hit" },
  // Conga High slap (staffLine 13)
  { id: 110, elementType: "Conga High", staffLine: 13, technique: "slap" },
  // Conga High (staffLine 14)
  { id: 63, elementType: "Conga High", staffLine: 14, technique: "hit" },
  // Conga Low mute (staffLine 15)
  { id: 109, elementType: "Conga Low", staffLine: 15, technique: "mute" },
  // Conga Low slap (staffLine 16)
  { id: 108, elementType: "Conga Low", staffLine: 16, technique: "slap" },
  // Conga Low (staffLine 17)
  { id: 64, elementType: "Conga Low", staffLine: 17, technique: "hit" },
  // Piatti (staffLine 18)
  { id: 115, elementType: "Piatti", staffLine: 18, technique: "hit" },
  // Conga High mute (staffLine 19)
  { id: 62, elementType: "Conga High", staffLine: 19, technique: "mute" },
  // Claves (staffLine 20)
  { id: 75, elementType: "Claves", staffLine: 20, technique: "hit" },
  // Castanets (staffLine 21)
  { id: 85, elementType: "Castanets", staffLine: 21, technique: "hit" },
  // Cabasa return (staffLine 22)
  { id: 117, elementType: "Cabasa", staffLine: 22, technique: "return" },
  // Cabasa (staffLine 23)
  { id: 69, elementType: "Cabasa", staffLine: 23, technique: "hit" },
  // Piatti hand (staffLine 24)
  { id: 116, elementType: "Piatti", staffLine: 24, technique: "hand" },
  // Grancassa (staffLine 25)
  { id: 114, elementType: "Grancassa", staffLine: 25, technique: "hit" },
  // Triangle mute (staffLine 26)
  { id: 80, elementType: "Triangle", staffLine: 26, technique: "mute" },
  // Triangle (staffLine 27)
  { id: 81, elementType: "Triangle", staffLine: 27, technique: "hit" },
  // Vibraslap (staffLine 28)
  { id: 58, elementType: "Vibraslap", staffLine: 28, technique: "hit" },
  // Cuica mute (staffLine 29)
  { id: 78, elementType: "Cuica", staffLine: 29, technique: "mute" },
  // Cuica open (staffLine 30)
  { id: 79, elementType: "Cuica", staffLine: 30, technique: "open" },
  // Surdo mute (staffLine 35)
  { id: 87, elementType: "Surdo", staffLine: 35, technique: "mute" },
  // Surdo (staffLine 36)
  { id: 86, elementType: "Surdo", staffLine: 36, technique: "hit" },
  // Guiro scrap-return (staffLine 37)
  { id: 74, elementType: "Guiro", staffLine: 37, technique: "scrap-return" },
  // Guiro (staffLine 38)
  { id: 73, elementType: "Guiro", staffLine: 38, technique: "hit" },
  // Bongo High (staffLine -4)
  { id: 60, elementType: "Bongo High", staffLine: -4, technique: "hit" },
  // Bongo High mute (staffLine -5)
  { id: 104, elementType: "Bongo High", staffLine: -5, technique: "mute" },
  // Bongo High slap (staffLine -6)
  { id: 105, elementType: "Bongo High", staffLine: -6, technique: "slap" },
  // Bongo Low (staffLine -7)
  { id: 61, elementType: "Bongo Low", staffLine: -7, technique: "hit" },
  // Tambourine hand (staffLine -7)
  { id: 113, elementType: "Tambourine", staffLine: -7, technique: "hand" },
  // Bongo Low mute (staffLine -8)
  { id: 106, elementType: "Bongo Low", staffLine: -8, technique: "mute" },
  // Woodblock Low (staffLine -9)
  { id: 77, elementType: "Woodblock Low", staffLine: -9, technique: "hit" },
  // Woodblock High (staffLine -10)
  { id: 76, elementType: "Woodblock High", staffLine: -10, technique: "hit" },
  // Whistle Low (staffLine -11)
  { id: 72, elementType: "Whistle Low", staffLine: -11, technique: "hit" },
  // Left Maraca (staffLine -12)
  { id: 70, elementType: "Left Maraca", staffLine: -12, technique: "hit" },
  // Left Maraca return (staffLine -13)
  { id: 118, elementType: "Left Maraca", staffLine: -13, technique: "return" },
  // Right Maraca (staffLine -14)
  { id: 119, elementType: "Right Maraca", staffLine: -14, technique: "hit" },
  // Right Maraca return (staffLine -15)
  { id: 120, elementType: "Right Maraca", staffLine: -15, technique: "return" },
  // Bongo Low slap (staffLine -16)
  { id: 107, elementType: "Bongo Low", staffLine: -16, technique: "slap" },
  // Whistle High (staffLine -17)
  { id: 71, elementType: "Whistle High", staffLine: -17, technique: "hit" },
  // Bell Tree (staffLine -18)
  { id: 84, elementType: "Bell Tree", staffLine: -18, technique: "hit" },
  // Bell Tree return (staffLine -19)
  { id: 123, elementType: "Bell Tree", staffLine: -19, technique: "return" },
  // Jingle Bell (staffLine -20)
  { id: 83, elementType: "Jingle Bell", staffLine: -20, technique: "hit" },
  // Golpe thumb (staffLine -21)
  { id: 124, elementType: "Golpe", staffLine: -21, technique: "thumb" },
  // Golpe finger (staffLine -22)
  { id: 125, elementType: "Golpe", staffLine: -22, technique: "finger" },
  // Shaker (staffLine -23)
  { id: 82, elementType: "Shaker", staffLine: -23, technique: "hit" },
  // Shaker return (staffLine -24)
  { id: 122, elementType: "Shaker", staffLine: -24, technique: "return" },
];

/** Quick lookup: GP7 ID → articulation definition. */
export const GP7_DEF_BY_ID: ReadonlyMap<number, PercArticulationDef> = new Map(
  ALPHATAB_PERCUSSION_DEFS.map((d) => [d.id, d]),
);

/** GP7 articulation ID → staffLine (derived from ALPHATAB_PERCUSSION_DEFS). */
export const GP7_ARTICULATION_MAP: ReadonlyMap<number, number> = new Map(
  ALPHATAB_PERCUSSION_DEFS.map((d) => [d.id, d.staffLine]),
);

/** Reverse map: staffLine → GP7 articulation IDs at that position. */
export const GP7_STAFF_LINE_MAP: ReadonlyMap<number, readonly number[]> = (() => {
  const m = new Map<number, number[]>();
  for (const d of ALPHATAB_PERCUSSION_DEFS) {
    const arr = m.get(d.staffLine) ?? [];
    arr.push(d.id);
    m.set(d.staffLine, arr);
  }
  return m as ReadonlyMap<number, readonly number[]>;
})();

/** Static pre-computed groups: every possible staff line from ALPHATAB_PERCUSSION_DEFS. */
export const PERC_SNAP_GROUPS: readonly PercSnapGroup[] = (() => {
  const byLine = new Map<number, PercArticulationDef[]>();
  for (const d of ALPHATAB_PERCUSSION_DEFS) {
    const arr = byLine.get(d.staffLine) ?? [];
    arr.push(d);
    byLine.set(d.staffLine, arr);
  }
  return [...byLine.entries()]
    .sort(([a], [b]) => a - b)
    .map(([staffLine, entries]) => ({ staffLine, entries }));
})();

/**
 * Resolve a note's `percussionArticulation` to its GP7 articulation ID.
 * When the track defines custom `percussionArticulations`, the value is
 * an array index — read the `.id` field. Otherwise it is the GP7 ID itself.
 */
export function resolveGp7Id(note: alphaTab.model.Note): number {
  const idx = note.percussionArticulation;
  const artics = note.beat.voice.bar.staff.track.percussionArticulations;
  if (artics?.length > 0 && idx >= 0 && idx < artics.length) {
    return artics[idx].id;
  }
  return idx;
}

/**
 * Convert a GP7 articulation ID to the value expected by
 * `note.percussionArticulation` for the given track.
 */
function gp7IdToPercussionArticulation(
  track: alphaTab.model.Track,
  gp7Id: number,
): number {
  const artics = track.percussionArticulations;
  if (artics?.length > 0) {
    const idx = artics.findIndex((a) => a.id === gp7Id);
    if (idx >= 0) return idx;
  }
  return gp7Id;
}

/**
 * Resolve percussion articulation name for a note.
 *
 * `note.percussionArticulation` is the **array index** into
 * `track.percussionArticulations`.  If the track defines articulations
 * and the index is valid, the raw `elementType` from the score file is returned.
 *
 * Otherwise the value is treated as a GP7 articulation ID and the name is
 * derived from `ALPHATAB_PERCUSSION_DEFS`.
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
  const def = GP7_DEF_BY_ID.get(idx);
  if (def) {
    return `${def.elementType} (${def.technique})`;
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

// ─── Note Placement Helpers ──────────────────────────────────────────────────

const DIATONIC_TONES = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B

/**
 * Map a snap-grid position (1–21, 1 = top / highest pitch) to an
 * (octave, tone) pair based on the bar's clef.
 *
 * Position 11 is the anchor (middle line of the staff).
 */
function snapPositionToPitch(
  clef: alphaTab.model.Clef,
  position: number,
): { octave: number; tone: number } {
  let refOctave: number;
  let refScaleIdx: number;

  switch (clef as unknown as number) {
    case 4: // G2 — treble
      refOctave = 4;
      refScaleIdx = 6; // B4
      break;
    case 3: // F4 — bass
      refOctave = 3;
      refScaleIdx = 1; // D3
      break;
    case 1: // C3 — alto
      refOctave = 4;
      refScaleIdx = 0; // C4
      break;
    case 2: // C4 — tenor
      refOctave = 3;
      refScaleIdx = 5; // A3
      break;
    default: // Neutral or unknown → treble
      refOctave = 4;
      refScaleIdx = 6; // B4
  }

  const steps = 11 - position; // positive = higher pitch
  let scaleIdx = refScaleIdx + steps;
  let octave = refOctave;

  while (scaleIdx >= 7) {
    scaleIdx -= 7;
    octave++;
  }
  while (scaleIdx < 0) {
    scaleIdx += 7;
    octave--;
  }

  return { octave, tone: DIATONIC_TONES[scaleIdx] };
}

/**
 * Default GP7 percussion articulation for each staffLine value.
 * Covers a standard 5-piece kit spread across the staff.
 * Keys are alphaTab `InstrumentArticulation.staffLine` values.
 */
const DRUM_STAFFLINE_DEFAULTS: Record<number, number> = {
  [-3]: 52,  // China
  [-2]: 49,  // Crash high
  [-1]: 42,  // Closed Hi-Hat
  0: 51,     // Ride (middle)
  1: 50,     // Tom Very High
  2: 48,     // Tom High
  3: 38,     // Snare
  4: 47,     // Tom Medium
  5: 45,     // Tom Low
  6: 43,     // Tom Very Low
  7: 36,     // Kick Drum
  8: 35,     // Acoustic Kick
  9: 44,     // Pedal Hi-Hat
};

// ─── Bar Insertion Helper ────────────────────────────────────────────────────

/**
 * Insert a rest-filled bar at `insertIndex` across all tracks.
 * Copies time signature from the nearest existing bar.
 * Calls `score.finish()` + `applyBarWarningStyles()` before returning.
 */
function insertBarAtIndex(
  score: alphaTab.model.Score,
  insertIndex: number,
): void {
  try {
    debugLog("debug", "insertBarAtIndex", "start", {
      insertIndex,
      masterBarCount: score.masterBars.length,
      trackCount: score.tracks.length,
    });

    const refBarIndex = Math.min(insertIndex, score.masterBars.length - 1);
    const refMasterBar = score.masterBars[refBarIndex];

    debugLog("debug", "insertBarAtIndex", "reference bar", {
      refBarIndex,
      timeSignature: `${refMasterBar.timeSignatureNumerator}/${refMasterBar.timeSignatureDenominator}`,
    });

    const mb = new alphaTab.model.MasterBar();
    mb.timeSignatureNumerator = refMasterBar.timeSignatureNumerator;
    mb.timeSignatureDenominator = refMasterBar.timeSignatureDenominator;
    mb.timeSignatureCommon = refMasterBar.timeSignatureCommon;

    // Set score reference before splicing
    mb.score = score;

    score.masterBars.splice(insertIndex, 0, mb);
    debugLog("debug", "insertBarAtIndex", "masterBar inserted", {
      newMasterBarCount: score.masterBars.length,
    });

    // Re-index all masterBars and rebuild linked lists
    for (let i = 0; i < score.masterBars.length; i++) {
      const masterBar = score.masterBars[i];
      masterBar.index = i;
      masterBar.previousMasterBar = i > 0 ? score.masterBars[i - 1] : null;
      masterBar.nextMasterBar = i < score.masterBars.length - 1 ? score.masterBars[i + 1] : null;
    }
    debugLog("debug", "insertBarAtIndex", "masterBar indices and links updated");

    for (const track of score.tracks) {
      for (const staff of track.staves) {
        const refBar = staff.bars[refBarIndex < insertIndex ? refBarIndex : Math.min(insertIndex, staff.bars.length - 1)];
        const voiceCount = refBar ? refBar.voices.length : 1;

        debugLog("debug", "insertBarAtIndex", "creating bar for track/staff", {
          trackIndex: track.index,
          staffIndex: staff.index,
          voiceCount,
        });

        const bar = new alphaTab.model.Bar();
        bar.clef = refBar ? refBar.clef : (4 as unknown as alphaTab.model.Clef); // G2

        for (let vi = 0; vi < voiceCount; vi++) {
          const voice = new alphaTab.model.Voice();
          const restBeat = new alphaTab.model.Beat();
          restBeat.isEmpty = false;
          restBeat.notes = [];
          restBeat.duration = alphaTab.model.Duration.Quarter as number as alphaTab.model.Duration;
          voice.addBeat(restBeat);
          bar.addVoice(voice);
        }

        staff.bars.splice(insertIndex, 0, bar);

        // Set staff reference and re-index all bars in this staff
        for (let i = 0; i < staff.bars.length; i++) {
          const b = staff.bars[i];
          b.staff = staff;
          b.index = i;
          b.previousBar = i > 0 ? staff.bars[i - 1] : null;
          b.nextBar = i < staff.bars.length - 1 ? staff.bars[i + 1] : null;
        }
      }
    }
    debugLog("debug", "insertBarAtIndex", "bar indices and links updated");

    debugLog("debug", "insertBarAtIndex", "calling score.finish()");
    score.finish(api!.settings);
    debugLog("debug", "insertBarAtIndex", "score.finish() completed");

    debugLog("debug", "insertBarAtIndex", "calling applyBarWarningStyles()");
    applyBarWarningStyles();
    debugLog("info", "insertBarAtIndex", "complete", {
      newMasterBarCount: score.masterBars.length,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    debugLog("error", "insertBarAtIndex", "failed", {
      error: err.message,
      stack: err.stack,
      insertIndex,
    });
    throw err;
  }
}

// ─── Duration Helpers ─────────────────────────────────────────────────────────

/**
 * Convert a Duration enum value to ticks.
 * Mirrors AlphaTab's internal MidiUtils.toTicks (not exported).
 */
function durationToTicks(duration: number): number {
  let denom = duration;
  if (denom < 0) {
    denom = 1 / -denom;
  }
  return (QUARTER_TICKS * (4 / denom)) | 0;
}

/**
 * Calculate the playback duration of a single beat in ticks,
 * accounting for dots and tuplets.
 */
function beatDurationTicks(beat: alphaTab.model.Beat): number {
  // Grace notes have zero display duration — skip them
  if (beat.graceType !== (0 as unknown as alphaTab.model.GraceType)) return 0;

  let ticks = durationToTicks(beat.duration as unknown as number);
  // Apply dots
  if (beat.dots === 1) {
    ticks = ticks + ((ticks / 2) | 0);
  } else if (beat.dots === 2) {
    ticks = ticks + (((ticks / 4) | 0) * 3);
  }
  // Apply tuplet
  if (beat.tupletDenominator > 0 && beat.tupletNumerator > 0) {
    ticks = ((ticks * beat.tupletDenominator) / beat.tupletNumerator) | 0;
  }
  return ticks;
}

/**
 * Sum the durations of all beats in a voice.
 * All beats (including isEmpty placeholders) count toward bar fullness
 * because AlphaTab allocates display duration for them.
 */
function sumBeatDurationTicks(voice: alphaTab.model.Voice): number {
  let total = 0;
  for (const beat of voice.beats) {
    total += beatDurationTicks(beat);
  }
  return total;
}

// ─── Bar Empty Check ─────────────────────────────────────────────────────────

/**
 * Check whether a bar index is "empty" across ALL tracks — meaning every
 * track/staff/voice at that index contains only rests (no real notes).
 */
function isBarEmptyAllTracks(barIndex: number): boolean {
  const score = api?.score;
  if (!score) return false;
  for (const track of score.tracks) {
    for (const staff of track.staves) {
      const bar = staff.bars[barIndex];
      if (!bar) continue;
      if (!bar.isEmpty && !bar.isRestOnly) return false;
    }
  }
  return true;
}

// ─── Bar Duration Validator ──────────────────────────────────────────────────

type BarDurationStatus = "complete" | "incomplete" | "overfull";

/**
 * Check whether a bar's voice has the correct total duration.
 */
function getBarDurationStatus(
  bar: alphaTab.model.Bar,
  voiceIndex: number,
): BarDurationStatus {
  const voice = bar.voices[voiceIndex];
  if (!voice || voice.isEmpty) return "complete";
  const expected = bar.masterBar.calculateDuration();
  const actual = sumBeatDurationTicks(voice);
  if (actual < expected) return "incomplete";
  if (actual > expected) return "overfull";
  return "complete";
}


/**
 * Cluster an array of Y values by merging those within `tolerance` of each
 * other, returning the average of each cluster sorted ascending.
 */
function clusterYPositions(ys: number[], tolerance: number): number[] {
  if (ys.length === 0) return [];
  const sorted = [...ys].sort((a, b) => a - b);
  const clusters: number[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const last = clusters[clusters.length - 1];
    if (sorted[i] - last[last.length - 1] <= tolerance) {
      last.push(sorted[i]);
    } else {
      clusters.push([sorted[i]]);
    }
  }
  return clusters.map(
    (c) => c.reduce((a, b) => a + b, 0) / c.length,
  );
}

/**
 * Build snap grids for all visible tracks by scanning NoteBounds.
 * For tablature tracks the positions correspond to string lines;
 * for standard notation they correspond to staff lines and spaces
 * (5 lines + 4 spaces = 9 core positions + ledger positions).
 */
function buildSnapGrids(): void {
  snapGrids.clear();
  const lookup = api?.boundsLookup;
  const score = api?.score;
  if (!lookup || !score || lookup.staffSystems.length === 0) return;

  // ── Collection phase ──────────────────────────────────────────────
  // Collect note head positions across ALL systems / master bars so that
  // even tracks whose first system is rests still get a grid.
  const collected = new Map<
    string,
    {
      stringYs: Map<number, number>; // string → centerY (for tab)
      allYPositions: number[];       // every note centerY (for notation)
      /** For percussion: observed (centerY, percussionArticulation) pairs. */
      percYArticulations: { y: number; artic: number }[];
      widths: number[];
      heights: number[];
      trackIndex: number;
      staffIndex: number;
      isTab: boolean;
      barRealBounds: { y: number; h: number } | null;
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
          const trackObj = score.tracks[ti];
          const staffObj = trackObj?.staves[si];
          entry = {
            stringYs: new Map(),
            allYPositions: [],
            percYArticulations: [],
            widths: [],
            heights: [],
            trackIndex: ti,
            staffIndex: si,
            isTab: staffObj?.showTablature ?? true,
            barRealBounds: null,
          };
          collected.set(key, entry);
        }

        // Capture bar realBounds for fallback (first seen)
        if (!entry.barRealBounds) {
          entry.barRealBounds = {
            y: barBounds.realBounds.y,
            h: barBounds.realBounds.h,
          };
        }

        for (const beatBounds of barBounds.beats) {
          if (!beatBounds.notes) continue;
          for (const nb of beatBounds.notes) {
            const centerY = nb.noteHeadBounds.y + nb.noteHeadBounds.h / 2;

            // For tab: one Y per string number
            const s = nb.note.string;
            if (!entry.stringYs.has(s)) {
              entry.stringYs.set(s, centerY);
            }
            // For notation: collect every note Y position
            // Also for percussion (uses notation grid even when showTablature is true)
            const trackObj = score.tracks[ti];
            if (!entry.isTab || trackObj?.isPercussion) {
              entry.allYPositions.push(centerY);
              if (trackObj?.isPercussion) {
                entry.percYArticulations.push({
                  y: centerY,
                  artic: nb.note.percussionArticulation,
                });
              }
            }

            entry.widths.push(nb.noteHeadBounds.w);
            entry.heights.push(nb.noteHeadBounds.h);
          }
        }
      }
    }
  }

  // ── Grid generation phase ─────────────────────────────────────────
  for (const [key, entry] of collected) {
    const track = score.tracks[entry.trackIndex];
    if (!track) continue;
    const staff = track.staves[entry.staffIndex];
    if (!staff) continue;

    // Need at least some data to build a grid
    if (entry.stringYs.size === 0 && entry.allYPositions.length === 0) continue;

    const medianW = median(entry.widths);
    const medianH = median(entry.heights);
    const positions: SnapPosition[] = [];

    // Percussion notation uses a staff (lines + spaces); treat as standard
    // notation even when showTablature is true (GP drum tab uses fewer "strings").
    if (entry.isTab && !track.isPercussion) {
      // ── Tablature: one position per string ──
      const numStrings = staff.tuning.length || 6;
      if (entry.stringYs.size >= 2) {
        const sorted = [...entry.stringYs.entries()].sort(
          (a, b) => a[0] - b[0],
        );
        const firstS = sorted[0][0];
        const firstY = sorted[0][1];
        const lastS = sorted[sorted.length - 1][0];
        const lastY = sorted[sorted.length - 1][1];
        const spacing = (lastY - firstY) / (lastS - firstS);

        for (let s = 1; s <= numStrings; s++) {
          positions.push({ string: s, y: firstY + (s - firstS) * spacing });
        }
      } else {
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
      // ── Standard notation: 5 lines + 4 spaces = 9 core positions ──
      // Cluster all observed note Y positions to find distinct staff
      // positions, then derive halfSpace (line-to-space distance) from
      // the minimum gap between clusters.
      const distinctYs = clusterYPositions(entry.allYPositions, 1.0);

      // In standard notation a note head's height ≈ 1 staff space
      // (the distance between two adjacent lines) = 2 × halfSpace.
      // This relationship is intrinsic to the music font and doesn't
      // depend on bar padding, making it a robust reference.
      const refHalfSpace = medianH > 0 ? medianH / 2 : 0;

      let halfSpace: number;
      if (distinctYs.length >= 2) {
        // Minimum gap between distinct note positions.  When notes are
        // sparse (e.g. drumkit with notes only on lines, or only on
        // spaces), this gap can be a small integer multiple of the true
        // half-space.  Cross-validate against note-head geometry.
        let minGap = Infinity;
        for (let i = 1; i < distinctYs.length; i++) {
          const gap = distinctYs[i] - distinctYs[i - 1];
          if (gap > 0.5 && gap < minGap) minGap = gap;
        }
        if (!isFinite(minGap)) minGap = medianH * 1.2;

        halfSpace = minGap;
        if (refHalfSpace > 0) {
          const ratio = minGap / refHalfSpace;
          if (ratio > 1.4) {
            const n = Math.round(ratio);
            if (n >= 2 && Math.abs(ratio - n) < 0.5) {
              // Min gap is ~Nx the true half-space; divide down.
              halfSpace = minGap / n;
            } else {
              // Can't align cleanly; trust note-head geometry.
              halfSpace = refHalfSpace;
            }
          }
        }
      } else {
        // Only one (or zero) distinct positions; use note-head geometry
        // or bar-geometry as last resort.
        halfSpace = refHalfSpace > 0
          ? refHalfSpace
          : (entry.barRealBounds?.h ?? medianH * 10) / 12;
      }

      // Anchor at the median of observed Y values, or bar center
      const anchorY =
        distinctYs.length > 0
          ? distinctYs[Math.floor(distinctYs.length / 2)]
          : entry.barRealBounds
            ? entry.barRealBounds.y + entry.barRealBounds.h / 2
            : 0;

      if (track.isPercussion) {
        // ── Percussion: label positions with alphaTab staffLine values ──
        // Derive the anchor's staffLine from any observed (Y, articulation) pair.
        let anchorStaffLine = 3; // default: snare line
        const artics = track.percussionArticulations;
        for (const pa of entry.percYArticulations) {
          const gp7Id =
            artics?.length > 0 && pa.artic >= 0 && pa.artic < artics.length
              ? artics[pa.artic].id
              : pa.artic;
          const sl = GP7_ARTICULATION_MAP.get(gp7Id);
          if (sl !== undefined) {
            const stepsFromAnchor = Math.round((pa.y - anchorY) / halfSpace);
            anchorStaffLine = sl - stepsFromAnchor;
            break;
          }
        }
        for (let i = -10; i <= 10; i++) {
          positions.push({ string: anchorStaffLine + i, y: anchorY + i * halfSpace });
        }
      } else {
        // ── Standard notation: 21 positions (1–21) centered on index 11 ──
        for (let i = -10; i <= 10; i++) {
          positions.push({ string: i + 11, y: anchorY + i * halfSpace });
        }
      }
    }

    // Sort by Y ascending
    positions.sort((a, b) => a.y - b.y);

    // For percussion tracks: build a staffLine → articulation map directly
    // from observed notes (no Y-based clustering needed since each
    // articulation has a known staffLine from GP7_ARTICULATION_MAP).
    let percussionMap: Map<number, number> | undefined;
    if (track.isPercussion && entry.percYArticulations.length > 0) {
      percussionMap = new Map();
      const artics = track.percussionArticulations;
      for (const pa of entry.percYArticulations) {
        const gp7Id =
          artics?.length > 0 && pa.artic >= 0 && pa.artic < artics.length
            ? artics[pa.artic].id
            : pa.artic;
        const sl = GP7_ARTICULATION_MAP.get(gp7Id);
        if (sl !== undefined && !percussionMap.has(sl)) {
          percussionMap.set(sl, pa.artic);
        }
      }
    }

    snapGrids.set(key, {
      positions,
      noteWidth: medianW,
      noteHeight: medianH,
      percussionMap,
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

  if (!beatBounds || !grid) {
    cursorElement.style.display = "none";
    return;
  }

  const w = grid.noteWidth;
  const h = grid.noteHeight;
  const x = beatBounds.onNotesX - w / 2;
  // Use snap Y when available; otherwise fall back to the vertical centre
  // of the beat's visual bounds (e.g. for rest beats with no snap position).
  const y = snap
    ? snap.y - h / 2
    : beatBounds.visualBounds.y + beatBounds.visualBounds.h / 2 - h / 2;

  cursorElement.style.display = "";
  cursorElement.style.left = `${x}px`;
  cursorElement.style.top = `${y}px`;
  cursorElement.style.width = `${w}px`;
  cursorElement.style.height = `${h}px`;
}

/**
 * Position AlphaTab's built-in `.at-cursor-bar` and `.at-cursor-beat`
 * elements at the correct bar.
 *
 * AlphaTab's internal cursor positioning uses tick-based masterbar lookup,
 * which breaks for overfull bars (beats beyond the bar's duration get
 * ticks in the next bar's range).  Since we handle clicks ourselves
 * (stopping propagation before AlphaTab sees them), AlphaTab's cursor
 * is never updated from clicks.  We set it manually here using the
 * actual bar bounds from boundsLookup.
 */
function fixAlphaTabCursors(
  trackIndex: number,
  staffIndex: number,
  barIndex: number,
  beatBounds: alphaTab.rendering.BeatBounds | null,
): void {
  if (!mainElement) return;
  const lookup = api?.boundsLookup;
  if (!lookup) return;

  // Find the MasterBarBounds that contains this bar
  for (const system of lookup.staffSystems) {
    for (const masterBarBounds of system.bars) {
      // Check if any BarBounds in this MasterBarBounds matches our bar
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

      // Override .at-cursor-bar to cover this masterbar's full visual area.
      // AlphaTab uses a 100×100 base div with scale transform.
      const cursorBar = mainElement.querySelector(
        ".at-cursor-bar",
      ) as HTMLElement | null;
      if (cursorBar) {
        const vb = masterBarBounds.visualBounds;
        cursorBar.style.transform =
          `translate(${vb.x}px, ${vb.y}px) scale(${vb.w / 100}, ${vb.h / 100})`;
      }

      // Override .at-cursor-beat to point at the selected beat's X
      const cursorBeat = mainElement.querySelector(
        ".at-cursor-beat",
      ) as HTMLElement | null;
      if (cursorBeat && beatBounds) {
        const vb = masterBarBounds.visualBounds;
        cursorBeat.style.transform =
          `translate(${beatBounds.onNotesX}px, ${vb.y}px) scale(0.01, ${vb.h / 100}) translateX(-50%)`;
      }

      return;
    }
  }
}

/**
 * Render (or remove) snap-grid debug overlay markers + right-edge ID labels.
 * Each grid position gets a thin horizontal line so developers can verify
 * that the snap grid aligns with actual staff lines and spaces.
 */
function updateSnapGridOverlay(show: boolean): void {
  // Remove existing marker container
  if (snapGridOverlayContainer) {
    snapGridOverlayContainer.remove();
    snapGridOverlayContainer = null;
  }
  // Remove existing label container + scroll handler
  if (snapGridScrollHandler && viewportElement) {
    viewportElement.removeEventListener("scroll", snapGridScrollHandler);
    snapGridScrollHandler = null;
  }
  if (snapGridLabelContainer) {
    snapGridLabelContainer.remove();
    snapGridLabelContainer = null;
  }
  snapGridEntries = [];

  if (!show || !mainElement) return;

  const cursorsWrapper = mainElement.querySelector(".at-cursors");
  if (!cursorsWrapper) return;

  snapGridOverlayContainer = document.createElement("div");
  snapGridOverlayContainer.classList.add("at-snap-grid-overlay");

  const mainWidth = mainElement.scrollWidth;
  const wrapper = viewportElement?.parentElement;

  if (wrapper && viewportElement) {
    snapGridLabelContainer = document.createElement("div");
    snapGridLabelContainer.classList.add("at-snap-grid-labels");
  }

  for (const [gridKey, grid] of snapGrids) {
    // Extract trackIndex and staffIndex from grid key (format: "trackIndex:staffIndex")
    const [trackIndex, staffIndex] = gridKey.split(":").map(Number);
    
    for (let i = 0; i < grid.positions.length; i++) {
      const pos = grid.positions[i];
      const isLine = i % 2 === 0;

      // Marker
      const marker = document.createElement("div");
      marker.classList.add("at-snap-grid-marker");
      marker.classList.add(
        isLine ? "at-snap-grid-marker--line" : "at-snap-grid-marker--space",
      );
      marker.style.top = `${pos.y}px`;
      marker.style.width = `${mainWidth}px`;
      snapGridOverlayContainer.appendChild(marker);

      // Label
      const label = document.createElement("div");
      label.classList.add("at-snap-grid-label");
      label.classList.add(
        isLine ? "at-snap-grid-label--line" : "at-snap-grid-label--space",
      );
      label.textContent = String(pos.string);
      snapGridLabelContainer?.appendChild(label);

      snapGridEntries.push({ marker, label, string: pos.string, y: pos.y, trackIndex, staffIndex });
    }
  }

  cursorsWrapper.appendChild(snapGridOverlayContainer);

  if (snapGridLabelContainer && wrapper && viewportElement) {
    wrapper.appendChild(snapGridLabelContainer);

    const repositionLabels = () => {
      if (!viewportElement) return;
      const scrollTop = viewportElement.scrollTop;
      const vpHeight = viewportElement.clientHeight;
      for (const entry of snapGridEntries) {
        const top = entry.y - scrollTop;
        entry.label.style.top = `${top}px`;
        entry.label.style.display =
          top < -12 || top > vpHeight + 12 ? "none" : "";
      }
    };

    snapGridScrollHandler = repositionLabels;
    viewportElement.addEventListener("scroll", repositionLabels, { passive: true });
    repositionLabels();
  }

  // Apply initial selection dimming
  const state = usePlayerStore.getState();
  const selectedBeat = state.selectedBeat;
  updateSnapGridSelection(
    state.selectedString,
    selectedBeat?.trackIndex ?? null,
    selectedBeat?.staffIndex ?? null,
  );
}

/**
 * Dim/undim snap-grid markers and labels based on the currently selected
 * string and track/staff.  When a grid position is not the selected one
 * (or not in the selected track/staff), both its marker and label become faint.
 */
function updateSnapGridSelection(selectedString: number | null, trackIndex: number | null = null, staffIndex: number | null = null): void {
  for (const entry of snapGridEntries) {
    const stringMatches = selectedString === null || entry.string === selectedString;
    const trackMatches = trackIndex === null || entry.trackIndex === trackIndex;
    const staffMatches = staffIndex === null || entry.staffIndex === staffIndex;
    const active = stringMatches && trackMatches && staffMatches;
    entry.marker.classList.toggle("at-snap-grid--dim", !active);
    entry.label.classList.toggle("at-snap-grid--dim", !active);
  }
}

// ─── Bar Warning Colors (AlphaTab native styling) ────────────────────────────

const BAR_WARN_INCOMPLETE = alphaTab.model.Color.fromJson("#F59E0B");
const BAR_WARN_OVERFULL = alphaTab.model.Color.fromJson("#EF4444");

/** BarSubElement indices we color when a bar has a duration issue. */
const BAR_STYLE_ELEMENTS: number[] = [
  // Bar lines
  alphaTab.model.BarSubElement.StandardNotationBarLines,
  alphaTab.model.BarSubElement.GuitarTabsBarLines,
  alphaTab.model.BarSubElement.SlashBarLines,
  alphaTab.model.BarSubElement.NumberedBarLines,
  // Staff lines
  alphaTab.model.BarSubElement.StandardNotationStaffLine,
  alphaTab.model.BarSubElement.GuitarTabsStaffLine,
  alphaTab.model.BarSubElement.SlashStaffLine,
  alphaTab.model.BarSubElement.NumberedStaffLine,
  // Bar numbers
  alphaTab.model.BarSubElement.StandardNotationBarNumber,
  alphaTab.model.BarSubElement.GuitarTabsBarNumber,
  alphaTab.model.BarSubElement.SlashBarNumber,
  alphaTab.model.BarSubElement.NumberedBarNumber,
];

/**
 * Apply bar-level warning colors via AlphaTab's native `BarStyle` API.
 * Traverses every bar in the score and sets (or clears) colored staff lines,
 * bar lines and bar numbers for duration-incorrect bars.
 *
 * Must be called **before** `api.render()` / `api.renderTracks()` so the
 * renderer picks up the updated styles.
 */
function applyBarWarningStyles(): void {
  const score = api?.score;
  if (!score) return;

  for (const track of score.tracks) {
    for (const staff of track.staves) {
      for (const bar of staff.bars) {
        // Check every non-empty voice; use the worst status across them.
        // Empty voices (e.g. voice.isEmpty) do not need to fill the bar — AlphaTab
        // ignores them for layout, so we skip them to avoid false "incomplete" warnings.
        let worstStatus: BarDurationStatus = "complete";
        for (let vi = 0; vi < bar.voices.length; vi++) {
          const voice = bar.voices[vi];
          if (voice?.isEmpty) continue;
          const s = getBarDurationStatus(bar, vi);
          if (s === "overfull") {
            worstStatus = "overfull";
            break;
          }
          if (s === "incomplete") worstStatus = "incomplete";
        }

        if (worstStatus === "complete") {
          // Clear any previous warning style
          bar.style = null as unknown as alphaTab.model.BarStyle;
          continue;
        }

        const color =
          worstStatus === "incomplete" ? BAR_WARN_INCOMPLETE : BAR_WARN_OVERFULL;

        const style = new alphaTab.model.BarStyle();
        for (const elem of BAR_STYLE_ELEMENTS) {
          style.colors.set(elem, color);
        }
        bar.style = style;
      }
    }
  }
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
    percussionGp7Id: perc ? resolveGp7Id(note) : -1,
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
    deadSlapped: (beat as unknown as Record<string, boolean>).deadSlapped ?? false,
    isLegatoOrigin: (beat as unknown as Record<string, boolean>).isLegatoOrigin ?? false,
    notes: beat.notes.map(extractNoteInfo),
  };
}

/** Extract track-level info from an AlphaTab Track model object. */
function extractTrackInfo(track: alphaTab.model.Track): SelectedTrackInfo {
  const pi = track.playbackInfo;
  return {
    index: track.index,
    name: track.name,
    shortName: track.shortName,
    isPercussion: track.isPercussion,
    staffCount: track.staves.length,
    playbackChannel: pi.primaryChannel,
    playbackProgram: pi.program,
    playbackPort: pi.port,
  };
}

/** Extract staff-level info from an AlphaTab Staff model object. */
function extractStaffInfo(staff: alphaTab.model.Staff): SelectedStaffInfo {
  return {
    index: staff.index,
    showTablature: staff.showTablature,
    showStandardNotation: staff.showStandardNotation,
    stringCount: staff.tuning.length,
    capo: staff.capo,
    transpositionPitch: staff.transpositionPitch,
    displayTranspositionPitch: staff.displayTranspositionPitch,
  };
}

/** Extract voice-level info from an AlphaTab Voice model object. */
function extractVoiceInfo(voice: alphaTab.model.Voice): SelectedVoiceInfo {
  return {
    index: voice.index,
    isEmpty: voice.isEmpty,
    beatCount: voice.beats.length,
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

const EDITOR_MODE_STORAGE_KEY = "cotab:editorMode";

function getInitialEditorMode(): "essentials" | "advanced" {
  if (typeof localStorage === "undefined") return "essentials";
  const raw = localStorage.getItem(EDITOR_MODE_STORAGE_KEY);
  if (raw === "essentials" || raw === "advanced") return raw;
  return "essentials";
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
  selectedTrackInfo: null,
  selectedStaffInfo: null,
  selectedBarInfo: null,
  selectedVoiceInfo: null,
  selectedBeatInfo: null,
  selectedNoteIndex: -1,
  selectedString: null,
  zoom: 1,
  editorMode: getInitialEditorMode(),
  showSnapGrid: false,

  setEditorMode: (mode) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(EDITOR_MODE_STORAGE_KEY, mode);
    }
    set({ editorMode: mode });
  },

  // ── Score Metadata Editing ───────────────────────────────────────────────

  setScoreMetadata: (field, value) => {
    const score = api?.score;
    if (!score) return;
    // alphaTab Score properties are typed individually; use bracket access via unknown
    (score as unknown as Record<string, unknown>)[field] = value;
    const stateKey = SCORE_FIELD_TO_STATE[field];
    set({ [stateKey]: value } as Partial<PlayerState>);
    api!.render();
  },

  setScoreTempo: (tempo) => {
    const score = api?.score;
    if (!score || tempo <= 0) return;
    // tempo getter is read-only on Score; update via the first masterBar header
    (score as unknown as Record<string, unknown>).tempo = tempo;
    set({ scoreTempo: tempo });
    api!.render();
  },

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

    // ── Click-to-select via mousedown + boundsLookup ────────────────
    // We handle beat selection entirely in our own mousedown handler
    // (capture phase) and stop propagation so AlphaTab's internal click
    // handling never fires.  This prevents AlphaTab's tick-based cursor
    // from jumping to the wrong bar in overfull bars.
    const onMouseDown = (e: MouseEvent) => {
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
      updateSnapGridOverlay(get().showSnapGrid);

      set({
        isLoading: false,
        visibleTrackIndices,
        trackBounds: newTrackBounds,
      });

      // 6. Apply pending selection (from rest insertion) with fresh bounds,
      //    or re-position the existing cursor if no pending change.
      if (pendingSelection) {
        const ps = pendingSelection;
        pendingSelection = null;
        get().setSelection(ps);
      } else {
        const sel = get().selectedBeat;
        if (sel && cursorElement) {
          const freshBB = findBeatBounds(
            sel.trackIndex,
            sel.staffIndex,
            sel.barIndex,
            sel.beatIndex,
          );
          const gridKey = `${sel.trackIndex}:${sel.staffIndex}`;
          const freshGrid = snapGrids.get(gridKey) ?? null;
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

      // Apply bar-warning colors before the initial render
      applyBarWarningStyles();

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

    // Load the demo file
    api.load("/demos/Taijin_kyofusho.gp");
  },

  destroy: () => {
    // Remove cursor element
    if (cursorElement) {
      cursorElement.remove();
      cursorElement = null;
    }
    // Remove snap grid overlay + labels
    if (snapGridOverlayContainer) {
      snapGridOverlayContainer.remove();
      snapGridOverlayContainer = null;
    }
    if (snapGridScrollHandler && viewportElement) {
      viewportElement.removeEventListener("scroll", snapGridScrollHandler);
      snapGridScrollHandler = null;
    }
    if (snapGridLabelContainer) {
      snapGridLabelContainer.remove();
      snapGridLabelContainer = null;
    }
    snapGridEntries = [];
    pendingSelection = null;
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

  setShowSnapGrid: (show) => {
    set({ showSnapGrid: show });
    updateSnapGridOverlay(show);
  },

  // ── Rest Insertion ──────────────────────────────────────────────────────

  appendRestBefore: (duration) => {
    const sel = get().selectedBeat;
    if (!sel || !api) return;
    const beat = resolveBeat(
      sel.trackIndex,
      sel.barIndex,
      sel.beatIndex,
      sel.staffIndex,
      sel.voiceIndex,
    );
    if (!beat) return;
    const voice = beat.voice;

    const restBeat = new alphaTab.model.Beat();
    restBeat.isEmpty = false;
    restBeat.duration = duration ?? beat.duration;
    restBeat.notes = [];

    // Insert before the current beat by splicing into voice.beats
    const idx = voice.beats.indexOf(beat);
    if (idx >= 0) {
      voice.beats.splice(idx, 0, restBeat);
      // Re-parent: set voice reference
      restBeat.voice = voice;
    } else {
      voice.addBeat(restBeat);
    }
    voice.finish(api.settings);
    applyBarWarningStyles();

    // Defer selection to postRenderFinished so the cursor uses fresh bounds
    pendingSelection = {
      trackIndex: sel.trackIndex,
      barIndex: sel.barIndex,
      beatIndex: idx >= 0 ? idx : sel.beatIndex,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      string: sel.string,
    };
    api.render();
  },

  appendRestAfter: (duration) => {
    const sel = get().selectedBeat;
    if (!sel || !api) return;
    const beat = resolveBeat(
      sel.trackIndex,
      sel.barIndex,
      sel.beatIndex,
      sel.staffIndex,
      sel.voiceIndex,
    );
    if (!beat) return;
    const voice = beat.voice;

    const restBeat = new alphaTab.model.Beat();
    restBeat.isEmpty = false;
    restBeat.duration = duration ?? beat.duration;
    restBeat.notes = [];

    // Insert after the current beat
    const idx = voice.beats.indexOf(beat);
    if (idx >= 0 && idx < voice.beats.length - 1) {
      voice.beats.splice(idx + 1, 0, restBeat);
      restBeat.voice = voice;
    } else {
      voice.addBeat(restBeat);
    }
    voice.finish(api.settings);
    applyBarWarningStyles();

    // Defer selection to postRenderFinished so the cursor uses fresh bounds
    pendingSelection = {
      trackIndex: sel.trackIndex,
      barIndex: sel.barIndex,
      beatIndex: idx >= 0 ? idx + 1 : voice.beats.length - 1,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      string: sel.string,
    };
    api.render();
  },

  // ── Beat Manipulation ──────────────────────────────────────────────────

  toggleBeatIsEmpty: () => {
    try {
      const sel = get().selectedBeat;
      if (!sel || !api) return;

      const beat = resolveBeat(
        sel.trackIndex,
        sel.barIndex,
        sel.beatIndex,
        sel.staffIndex,
        sel.voiceIndex,
      );
      if (!beat) return;

      beat.isEmpty = !beat.isEmpty;
      beat.voice.finish(api.settings);
      applyBarWarningStyles();

      pendingSelection = {
        trackIndex: sel.trackIndex,
        barIndex: sel.barIndex,
        beatIndex: sel.beatIndex,
        staffIndex: sel.staffIndex,
        voiceIndex: sel.voiceIndex,
        string: sel.string,
      };
      api.render();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      debugLog("error", "toggleBeatIsEmpty", "failed", {
        error: err.message,
        stack: err.stack,
      });
    }
  },

  updateBeat: (updates) => {
    const sel = get().selectedBeat;
    if (!sel || !api) return;
    const beat = resolveBeat(
      sel.trackIndex,
      sel.barIndex,
      sel.beatIndex,
      sel.staffIndex,
      sel.voiceIndex,
    );
    if (!beat) return;
    const b = beat as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(updates)) {
      b[key] = value;
    }
    beat.voice.finish(api.settings);
    applyBarWarningStyles();
    pendingSelection = {
      trackIndex: sel.trackIndex,
      barIndex: sel.barIndex,
      beatIndex: sel.beatIndex,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      string: sel.string,
    };
    api.render();
  },

  updateNote: (updates) => {
    const sel = get().selectedBeat;
    const noteIndex = get().selectedNoteIndex;
    if (!sel || !api || noteIndex < 0) return;
    const beat = resolveBeat(
      sel.trackIndex,
      sel.barIndex,
      sel.beatIndex,
      sel.staffIndex,
      sel.voiceIndex,
    );
    if (!beat || noteIndex >= beat.notes.length) return;
    const note = beat.notes[noteIndex] as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(updates)) {
      note[key] = value;
    }
    beat.voice.finish(api.settings);
    applyBarWarningStyles();
    pendingSelection = {
      trackIndex: sel.trackIndex,
      barIndex: sel.barIndex,
      beatIndex: sel.beatIndex,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      string: sel.string,
    };
    api.render();
  },

  // ── Percussion Articulation Toggle ───────────────────────────────────

  togglePercussionArticulation: (gp7Id: number) => {
    const sel = get().selectedBeat;
    if (!sel || !api) return;

    const score = api.score;
    if (!score) return;

    const beat = resolveBeat(
      sel.trackIndex,
      sel.barIndex,
      sel.beatIndex,
      sel.staffIndex,
      sel.voiceIndex,
    );
    if (!beat) return;

    const track = score.tracks[sel.trackIndex];
    if (!track?.isPercussion) return;

    let existingExact: alphaTab.model.Note | null = null;

    for (const n of beat.notes) {
      const nGp7 = resolveGp7Id(n);
      if (nGp7 === gp7Id) {
        existingExact = n;
        break;
      }
    }

    if (existingExact) {
      // Toggle off — remove the note
      const idx = beat.notes.indexOf(existingExact);
      if (idx >= 0) beat.notes.splice(idx, 1);
    } else {
      // Toggle on — add new note
      const note = new alphaTab.model.Note();
      note.percussionArticulation =
        gp7IdToPercussionArticulation(track, gp7Id);
      beat.addNote(note);
      beat.isEmpty = false;
    }

    beat.voice.finish(api.settings);
    applyBarWarningStyles();

    pendingSelection = {
      trackIndex: sel.trackIndex,
      barIndex: sel.barIndex,
      beatIndex: sel.beatIndex,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      string: sel.string,
    };
    api.render();
  },

  // ── Note Deletion ─────────────────────────────────────────────────────

  deleteNote: () => {
    try {
      const sel = get().selectedBeat;
      if (!sel || !api) return false;

      const beat = resolveBeat(
        sel.trackIndex,
        sel.barIndex,
        sel.beatIndex,
        sel.staffIndex,
        sel.voiceIndex,
      );
      if (!beat) return false;

      const voice = beat.voice;
      const noteIdx = get().selectedNoteIndex;

      // ── Case 3: Beat is a rest — remove the beat ────────────────────────
      if (beat.notes.length === 0 || beat.isRest) {
        if (voice.beats.length <= 1) {
          // Last rest in bar — block deletion
          return false;
        }

        const beatIdx = voice.beats.indexOf(beat);
        if (beatIdx < 0) return false;

        voice.beats.splice(beatIdx, 1);
        voice.finish(api.settings);
        applyBarWarningStyles();

        const newBeatIdx = Math.min(beatIdx, voice.beats.length - 1);
        pendingSelection = {
          trackIndex: sel.trackIndex,
          barIndex: sel.barIndex,
          beatIndex: newBeatIdx,
          staffIndex: sel.staffIndex,
          voiceIndex: sel.voiceIndex,
          string: sel.string,
        };

        api.render();
        return true;
      }

      // ── Cases 1 & 2: Beat has notes ─────────────────────────────────────
      if (noteIdx < 0 || noteIdx >= beat.notes.length) return false;

    if (beat.notes.length > 1) {
      // Case 1: Multiple notes on beat — remove only the selected one
      beat.notes.splice(noteIdx, 1);
      for (let i = 0; i < beat.notes.length; i++) {
        beat.notes[i].index = i;
      }
      voice.finish(api.settings);
      applyBarWarningStyles();

      const newNoteIdx = Math.min(noteIdx, beat.notes.length - 1);
      pendingSelection = {
        trackIndex: sel.trackIndex,
        barIndex: sel.barIndex,
        beatIndex: sel.beatIndex,
        staffIndex: sel.staffIndex,
        voiceIndex: sel.voiceIndex,
        string: beat.notes[newNoteIdx]?.string ?? sel.string,
      };
    } else {
      // Case 2: Only note on beat — remove it so the beat becomes a rest
      beat.notes = [];
      voice.finish(api.settings);
      applyBarWarningStyles();

      pendingSelection = {
        trackIndex: sel.trackIndex,
        barIndex: sel.barIndex,
        beatIndex: sel.beatIndex,
        staffIndex: sel.staffIndex,
        voiceIndex: sel.voiceIndex,
        string: sel.string,
      };
    }

    api.render();
    return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      debugLog("error", "deleteNote", "failed", {
        error: err.message,
        stack: err.stack,
      });
      return false;
    }
  },

  // ── Note Placement ────────────────────────────────────────────────────

  placeNote: () => {
    try {
      const sel = get().selectedBeat;
      if (!sel || !api || sel.string === null) return;

      const score = api.score;
      if (!score) return;

      const beat = resolveBeat(
        sel.trackIndex,
        sel.barIndex,
        sel.beatIndex,
        sel.staffIndex,
        sel.voiceIndex,
      );
      if (!beat) return;

      const track = score.tracks[sel.trackIndex];
      if (!track) return;
      const staff = track.staves[sel.staffIndex];
      if (!staff) return;

    const note = new alphaTab.model.Note();

    if (track.isPercussion) {
      // sel.string IS the staffLine — look up articulation directly
      const gridKey = `${sel.trackIndex}:${sel.staffIndex}`;
      const grid = snapGrids.get(gridKey);
      const observedArtic = grid?.percussionMap?.get(sel.string);
      if (observedArtic !== undefined) {
        note.percussionArticulation = observedArtic;
      } else {
        const defaultGp7Id = DRUM_STAFFLINE_DEFAULTS[sel.string];
        if (defaultGp7Id !== undefined) {
          note.percussionArticulation =
            gp7IdToPercussionArticulation(track, defaultGp7Id);
        } else {
          const idsAtLine = GP7_STAFF_LINE_MAP.get(sel.string);
          const fallbackId = idsAtLine?.[0] ?? 42;
          note.percussionArticulation =
            gp7IdToPercussionArticulation(track, fallbackId);
        }
      }
    } else if (staff.showTablature && staff.tuning.length > 0) {
      note.fret = 1;
      note.string = sel.string!;
    } else {
      const pitch = snapPositionToPitch(beat.voice.bar.clef, sel.string!);
      note.octave = pitch.octave;
      note.tone = pitch.tone;
    }

    beat.addNote(note);
    beat.isEmpty = false;
    beat.duration = alphaTab.model.Duration.Quarter as number as alphaTab.model.Duration;

    beat.voice.finish(api.settings);
    applyBarWarningStyles();

    pendingSelection = {
      trackIndex: sel.trackIndex,
      barIndex: sel.barIndex,
      beatIndex: sel.beatIndex,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      string: sel.string,
    };
    api.render();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      debugLog("error", "placeNote", "failed", {
        error: err.message,
        stack: err.stack,
      });
    }
  },

  // ── Bar Manipulation ──────────────────────────────────────────────────

  insertBarBefore: () => {
    try {
      const sel = get().selectedBeat;
      if (!sel || !api) {
        debugLog("warn", "insertBarBefore", "no selection or API");
        return;
      }
      const score = api.score;
      if (!score) {
        debugLog("warn", "insertBarBefore", "no score");
        return;
      }

      debugLog("info", "insertBarBefore", "start", {
        barIndex: sel.barIndex,
        trackCount: score.tracks.length,
        masterBarCount: score.masterBars.length,
      });

      insertBarAtIndex(score, sel.barIndex);

      pendingSelection = {
        trackIndex: sel.trackIndex,
        barIndex: sel.barIndex + 1,
        beatIndex: sel.beatIndex,
        staffIndex: sel.staffIndex,
        voiceIndex: sel.voiceIndex,
        string: sel.string,
      };

      debugLog("info", "insertBarBefore", "complete", {
        newBarCount: score.masterBars.length,
        newSelectionBarIndex: sel.barIndex + 1,
      });

      api.render();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      debugLog("error", "insertBarBefore", "failed", {
        error: err.message,
        stack: err.stack,
      });
      // Re-throw to maintain existing behavior
      throw err;
    }
  },

  insertBarAfter: () => {
    try {
      const sel = get().selectedBeat;
      if (!sel || !api) {
        debugLog("warn", "insertBarAfter", "no selection or API");
        return;
      }
      const score = api.score;
      if (!score) {
        debugLog("warn", "insertBarAfter", "no score");
        return;
      }

      debugLog("info", "insertBarAfter", "start", {
        barIndex: sel.barIndex,
        insertIndex: sel.barIndex + 1,
        trackCount: score.tracks.length,
        masterBarCount: score.masterBars.length,
      });

      insertBarAtIndex(score, sel.barIndex + 1);

      pendingSelection = {
        trackIndex: sel.trackIndex,
        barIndex: sel.barIndex,
        beatIndex: sel.beatIndex,
        staffIndex: sel.staffIndex,
        voiceIndex: sel.voiceIndex,
        string: sel.string,
      };

      debugLog("info", "insertBarAfter", "complete", {
        newBarCount: score.masterBars.length,
        selectionBarIndex: sel.barIndex,
      });

      api.render();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      debugLog("error", "insertBarAfter", "failed", {
        error: err.message,
        stack: err.stack,
      });
      // Re-throw to maintain existing behavior
      throw err;
    }
  },

  deleteBar: () => {
    try {
      const sel = get().selectedBeat;
      if (!sel || !api) {
        debugLog("warn", "deleteBar", "no selection or API");
        return false;
      }
      const score = api.score;
      if (!score) {
        debugLog("warn", "deleteBar", "no score");
        return false;
      }

      debugLog("info", "deleteBar", "start", {
        barIndex: sel.barIndex,
        masterBarCount: score.masterBars.length,
      });

      if (score.masterBars.length <= 1) {
        debugLog("warn", "deleteBar", "blocked — only bar remaining");
        return false;
      }

      const isEmpty = isBarEmptyAllTracks(sel.barIndex);
      debugLog("debug", "deleteBar", "bar empty check", {
        barIndex: sel.barIndex,
        isEmpty,
      });

      if (!isEmpty) {
        debugLog("warn", "deleteBar", "blocked — bar not empty");
        return false;
      }

      debugLog("debug", "deleteBar", "splicing masterBars and staff bars");
      score.masterBars.splice(sel.barIndex, 1);
      for (const track of score.tracks) {
        for (const staff of track.staves) {
          staff.bars.splice(sel.barIndex, 1);
        }
      }

      // Re-index all masterBars and rebuild linked lists
      for (let i = 0; i < score.masterBars.length; i++) {
        const masterBar = score.masterBars[i];
        masterBar.index = i;
        masterBar.previousMasterBar = i > 0 ? score.masterBars[i - 1] : null;
        masterBar.nextMasterBar = i < score.masterBars.length - 1 ? score.masterBars[i + 1] : null;
      }
      debugLog("debug", "deleteBar", "masterBar indices and links updated");

      // Re-index all bars in all staves and rebuild linked lists
      for (const track of score.tracks) {
        for (const staff of track.staves) {
          for (let i = 0; i < staff.bars.length; i++) {
            const bar = staff.bars[i];
            bar.staff = staff;
            bar.index = i;
            bar.previousBar = i > 0 ? staff.bars[i - 1] : null;
            bar.nextBar = i < staff.bars.length - 1 ? staff.bars[i + 1] : null;
          }
        }
      }
      debugLog("debug", "deleteBar", "bar indices and links updated");

      debugLog("debug", "deleteBar", "calling score.finish()");
      score.finish(api.settings);
      debugLog("debug", "deleteBar", "score.finish() completed");

      debugLog("debug", "deleteBar", "calling applyBarWarningStyles()");
      applyBarWarningStyles();

      const newBarIndex = Math.min(sel.barIndex, score.masterBars.length - 1);
      pendingSelection = {
        trackIndex: sel.trackIndex,
        barIndex: newBarIndex,
        beatIndex: 0,
        staffIndex: sel.staffIndex,
        voiceIndex: sel.voiceIndex,
        string: sel.string,
      };

      debugLog("info", "deleteBar", "complete", {
        newBarCount: score.masterBars.length,
        newSelectionBarIndex: newBarIndex,
      });

      api.render();
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      debugLog("error", "deleteBar", "failed", {
        error: err.message,
        stack: err.stack,
      });
      return false;
    }
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
      const grid = snapGrids.get(gridKey) ?? null;
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
      if (!cursorElement && mainElement) {
        const cursorsWrapper = mainElement.querySelector(".at-cursors");
        if (cursorsWrapper) {
          cursorElement = document.createElement("div");
          cursorElement.classList.add("at-edit-cursor");
          cursorsWrapper.appendChild(cursorElement);
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
        updateSnapGridSelection(selectedStr, trackIndex, staffIndex);
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
      updateSnapGridSelection(null, null, null);
    }
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
  // Expose snap grids for e2e testing
  Object.defineProperty(window, "__SNAP_GRIDS__", {
    get: () => Object.fromEntries(snapGrids),
    configurable: true,
  });
}
