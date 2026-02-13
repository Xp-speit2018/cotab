/**
 * schema.ts — Normalized CRDT schema for the shared tab document.
 *
 * Every entity is a nested Y.Type with a permanent `uuid`.
 * Plain-object "snapshot" interfaces are defined for UI consumption.
 * Factory functions create properly initialized Y.Map instances.
 *
 * Enums and property names mirror AlphaTab's data model (alphaTab.model.*)
 * so that converting between CRDT state and AlphaTab rendering is direct.
 */

import * as Y from "yjs";
import { v4 as uuidv4 } from "uuid";

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

// ─── Snapshot Interfaces (plain objects for UI / Zustand) ────────────────────

export interface NoteSchema {
  uuid: string;
  fret: number;
  /** 1-indexed guitar string number (1 = highest pitch string) */
  string: number;

  // ── Boolean flags ─────────────────────────────────────────────────────────
  isDead: boolean;
  isGhost: boolean;
  isStaccato: boolean;
  isLetRing: boolean;
  isPalmMute: boolean;
  isTieDestination: boolean;
  isHammerPullOrigin: boolean;
  isLeftHandTapped: boolean;

  // ── Enum properties ───────────────────────────────────────────────────────
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

  // ── Trill ─────────────────────────────────────────────────────────────────
  /** -1 means no trill */
  trillValue: number;
  trillSpeed: Duration;

  // ── Misc ──────────────────────────────────────────────────────────────────
  durationPercent: number;
}

export interface BeatSchema {
  uuid: string;
  /** Duration value: 1 (whole), 2 (half), 4 (quarter), 8 (eighth), 16, 32, 64 */
  duration: Duration;
  notes: NoteSchema[];

  // ── Rhythm modifiers ──────────────────────────────────────────────────────
  dots: number;
  isRest: boolean;
  tupletNumerator: number;
  tupletDenominator: number;

  // ── Enum properties ───────────────────────────────────────────────────────
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

  // ── Whammy bar ────────────────────────────────────────────────────────────
  whammyBarType: WhammyType;
  whammyBarPoints: BendPointSchema[];

  // ── Text / chord ──────────────────────────────────────────────────────────
  text: string | null;
  chordId: string | null;

  // ── Technique toggles ─────────────────────────────────────────────────────
  tap: boolean;
  slap: boolean;
  pop: boolean;
  slashed: boolean;

  // ── Fermata ───────────────────────────────────────────────────────────────
  fermata: FermataSchema | null;
}

export interface MeasureSchema {
  uuid: string;
  timeSignatureNumerator: number;
  timeSignatureDenominator: number;
  beats: BeatSchema[];

  // ── MasterBar-level properties ────────────────────────────────────────────
  keySignature: number;
  keySignatureType: KeySignatureType;
  isRepeatStart: boolean;
  repeatCount: number;
  alternateEndings: number;
  tripletFeel: TripletFeel;
  isFreeTime: boolean;
  isDoubleBar: boolean;
  section: SectionSchema | null;
  /** Tempo override for this bar (null = inherit from previous) */
  tempo: number | null;
}

export interface StaffSchema {
  uuid: string;
  measures: MeasureSchema[];
}

export interface TrackSchema {
  uuid: string;
  name: string;
  instrument: string;
  tuning: number[];
  staves: StaffSchema[];
}

export interface ScoreSchema {
  title: string;
  artist: string;
  tempo: number;
  tracks: TrackSchema[];
}

// ─── Factory Functions (create initialized Y.Map instances) ──────────────────

/** Standard guitar tuning in MIDI note numbers (E2 A2 D3 G3 B3 E4). */
const STANDARD_TUNING = [40, 45, 50, 55, 59, 64];

export function createNote(fret: number, stringNum: number): Y.Map<unknown> {
  const note = new Y.Map<unknown>();
  note.set("uuid", uuidv4());
  note.set("fret", fret);
  note.set("string", stringNum);

  // Boolean flags
  note.set("isDead", false);
  note.set("isGhost", false);
  note.set("isStaccato", false);
  note.set("isLetRing", false);
  note.set("isPalmMute", false);
  note.set("isTieDestination", false);
  note.set("isHammerPullOrigin", false);
  note.set("isLeftHandTapped", false);

  // Enum properties
  note.set("accentuated", AccentuationType.None);
  note.set("vibrato", VibratoType.None);
  note.set("slideInType", SlideInType.None);
  note.set("slideOutType", SlideOutType.None);
  note.set("harmonicType", HarmonicType.None);
  note.set("harmonicValue", 0);
  note.set("bendType", BendType.None);
  note.set("bendStyle", BendStyle.Default);
  note.set("bendPoints", new Y.Array<Y.Map<unknown>>());
  note.set("leftHandFinger", Fingers.Unknown);
  note.set("rightHandFinger", Fingers.Unknown);
  note.set("dynamics", DynamicValue.F);
  note.set("ornament", NoteOrnament.None);
  note.set("accidentalMode", NoteAccidentalMode.Default);

  // Trill
  note.set("trillValue", -1);
  note.set("trillSpeed", Duration.Sixteenth);

  // Misc
  note.set("durationPercent", 1);

  return note;
}

