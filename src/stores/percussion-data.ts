/**
 * Static percussion articulation tables and lookup helpers.
 * Depends only on player-types (PercArticulationDef, PercSnapGroup, DrumCategoryId) and alphaTab types.
 */

import * as alphaTab from "@coderline/alphatab";
import type { DrumCategoryId, PercArticulationDef, PercSnapGroup } from "./render-types";

export const ALPHATAB_PERCUSSION_DEFS: readonly PercArticulationDef[] = [
  { id: 38, elementType: "Snare", staffLine: 3, technique: "hit" },
  { id: 37, elementType: "Snare", staffLine: 3, technique: "side stick" },
  { id: 91, elementType: "Snare", staffLine: 3, technique: "rim shot" },
  { id: 39, elementType: "Hand Clap", staffLine: 3, technique: "hit" },
  { id: 40, elementType: "Electric Snare", staffLine: 3, technique: "hit" },
  { id: 31, elementType: "Sticks", staffLine: 3, technique: "hit" },
  { id: 33, elementType: "Metronome", staffLine: 3, technique: "hit" },
  { id: 34, elementType: "Metronome", staffLine: 3, technique: "bell" },
  { id: 54, elementType: "Tambourine", staffLine: 3, technique: "hit" },
  { id: 42, elementType: "Charley", staffLine: -1, technique: "closed" },
  { id: 92, elementType: "Charley", staffLine: -1, technique: "half" },
  { id: 46, elementType: "Charley", staffLine: -1, technique: "open" },
  { id: 57, elementType: "Crash Medium", staffLine: -1, technique: "hit" },
  { id: 98, elementType: "Crash Medium", staffLine: -1, technique: "choke" },
  { id: 102, elementType: "Cowbell High", staffLine: -1, technique: "hit" },
  { id: 103, elementType: "Cowbell High", staffLine: -1, technique: "tip" },
  { id: 44, elementType: "Charley", staffLine: 9, technique: "hit" },
  { id: 93, elementType: "Ride", staffLine: 0, technique: "edge" },
  { id: 51, elementType: "Ride", staffLine: 0, technique: "middle" },
  { id: 53, elementType: "Ride", staffLine: 0, technique: "bell" },
  { id: 94, elementType: "Ride", staffLine: 0, technique: "choke" },
  { id: 56, elementType: "Cowbell Medium", staffLine: 0, technique: "hit" },
  { id: 101, elementType: "Cowbell Medium", staffLine: 0, technique: "tip" },
  { id: 55, elementType: "Splash", staffLine: -2, technique: "hit" },
  { id: 95, elementType: "Splash", staffLine: -2, technique: "choke" },
  { id: 49, elementType: "Crash High", staffLine: -2, technique: "hit" },
  { id: 97, elementType: "Crash High", staffLine: -2, technique: "choke" },
  { id: 52, elementType: "China", staffLine: -3, technique: "hit" },
  { id: 96, elementType: "China", staffLine: -3, technique: "choke" },
  { id: 30, elementType: "Reverse Cymbal", staffLine: -3, technique: "hit" },
  { id: 50, elementType: "Tom Very High", staffLine: 1, technique: "hit" },
  { id: 99, elementType: "Cowbell Low", staffLine: 1, technique: "hit" },
  { id: 100, elementType: "Cowbell Low", staffLine: 1, technique: "tip" },
  { id: 112, elementType: "Tambourine", staffLine: 1, technique: "roll" },
  { id: 48, elementType: "Tom High", staffLine: 2, technique: "hit" },
  { id: 111, elementType: "Tambourine", staffLine: 2, technique: "return" },
  { id: 59, elementType: "Ride Cymbal 2", staffLine: 2, technique: "edge" },
  { id: 126, elementType: "Ride Cymbal 2", staffLine: 2, technique: "middle" },
  { id: 127, elementType: "Ride Cymbal 2", staffLine: 2, technique: "bell" },
  { id: 29, elementType: "Ride Cymbal 2", staffLine: 2, technique: "choke" },
  { id: 47, elementType: "Tom Medium", staffLine: 4, technique: "hit" },
  { id: 45, elementType: "Tom Low", staffLine: 5, technique: "hit" },
  { id: 41, elementType: "Very Low Floor Tom", staffLine: 5, technique: "hit" },
  { id: 43, elementType: "Tom Very Low", staffLine: 6, technique: "hit" },
  { id: 36, elementType: "Kick Drum", staffLine: 7, technique: "hit" },
  { id: 35, elementType: "Acoustic Kick Drum", staffLine: 8, technique: "hit" },
  { id: 65, elementType: "Timbale High", staffLine: 9, technique: "hit" },
  { id: 66, elementType: "Timbale Low", staffLine: 10, technique: "hit" },
  { id: 67, elementType: "Agogo High", staffLine: 11, technique: "hit" },
  { id: 68, elementType: "Agogo Low", staffLine: 12, technique: "hit" },
  { id: 110, elementType: "Conga High", staffLine: 13, technique: "slap" },
  { id: 63, elementType: "Conga High", staffLine: 14, technique: "hit" },
  { id: 109, elementType: "Conga Low", staffLine: 15, technique: "mute" },
  { id: 108, elementType: "Conga Low", staffLine: 16, technique: "slap" },
  { id: 64, elementType: "Conga Low", staffLine: 17, technique: "hit" },
  { id: 115, elementType: "Piatti", staffLine: 18, technique: "hit" },
  { id: 62, elementType: "Conga High", staffLine: 19, technique: "mute" },
  { id: 75, elementType: "Claves", staffLine: 20, technique: "hit" },
  { id: 85, elementType: "Castanets", staffLine: 21, technique: "hit" },
  { id: 117, elementType: "Cabasa", staffLine: 22, technique: "return" },
  { id: 69, elementType: "Cabasa", staffLine: 23, technique: "hit" },
  { id: 116, elementType: "Piatti", staffLine: 24, technique: "hand" },
  { id: 114, elementType: "Grancassa", staffLine: 25, technique: "hit" },
  { id: 80, elementType: "Triangle", staffLine: 26, technique: "mute" },
  { id: 81, elementType: "Triangle", staffLine: 27, technique: "hit" },
  { id: 58, elementType: "Vibraslap", staffLine: 28, technique: "hit" },
  { id: 78, elementType: "Cuica", staffLine: 29, technique: "mute" },
  { id: 79, elementType: "Cuica", staffLine: 30, technique: "open" },
  { id: 87, elementType: "Surdo", staffLine: 35, technique: "mute" },
  { id: 86, elementType: "Surdo", staffLine: 36, technique: "hit" },
  { id: 74, elementType: "Guiro", staffLine: 37, technique: "scrap-return" },
  { id: 73, elementType: "Guiro", staffLine: 38, technique: "hit" },
  { id: 60, elementType: "Bongo High", staffLine: -4, technique: "hit" },
  { id: 104, elementType: "Bongo High", staffLine: -5, technique: "mute" },
  { id: 105, elementType: "Bongo High", staffLine: -6, technique: "slap" },
  { id: 61, elementType: "Bongo Low", staffLine: -7, technique: "hit" },
  { id: 113, elementType: "Tambourine", staffLine: -7, technique: "hand" },
  { id: 106, elementType: "Bongo Low", staffLine: -8, technique: "mute" },
  { id: 77, elementType: "Woodblock Low", staffLine: -9, technique: "hit" },
  { id: 76, elementType: "Woodblock High", staffLine: -10, technique: "hit" },
  { id: 72, elementType: "Whistle Low", staffLine: -11, technique: "hit" },
  { id: 70, elementType: "Left Maraca", staffLine: -12, technique: "hit" },
  { id: 118, elementType: "Left Maraca", staffLine: -13, technique: "return" },
  { id: 119, elementType: "Right Maraca", staffLine: -14, technique: "hit" },
  { id: 120, elementType: "Right Maraca", staffLine: -15, technique: "return" },
  { id: 107, elementType: "Bongo Low", staffLine: -16, technique: "slap" },
  { id: 71, elementType: "Whistle High", staffLine: -17, technique: "hit" },
  { id: 84, elementType: "Bell Tree", staffLine: -18, technique: "hit" },
  { id: 123, elementType: "Bell Tree", staffLine: -19, technique: "return" },
  { id: 83, elementType: "Jingle Bell", staffLine: -20, technique: "hit" },
  { id: 124, elementType: "Golpe", staffLine: -21, technique: "thumb" },
  { id: 125, elementType: "Golpe", staffLine: -22, technique: "finger" },
  { id: 82, elementType: "Shaker", staffLine: -23, technique: "hit" },
  { id: 122, elementType: "Shaker", staffLine: -24, technique: "return" },
];

