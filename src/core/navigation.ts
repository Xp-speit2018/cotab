import * as Y from "yjs";

import { engine, type SelectedBeat } from "@/core/engine";

export interface NavigationOptions {
  getNavigablePositions?: (trackIndex: number, staffIndex: number) => readonly number[] | null;
  visibleTrackIndices?: readonly number[] | null;
}

const PERCUSSION_FALLBACK_POSITIONS = [
  -24, -23, -22, -21, -20, -19, -18, -17, -16, -15, -14, -13, -12, -11, -10,
  -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
  12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
  35, 36, 37, 38,
];

/** Count beats in a voice via Y.Doc. */
export function getBeatsLength(
  trackIndex: number,
  staffIndex: number,
  barIndex: number,
  voiceIndex: number,
): number {
  const yVoice = engine.resolveYVoice(trackIndex, staffIndex, barIndex, voiceIndex);
  if (!yVoice) return 0;
  const beats = yVoice.get("beats") as Y.Array<unknown> | undefined;
  return beats ? beats.length : 0;
}

/** Count bars in a staff via Y.Doc. */
export function getBarsLength(trackIndex: number, staffIndex: number): number {
  const yStaff = engine.resolveYStaff(trackIndex, staffIndex);
  if (!yStaff) return 0;
  const bars = yStaff.get("bars") as Y.Array<unknown> | undefined;
  return bars ? bars.length : 0;
}

/** Count staves in a track via Y.Doc. */
export function getStavesLength(trackIndex: number): number {
  const yTrack = engine.resolveYTrack(trackIndex);
  if (!yTrack) return 0;
  const staves = yTrack.get("staves") as Y.Array<unknown> | undefined;
  return staves ? staves.length : 0;
}

/** Get the number of strings (tuning length) in a staff. */
export function getStringCount(trackIndex: number, staffIndex: number): number {
  const yStaff = engine.resolveYStaff(trackIndex, staffIndex);
  if (!yStaff) return 0;
  const yStringTuning = yStaff.get("stringTuning") as
    | Y.Map<unknown>
    | undefined;
  const yTunings = yStringTuning?.get("tunings") as
    | Y.Array<number>
    | undefined;
  return yTunings?.length ?? 0;
}

/** Check if a staff is percussion. */
export function isPercussionStaff(trackIndex: number, staffIndex: number): boolean {
  const yStaff = engine.resolveYStaff(trackIndex, staffIndex);
  if (!yStaff) return false;
  return (yStaff.get("isPercussion") as boolean | undefined) ?? false;
}

function getTrackCount(): number {
  const yScore = engine.getScoreMap();
  const yTracks = yScore?.get("tracks") as Y.Array<unknown> | undefined;
  return yTracks?.length ?? 0;
}

function getVisibleTrackIndices(options: NavigationOptions): readonly number[] {
  if (options.visibleTrackIndices) {
    return options.visibleTrackIndices;
  }

  return Array.from({ length: getTrackCount() }, (_value, index) => index);
}

function getFallbackPositions(trackIndex: number, staffIndex: number): readonly number[] | null {
  if (isPercussionStaff(trackIndex, staffIndex)) {
    return PERCUSSION_FALLBACK_POSITIONS;
  }
  const stringCount = getStringCount(trackIndex, staffIndex);
  if (stringCount > 0) {
    return Array.from({ length: stringCount }, (_value, index) => stringCount - index);
  }
  return Array.from({ length: 21 }, (_value, index) => index + 1);
}

function getMovePositions(
  trackIndex: number,
  staffIndex: number,
  options: NavigationOptions,
): readonly number[] | null {
  const snapPositions = options.getNavigablePositions?.(trackIndex, staffIndex);
  return snapPositions && snapPositions.length > 0
    ? snapPositions
    : getFallbackPositions(trackIndex, staffIndex);
}

/** Compute next beat target (moves to next bar if at end). */
export function computeNextBeat(current: SelectedBeat): SelectedBeat | null {
  const beatsLen = getBeatsLength(
    current.trackIndex,
    current.staffIndex,
    current.barIndex,
    current.voiceIndex,
  );
  const barsLen = getBarsLength(current.trackIndex, current.staffIndex);

  if (current.beatIndex < beatsLen - 1) {
    return { ...current, beatIndex: current.beatIndex + 1 };
  } else if (current.barIndex < barsLen - 1) {
    return { ...current, barIndex: current.barIndex + 1, beatIndex: 0 };
  }
  return null;
}