export function createBeat(duration: number = 4): Y.Map<unknown> {
  const beat = new Y.Map<unknown>();
  beat.set("uuid", uuidv4());
  beat.set("duration", duration);
  beat.set("notes", new Y.Array<Y.Map<unknown>>());

  // Rhythm modifiers
  beat.set("dots", 0);
  beat.set("isRest", false);
  beat.set("tupletNumerator", 0);
  beat.set("tupletDenominator", 0);

  // Enum properties
  beat.set("graceType", GraceType.None);
  beat.set("pickStroke", PickStroke.None);
  beat.set("brushType", BrushType.None);
  beat.set("dynamics", DynamicValue.F);
  beat.set("crescendo", CrescendoType.None);
  beat.set("vibrato", VibratoType.None);
  beat.set("fade", FadeType.None);
  beat.set("ottava", Ottavia.Regular);
  beat.set("golpe", GolpeType.None);
  beat.set("wahPedal", WahPedal.None);

  // Whammy bar
  beat.set("whammyBarType", WhammyType.None);
  beat.set("whammyBarPoints", new Y.Array<Y.Map<unknown>>());

  // Text / chord
  beat.set("text", null);
  beat.set("chordId", null);

  // Technique toggles
  beat.set("tap", false);
  beat.set("slap", false);
  beat.set("pop", false);
  beat.set("slashed", false);

  // Fermata
  beat.set("fermata", null);

  return beat;
}

export function createMeasure(
  numerator: number = 4,
  denominator: number = 4,
): Y.Map<unknown> {
  const measure = new Y.Map<unknown>();
  measure.set("uuid", uuidv4());
  measure.set("timeSignatureNumerator", numerator);
  measure.set("timeSignatureDenominator", denominator);
  measure.set("beats", new Y.Array<Y.Map<unknown>>());

  // MasterBar-level properties
  measure.set("keySignature", 0);
  measure.set("keySignatureType", KeySignatureType.Major);
  measure.set("isRepeatStart", false);
  measure.set("repeatCount", 0);
  measure.set("alternateEndings", 0);
  measure.set("tripletFeel", TripletFeel.NoTripletFeel);
  measure.set("isFreeTime", false);
  measure.set("isDoubleBar", false);
  measure.set("section", null);
  measure.set("tempo", null);

  return measure;
}

export function createStaff(): Y.Map<unknown> {
  const staff = new Y.Map<unknown>();
  staff.set("uuid", uuidv4());
  staff.set("measures", new Y.Array<Y.Map<unknown>>());
  return staff;
}

export function createTrack(name: string = "Track 1"): Y.Map<unknown> {
  const track = new Y.Map<unknown>();
  track.set("uuid", uuidv4());
  track.set("name", name);
  track.set("instrument", "acoustic-guitar");

  const tuning = new Y.Array<number>();
  tuning.push(STANDARD_TUNING);
  track.set("tuning", tuning);

  track.set("staves", new Y.Array<Y.Map<unknown>>());
  return track;
}

// ─── Initialization ──────────────────────────────────────────────────────────

/**
 * Set up the root Y.Map ('score') with default metadata and an empty tracks
 * array. Only writes if the map is empty (first peer to initialize).
 */
export function initializeScore(doc: Y.Doc): Y.Map<unknown> {
  const score = doc.getMap("score");

  if (!score.has("title")) {
    doc.transact(() => {
      score.set("title", "Untitled");
      score.set("artist", "");
      score.set("tempo", 120);
      score.set("tracks", new Y.Array<Y.Map<unknown>>());
    });
  }

  return score;
}

// ─── Snapshot Helpers ────────────────────────────────────────────────────────

/** Snapshot a Y.Array of BendPoint Y.Maps into plain objects. */
function snapshotBendPoints(
  yPoints: Y.Array<Y.Map<unknown>> | null | undefined,
): BendPointSchema[] {
  if (!yPoints) return [];
  return yPoints.map((p) => ({
    offset: (p.get("offset") as number) ?? 0,
    value: (p.get("value") as number) ?? 0,
  }));
}

