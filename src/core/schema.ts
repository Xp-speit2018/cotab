/**
 * schema.ts — Normalized CRDT schema for the shared tab document.
 *
 * Every entity is a nested Y.Type with a permanent `uuid`.
 * Plain-object "snapshot" interfaces are defined for UI consumption.
 * Factory functions create properly initialized Y.Map instances.
 *
 * Hierarchy mirrors AlphaTab's data model:
 *   Score → MasterBar[]  (shared bar metadata)
 *        → Track[] → Staff[] → Bar[] → Voice[] → Beat[] → Note[]
 *
 * Enums and property names mirror AlphaTab's model (alphaTab.model.*)
 * so that converting between CRDT state and AlphaTab rendering is direct.
 */

import * as Y from "yjs";
import { v4 as uuidv4 } from "uuid";

const DOCUMENT_METADATA_MAP = "cotabDocument";
const DOCUMENT_ID_KEY = "id";

export function ensureDocumentId(doc: Y.Doc): string {
  const metadata = doc.getMap(DOCUMENT_METADATA_MAP);
  const existing = metadata.get(DOCUMENT_ID_KEY);
  if (typeof existing === "string" && existing.length > 0) return existing;

  const documentId = uuidv4();
  metadata.set(DOCUMENT_ID_KEY, documentId);
  return documentId;
}

export function resetDocumentId(doc: Y.Doc): string {
  const documentId = uuidv4();
  doc.getMap(DOCUMENT_METADATA_MAP).set(DOCUMENT_ID_KEY, documentId);
  return documentId;
}

export function readDocumentId(doc: Y.Doc): string | null {
  const value = doc.getMap(DOCUMENT_METADATA_MAP).get(DOCUMENT_ID_KEY);
  return typeof value === "string" && value.length > 0 ? value : null;
}

// ─── Enums (mirror AlphaTab's model enums) ───────────────────────────────────

export const enum AccentuationType {
  None = 0,
  Normal = 1,
  Heavy = 2,
  Tenuto = 3,
}

export const enum BendType {
  None = 0,
  Custom = 1,
  Bend = 2,
  Release = 3,
  BendRelease = 4,
  Hold = 5,
  Prebend = 6,
  PrebendBend = 7,
  PrebendRelease = 8,
}

export const enum BendStyle {
  Default = 0,
  Gradual = 1,
  Fast = 2,
}

export const enum VibratoType {
  None = 0,
  Slight = 1,
  Wide = 2,
}

export const enum SlideInType {
  None = 0,
  IntoFromBelow = 1,
  IntoFromAbove = 2,
}

export const enum SlideOutType {
  None = 0,
  Shift = 1,
  Legato = 2,
  OutUp = 3,
  OutDown = 4,
  PickSlideDown = 5,
  PickSlideUp = 6,
}

export const enum HarmonicType {
  None = 0,
  Natural = 1,
  Artificial = 2,
  Pinch = 3,
  Tap = 4,
  Semi = 5,
  Feedback = 6,
}

export const enum Fingers {
  Unknown = -2,
  NoOrDead = -1,
  Thumb = 0,
  IndexFinger = 1,
  MiddleFinger = 2,
  AnnularFinger = 3,
  LittleFinger = 4,
}

export const enum NoteAccidentalMode {
  Default = 0,
  ForceNone = 1,
  ForceNatural = 2,
  ForceSharp = 3,
  ForceDoubleSharp = 4,
  ForceFlat = 5,
  ForceDoubleFlat = 6,
}

export const enum NoteOrnament {
  None = 0,
  InvertedTurn = 1,
  Turn = 2,
  UpperMordent = 3,
  LowerMordent = 4,
}

export const enum Duration {
  QuadrupleWhole = -4,
  DoubleWhole = -2,
  Whole = 1,
  Half = 2,
  Quarter = 4,
  Eighth = 8,
  Sixteenth = 16,
  ThirtySecond = 32,
  SixtyFourth = 64,
  OneHundredTwentyEighth = 128,
  TwoHundredFiftySixth = 256,
}

export const enum GraceType {
  None = 0,
  OnBeat = 1,
  BeforeBeat = 2,
  BendGrace = 3,
}

export const enum PickStroke {
  None = 0,
  Up = 1,
  Down = 2,
}

export const enum BrushType {
  None = 0,
  BrushUp = 1,
  BrushDown = 2,
  ArpeggioUp = 3,
  ArpeggioDown = 4,
}

export const enum DynamicValue {
  PPP = 0,
  PP = 1,
  P = 2,
  MP = 3,
  MF = 4,
  F = 5,
  FF = 6,
  FFF = 7,
}

export const enum CrescendoType {
  None = 0,
  Crescendo = 1,
  Decrescendo = 2,
}

export const enum FadeType {
  None = 0,
  FadeIn = 1,
  FadeOut = 2,
  VolumeSwell = 3,
}

export const enum WhammyType {
  None = 0,
  Custom = 1,
  Dive = 2,
  Dip = 3,
  Hold = 4,
  Predive = 5,
  PrediveDive = 6,
}

