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

/** References to DOM elements needed for coordinate conversion. */
let mainElement: HTMLElement | null = null;
let viewportElement: HTMLElement | null = null;

/** Cursor rectangle DOM element, appended to `.at-cursors`. */
let cursorElement: HTMLDivElement | null = null;

/** Container for snap-grid debug overlay markers, appended to `.at-cursors`. */
let snapGridOverlayContainer: HTMLDivElement | null = null;

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
  string: number;
} | null = null;

/** Quarter-note tick constant (AlphaTab uses 960 ticks per quarter). */
const QUARTER_TICKS = 960;

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
  /**
   * For percussion tracks only: maps grid position string → default
   * percussionArticulation value, derived from observed notes in the score.
   */
  percussionMap?: Map<number, number>;
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
  /** The string/line the cursor is on, -1 = none. */
  selectedString: number;

  // View
  zoom: number;

  // Debug
  /** When true, renders horizontal markers at each snap grid position on the score. */
  showSnapGrid: boolean;

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
  setShowSnapGrid: (show: boolean) => void;

  // Rest insertion
  /** Insert a rest beat before the currently selected beat. */
  appendRestBefore: (duration?: alphaTab.model.Duration) => void;
  /** Insert a rest beat after the currently selected beat. */
  appendRestAfter: (duration?: alphaTab.model.Duration) => void;

  // Beat manipulation
  /** Toggle the `isEmpty` flag on the selected beat and re-render. */
  toggleBeatIsEmpty: () => void;

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
    string?: number;
  }) => void;
  /** Clear the current selection. */
  clearSelection: () => void;
}

// ─── GP7 Percussion Articulation IDs ─────────────────────────────────────────
// The human-readable names live in the i18n files under "percussion.gp7.{id}".

const GP7_PERCUSSION_IDS = new Set([
  29, 30, 31, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
  48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65,
  66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83,
  84, 85, 86, 87, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103,
  104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118,
  119, 120, 122, 123, 124, 125, 126, 127,
]);

// ─── GP7 Articulation ↔ StaffLine Bidirectional Map ─────────────────────────
// Single source of truth for vertical position of every GP7 percussion
// articulation, extracted from alphaTab PercussionMapper.instrumentArticulations.
// Format: GP7 articulation ID → staffLine (1 = top line, increasing downward).

