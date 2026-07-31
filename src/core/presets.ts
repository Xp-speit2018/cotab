export interface TrackPresetStaff {
  readonly initialClef: number;
  readonly isPercussion: boolean;
  readonly showTablature: boolean;
  readonly showStandardNotation: boolean;
  readonly capo: number;
  readonly transpositionPitch: number;
  readonly displayTranspositionPitch: number;
  readonly stringTuning: {
    readonly tunings: readonly number[];
    readonly name: string;
    readonly isStandard: boolean;
  };
}

export interface TrackPreset {
  readonly id: string;
  readonly nameKey: string;
  readonly defaultName: string;
  readonly shortName: string;
  readonly colorRaw: number;
  readonly playbackInfo: {
    readonly program: number;
    readonly bank: number;
  };
  readonly defaultSystemsLayout: number;
  readonly staves: readonly TrackPresetStaff[];
}

const STANDARD_COLOR = -40121;
const STANDARD_SYSTEMS_LAYOUT = 3;

function frettedStaff(tunings: readonly number[]): TrackPresetStaff {
  return {
    initialClef: 4,
    isPercussion: false,
    showTablature: true,
    showStandardNotation: true,
    capo: 0,
    transpositionPitch: 0,
    displayTranspositionPitch: 0,
    stringTuning: { tunings, name: "Standard", isStandard: true },
  };
}

export const TRACK_PRESETS = [
  {
    id: "acousticGuitar",
    nameKey: "sidebar.tracks.presets.acousticGuitar",
    defaultName: "Acoustic Guitar",
    shortName: "Ac. Gtr.",
    colorRaw: STANDARD_COLOR,
    playbackInfo: { program: 25, bank: 0 },
    defaultSystemsLayout: STANDARD_SYSTEMS_LAYOUT,
    staves: [frettedStaff([64, 59, 55, 50, 45, 40])],
  },
  {
    id: "electricGuitarClean",
    nameKey: "sidebar.tracks.presets.electricGuitarClean",
    defaultName: "Electric Guitar (Clean)",
    shortName: "El. Gtr.",
    colorRaw: STANDARD_COLOR,
    playbackInfo: { program: 27, bank: 0 },
    defaultSystemsLayout: STANDARD_SYSTEMS_LAYOUT,
    staves: [frettedStaff([64, 59, 55, 50, 45, 40])],
  },
  {
    id: "electricGuitarDistortion",
    nameKey: "sidebar.tracks.presets.electricGuitarDistortion",
    defaultName: "Electric Guitar (Distortion)",
    shortName: "El. Gtr.",
    colorRaw: STANDARD_COLOR,
    playbackInfo: { program: 30, bank: 0 },
    defaultSystemsLayout: STANDARD_SYSTEMS_LAYOUT,
    staves: [frettedStaff([64, 59, 55, 50, 45, 40])],
  },
  {
    id: "bassGuitar",
    nameKey: "sidebar.tracks.presets.bassGuitar",
    defaultName: "Bass Guitar",
    shortName: "Bass",
    colorRaw: STANDARD_COLOR,
    playbackInfo: { program: 33, bank: 0 },
    defaultSystemsLayout: STANDARD_SYSTEMS_LAYOUT,
    staves: [{ ...frettedStaff([43, 38, 33, 28]), initialClef: 3 }],
  },
  {
    id: "violin",
    nameKey: "sidebar.tracks.presets.violin",
    defaultName: "Violin",
    shortName: "Vln.",
    colorRaw: STANDARD_COLOR,
    playbackInfo: { program: 40, bank: 0 },
    defaultSystemsLayout: STANDARD_SYSTEMS_LAYOUT,
    staves: [{
      ...frettedStaff([76, 69, 62, 55]),
      showTablature: false,
      showStandardNotation: true,
    }],
  },
  {
    id: "acousticPiano",
    nameKey: "sidebar.tracks.presets.acousticPiano",
    defaultName: "Acoustic Piano",
    shortName: "Pno.",
    colorRaw: STANDARD_COLOR,
    playbackInfo: { program: 0, bank: 0 },
    defaultSystemsLayout: STANDARD_SYSTEMS_LAYOUT,
    staves: [4, 3].map((initialClef) => ({
      initialClef,
      isPercussion: false,
      showTablature: false,
      showStandardNotation: true,
      capo: 0,
      transpositionPitch: 0,
      displayTranspositionPitch: 0,
      stringTuning: { tunings: [], name: "", isStandard: false },
    })),
  },
  {
    id: "drumkit",
    nameKey: "sidebar.tracks.presets.drumkit",
    defaultName: "Drums",
    shortName: "Dr.",
    colorRaw: STANDARD_COLOR,
    playbackInfo: { program: 0, bank: 0 },
    defaultSystemsLayout: STANDARD_SYSTEMS_LAYOUT,
    staves: [{
      initialClef: 0,
      isPercussion: true,
      showTablature: false,
      showStandardNotation: true,
      capo: 0,
      transpositionPitch: 0,
      displayTranspositionPitch: 0,
      stringTuning: { tunings: [], name: "", isStandard: false },
    }],
  },
] as const satisfies readonly TrackPreset[];

export type TrackPresetId = (typeof TRACK_PRESETS)[number]["id"];