export const enum GolpeType {
  None = 0,
  Thumb = 1,
  Finger = 2,
}

export const enum WahPedal {
  None = 0,
  Open = 1,
  Closed = 2,
}

export const enum FermataType {
  Short = 0,
  Medium = 1,
  Long = 2,
}

export const enum Ottavia {
  _15ma = 0,
  _8va = 1,
  Regular = 2,
  _8vb = 3,
  _15mb = 4,
}

export const enum TripletFeel {
  NoTripletFeel = 0,
  Triplet16th = 1,
  Triplet8th = 2,
  Dotted16th = 3,
  Dotted8th = 4,
  Scottish16th = 5,
  Scottish8th = 6,
}

export const enum KeySignatureType {
  Major = 0,
  Minor = 1,
}

export const enum Clef {
  Neutral = 0,
  C3 = 1,
  C4 = 2,
  F4 = 3,
  G2 = 4,
}

export const enum AutomationType {
  Tempo = 0,
  Volume = 1,
  Instrument = 2,
  Balance = 3,
  SyncPoint = 4,
  Bank = 4,
}

export const enum SimileMark {
  None = 0,
  Simple = 1,
  FirstOfDouble = 2,
  SecondOfDouble = 3,
}

export const enum Rasgueado {
  None = 0,
  Ii = 1,
  Mi = 2,
  MiiTriplet = 3,
  MiiAnapaest = 4,
  PmpTriplet = 5,
  PmpAnapaest = 6,
  PeiTriplet = 7,
  PeiAnapaest = 8,
  PaiTriplet = 9,
  PaiAnapaest = 10,
  AmiTriplet = 11,
  AmiAnapaest = 12,
  Ppp = 13,
  Amii = 14,
  Amip = 15,
  Eami = 16,
  Eamii = 17,
  Peami = 18,
}

export const enum TremoloPickingStyle {
  Default = 0,
  BuzzRoll = 1,
}

// ─── Sub-schemas ─────────────────────────────────────────────────────────────

export interface BendPointSchema {
  offset: number;
  value: number;
}

export interface FermataSchema {
  type: FermataType;
  length: number;
}

export interface SectionSchema {
  text: string;
  marker: string;
}

export interface AutomationSchema {
  isLinear: boolean;
  type: AutomationType;
  value: number;
  ratioPosition: number;
  text: string;
  isVisible: boolean;
}

export interface ChordSchema {
  name: string;
  firstFret: number;
  strings: number[];
  barreFrets: number[];
  showName: boolean;
  showDiagram: boolean;
  showFingering: boolean;
}

export interface ColorSchema {
  raw: number;
}

export interface InstrumentArticulationSchema {
  id: number;
  elementType: string;
  staffLine: number;
  noteHeadDefault: number;
  noteHeadHalf: number;
  noteHeadWhole: number;
  techniqueSymbol: number;
  techniqueSymbolPlacement: number;
  outputMidiNumber: number;
}

export interface LyricsSchema {
  startBar: number;
  text: string;
  chunks: string[];
}

export interface PlaybackInformationSchema {
  volume: number;
  balance: number;
  port: number;
  program: number;
  bank: number;
  primaryChannel: number;
  secondaryChannel: number;
  isMute: boolean;
  isSolo: boolean;
}

export interface TremoloPickingEffectSchema {
  marks: number;
  style: TremoloPickingStyle;
}

export interface TuningSchema {
  isStandard: boolean;
  name: string;
  tunings: number[];
}

// ─── Snapshot Interfaces (plain objects for UI / Zustand) ────────────────────

export interface NoteSchema {
  uuid: string;
  fret: number;
  /** AlphaTab string number: 1 is the lowest-pitch, bottom tablature line. */
  string: number;

  // ── Notation (non-tab) ───────────────────────────────────────────────────
  octave: number;
  tone: number;

  // ── Percussion ───────────────────────────────────────────────────────────
  percussionArticulation: number;

  // ── Boolean flags ─────────────────────────────────────────────────────────
  isDead: boolean;
  isGhost: boolean;
  isStaccato: boolean;
  isLetRing: boolean;
  isPalmMute: boolean;
  isTieDestination: boolean;
  isHammerPullOrigin: boolean;
  isLeftHandTapped: boolean;
  isContinuedBend: boolean;

  // ── Enum properties ───────────────────────────────────────────────────────
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

  // ── Trill ─────────────────────────────────────────────────────────────────
  /** -1 means no trill */
  trillValue: number;
  trillSpeed: Duration;

  // ── Misc ──────────────────────────────────────────────────────────────────
  durationPercent: number;
}

export interface BeatSchema {
  uuid: string;
  duration: Duration;
  notes: NoteSchema[];

  // ── State ──────────────────────────────────────────────────────────────────
  isEmpty: boolean;

  // ── Rhythm modifiers ──────────────────────────────────────────────────────
  dots: number;
  tupletNumerator: number;
  tupletDenominator: number;

  // ── Enum properties ───────────────────────────────────────────────────────
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