export const GP7_ARTICULATION_MAP: ReadonlyMap<number, number> = new Map([
  // Snare area (staffLine 3)
  [38, 3], [37, 3], [91, 3], [54, 3], [39, 3], [40, 3], [31, 3], [33, 3], [34, 3],
  // Hi-Hat / Crash Medium / Cowbell High (staffLine -1)
  [42, -1], [92, -1], [46, -1], [57, -1], [98, -1], [102, -1], [103, -1],
  // Ride / Cowbell Medium (staffLine 0)
  [93, 0], [51, 0], [53, 0], [94, 0], [56, 0], [101, 0],
  // Splash / Crash High (staffLine -2)
  [55, -2], [95, -2], [49, -2], [97, -2],
  // China / Reverse Cymbal (staffLine -3)
  [52, -3], [96, -3], [30, -3],
  // Tom Very High / Cowbell Low / Tambourine roll (staffLine 1)
  [50, 1], [99, 1], [100, 1], [112, 1],
  // Tom High / Tambourine return / Ride Cymbal 2 (staffLine 2)
  [48, 2], [111, 2], [59, 2], [126, 2], [127, 2], [29, 2],
  // Tom Medium (staffLine 4)
  [47, 4],
  // Tom Low / Very Low Floor Tom (staffLine 5)
  [45, 5], [41, 5],
  // Tom Very Low (staffLine 6)
  [43, 6],
  // Kick Drum (staffLine 7)
  [36, 7],
  // Acoustic Kick Drum (staffLine 8)
  [35, 8],
  // Pedal Hi-Hat / Timbale High (staffLine 9)
  [44, 9], [65, 9],
  // Timbale Low (staffLine 10)
  [66, 10],
  // Agogo High (staffLine 11)
  [67, 11],
  // Agogo Low (staffLine 12)
  [68, 12],
  // Conga High slap (staffLine 13)
  [110, 13],
  // Conga High (staffLine 14)
  [63, 14],
  // Conga Low mute (staffLine 15)
  [109, 15],
  // Conga Low slap (staffLine 16)
  [108, 16],
  // Conga Low (staffLine 17)
  [64, 17],
  // Piatti (staffLine 18)
  [115, 18],
  // Conga High mute (staffLine 19)
  [62, 19],
  // Claves (staffLine 20)
  [75, 20],
  // Castanets (staffLine 21)
  [85, 21],
  // Cabasa return (staffLine 22)
  [117, 22],
  // Cabasa (staffLine 23)
  [69, 23],
  // Piatti hand (staffLine 24)
  [116, 24],
  // Grancassa (staffLine 25)
  [114, 25],
  // Triangle mute (staffLine 26)
  [80, 26],
  // Triangle (staffLine 27)
  [81, 27],
  // Vibraslap (staffLine 28)
  [58, 28],
  // Cuica mute (staffLine 29)
  [78, 29],
  // Cuica open (staffLine 30)
  [79, 30],
  // Surdo mute (staffLine 35)
  [87, 35],
  // Surdo (staffLine 36)
  [86, 36],
  // Guiro scrap-return (staffLine 37)
  [74, 37],
  // Guiro (staffLine 38)
  [73, 38],
  // Bongo High (staffLine -4)
  [60, -4],
  // Bongo High mute (staffLine -5)
  [104, -5],
  // Bongo High slap (staffLine -6)
  [105, -6],
  // Bongo Low / Tambourine hand (staffLine -7)
  [61, -7], [113, -7],
  // Bongo Low mute (staffLine -8)
  [106, -8],
  // Woodblock Low (staffLine -9)
  [77, -9],
  // Woodblock High (staffLine -10)
  [76, -10],
  // Whistle Low (staffLine -11)
  [72, -11],
  // Left Maraca (staffLine -12)
  [70, -12],
  // Left Maraca return (staffLine -13)
  [118, -13],
  // Right Maraca (staffLine -14)
  [119, -14],
  // Right Maraca return (staffLine -15)
  [120, -15],
  // Bongo Low slap (staffLine -16)
  [107, -16],
  // Whistle High (staffLine -17)
  [71, -17],
  // Bell Tree (staffLine -18)
  [84, -18],
  // Bell Tree return (staffLine -19)
  [123, -19],
  // Jingle Bell (staffLine -20)
  [83, -20],
  // Golpe thumb (staffLine -21)
  [124, -21],
  // Golpe finger (staffLine -22)
  [125, -22],
  // Shaker (staffLine -23)
  [82, -23],
  // Shaker return (staffLine -24)
  [122, -24],
]);

