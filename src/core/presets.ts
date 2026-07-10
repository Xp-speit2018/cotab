export interface TrackPreset {
  id: string;
  nameKey: string;
  defaultName: string;
  program: number;
  channel: number;
  clef: number;
  isPercussion: boolean;
  stringCount: number;
  tuning?: readonly number[];
}

export const TRACK_PRESETS: readonly TrackPreset[] = [
  { id: "acousticGuitar", nameKey: "sidebar.selector.presets.acousticGuitar", defaultName: "Acoustic Guitar", program: 25, channel: 0, clef: 4, isPercussion: false, stringCount: 6, tuning: [64, 59, 55, 50, 45, 40] },
  { id: "electricGuitarClean", nameKey: "sidebar.selector.presets.electricGuitarClean", defaultName: "Electric Guitar (Clean)", program: 27, channel: 0, clef: 4, isPercussion: false, stringCount: 6, tuning: [64, 59, 55, 50, 45, 40] },
  { id: "electricGuitarDistortion", nameKey: "sidebar.selector.presets.electricGuitarDistortion", defaultName: "Electric Guitar (Distortion)", program: 30, channel: 0, clef: 4, isPercussion: false, stringCount: 6, tuning: [64, 59, 55, 50, 45, 40] },
  { id: "bassGuitar", nameKey: "sidebar.selector.presets.bassGuitar", defaultName: "Bass Guitar", program: 33, channel: 0, clef: 3, isPercussion: false, stringCount: 4, tuning: [43, 38, 33, 28] },
  { id: "violin", nameKey: "sidebar.selector.presets.violin", defaultName: "Violin", program: 40, channel: 0, clef: 4, isPercussion: false, stringCount: 4, tuning: [76, 69, 62, 55] },
  { id: "acousticPiano", nameKey: "sidebar.selector.presets.acousticPiano", defaultName: "Acoustic Piano", program: 0, channel: 0, clef: 4, isPercussion: false, stringCount: 0 },
  { id: "drumkit", nameKey: "sidebar.selector.presets.drumkit", defaultName: "Drums", program: 0, channel: 9, clef: 0, isPercussion: true, stringCount: 0 },
] as const;
