import type {
  AutomationSchema,
  BarSchema,
  BeatSchema,
  BendPointSchema,
  ChordSchema,
  ColorSchema,
  FermataSchema,
  InstrumentArticulationSchema,
  LyricsSchema,
  MasterBarSchema,
  NoteSchema,
  PlaybackInformationSchema,
  ScoreSchema,
  SectionSchema,
  StaffSchema,
  TrackSchema,
  TremoloPickingEffectSchema,
  TuningSchema,
  VoiceSchema,
} from "@/core/schema";

export type InspectorFieldSurface =
  | "inline"
  | "choice"
  | "popover"
  | "resource"
  | "dialog"
  | "external"
  | "hidden";

export type InspectorFieldStatus =
  | "ready"
  | "partial"
  | "missing"
  | "external"
  | "internal";

export type InspectorEditorId =
  | "accidental"
  | "alternate-endings"
  | "automation"
  | "bend-curve"
  | "boolean"
  | "brush"
  | "chord-library"
  | "chord-picker"
  | "clef"
  | "color"
  | "derived"
  | "duration"
  | "dynamics"
  | "effect-choice"
  | "enum"
  | "fermata"
  | "fingering"
  | "grace"
  | "harmonic"
  | "hidden-structure"
  | "identity"
  | "instrument"
  | "key-signature"
  | "layout"
  | "long-text"
  | "lyrics"
  | "number"
  | "percussion-articulation"
  | "percussion-map"
  | "pitch"
  | "playback"
  | "rasgueado"
  | "section"
  | "short-text"
  | "tempo"
  | "time-signature"
  | "tremolo-picking"
  | "trill"
  | "tuning"
  | "tuplet"
  | "whammy-curve";

export interface InspectorFieldPolicy {
  readonly surface: InspectorFieldSurface;
  readonly editor: InspectorEditorId;
  readonly status: InspectorFieldStatus;
}

function field<
  const Surface extends InspectorFieldSurface,
  const Editor extends InspectorEditorId,
  const Status extends InspectorFieldStatus,
>(
  surface: Surface,
  editor: Editor,
  status: Status,
): InspectorFieldPolicy {
  return { surface, editor, status };
}

const identity = field("hidden", "identity", "internal");
const structure = field("hidden", "hidden-structure", "internal");
const derived = field("hidden", "derived", "internal");
const ownedNumber = field("hidden", "number", "internal");
const ownedText = field("hidden", "short-text", "internal");
const ownedBoolean = field("hidden", "boolean", "internal");
const inlineText = field("inline", "short-text", "ready");
const inlineNumber = field("inline", "number", "ready");
const readyToggle = field("choice", "boolean", "ready");
const readyEnum = field("choice", "enum", "ready");
const layout = field("external", "layout", "external");

export interface InspectorFieldCatalog {
  bendPoint: Record<keyof BendPointSchema, InspectorFieldPolicy>;
  fermata: Record<keyof FermataSchema, InspectorFieldPolicy>;
  section: Record<keyof SectionSchema, InspectorFieldPolicy>;
  automation: Record<keyof AutomationSchema, InspectorFieldPolicy>;
  chord: Record<keyof ChordSchema, InspectorFieldPolicy>;
  color: Record<keyof ColorSchema, InspectorFieldPolicy>;
  instrumentArticulation: Record<keyof InstrumentArticulationSchema, InspectorFieldPolicy>;
  lyrics: Record<keyof LyricsSchema, InspectorFieldPolicy>;
  playbackInformation: Record<keyof PlaybackInformationSchema, InspectorFieldPolicy>;
  tremoloPicking: Record<keyof TremoloPickingEffectSchema, InspectorFieldPolicy>;
  tuning: Record<keyof TuningSchema, InspectorFieldPolicy>;
  note: Record<keyof NoteSchema, InspectorFieldPolicy>;
  beat: Record<keyof BeatSchema, InspectorFieldPolicy>;
  voice: Record<keyof VoiceSchema, InspectorFieldPolicy>;
  bar: Record<keyof BarSchema, InspectorFieldPolicy>;
  masterBar: Record<keyof MasterBarSchema, InspectorFieldPolicy>;
  staff: Record<keyof StaffSchema, InspectorFieldPolicy>;
  track: Record<keyof TrackSchema, InspectorFieldPolicy>;
  score: Record<keyof ScoreSchema, InspectorFieldPolicy>;
}

/**
 * Exhaustive UX policy for every retained document field. Complex child fields
 * are hidden because their parent editor owns them as one atomic value.
 */