/** Reverse map: staffLine → GP7 articulation IDs at that position. */
export const GP7_STAFF_LINE_MAP: ReadonlyMap<number, readonly number[]> = (() => {
  const m = new Map<number, number[]>();
  for (const [id, sl] of GP7_ARTICULATION_MAP) {
    const arr = m.get(sl) ?? [];
    arr.push(id);
    m.set(sl, arr);
  }
  return m as ReadonlyMap<number, readonly number[]>;
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
 * Default GP7 percussion articulation for each snap-grid position (1–21).
 * Covers a standard 5-piece kit spread across the staff.
 */
const DRUM_POSITION_DEFAULTS: Record<number, number> = {
  1: 49, 2: 49, 3: 49,   // Crash high
  4: 42, 5: 42,           // Hi-Hat (closed)
  6: 51, 7: 51,           // Ride (middle)
  8: 48, 9: 48,           // High Tom
  10: 38, 11: 38,         // Snare
  12: 47, 13: 47,         // Mid Tom
  14: 45, 15: 45,         // Low Tom
  16: 41, 17: 41,         // Very Low Tom
  18: 36, 19: 36,         // Kick
  20: 44, 21: 44,         // Pedal Hi-Hat
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
  const refBarIndex = Math.min(insertIndex, score.masterBars.length - 1);
  const refMasterBar = score.masterBars[refBarIndex];

  const mb = new alphaTab.model.MasterBar();
  mb.timeSignatureNumerator = refMasterBar.timeSignatureNumerator;
  mb.timeSignatureDenominator = refMasterBar.timeSignatureDenominator;
  mb.timeSignatureCommon = refMasterBar.timeSignatureCommon;

  score.masterBars.splice(insertIndex, 0, mb);

  for (const track of score.tracks) {
    for (const staff of track.staves) {
      const refBar = staff.bars[refBarIndex < insertIndex ? refBarIndex : Math.min(insertIndex, staff.bars.length - 1)];
      const voiceCount = refBar ? refBar.voices.length : 1;

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
    }
  }

  score.finish(api!.settings);
  applyBarWarningStyles();
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
    let halfSpaceForPerc = 0;

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

      // Generate 21 positions:
      //   3 ledger lines above + 5 staff lines + 3 ledger lines below
      //   = 11 lines + 10 spaces = 21 selectable positions (20 gaps)
      // Centered so index 11 = anchorY
      for (let i = -10; i <= 10; i++) {
        positions.push({ string: i + 11, y: anchorY + i * halfSpace });
      }
      halfSpaceForPerc = halfSpace;
    }

    // Sort by Y ascending
    positions.sort((a, b) => a.y - b.y);

    // For percussion tracks: build a position → articulation map from
    // observed notes so placeNote() picks the right drum instrument.
    let percussionMap: Map<number, number> | undefined;
    if (track.isPercussion && entry.percYArticulations.length > 0) {
      percussionMap = new Map();
      // De-duplicate observed articulations by Y: for each distinct Y
      // keep the first-seen articulation (most common in practice).
      const seen = new Map<number, number>(); // clustered Y → artic
      const sortedPerc = [...entry.percYArticulations].sort(
        (a, b) => a.y - b.y,
      );
      for (const pa of sortedPerc) {
        // Cluster to nearest half-space to merge slight Y variations
        const roundedY = halfSpaceForPerc > 0
          ? Math.round(pa.y / halfSpaceForPerc) * halfSpaceForPerc
          : Math.round(pa.y);
        if (!seen.has(roundedY)) {
          seen.set(roundedY, pa.artic);
        }
      }
      // For each grid position, find the nearest observed articulation
      for (const pos of positions) {
        let bestArtic = -1;
        let bestDist = Infinity;
        for (const [rY, artic] of seen) {
          const d = Math.abs(pos.y - rY);
          if (d < bestDist) {
            bestDist = d;
            bestArtic = artic;
          }
        }
        // Only map if the observed note is within 1 halfSpace of the
        // grid position; otherwise there is no known drum there.
        if (bestArtic >= 0 && bestDist <= (halfSpaceForPerc > 0 ? halfSpaceForPerc * 1.1 : Infinity)) {
          percussionMap.set(pos.string, bestArtic);
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
 * Render (or remove) snap-grid debug overlay markers.
 * Each grid position gets a thin horizontal line so developers can verify
 * that the snap grid aligns with actual staff lines and spaces.
 */
function updateSnapGridOverlay(show: boolean): void {
  // Remove existing container
  if (snapGridOverlayContainer) {
    snapGridOverlayContainer.remove();
    snapGridOverlayContainer = null;
  }

  if (!show || !mainElement) return;

  const cursorsWrapper = mainElement.querySelector(".at-cursors");
  if (!cursorsWrapper) return;

  snapGridOverlayContainer = document.createElement("div");
  snapGridOverlayContainer.classList.add("at-snap-grid-overlay");

  // Get the total rendered width so markers span the full score
  const mainWidth = mainElement.scrollWidth;

  for (const [, grid] of snapGrids) {
    for (let i = 0; i < grid.positions.length; i++) {
      const pos = grid.positions[i];
      const marker = document.createElement("div");
      marker.classList.add("at-snap-grid-marker");
      // Alternate line/space: even index → line style, odd → space style
      // (positions are sorted by Y; in a standard staff they alternate)
      if (i % 2 === 0) {
        marker.classList.add("at-snap-grid-marker--line");
      } else {
        marker.classList.add("at-snap-grid-marker--space");
      }
      marker.style.top = `${pos.y}px`;
      marker.style.width = `${mainWidth}px`;
      snapGridOverlayContainer.appendChild(marker);
    }
  }

  cursorsWrapper.appendChild(snapGridOverlayContainer);
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
  selectedString: -1,
  zoom: 1,
  showSnapGrid: false,

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
      let snappedString = -1;

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
            freshGrid && sel.string > 0
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
    // Remove snap grid overlay
    if (snapGridOverlayContainer) {
      snapGridOverlayContainer.remove();
      snapGridOverlayContainer = null;
    }
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

    const targetStaffLine = GP7_ARTICULATION_MAP.get(gp7Id);
    if (targetStaffLine === undefined) return;

    const sameLineIds = GP7_STAFF_LINE_MAP.get(targetStaffLine) ?? [];

    let existingExact: alphaTab.model.Note | null = null;
    let existingSameLine: alphaTab.model.Note | null = null;

    for (const n of beat.notes) {
      const nGp7 = resolveGp7Id(n);
      if (nGp7 === gp7Id) {
        existingExact = n;
        break;
      }
      if (sameLineIds.includes(nGp7)) {
        existingSameLine = n;
      }
    }

    if (existingExact) {
      // Toggle off — remove the note
      const idx = beat.notes.indexOf(existingExact);
      if (idx >= 0) beat.notes.splice(idx, 1);
    } else if (existingSameLine) {
      // Replace — same staffLine, different articulation
      existingSameLine.percussionArticulation =
        gp7IdToPercussionArticulation(track, gp7Id);
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
  },

  // ── Note Placement ────────────────────────────────────────────────────

  placeNote: () => {
    const sel = get().selectedBeat;
    if (!sel || !api || sel.string < 1) return;

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
      const gridKey = `${sel.trackIndex}:${sel.staffIndex}`;
      const grid = snapGrids.get(gridKey);
      const dynamicArtic = grid?.percussionMap?.get(sel.string);
      note.percussionArticulation =
        dynamicArtic ?? DRUM_POSITION_DEFAULTS[sel.string] ?? 42;
    } else if (staff.showTablature && staff.tuning.length > 0) {
      note.fret = 1;
      note.string = sel.string;
    } else {
      const pitch = snapPositionToPitch(beat.voice.bar.clef, sel.string);
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
  },

  // ── Bar Manipulation ──────────────────────────────────────────────────

  insertBarBefore: () => {
    const sel = get().selectedBeat;
    if (!sel || !api) return;
    const score = api.score;
    if (!score) return;

    insertBarAtIndex(score, sel.barIndex);

    pendingSelection = {
      trackIndex: sel.trackIndex,
      barIndex: sel.barIndex + 1,
      beatIndex: sel.beatIndex,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      string: sel.string,
    };
    api.render();
  },

  insertBarAfter: () => {
    const sel = get().selectedBeat;
    if (!sel || !api) return;
    const score = api.score;
    if (!score) return;

    insertBarAtIndex(score, sel.barIndex + 1);

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

  deleteBar: () => {
    const sel = get().selectedBeat;
    if (!sel || !api) return false;
    const score = api.score;
    if (!score) return false;

    if (score.masterBars.length <= 1) return false;
    if (!isBarEmptyAllTracks(sel.barIndex)) return false;

    score.masterBars.splice(sel.barIndex, 1);
    for (const track of score.tracks) {
      for (const staff of track.staves) {
        staff.bars.splice(sel.barIndex, 1);
      }
    }

    score.finish(api.settings);
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
    api.render();
    return true;
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

      const selectedStr = stringArg ?? -1;

      // Look up grid and beat bounds (needed for both cursor and note matching)
      const gridKey = `${trackIndex}:${staffIndex}`;
      const grid = snapGrids.get(gridKey) ?? null;
      const snap =
        grid && selectedStr > 0
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
      } else if (selectedStr > 0 && beat.notes.length > 0) {
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

      set({
        selectedBeat: {
          trackIndex,
          staffIndex,
          voiceIndex,
          barIndex,
          beatIndex,
          string: selectedStr,
        },
        selectedTrackInfo: extractTrackInfo(beat.voice.bar.staff.track),
        selectedStaffInfo: extractStaffInfo(beat.voice.bar.staff),
        selectedBarInfo: extractBarInfo(beat.voice.bar),
        selectedVoiceInfo: extractVoiceInfo(beat.voice),
        selectedBeatInfo: extractBeatInfo(beat),
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
      selectedTrackInfo: null,
      selectedStaffInfo: null,
      selectedBarInfo: null,
      selectedVoiceInfo: null,
      selectedBeatInfo: null,
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
  // Expose snap grids for e2e testing
  Object.defineProperty(window, "__SNAP_GRIDS__", {
    get: () => Object.fromEntries(snapGrids),
    configurable: true,
  });
}