/** Snapshot a section Y.Map or null. */
function snapshotSection(
  ySection: Y.Map<unknown> | null | undefined,
): SectionSchema | null {
  if (!ySection) return null;
  return {
    text: (ySection.get("text") as string) ?? "",
    marker: (ySection.get("marker") as string) ?? "",
  };
}

/** Snapshot a fermata Y.Map or null. */
function snapshotFermata(
  yFermata: Y.Map<unknown> | null | undefined,
): FermataSchema | null {
  if (!yFermata) return null;
  return {
    type: (yFermata.get("type") as FermataType) ?? FermataType.Medium,
    length: (yFermata.get("length") as number) ?? 1,
  };
}

/** Convert a Note Y.Map to a plain NoteSchema object. */
export function snapshotNote(yNote: Y.Map<unknown>): NoteSchema {
  return {
    uuid: yNote.get("uuid") as string,
    fret: yNote.get("fret") as number,
    string: yNote.get("string") as number,

    // Boolean flags
    isDead: (yNote.get("isDead") as boolean) ?? false,
    isGhost: (yNote.get("isGhost") as boolean) ?? false,
    isStaccato: (yNote.get("isStaccato") as boolean) ?? false,
    isLetRing: (yNote.get("isLetRing") as boolean) ?? false,
    isPalmMute: (yNote.get("isPalmMute") as boolean) ?? false,
    isTieDestination: (yNote.get("isTieDestination") as boolean) ?? false,
    isHammerPullOrigin: (yNote.get("isHammerPullOrigin") as boolean) ?? false,
    isLeftHandTapped: (yNote.get("isLeftHandTapped") as boolean) ?? false,

    // Enum properties
    accentuated:
      (yNote.get("accentuated") as AccentuationType) ??
      AccentuationType.None,
    vibrato:
      (yNote.get("vibrato") as VibratoType) ?? VibratoType.None,
    slideInType:
      (yNote.get("slideInType") as SlideInType) ?? SlideInType.None,
    slideOutType:
      (yNote.get("slideOutType") as SlideOutType) ?? SlideOutType.None,
    harmonicType:
      (yNote.get("harmonicType") as HarmonicType) ?? HarmonicType.None,
    harmonicValue: (yNote.get("harmonicValue") as number) ?? 0,
    bendType: (yNote.get("bendType") as BendType) ?? BendType.None,
    bendStyle: (yNote.get("bendStyle") as BendStyle) ?? BendStyle.Default,
    bendPoints: snapshotBendPoints(
      yNote.get("bendPoints") as Y.Array<Y.Map<unknown>> | undefined,
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

    // Trill
    trillValue: (yNote.get("trillValue") as number) ?? -1,
    trillSpeed:
      (yNote.get("trillSpeed") as Duration) ?? Duration.Sixteenth,

    // Misc
    durationPercent: (yNote.get("durationPercent") as number) ?? 1,
  };
}

/** Convert a Beat Y.Map to a plain BeatSchema object. */
export function snapshotBeat(yBeat: Y.Map<unknown>): BeatSchema {
  const notes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
  return {
    uuid: yBeat.get("uuid") as string,
    duration: (yBeat.get("duration") as Duration) ?? Duration.Quarter,
    notes: notes.map((n) => snapshotNote(n)),

    // Rhythm modifiers
    dots: (yBeat.get("dots") as number) ?? 0,
    isRest: (yBeat.get("isRest") as boolean) ?? false,
    tupletNumerator: (yBeat.get("tupletNumerator") as number) ?? 0,
    tupletDenominator: (yBeat.get("tupletDenominator") as number) ?? 0,

    // Enum properties
    graceType: (yBeat.get("graceType") as GraceType) ?? GraceType.None,
    pickStroke: (yBeat.get("pickStroke") as PickStroke) ?? PickStroke.None,
    brushType: (yBeat.get("brushType") as BrushType) ?? BrushType.None,
    dynamics: (yBeat.get("dynamics") as DynamicValue) ?? DynamicValue.F,
    crescendo:
      (yBeat.get("crescendo") as CrescendoType) ?? CrescendoType.None,
    vibrato: (yBeat.get("vibrato") as VibratoType) ?? VibratoType.None,
    fade: (yBeat.get("fade") as FadeType) ?? FadeType.None,
    ottava: (yBeat.get("ottava") as Ottavia) ?? Ottavia.Regular,
    golpe: (yBeat.get("golpe") as GolpeType) ?? GolpeType.None,
    wahPedal: (yBeat.get("wahPedal") as WahPedal) ?? WahPedal.None,

    // Whammy bar
    whammyBarType:
      (yBeat.get("whammyBarType") as WhammyType) ?? WhammyType.None,
    whammyBarPoints: snapshotBendPoints(
      yBeat.get("whammyBarPoints") as Y.Array<Y.Map<unknown>> | undefined,
    ),

    // Text / chord
    text: (yBeat.get("text") as string) ?? null,
    chordId: (yBeat.get("chordId") as string) ?? null,

    // Technique toggles
    tap: (yBeat.get("tap") as boolean) ?? false,
    slap: (yBeat.get("slap") as boolean) ?? false,
    pop: (yBeat.get("pop") as boolean) ?? false,
    slashed: (yBeat.get("slashed") as boolean) ?? false,

    // Fermata
    fermata: snapshotFermata(
      yBeat.get("fermata") as Y.Map<unknown> | null | undefined,
    ),
  };
}

/** Convert a Measure Y.Map to a plain MeasureSchema object. */
export function snapshotMeasure(yMeasure: Y.Map<unknown>): MeasureSchema {
  const beats = yMeasure.get("beats") as Y.Array<Y.Map<unknown>>;
  return {
    uuid: yMeasure.get("uuid") as string,
    timeSignatureNumerator: yMeasure.get("timeSignatureNumerator") as number,
    timeSignatureDenominator: yMeasure.get(
      "timeSignatureDenominator",
    ) as number,
    beats: beats.map((b) => snapshotBeat(b)),

    // MasterBar-level properties
    keySignature: (yMeasure.get("keySignature") as number) ?? 0,
    keySignatureType:
      (yMeasure.get("keySignatureType") as KeySignatureType) ??
      KeySignatureType.Major,
    isRepeatStart: (yMeasure.get("isRepeatStart") as boolean) ?? false,
    repeatCount: (yMeasure.get("repeatCount") as number) ?? 0,
    alternateEndings: (yMeasure.get("alternateEndings") as number) ?? 0,
    tripletFeel:
      (yMeasure.get("tripletFeel") as TripletFeel) ??
      TripletFeel.NoTripletFeel,
    isFreeTime: (yMeasure.get("isFreeTime") as boolean) ?? false,
    isDoubleBar: (yMeasure.get("isDoubleBar") as boolean) ?? false,
    section: snapshotSection(
      yMeasure.get("section") as Y.Map<unknown> | null | undefined,
    ),
    tempo: (yMeasure.get("tempo") as number) ?? null,
  };
}

/** Convert a Staff Y.Map to a plain StaffSchema object. */
export function snapshotStaff(yStaff: Y.Map<unknown>): StaffSchema {
  const measures = yStaff.get("measures") as Y.Array<Y.Map<unknown>>;
  return {
    uuid: yStaff.get("uuid") as string,
    measures: measures.map((m) => snapshotMeasure(m)),
  };
}

/** Convert a Track Y.Map to a plain TrackSchema object. */
export function snapshotTrack(yTrack: Y.Map<unknown>): TrackSchema {
  const staves = yTrack.get("staves") as Y.Array<Y.Map<unknown>>;
  const tuning = yTrack.get("tuning") as Y.Array<number>;
  return {
    uuid: yTrack.get("uuid") as string,
    name: yTrack.get("name") as string,
    instrument: yTrack.get("instrument") as string,
    tuning: tuning.toArray(),
    staves: staves.map((s) => snapshotStaff(s)),
  };
}

/** Snapshot the entire score Y.Map into a plain ScoreSchema object. */
export function snapshotScore(yScore: Y.Map<unknown>): ScoreSchema {
  const tracks = yScore.get("tracks") as Y.Array<Y.Map<unknown>>;
  return {
    title: yScore.get("title") as string,
    artist: yScore.get("artist") as string,
    tempo: yScore.get("tempo") as number,
    tracks: tracks.map((t) => snapshotTrack(t)),
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

  const tracks = yScore.get("tracks") as Y.Array<Y.Map<unknown>> | undefined;
  if (!tracks) return index;

  for (const yTrack of tracks) {
    index.set(yTrack.get("uuid") as string, yTrack);

    const staves = yTrack.get("staves") as Y.Array<Y.Map<unknown>>;
    for (const yStaff of staves) {
      index.set(yStaff.get("uuid") as string, yStaff);

      const measures = yStaff.get("measures") as Y.Array<Y.Map<unknown>>;
      for (const yMeasure of measures) {
        index.set(yMeasure.get("uuid") as string, yMeasure);

        const beats = yMeasure.get("beats") as Y.Array<Y.Map<unknown>>;
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

  return index;
}