  // ── Whammy bar ────────────────────────────────────────────────────────────
  whammyStyle: BendStyle;
  isContinuedWhammy: boolean;
  whammyBarType: WhammyType;
  whammyBarPoints: BendPointSchema[] | null;

  automations: AutomationSchema[];
  lyrics: string[] | null;
  tremoloPicking: TremoloPickingEffectSchema | null;
  rasgueado: Rasgueado;

  // ── Text / chord ──────────────────────────────────────────────────────────
  text: string | null;
  chordId: string | null;

  // ── Technique toggles ─────────────────────────────────────────────────────
  tap: boolean;
  slap: boolean;
  pop: boolean;
  slashed: boolean;
  deadSlapped: boolean;
  isLegatoOrigin: boolean;
}

export interface VoiceSchema {
  uuid: string;
  beats: BeatSchema[];
}

export interface BarSchema {
  uuid: string;
  clef: Clef;
  clefOttava: Ottavia;
  voices: VoiceSchema[];
  simileMark: SimileMark;
  keySignature: number;
  keySignatureType: KeySignatureType;
}

export interface MasterBarSchema {
  uuid: string;
  timeSignatureNumerator: number;
  timeSignatureDenominator: number;
  isRepeatStart: boolean;
  repeatCount: number;
  alternateEndings: number;
  tripletFeel: TripletFeel;
  isFreeTime: boolean;
  section: SectionSchema | null;
  tempoAutomations: AutomationSchema[];
  fermata: Map<number, FermataSchema> | null;
}

export interface StaffSchema {
  uuid: string;
  bars: BarSchema[];
  chords: Map<string, ChordSchema> | null;
  capo: number;
  transpositionPitch: number;
  displayTranspositionPitch: number;
  showTablature: boolean;
  showStandardNotation: boolean;
  isPercussion: boolean;
  stringTuning: TuningSchema;
}

export interface TrackSchema {
  uuid: string;
  staves: StaffSchema[];
  playbackInfo: PlaybackInformationSchema;
  color: ColorSchema;
  name: string;
  shortName: string;
  percussionArticulations: InstrumentArticulationSchema[];
}

