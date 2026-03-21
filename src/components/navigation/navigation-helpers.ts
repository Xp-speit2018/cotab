/**
 * navigation-helpers.ts — Navigation target calculators.
 *
 * Used by sidebar buttons and keyboard shortcuts to compute targets
 * before calling nav.setSelection.
 */

import type { SelectedBeat } from "@/core/engine";
import { engine } from "@/core/engine";
import * as Y from "yjs";
import { usePlayerStore } from "@/stores/render-store";

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
  const tuning = yStaff.get("tuning") as Y.Array<number> | undefined;
  return tuning ? tuning.length : 0;
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

/**
 * Compute move up target.
 * String 1 = highest pitch (physically at bottom of tab), string N = lowest pitch (physically at top)
 * MoveUp = physically upward = toward higher string numbers (lower pitch)
 */
export function computeMoveUp(current: SelectedBeat): SelectedBeat | null {
  const stringCount = getStringCount(current.trackIndex, current.staffIndex);
  if (stringCount === 0) return null;

  const { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string: currentString } = current;

  if (currentString === null) {
    const mid = Math.ceil(stringCount / 2);
    return {
      trackIndex,
      staffIndex,
      barIndex,
      voiceIndex,
      beatIndex,
      string: Math.min(stringCount, mid + 1),
    };
  }

  if (currentString < stringCount) {
    return {
      trackIndex,
      staffIndex,
      barIndex,
      voiceIndex,
      beatIndex,
      string: currentString + 1,
    };
  }
  return null;
}

/**
 * Compute move down target.
 * String 1 = highest pitch (physically at bottom of tab), string N = lowest pitch (physically at top)
 * MoveDown = physically downward = toward lower string numbers (higher pitch)
 */
export function computeMoveDown(current: SelectedBeat): SelectedBeat | null {
  const stringCount = getStringCount(current.trackIndex, current.staffIndex);
  if (stringCount === 0) return null;

  const { trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string: currentString } = current;

  if (currentString === null) {
    const mid = Math.ceil(stringCount / 2);
    return {
      trackIndex,
      staffIndex,
      barIndex,
      voiceIndex,
      beatIndex,
      string: Math.max(1, mid - 1),
    };
  }

  if (currentString > 1) {
    return {
      trackIndex,
      staffIndex,
      barIndex,
      voiceIndex,
      beatIndex,
      string: currentString - 1,
    };
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

/** Compute next staff target (across visible tracks). */
export function computeNextStaff(current: SelectedBeat): SelectedBeat | null {
  const visible = usePlayerStore.getState().visibleTrackIndices;

  const allStaves: Array<{ trackIndex: number; staffIndex: number }> = [];
  for (const ti of visible) {
    const stavesLen = getStavesLength(ti);
    for (let si = 0; si < stavesLen; si++) {
      allStaves.push({ trackIndex: ti, staffIndex: si });
    }
  }

  const curPos = allStaves.findIndex(
    (s) => s.trackIndex === current.trackIndex && s.staffIndex === current.staffIndex,
  );

  if (curPos >= 0 && curPos < allStaves.length - 1) {
    const next = allStaves[curPos + 1];
    const barsLen = getBarsLength(next.trackIndex, next.staffIndex);
    const barIndex = Math.min(current.barIndex, Math.max(0, barsLen - 1));
    return {
      trackIndex: next.trackIndex,
      staffIndex: next.staffIndex,
      voiceIndex: 0,
      barIndex,
      beatIndex: 0,
      string: null,
    };
  }
  return null;
}

/** Compute previous staff target (across visible tracks). */
export function computePrevStaff(current: SelectedBeat): SelectedBeat | null {
  const visible = usePlayerStore.getState().visibleTrackIndices;

  const allStaves: Array<{ trackIndex: number; staffIndex: number }> = [];
  for (const ti of visible) {
    const stavesLen = getStavesLength(ti);
    for (let si = 0; si < stavesLen; si++) {
      allStaves.push({ trackIndex: ti, staffIndex: si });
    }
  }

  const curPos = allStaves.findIndex(
    (s) => s.trackIndex === current.trackIndex && s.staffIndex === current.staffIndex,
  );

  if (curPos > 0) {
    const prev = allStaves[curPos - 1];
    const barsLen = getBarsLength(prev.trackIndex, prev.staffIndex);
    const barIndex = Math.min(current.barIndex, Math.max(0, barsLen - 1));
    return {
      trackIndex: prev.trackIndex,
      staffIndex: prev.staffIndex,
      voiceIndex: 0,
      barIndex,
      beatIndex: 0,
      string: null,
    };
  }
  return null;
}