export const INSPECTOR_FIELD_CATALOG = {
  bendPoint: {
    offset: ownedNumber,
    value: ownedNumber,
  },
  fermata: {
    type: field("hidden", "fermata", "internal"),
    length: field("hidden", "fermata", "internal"),
  },
  section: {
    text: ownedText,
    marker: ownedText,
  },
  automation: {
    isLinear: ownedBoolean,
    type: field("hidden", "automation", "internal"),
    value: field("hidden", "automation", "internal"),
    ratioPosition: field("hidden", "automation", "internal"),
    text: field("hidden", "automation", "internal"),
    isVisible: field("hidden", "automation", "internal"),
  },
  chord: {
    name: field("hidden", "chord-library", "internal"),
    firstFret: field("hidden", "chord-library", "internal"),
    strings: field("hidden", "chord-library", "internal"),
    barreFrets: field("hidden", "chord-library", "internal"),
    showName: field("hidden", "chord-library", "internal"),
    showDiagram: field("hidden", "chord-library", "internal"),
    showFingering: field("hidden", "chord-library", "internal"),
  },
  color: {
    raw: field("hidden", "color", "internal"),
  },
  instrumentArticulation: {
    id: field("hidden", "percussion-map", "internal"),
    elementType: field("hidden", "percussion-map", "internal"),
    staffLine: field("hidden", "percussion-map", "internal"),
    noteHeadDefault: field("hidden", "percussion-map", "internal"),
    noteHeadHalf: field("hidden", "percussion-map", "internal"),
    noteHeadWhole: field("hidden", "percussion-map", "internal"),
    techniqueSymbol: field("hidden", "percussion-map", "internal"),
    techniqueSymbolPlacement: field("hidden", "percussion-map", "internal"),
    outputMidiNumber: field("hidden", "percussion-map", "internal"),
  },
  lyrics: {
    startBar: field("hidden", "lyrics", "internal"),
    text: field("hidden", "lyrics", "internal"),
    chunks: field("hidden", "lyrics", "internal"),
  },
  playbackInformation: {
    volume: field("external", "playback", "external"),
    balance: field("external", "playback", "external"),
    port: field("hidden", "playback", "internal"),
    program: field("hidden", "instrument", "internal"),
    bank: field("hidden", "instrument", "internal"),
    primaryChannel: field("hidden", "playback", "internal"),
    secondaryChannel: field("hidden", "playback", "internal"),
    isMute: field("external", "playback", "external"),
    isSolo: field("external", "playback", "external"),
  },
  tremoloPicking: {
    marks: field("hidden", "tremolo-picking", "internal"),
    style: field("hidden", "tremolo-picking", "internal"),
  },
  tuning: {
    isStandard: field("hidden", "tuning", "internal"),
    name: field("hidden", "tuning", "internal"),
    tunings: field("hidden", "tuning", "internal"),
  },
  note: {
    uuid: identity,
    fret: inlineNumber,
    string: inlineNumber,
    octave: field("popover", "pitch", "ready"),
    tone: field("popover", "pitch", "ready"),
    percussionArticulation: field("resource", "percussion-articulation", "ready"),
    isDead: readyToggle,
    isGhost: readyToggle,
    isStaccato: readyToggle,
    isLetRing: readyToggle,
    isPalmMute: readyToggle,
    isTieDestination: readyToggle,
    isHammerPullOrigin: readyToggle,
    isLeftHandTapped: readyToggle,
    isContinuedBend: field("popover", "bend-curve", "ready"),
    accentuated: readyEnum,
    vibrato: readyEnum,
    slideInType: field("choice", "effect-choice", "ready"),
    slideOutType: field("choice", "effect-choice", "ready"),
    harmonicType: field("popover", "harmonic", "ready"),
    harmonicValue: field("popover", "harmonic", "ready"),
    bendType: field("popover", "bend-curve", "ready"),
    bendStyle: field("popover", "bend-curve", "ready"),
    bendPoints: field("popover", "bend-curve", "ready"),
    leftHandFinger: field("choice", "fingering", "ready"),
    rightHandFinger: field("choice", "fingering", "ready"),
    dynamics: field("choice", "dynamics", "ready"),
    ornament: field("choice", "effect-choice", "ready"),
    accidentalMode: field("choice", "accidental", "ready"),
    trillValue: field("popover", "trill", "ready"),
    trillSpeed: field("popover", "trill", "ready"),
    durationPercent: field("popover", "duration", "missing"),
  },
  beat: {
    uuid: identity,
    duration: field("choice", "duration", "ready"),
    notes: structure,
    isEmpty: derived,
    dots: readyEnum,
    tupletNumerator: field("popover", "tuplet", "ready"),
    tupletDenominator: field("popover", "tuplet", "ready"),
    graceType: field("popover", "grace", "ready"),
    pickStroke: readyEnum,
    brushType: field("popover", "brush", "ready"),
    brushDuration: field("popover", "brush", "ready"),
    dynamics: field("choice", "dynamics", "ready"),
    crescendo: readyEnum,
    vibrato: field("choice", "effect-choice", "ready"),
    fade: readyEnum,
    ottava: readyEnum,
    golpe: readyEnum,
    wahPedal: readyEnum,
    whammyStyle: field("popover", "whammy-curve", "ready"),
    isContinuedWhammy: field("popover", "whammy-curve", "ready"),
    whammyBarType: field("popover", "whammy-curve", "ready"),
    whammyBarPoints: field("popover", "whammy-curve", "ready"),
    automations: field("dialog", "automation", "missing"),
    lyrics: field("dialog", "lyrics", "ready"),
    tremoloPicking: field("popover", "tremolo-picking", "ready"),
    rasgueado: field("popover", "rasgueado", "ready"),
    text: inlineText,
    chordId: field("resource", "chord-picker", "ready"),
    tap: readyToggle,
    slap: readyToggle,
    pop: readyToggle,
    slashed: readyToggle,
    deadSlapped: readyToggle,
    isLegatoOrigin: readyToggle,
  },
  voice: {
    uuid: identity,
    beats: structure,
  },
  bar: {
    uuid: identity,
    clef: field("choice", "clef", "ready"),
    clefOttava: field("choice", "clef", "ready"),
    voices: structure,
    simileMark: readyEnum,
    keySignature: field("popover", "key-signature", "ready"),
    keySignatureType: field("popover", "key-signature", "ready"),
    displayScale: layout,
    displayWidth: layout,
  },
  masterBar: {
    uuid: identity,
    timeSignatureNumerator: field("popover", "time-signature", "ready"),
    timeSignatureDenominator: field("popover", "time-signature", "ready"),
    isRepeatStart: readyToggle,
    repeatCount: inlineNumber,
    alternateEndings: field("popover", "alternate-endings", "ready"),
    tripletFeel: readyEnum,
    isFreeTime: readyToggle,
    section: field("popover", "section", "ready"),
    tempoAutomations: field("dialog", "automation", "ready"),
    fermata: field("popover", "fermata", "missing"),
    displayScale: layout,
    displayWidth: layout,
  },
  staff: {
    uuid: identity,
    bars: structure,
    chords: field("dialog", "chord-library", "ready"),
    capo: inlineNumber,
    transpositionPitch: inlineNumber,
    displayTranspositionPitch: field("inline", "number", "ready"),
    showTablature: readyToggle,
    showStandardNotation: readyToggle,
    isPercussion: structure,
    stringTuning: field("popover", "tuning", "ready"),
  },
  track: {
    uuid: identity,
    staves: structure,
    playbackInfo: field("dialog", "instrument", "ready"),
    color: field("popover", "color", "ready"),
    name: inlineText,
    shortName: inlineText,
    percussionArticulations: field("dialog", "percussion-map", "ready"),
    defaultSystemsLayout: layout,
    systemsLayout: layout,
  },
  score: {
    title: inlineText,
    subTitle: inlineText,
    artist: inlineText,
    album: inlineText,
    words: inlineText,
    music: inlineText,
    copyright: inlineText,
    tab: inlineText,
    instructions: field("dialog", "long-text", "ready"),
    notices: field("dialog", "long-text", "ready"),
    defaultSystemsLayout: layout,
    systemsLayout: layout,
    tempo: field("inline", "tempo", "ready"),
    tempoLabel: inlineText,
    masterBars: structure,
    tracks: structure,
  },
} satisfies InspectorFieldCatalog;

export type InspectorModelName = keyof InspectorFieldCatalog;

export function inspectorFieldPolicy<
  Model extends InspectorModelName,
  Field extends keyof InspectorFieldCatalog[Model],
>(model: Model, fieldName: Field): InspectorFieldPolicy {
  return INSPECTOR_FIELD_CATALOG[model][fieldName] as InspectorFieldPolicy;
}

export function inspectorFieldsByStatus(status: InspectorFieldStatus): Array<{
  model: InspectorModelName;
  field: string;
  policy: InspectorFieldPolicy;
}> {
  return (Object.entries(INSPECTOR_FIELD_CATALOG) as Array<[
    InspectorModelName,
    Record<string, InspectorFieldPolicy>,
  ]>).flatMap(([model, fields]) =>
    Object.entries(fields)
      .filter(([, policy]) => policy.status === status)
      .map(([fieldName, policy]) => ({ model, field: fieldName, policy })),
  );
}