export interface ScoreSchema {
  title: string;
  subTitle: string;
  artist: string;
  album: string;
  words: string;
  music: string;
  copyright: string;
  tab: string;
  instructions: string;
  notices: string;
  /** AlphaTab getter derived from the first master bar's first tempo automation. */
  tempo: number;
  /** AlphaTab getter derived from the first master bar's first tempo automation. */
  tempoLabel: string;
  masterBars: MasterBarSchema[];
  tracks: TrackSchema[];
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
  | "notices";

// ─── Factory Functions (create initialized Y.Map instances) ──────────────────

/** AlphaTab orders tuning from the top tablature line (highest pitch) down. */
const STANDARD_TUNING = [64, 59, 55, 50, 45, 40];

export function createAutomation(
  type: AutomationType = AutomationType.Tempo,
  value: number = 0,
  ratioPosition: number = 0,
): Y.Map<unknown> {
  const automation = new Y.Map<unknown>();
  automation.set("isLinear", false);
  automation.set("type", type);
  automation.set("value", value);
  automation.set("ratioPosition", ratioPosition);
  automation.set("text", "");
  automation.set("isVisible", true);
  return automation;
}

export function createTuning(tunings: readonly number[]): Y.Map<unknown> {
  const tuning = new Y.Map<unknown>();
  tuning.set("isStandard", false);
  tuning.set("name", "");
  const yTunings = new Y.Array<number>();
  yTunings.push([...tunings]);
  tuning.set("tunings", yTunings);
  return tuning;
}

export function createPlaybackInformation(
  program: number = 25,
  primaryChannel: number = 0,
  secondaryChannel: number = 1,
): Y.Map<unknown> {
  const playbackInfo = new Y.Map<unknown>();
  playbackInfo.set("volume", 15);
  playbackInfo.set("balance", 8);
  playbackInfo.set("port", 1);
  playbackInfo.set("program", program);
  playbackInfo.set("bank", 0);
  playbackInfo.set("primaryChannel", primaryChannel);
  playbackInfo.set("secondaryChannel", secondaryChannel);
  playbackInfo.set("isMute", false);
  playbackInfo.set("isSolo", false);
  return playbackInfo;
}

function createColor(r: number, g: number, b: number, a: number): Y.Map<unknown> {
  const color = new Y.Map<unknown>();
  color.set(
    "raw",
    ((a & 0xff) << 24) |
      ((r & 0xff) << 16) |
      ((g & 0xff) << 8) |
      (b & 0xff),
  );
  return color;
}

export function createNote(fret: number, stringNum: number): Y.Map<unknown> {
  const note = new Y.Map<unknown>();
  note.set("uuid", uuidv4());
  note.set("fret", fret);
  note.set("string", stringNum);

  note.set("octave", 0);
  note.set("tone", 0);
  note.set("percussionArticulation", -1);

  note.set("isDead", false);
  note.set("isGhost", false);
  note.set("isStaccato", false);
  note.set("isLetRing", false);
  note.set("isPalmMute", false);
  note.set("isTieDestination", false);
  note.set("isHammerPullOrigin", false);
  note.set("isLeftHandTapped", false);
  note.set("isContinuedBend", false);

  note.set("accentuated", AccentuationType.None);
  note.set("vibrato", VibratoType.None);
  note.set("slideInType", SlideInType.None);
  note.set("slideOutType", SlideOutType.None);
  note.set("harmonicType", HarmonicType.None);
  note.set("harmonicValue", 0);
  note.set("bendType", BendType.None);
  note.set("bendStyle", BendStyle.Default);
  note.set("bendPoints", null);
  note.set("leftHandFinger", Fingers.Unknown);
  note.set("rightHandFinger", Fingers.Unknown);
  note.set("dynamics", DynamicValue.F);
  note.set("ornament", NoteOrnament.None);
  note.set("accidentalMode", NoteAccidentalMode.Default);

  note.set("trillValue", -1);
  note.set("trillSpeed", Duration.Sixteenth);

  note.set("durationPercent", 1);

  return note;
}

export function createBeat(duration: number = 4): Y.Map<unknown> {
  const beat = new Y.Map<unknown>();
  beat.set("uuid", uuidv4());
  beat.set("duration", duration);
  beat.set("notes", new Y.Array<Y.Map<unknown>>());

  beat.set("isEmpty", true);

  beat.set("dots", 0);
  beat.set("tupletNumerator", -1);
  beat.set("tupletDenominator", -1);

  beat.set("graceType", GraceType.None);
  beat.set("pickStroke", PickStroke.None);
  beat.set("brushType", BrushType.None);
  beat.set("brushDuration", 0);
  beat.set("dynamics", DynamicValue.F);
  beat.set("crescendo", CrescendoType.None);
  beat.set("vibrato", VibratoType.None);
  beat.set("fade", FadeType.None);
  beat.set("ottava", Ottavia.Regular);
  beat.set("golpe", GolpeType.None);
  beat.set("wahPedal", WahPedal.None);

  beat.set("whammyStyle", BendStyle.Default);
  beat.set("isContinuedWhammy", false);
  beat.set("whammyBarType", WhammyType.None);
  beat.set("whammyBarPoints", null);

  beat.set("automations", new Y.Array<Y.Map<unknown>>());
  beat.set("lyrics", null);
  beat.set("tremoloPicking", null);
  beat.set("rasgueado", Rasgueado.None);

  beat.set("text", null);
  beat.set("chordId", null);

  beat.set("tap", false);
  beat.set("slap", false);
  beat.set("pop", false);
  beat.set("slashed", false);
  beat.set("deadSlapped", false);
  beat.set("isLegatoOrigin", false);

  return beat;
}

export function createVoice(): Y.Map<unknown> {
  const voice = new Y.Map<unknown>();
  voice.set("uuid", uuidv4());
  voice.set("beats", new Y.Array<Y.Map<unknown>>());
  return voice;
}

export function createBar(clef: number = Clef.G2): Y.Map<unknown> {
  const bar = new Y.Map<unknown>();
  bar.set("uuid", uuidv4());
  bar.set("clef", clef);
  bar.set("clefOttava", Ottavia.Regular);
  bar.set("voices", new Y.Array<Y.Map<unknown>>());
  bar.set("simileMark", SimileMark.None);
  bar.set("keySignature", 0);
  bar.set("keySignatureType", KeySignatureType.Major);
  return bar;
}

export function createMasterBar(
  numerator: number = 4,
  denominator: number = 4,
): Y.Map<unknown> {
  const mb = new Y.Map<unknown>();
  mb.set("uuid", uuidv4());
  mb.set("timeSignatureNumerator", numerator);
  mb.set("timeSignatureDenominator", denominator);
  mb.set("isRepeatStart", false);
  mb.set("repeatCount", 0);
  mb.set("alternateEndings", 0);
  mb.set("tripletFeel", TripletFeel.NoTripletFeel);
  mb.set("isFreeTime", false);
  mb.set("section", null);
  mb.set("tempoAutomations", new Y.Array<Y.Map<unknown>>());
  mb.set("fermata", null);
  return mb;
}

export function createStaff(tuning: number[] = STANDARD_TUNING): Y.Map<unknown> {
  const staff = new Y.Map<unknown>();
  staff.set("uuid", uuidv4());
  staff.set("bars", new Y.Array<Y.Map<unknown>>());
  staff.set("chords", null);
  staff.set("capo", 0);
  staff.set("transpositionPitch", 0);
  staff.set("displayTranspositionPitch", 0);
  staff.set("showTablature", true);
  staff.set("showStandardNotation", true);
  staff.set("isPercussion", false);

  staff.set("stringTuning", createTuning(tuning));
  return staff;
}

export function createTrack(name: string = "Track 1"): Y.Map<unknown> {
  const track = new Y.Map<unknown>();
  track.set("uuid", uuidv4());
  track.set("staves", new Y.Array<Y.Map<unknown>>());
  track.set("playbackInfo", createPlaybackInformation());
  track.set("color", createColor(255, 99, 71, 255));
  track.set("name", name);
  track.set("shortName", "");
  track.set("percussionArticulations", new Y.Array<Y.Map<unknown>>());
  return track;
}

// ─── Initialization ──────────────────────────────────────────────────────────

/**
 * Set up the root Y.Map ('score') with default metadata and empty arrays.
 * Only writes if the map is empty (first peer to initialize).
 */
export function initializeScore(doc: Y.Doc): Y.Map<unknown> {
  ensureDocumentId(doc);
  const score = doc.getMap("score");

  if (!score.has("title")) {
    doc.transact(() => {
      score.set("title", "Untitled");
      score.set("subTitle", "");
      score.set("artist", "");
      score.set("album", "");
      score.set("words", "");
      score.set("music", "");
      score.set("copyright", "");
      score.set("tab", "");
      score.set("instructions", "");
      score.set("notices", "");
      score.set("masterBars", new Y.Array<Y.Map<unknown>>());
      score.set("tracks", new Y.Array<Y.Map<unknown>>());
    });
  }

  return score;
}

// ─── Snapshot Helpers ────────────────────────────────────────────────────────

function snapshotBendPoints(
  yPoints: Y.Array<Y.Map<unknown>> | null | undefined,
): BendPointSchema[] | null {
  if (!yPoints) return null;
  return yPoints.map((p) => ({
    offset: (p.get("offset") as number) ?? 0,
    value: (p.get("value") as number) ?? 0,
  }));
}

function snapshotAutomation(yAutomation: Y.Map<unknown>): AutomationSchema {
  return {
    isLinear: (yAutomation.get("isLinear") as boolean) ?? false,
    type:
      (yAutomation.get("type") as AutomationType) ?? AutomationType.Tempo,
    value: (yAutomation.get("value") as number) ?? 0,
    ratioPosition: (yAutomation.get("ratioPosition") as number) ?? 0,
    text: (yAutomation.get("text") as string) ?? "",
    isVisible: (yAutomation.get("isVisible") as boolean) ?? true,
  };
}

function snapshotAutomations(
  yAutomations: Y.Array<Y.Map<unknown>> | null | undefined,
): AutomationSchema[] {
  return yAutomations?.map(snapshotAutomation) ?? [];
}

function snapshotTuning(
  yTuning: Y.Map<unknown> | null | undefined,
): TuningSchema {
  const yTunings = yTuning?.get("tunings") as Y.Array<number> | undefined;
  return {
    isStandard: (yTuning?.get("isStandard") as boolean) ?? false,
    name: (yTuning?.get("name") as string) ?? "",
    tunings: yTunings?.toArray() ?? [],
  };
}

function snapshotPlaybackInformation(
  yPlaybackInfo: Y.Map<unknown> | null | undefined,
): PlaybackInformationSchema {
  return {
    volume: (yPlaybackInfo?.get("volume") as number) ?? 15,
    balance: (yPlaybackInfo?.get("balance") as number) ?? 8,
    port: (yPlaybackInfo?.get("port") as number) ?? 1,
    program: (yPlaybackInfo?.get("program") as number) ?? 25,
    bank: (yPlaybackInfo?.get("bank") as number) ?? 0,
    primaryChannel:
      (yPlaybackInfo?.get("primaryChannel") as number) ?? 0,
    secondaryChannel:
      (yPlaybackInfo?.get("secondaryChannel") as number) ?? 1,
    isMute: (yPlaybackInfo?.get("isMute") as boolean) ?? false,
    isSolo: (yPlaybackInfo?.get("isSolo") as boolean) ?? false,
  };
}

function snapshotChord(yChord: Y.Map<unknown>): ChordSchema {
  return {
    name: (yChord.get("name") as string) ?? "",
    firstFret: (yChord.get("firstFret") as number) ?? 1,
    strings:
      (yChord.get("strings") as Y.Array<number> | undefined)?.toArray() ?? [],
    barreFrets:
      (yChord.get("barreFrets") as Y.Array<number> | undefined)?.toArray() ??
      [],
    showName: (yChord.get("showName") as boolean) ?? true,
    showDiagram: (yChord.get("showDiagram") as boolean) ?? true,
    showFingering: (yChord.get("showFingering") as boolean) ?? true,
  };
}

function snapshotChords(
  yChords: Y.Map<Y.Map<unknown>> | null | undefined,
): Map<string, ChordSchema> | null {
  if (!yChords) return null;
  return new Map(
    [...yChords.entries()].map(([id, yChord]) => [id, snapshotChord(yChord)]),
  );
}

function snapshotInstrumentArticulation(
  yArticulation: Y.Map<unknown>,
): InstrumentArticulationSchema {
  return {
    id: (yArticulation.get("id") as number) ?? 0,
    elementType: (yArticulation.get("elementType") as string) ?? "",
    staffLine: (yArticulation.get("staffLine") as number) ?? 0,
    noteHeadDefault: (yArticulation.get("noteHeadDefault") as number) ?? 0,
    noteHeadHalf: (yArticulation.get("noteHeadHalf") as number) ?? 0,
    noteHeadWhole: (yArticulation.get("noteHeadWhole") as number) ?? 0,
    techniqueSymbol: (yArticulation.get("techniqueSymbol") as number) ?? 0,
    techniqueSymbolPlacement:
      (yArticulation.get("techniqueSymbolPlacement") as number) ?? 0,
    outputMidiNumber:
      (yArticulation.get("outputMidiNumber") as number) ?? 0,
  };
}

function snapshotSection(
  ySection: Y.Map<unknown> | null | undefined,
): SectionSchema | null {
  if (!ySection) return null;
  return {
    text: (ySection.get("text") as string) ?? "",
    marker: (ySection.get("marker") as string) ?? "",
  };
}

function snapshotFermata(
  yFermata: Y.Map<unknown> | null | undefined,
): FermataSchema | null {
  if (!yFermata) return null;
  return {
    type: (yFermata.get("type") as FermataType) ?? FermataType.Medium,
    length: (yFermata.get("length") as number) ?? 1,
  };
}

export function snapshotNote(yNote: Y.Map<unknown>): NoteSchema {
  return {
    uuid: yNote.get("uuid") as string,
    fret: yNote.get("fret") as number,
    string: yNote.get("string") as number,

    octave: (yNote.get("octave") as number) ?? 0,
    tone: (yNote.get("tone") as number) ?? 0,
    percussionArticulation: (yNote.get("percussionArticulation") as number) ?? -1,

    isDead: (yNote.get("isDead") as boolean) ?? false,
    isGhost: (yNote.get("isGhost") as boolean) ?? false,
    isStaccato: (yNote.get("isStaccato") as boolean) ?? false,
    isLetRing: (yNote.get("isLetRing") as boolean) ?? false,
    isPalmMute: (yNote.get("isPalmMute") as boolean) ?? false,
    isTieDestination: (yNote.get("isTieDestination") as boolean) ?? false,
    isHammerPullOrigin: (yNote.get("isHammerPullOrigin") as boolean) ?? false,
    isLeftHandTapped: (yNote.get("isLeftHandTapped") as boolean) ?? false,
    isContinuedBend: (yNote.get("isContinuedBend") as boolean) ?? false,

    accentuated:
      (yNote.get("accentuated") as AccentuationType) ?? AccentuationType.None,
    vibrato: (yNote.get("vibrato") as VibratoType) ?? VibratoType.None,
    slideInType: (yNote.get("slideInType") as SlideInType) ?? SlideInType.None,
    slideOutType:
      (yNote.get("slideOutType") as SlideOutType) ?? SlideOutType.None,
    harmonicType:
      (yNote.get("harmonicType") as HarmonicType) ?? HarmonicType.None,
    harmonicValue: (yNote.get("harmonicValue") as number) ?? 0,
    bendType: (yNote.get("bendType") as BendType) ?? BendType.None,
    bendStyle: (yNote.get("bendStyle") as BendStyle) ?? BendStyle.Default,
    bendPoints: snapshotBendPoints(
      yNote.get("bendPoints") as
        | Y.Array<Y.Map<unknown>>
        | null
        | undefined,
    ),
    leftHandFinger:
      (yNote.get("leftHandFinger") as Fingers) ?? Fingers.Unknown,
    rightHandFinger:
      (yNote.get("rightHandFinger") as Fingers) ?? Fingers.Unknown,
    dynamics: (yNote.get("dynamics") as DynamicValue) ?? DynamicValue.F,
    ornament: (yNote.get("ornament") as NoteOrnament) ?? NoteOrnament.None,
    accidentalMode:
      (yNote.get("accidentalMode") as NoteAccidentalMode) ??
      NoteAccidentalMode.Default,

    trillValue: (yNote.get("trillValue") as number) ?? -1,
    trillSpeed: (yNote.get("trillSpeed") as Duration) ?? Duration.Sixteenth,

    durationPercent: (yNote.get("durationPercent") as number) ?? 1,
  };
}

export function snapshotBeat(yBeat: Y.Map<unknown>): BeatSchema {
  const notes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
  const yLyrics = yBeat.get("lyrics") as Y.Array<string> | null | undefined;
  const yTremolo = yBeat.get("tremoloPicking") as
    | Y.Map<unknown>
    | null
    | undefined;
  return {
    uuid: yBeat.get("uuid") as string,
    duration: (yBeat.get("duration") as Duration) ?? Duration.Quarter,
    notes: notes.map((n) => snapshotNote(n)),

    isEmpty: (yBeat.get("isEmpty") as boolean) ?? true,

    dots: (yBeat.get("dots") as number) ?? 0,
    tupletNumerator: (yBeat.get("tupletNumerator") as number) ?? -1,
    tupletDenominator: (yBeat.get("tupletDenominator") as number) ?? -1,

    graceType: (yBeat.get("graceType") as GraceType) ?? GraceType.None,
    pickStroke: (yBeat.get("pickStroke") as PickStroke) ?? PickStroke.None,
    brushType: (yBeat.get("brushType") as BrushType) ?? BrushType.None,
    brushDuration: (yBeat.get("brushDuration") as number) ?? 0,
    dynamics: (yBeat.get("dynamics") as DynamicValue) ?? DynamicValue.F,
    crescendo:
      (yBeat.get("crescendo") as CrescendoType) ?? CrescendoType.None,
    vibrato: (yBeat.get("vibrato") as VibratoType) ?? VibratoType.None,
    fade: (yBeat.get("fade") as FadeType) ?? FadeType.None,
    ottava: (yBeat.get("ottava") as Ottavia) ?? Ottavia.Regular,
    golpe: (yBeat.get("golpe") as GolpeType) ?? GolpeType.None,
    wahPedal: (yBeat.get("wahPedal") as WahPedal) ?? WahPedal.None,

    whammyStyle:
      (yBeat.get("whammyStyle") as BendStyle) ?? BendStyle.Default,
    isContinuedWhammy:
      (yBeat.get("isContinuedWhammy") as boolean) ?? false,
    whammyBarType:
      (yBeat.get("whammyBarType") as WhammyType) ?? WhammyType.None,
    whammyBarPoints: snapshotBendPoints(
      yBeat.get("whammyBarPoints") as
        | Y.Array<Y.Map<unknown>>
        | null
        | undefined,
    ),

    automations: snapshotAutomations(
      yBeat.get("automations") as Y.Array<Y.Map<unknown>> | undefined,
    ),
    lyrics: yLyrics?.toArray() ?? null,
    tremoloPicking: yTremolo
      ? {
          marks: (yTremolo.get("marks") as number) ?? 0,
          style:
            (yTremolo.get("style") as TremoloPickingStyle) ??
            TremoloPickingStyle.Default,
        }
      : null,
    rasgueado: (yBeat.get("rasgueado") as Rasgueado) ?? Rasgueado.None,

    text: (yBeat.get("text") as string) ?? null,
    chordId: (yBeat.get("chordId") as string) ?? null,

    tap: (yBeat.get("tap") as boolean) ?? false,
    slap: (yBeat.get("slap") as boolean) ?? false,
    pop: (yBeat.get("pop") as boolean) ?? false,
    slashed: (yBeat.get("slashed") as boolean) ?? false,
    deadSlapped: (yBeat.get("deadSlapped") as boolean) ?? false,
    isLegatoOrigin: (yBeat.get("isLegatoOrigin") as boolean) ?? false,
  };
}

export function snapshotVoice(yVoice: Y.Map<unknown>): VoiceSchema {
  const beats = yVoice.get("beats") as Y.Array<Y.Map<unknown>>;
  return {
    uuid: yVoice.get("uuid") as string,
    beats: beats.map((b) => snapshotBeat(b)),
  };
}

export function snapshotBar(yBar: Y.Map<unknown>): BarSchema {
  const voices = yBar.get("voices") as Y.Array<Y.Map<unknown>>;
  return {
    uuid: yBar.get("uuid") as string,
    clef: (yBar.get("clef") as Clef) ?? Clef.G2,
    clefOttava:
      (yBar.get("clefOttava") as Ottavia) ?? Ottavia.Regular,
    voices: voices.map((v) => snapshotVoice(v)),
    simileMark:
      (yBar.get("simileMark") as SimileMark) ?? SimileMark.None,
    keySignature: (yBar.get("keySignature") as number) ?? 0,
    keySignatureType:
      (yBar.get("keySignatureType") as KeySignatureType) ??
      KeySignatureType.Major,
  };
}

export function snapshotMasterBar(yMb: Y.Map<unknown>): MasterBarSchema {
  const yFermatas = yMb.get("fermata") as
    | Y.Map<Y.Map<unknown>>
    | null
    | undefined;
  const fermata = yFermatas
    ? new Map(
        [...yFermatas.entries()].map(([offset, yFermata]) => [
          Number(offset),
          snapshotFermata(yFermata)!,
        ]),
      )
    : null;
  return {
    uuid: yMb.get("uuid") as string,
    timeSignatureNumerator: (yMb.get("timeSignatureNumerator") as number) ?? 4,
    timeSignatureDenominator:
      (yMb.get("timeSignatureDenominator") as number) ?? 4,
    isRepeatStart: (yMb.get("isRepeatStart") as boolean) ?? false,
    repeatCount: (yMb.get("repeatCount") as number) ?? 0,
    alternateEndings: (yMb.get("alternateEndings") as number) ?? 0,
    tripletFeel:
      (yMb.get("tripletFeel") as TripletFeel) ?? TripletFeel.NoTripletFeel,
    isFreeTime: (yMb.get("isFreeTime") as boolean) ?? false,
    section: snapshotSection(
      yMb.get("section") as Y.Map<unknown> | null | undefined,
    ),
    tempoAutomations: snapshotAutomations(
      yMb.get("tempoAutomations") as Y.Array<Y.Map<unknown>> | undefined,
    ),
    fermata,
  };
}

export function snapshotStaff(yStaff: Y.Map<unknown>): StaffSchema {
  const bars = yStaff.get("bars") as Y.Array<Y.Map<unknown>>;
  return {
    uuid: yStaff.get("uuid") as string,
    bars: bars.map((b) => snapshotBar(b)),
    chords: snapshotChords(
      yStaff.get("chords") as Y.Map<Y.Map<unknown>> | null | undefined,
    ),
    capo: (yStaff.get("capo") as number) ?? 0,
    transpositionPitch: (yStaff.get("transpositionPitch") as number) ?? 0,
    displayTranspositionPitch:
      (yStaff.get("displayTranspositionPitch") as number) ?? 0,
    showTablature: (yStaff.get("showTablature") as boolean) ?? true,
    showStandardNotation:
      (yStaff.get("showStandardNotation") as boolean) ?? true,
    isPercussion: (yStaff.get("isPercussion") as boolean) ?? false,
    stringTuning: snapshotTuning(
      yStaff.get("stringTuning") as Y.Map<unknown> | undefined,
    ),
  };
}

export function snapshotTrack(yTrack: Y.Map<unknown>): TrackSchema {
  const staves = yTrack.get("staves") as Y.Array<Y.Map<unknown>>;
  const yColor = yTrack.get("color") as Y.Map<unknown> | undefined;
  const yArticulations = yTrack.get("percussionArticulations") as
    | Y.Array<Y.Map<unknown>>
    | undefined;
  return {
    uuid: yTrack.get("uuid") as string,
    staves: staves.map((s) => snapshotStaff(s)),
    playbackInfo: snapshotPlaybackInformation(
      yTrack.get("playbackInfo") as Y.Map<unknown> | undefined,
    ),
    color: { raw: (yColor?.get("raw") as number) ?? -40121 },
    name: (yTrack.get("name") as string) ?? "",
    shortName: (yTrack.get("shortName") as string) ?? "",
    percussionArticulations:
      yArticulations?.map(snapshotInstrumentArticulation) ?? [],
  };
}

export function snapshotScore(yScore: Y.Map<unknown>): ScoreSchema {
  const masterBars = yScore.get("masterBars") as Y.Array<Y.Map<unknown>>;
  const tracks = yScore.get("tracks") as Y.Array<Y.Map<unknown>>;
  const firstTempoAutomation = (
    masterBars?.get(0)?.get("tempoAutomations") as
      | Y.Array<Y.Map<unknown>>
      | undefined
  )?.get(0);
  return {
    title: (yScore.get("title") as string) ?? "",
    subTitle: (yScore.get("subTitle") as string) ?? "",
    artist: (yScore.get("artist") as string) ?? "",
    album: (yScore.get("album") as string) ?? "",
    words: (yScore.get("words") as string) ?? "",
    music: (yScore.get("music") as string) ?? "",
    copyright: (yScore.get("copyright") as string) ?? "",
    tab: (yScore.get("tab") as string) ?? "",
    instructions: (yScore.get("instructions") as string) ?? "",
    notices: (yScore.get("notices") as string) ?? "",
    tempo: (firstTempoAutomation?.get("value") as number) ?? 120,
    tempoLabel: (firstTempoAutomation?.get("text") as string) ?? "",
    masterBars: masterBars ? masterBars.map((mb) => snapshotMasterBar(mb)) : [],
    tracks: tracks ? tracks.map((t) => snapshotTrack(t)) : [],
  };
}

// ─── UUID Index Builder ──────────────────────────────────────────────────────

/**
 * Walk the entire Y.Doc score tree and build a Map<uuid, Y.Map> for O(1)
 * lookups. Called once on init and incrementally updated by the store.
 */
export function buildUuidIndex(
  yScore: Y.Map<unknown>,
): Map<string, Y.Map<unknown>> {
  const index = new Map<string, Y.Map<unknown>>();

  const masterBars = yScore.get("masterBars") as
    | Y.Array<Y.Map<unknown>>
    | undefined;
  if (masterBars) {
    for (const yMb of masterBars) {
      index.set(yMb.get("uuid") as string, yMb);
    }
  }

  const tracks = yScore.get("tracks") as Y.Array<Y.Map<unknown>> | undefined;
  if (!tracks) return index;

  for (const yTrack of tracks) {
    index.set(yTrack.get("uuid") as string, yTrack);

    const staves = yTrack.get("staves") as Y.Array<Y.Map<unknown>>;
    for (const yStaff of staves) {
      index.set(yStaff.get("uuid") as string, yStaff);

      const bars = yStaff.get("bars") as Y.Array<Y.Map<unknown>>;
      for (const yBar of bars) {
        index.set(yBar.get("uuid") as string, yBar);

        const voices = yBar.get("voices") as Y.Array<Y.Map<unknown>>;
        for (const yVoice of voices) {
          index.set(yVoice.get("uuid") as string, yVoice);

          const beats = yVoice.get("beats") as Y.Array<Y.Map<unknown>>;
          for (const yBeat of beats) {
            index.set(yBeat.get("uuid") as string, yBeat);

            const notes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
            for (const yNote of notes) {
              index.set(yNote.get("uuid") as string, yNote);
            }
          }
        }
      }
    }
  }

  return index;
}
