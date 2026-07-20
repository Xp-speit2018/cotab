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
  Clef,
  SimileMark,
  BendPointSchema,
  ChordSchema,
  AutomationSchema,
  TempoAutomationSchema,
  TremoloPickingEffectSchema,
  Rasgueado,
  ScoreMetadataField,
} from "@/core/schema";
export { TRACK_PRESETS } from "@/core/presets";
export type { TrackPreset } from "@/core/presets";
export type { ScoreMetadataField } from "@/core/schema";

export type {
  BeatAddress,
  PendingSelection,
  LoopRange,
  SelectedBeat,
  SelectionRange,
  SelectorState,
  TransportState,
} from "@/core/engine";
import type {
  LoopRange,
  SelectedBeat,
  SelectionRange,
  SelectorState,
  TransportState,
} from "@/core/engine";

// ─── Snap grid ───────────────────────────────────────────────────────────────

/** A single selectable position within a track's staff. */
export interface SnapPosition {
  string: number;
  y: number;
}

export interface SnapGrid {
  systemIndex: number;
  trackIndex: number;
  staffIndex: number;
  barIndexes: number[];
  systemBounds: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  positions: SnapPosition[];
  noteWidth: number;
  noteHeight: number;
  percussionMap?: Map<number, number>;
}

export type ScoreLayout = "horizontal" | "parchment";

export interface SystemLayoutRow {
  index: number;
  startBarIndex: number;
  endBarIndex: number;
  bounds: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
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
  isPercussion: boolean;
}

// ─── Selected element info ──────────────────────────────────────────────────

export interface SelectedNoteInfo {
  index: number;
  fret: number;
  string: number;
  stringCount: number;
  octave: number;
  tone: number;
  isDead: boolean;
  isGhost: boolean;
  isStaccato: boolean;
  isLetRing: boolean;
  isPalmMute: boolean;
  isTieDestination: boolean;
  isHammerPullOrigin: boolean;
  isLeftHandTapped: boolean;
  isContinuedBend: boolean;
  accentuated: AccentuationType;
  vibrato: VibratoType;
  slideInType: SlideInType;
  slideOutType: SlideOutType;
  harmonicType: HarmonicType;
  harmonicValue: number;
  bendType: BendType;
  bendStyle: BendStyle;
  bendPoints: BendPointSchema[] | null;
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
  brushDuration: number;
  dynamics: DynamicValue;
  crescendo: CrescendoType;
  vibrato: VibratoType;
  fade: FadeType;
  ottava: Ottavia;
  golpe: GolpeType;
  wahPedal: WahPedal;
  whammyStyle: BendStyle;
  isContinuedWhammy: boolean;
  whammyBarType: WhammyType;
  whammyBarPoints: BendPointSchema[] | null;
  automations: AutomationSchema[];
  lyrics: string[] | null;
  tremoloPicking: TremoloPickingEffectSchema | null;
  rasgueado: Rasgueado;
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
  clef: Clef;
  clefOttava: Ottavia;
  simileMark: SimileMark;
  keySignature: number;
  keySignatureType: KeySignatureType;
}

export interface SelectedMasterBarInfo {
  index: number;
  timeSignatureNumerator: number;
  timeSignatureDenominator: number;
  isRepeatStart: boolean;
  repeatCount: number;
  alternateEndings: number;
  tripletFeel: TripletFeel;
  isFreeTime: boolean;
  hasSection: boolean;
  sectionText: string;
  sectionMarker: string;
  tempoAutomations: TempoAutomationSchema[];
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
  chords: ChordDefinitionInfo[];
}

export interface ChordDefinitionInfo extends ChordSchema {
  id: string;
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

export type DrumCategoryId = "cymbals" | "snare" | "toms" | "kick";

// ─── Player state ───────────────────────────────────────────────────────────

export type PlaybackState = "stopped" | "playing" | "paused";

export interface BeatPositionArgs {
  trackIndex: number;
  barIndex: number;
  beatIndex: number;
  staffIndex?: number;
  voiceIndex?: number;
  string?: number | null;
}

export type RenderSelectorState = SelectorState;

export interface RenderTransportState extends TransportState {
  playerState: PlaybackState;
  currentTime: number;
  endTime: number;
  tickPosition: number;
}

export interface PlayerState {
  isLoading: boolean;
  isPlayerReady: boolean;
  soundFontProgress: number;
  selector: RenderSelectorState;
  transport: RenderTransportState;
  playerState: PlaybackState;
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
  selectedBeat: SelectedBeat | null;
  selectionRange: SelectionRange | null;
  selectedTrackInfo: SelectedTrackInfo | null;
  selectedStaffInfo: SelectedStaffInfo | null;
  selectedBarInfo: SelectedBarInfo | null;
  selectedMasterBarInfo: SelectedMasterBarInfo | null;
  selectedVoiceInfo: SelectedVoiceInfo | null;
  selectedBeatInfo: SelectedBeatInfo | null;
  selectedNoteIndex: number;
  selectedString: number | null;
  zoom: number;
  scoreLayout: ScoreLayout;
  layoutDesignMode: boolean;
  systemLayoutRows: SystemLayoutRow[];
  sidebarVisible: boolean;
  roomDialogOpen: boolean;
  showSnapGrid: boolean;
  addTrackDialogOpen: boolean;
  initialize: (mainEl: HTMLElement, viewportEl: HTMLElement) => void;
  destroy: () => void;
  loadFile: (data: File | ArrayBuffer | Uint8Array) => void;
  loadUrl: (url: string) => void;
  togglePlayback: () => void;
  stopTransport: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setMasterVolume: (volume: number) => void;
  toggleLoop: () => void;
  setTransportLoopRange: (range: LoopRange | null) => void;
  setTrackColor: (trackIndex: number, r: number, g: number, b: number) => void;
  setTrackProgram: (trackIndex: number, program: number) => void;
  getTuningPresets: (stringCount: number) => TuningPresetInfo[];
  formatTuningNote: (midiValue: number) => string;
  setZoom: (zoom: number) => void;
  setScoreLayout: (layout: ScoreLayout) => void;
  setLayoutDesignMode: (enabled: boolean) => void;
  setShowSnapGrid: (show: boolean) => void;
  setTransportPlayhead: (args: BeatPositionArgs | null) => void;
  setTransportPlayheadToSelection: () => void;
  setSelection: (args: BeatPositionArgs & {
    noteIndex?: number;
    preserveSelectionRange?: boolean;
  }) => void;
  focusSelection: () => void;
  clearSelection: () => void;
  clearSelectionRange: () => void;
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
};

/** Quarter-note tick constant (AlphaTab uses 960 ticks per quarter). */
export const QUARTER_TICKS = 960;