export const GP7_DEF_BY_ID: ReadonlyMap<number, PercArticulationDef> = new Map(
  ALPHATAB_PERCUSSION_DEFS.map((d) => [d.id, d]),
);

export const GP7_ARTICULATION_MAP: ReadonlyMap<number, number> = new Map(
  ALPHATAB_PERCUSSION_DEFS.map((d) => [d.id, d.staffLine]),
);

export const GP7_STAFF_LINE_MAP: ReadonlyMap<number, readonly number[]> = (() => {
  const m = new Map<number, number[]>();
  for (const d of ALPHATAB_PERCUSSION_DEFS) {
    const arr = m.get(d.staffLine) ?? [];
    arr.push(d.id);
    m.set(d.staffLine, arr);
  }
  return m as ReadonlyMap<number, readonly number[]>;
})();

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

export const ESSENTIAL_GP7_IDS: ReadonlySet<number> = new Set([
  42, 46, 92, 44, 51, 53, 93, 49, 55, 52, 38, 37, 91, 50, 48, 47, 45, 43, 36, 35,
]);

export const ESSENTIAL_ARTICULATION_GROUPS: ReadonlyArray<{
  category: DrumCategoryId;
  ids: readonly number[];
}> = [
  { category: "cymbals", ids: [42, 46, 92, 44, 51, 53, 93, 49, 55, 52] },
  { category: "snare", ids: [38, 37, 91] },
  { category: "toms", ids: [50, 48, 47, 45, 43] },
  { category: "kick", ids: [36, 35] },
];

export const DRUM_STAFFLINE_DEFAULTS: Record<number, number> = {
  [-3]: 52,
  [-2]: 49,
  [-1]: 42,
  0: 51,
  1: 50,
  2: 48,
  3: 38,
  4: 47,
  5: 45,
  6: 43,
  7: 36,
  8: 35,
  9: 44,
};

export function resolveGp7Id(note: alphaTab.model.Note): number {
  const idx = note.percussionArticulation;
  const artics = note.beat.voice.bar.staff.track.percussionArticulations;
  if (artics?.length > 0 && idx >= 0 && idx < artics.length) {
    return artics[idx].id;
  }
  return idx;
}

export function gp7IdToPercussionArticulation(
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