/** Compute previous beat target (moves to previous bar if at start). */
export function computePrevBeat(current: SelectedBeat): SelectedBeat | null {
  if (current.beatIndex > 0) {
    return { ...current, beatIndex: current.beatIndex - 1 };
  } else if (current.barIndex > 0) {
    const prevBeatsLen = getBeatsLength(
      current.trackIndex,
      current.staffIndex,
      current.barIndex - 1,
      current.voiceIndex,
    );
    return {
      ...current,
      barIndex: current.barIndex - 1,
      beatIndex: Math.max(0, prevBeatsLen - 1),
    };
  }
  return null;
}

export function computeMoveUp(
  current: SelectedBeat,
  options: NavigationOptions = {},
): SelectedBeat | null {
  const { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string: currentString } = current;
  const positions = getMovePositions(trackIndex, staffIndex, options);
  if (!positions || positions.length === 0) return null;

  if (currentString === null) {
    const idx = Math.max(0, Math.floor(positions.length / 2) - 1);
    return { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string: positions[idx] };
  }

  const idx = positions.indexOf(currentString);
  if (idx > 0) {
    return { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string: positions[idx - 1] };
  }
  return null;
}

export function computeMoveDown(
  current: SelectedBeat,
  options: NavigationOptions = {},
): SelectedBeat | null {
  const { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string: currentString } = current;
  const positions = getMovePositions(trackIndex, staffIndex, options);
  if (!positions || positions.length === 0) return null;

  if (currentString === null) {
    const idx = Math.min(positions.length - 1, Math.floor(positions.length / 2) + 1);
    return { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string: positions[idx] };
  }

  const idx = positions.indexOf(currentString);
  if (idx >= 0 && idx < positions.length - 1) {
    return { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string: positions[idx + 1] };
  }
  return null;
}

/** Compute next bar target (jumps to first beat of next bar). */
export function computeNextBar(current: SelectedBeat): SelectedBeat | null {
  const barsLen = getBarsLength(current.trackIndex, current.staffIndex);
  if (current.barIndex < barsLen - 1) {
    return { ...current, barIndex: current.barIndex + 1, beatIndex: 0 };
  }
  return null;
}

/** Compute previous bar target (jumps to last beat of previous bar). */
export function computePrevBar(current: SelectedBeat): SelectedBeat | null {
  if (current.barIndex > 0) {
    const prevBeatsLen = getBeatsLength(
      current.trackIndex,
      current.staffIndex,
      current.barIndex - 1,
      current.voiceIndex,
    );
    return {
      ...current,
      barIndex: current.barIndex - 1,
      beatIndex: Math.max(0, prevBeatsLen - 1),
    };
  }
  return null;
}

function getVisibleStaves(options: NavigationOptions): Array<{ trackIndex: number; staffIndex: number }> {
  const visible = getVisibleTrackIndices(options);
  const allStaves: Array<{ trackIndex: number; staffIndex: number }> = [];
  for (const trackIndex of visible) {
    const stavesLen = getStavesLength(trackIndex);
    for (let staffIndex = 0; staffIndex < stavesLen; staffIndex++) {
      allStaves.push({ trackIndex, staffIndex });
    }
  }
  return allStaves;
}

function buildStaffSelection(
  current: SelectedBeat,
  target: { trackIndex: number; staffIndex: number },
): SelectedBeat {
  const barsLen = getBarsLength(target.trackIndex, target.staffIndex);
  const barIndex = Math.min(current.barIndex, Math.max(0, barsLen - 1));
  return {
    trackIndex: target.trackIndex,
    staffIndex: target.staffIndex,
    voiceIndex: 0,
    barIndex,
    beatIndex: 0,
    string: null,
  };
}

export function computeNextStaff(
  current: SelectedBeat,
  options: NavigationOptions = {},
): SelectedBeat | null {
  const allStaves = getVisibleStaves(options);
  const curPos = allStaves.findIndex(
    (staff) => staff.trackIndex === current.trackIndex && staff.staffIndex === current.staffIndex,
  );

  if (curPos >= 0 && curPos < allStaves.length - 1) {
    return buildStaffSelection(current, allStaves[curPos + 1]);
  }
  return null;
}

export function computePrevStaff(
  current: SelectedBeat,
  options: NavigationOptions = {},
): SelectedBeat | null {
  const allStaves = getVisibleStaves(options);
  const curPos = allStaves.findIndex(
    (staff) => staff.trackIndex === current.trackIndex && staff.staffIndex === current.staffIndex,
  );

  if (curPos > 0) {
    return buildStaffSelection(current, allStaves[curPos - 1]);
  }
  return null;
}
