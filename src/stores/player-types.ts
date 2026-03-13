/**
 * Types and small constants for the AlphaTab player store.
 * No runtime dependencies on api or store — pure type/data.
 */

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

// ─── Pending selection ───────────────────────────────────────────────────────

export interface PendingSelection {
  trackIndex: number;
  barIndex: number;
  beatIndex: number;
  staffIndex: number;
  voiceIndex: number;
  string: number | null;
}

// ─── Snap grid ───────────────────────────────────────────────────────────────

/** A single selectable position within a track's staff. */
export interface SnapPosition {
  string: number;
  y: number;
}

export interface SnapGrid {
  positions: SnapPosition[];
  noteWidth: number;
  noteHeight: number;
  percussionMap?: Map<number, number>;
}

export interface PercArticulationDef {
  id: number;
  elementType: string;
  staffLine: number;
  technique: string;
}

export interface PercSnapGroup {
  staffLine: number;
  entries: PercArticulationDef[];
}

// ─── Track / preset ─────────────────────────────────────────────────────────

export interface TrackInfo {
  index: number;
  name: string;
  volume: number;
  isMuted: boolean;
  isSolo: boolean;
  isPercussion: boolean;
}

export interface TrackPreset {
  id: string;
  nameKey: string;
  defaultName: string;
  program: number;
  channel: number;
  clef: number;
  isPercussion: boolean;
  stringCount: number;
}

export const TRACK_PRESETS: readonly TrackPreset[] = [
  { id: "acousticGuitar", nameKey: "sidebar.selector.presets.acousticGuitar", defaultName: "Acoustic Guitar", program: 25, channel: 0, clef: 4, isPercussion: false, stringCount: 6 },
  { id: "electricGuitarClean", nameKey: "sidebar.selector.presets.electricGuitarClean", defaultName: "Electric Guitar (Clean)", program: 27, channel: 0, clef: 4, isPercussion: false, stringCount: 6 },
  { id: "electricGuitarDistortion", nameKey: "sidebar.selector.presets.electricGuitarDistortion", defaultName: "Electric Guitar (Distortion)", program: 30, channel: 0, clef: 4, isPercussion: false, stringCount: 6 },
  { id: "bassGuitar", nameKey: "sidebar.selector.presets.bassGuitar", defaultName: "Bass Guitar", program: 33, channel: 0, clef: 3, isPercussion: false, stringCount: 4 },
  { id: "violin", nameKey: "sidebar.selector.presets.violin", defaultName: "Violin", program: 40, channel: 0, clef: 4, isPercussion: false, stringCount: 4 },
  { id: "acousticPiano", nameKey: "sidebar.selector.presets.acousticPiano", defaultName: "Acoustic Piano", program: 0, channel: 0, clef: 4, isPercussion: false, stringCount: 0 },
  { id: "drumkit", nameKey: "sidebar.selector.presets.drumkit", defaultName: "Drums", program: 0, channel: 9, clef: 0, isPercussion: true, stringCount: 0 },
] as const;

export interface SelectedBeat {
  trackIndex: number;
  staffIndex: number;
  voiceIndex: number;
  barIndex: number;
  beatIndex: number;
  string: number | null;
}

export interface TrackBounds {
  y: number;
  height: number;
}

// ─── Selected element info ──────────────────────────────────────────────────

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
  color: { r: number; g: number; b: number; a: number };
}

export interface SelectedStaffInfo {
  index: number;
  showTablature: boolean;
  showStandardNotation: boolean;
  stringCount: number;
  capo: number;
  transpositionPitch: number;
  displayTranspositionPitch: number;
  tuningName: string;
  tuningValues: number[];
}

export interface TuningPresetInfo {
  name: string;
  isStandard: boolean;
  tunings: number[];
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

export type DrumCategoryId = "cymbals" | "snare" | "toms" | "kick";

// ─── Player state ───────────────────────────────────────────────────────────

export interface PlayerState {
  isLoading: boolean;
  isPlayerReady: boolean;
  soundFontProgress: number;
  playerState: "stopped" | "playing" | "paused";
  currentTime: number;
  endTime: number;
  playbackSpeed: number;
  isLooping: boolean;
  masterVolume: number;
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
  tracks: TrackInfo[];
  visibleTrackIndices: number[];
  trackBounds: TrackBounds[];
  selectedBeat: SelectedBeat | null;
  selectedTrackInfo: SelectedTrackInfo | null;
  selectedStaffInfo: SelectedStaffInfo | null;
  selectedBarInfo: SelectedBarInfo | null;
  selectedVoiceInfo: SelectedVoiceInfo | null;
  selectedBeatInfo: SelectedBeatInfo | null;
  selectedNoteIndex: number;
  selectedString: number | null;
  zoom: number;
  sidebarVisible: boolean;
  editorMode: "essentials" | "advanced";
  drumIconStyle: "notation" | "instrument";
  showSnapGrid: boolean;
  addTrackDialogOpen: boolean;
  setDrumIconStyle: (style: "notation" | "instrument") => void;
  initialize: (mainEl: HTMLElement, viewportEl: HTMLElement) => void;
  destroy: () => void;
  loadFile: (data: File | ArrayBuffer | Uint8Array) => void;
  loadUrl: (url: string) => void;
  setPlaybackSpeed: (speed: number) => void;
  setMasterVolume: (volume: number) => void;
  toggleLoop: () => void;
  setTrackVolume: (trackIndex: number, volume: number) => void;
  setTrackMute: (trackIndex: number, muted: boolean) => void;
  setTrackSolo: (trackIndex: number, solo: boolean) => void;
  setTrackColor: (trackIndex: number, r: number, g: number, b: number) => void;
  setTrackProgram: (trackIndex: number, program: number) => void;
  getTuningPresets: (stringCount: number) => TuningPresetInfo[];
  formatTuningNote: (midiValue: number) => string;
  setZoom: (zoom: number) => void;
  setShowSnapGrid: (show: boolean) => void;
  setSelection: (args: {
    trackIndex: number;
    barIndex: number;
    beatIndex: number;
    staffIndex?: number;
    voiceIndex?: number;
    noteIndex?: number;
    string?: number | null;
  }) => void;
  clearSelection: () => void;
}

export const SCORE_FIELD_TO_STATE: Record<ScoreMetadataField, keyof PlayerState> = {
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

/** Quarter-note tick constant (AlphaTab uses 960 ticks per quarter). */
export const QUARTER_TICKS = 960;
