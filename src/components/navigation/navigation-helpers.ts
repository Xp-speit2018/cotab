import type * as alphaTab from "@coderline/alphatab";
import type { SelectedBeat } from "@/core/engine";
import {
  computeMoveDown as computeCoreMoveDown,
  computeMoveUp as computeCoreMoveUp,
  computeNextStaff as computeCoreNextStaff,
  computePrevStaff as computeCorePrevStaff,
} from "@/core/navigation";
import { usePlayerStore } from "@/stores/render-store";
import { getApi } from "@/stores/render-api";
import {
  findNearestSnap,
  getNavigablePositions,
  getSnapGridForBar,
} from "@/stores/snap-grid";

export {
  computeNextBar,
  computeNextBeat,
  computePrevBar,
  computePrevBeat,
  getBarsLength,
  getBeatsLength,
  getStavesLength,
  getStringCount,
  isPercussionStaff,
} from "@/core/navigation";

export function computeMoveUp(current: SelectedBeat): SelectedBeat | null {
  return computeCoreMoveUp(current, { getNavigablePositions });
}

export function computeMoveDown(current: SelectedBeat): SelectedBeat | null {
  return computeCoreMoveDown(current, { getNavigablePositions });
}

function projectStringToStaff(
  current: SelectedBeat,
  target: SelectedBeat,
): number | null {
  const targetGrid = getSnapGridForBar(
    target.trackIndex,
    target.staffIndex,
    target.barIndex,
  );
  if (!targetGrid || targetGrid.positions.length === 0) return null;

  let relativeY = 0.5;
  const sourceGrid = getSnapGridForBar(
    current.trackIndex,
    current.staffIndex,
    current.barIndex,
  );
  const sourcePosition = current.string === null
    ? null
    : sourceGrid?.positions.find((position) => position.string === current.string) ?? null;
  if (sourceGrid && sourcePosition && sourceGrid.positions.length > 1) {
    const first = sourceGrid.positions[0].y;
    const last = sourceGrid.positions.at(-1)!.y;
    if (last !== first) {
      relativeY = (sourcePosition.y - first) / (last - first);
    }
  }

  const targetFirst = targetGrid.positions[0].y;
  const targetLast = targetGrid.positions.at(-1)!.y;
  const targetY = targetFirst + relativeY * (targetLast - targetFirst);
  return findNearestSnap(targetGrid, targetY)?.string ?? null;
}

function snapRenderedStaffSelection(
  current: SelectedBeat,
  fallback: SelectedBeat,
): SelectedBeat {
  const api = getApi();
  const lookup = api?.boundsLookup;
  const score = api?.score;
  const snappedString = projectStringToStaff(current, fallback);
  if (!lookup || !score || current.barIndex !== fallback.barIndex) {
    return { ...fallback, string: snappedString };
  }

  const sourceBeat = score.tracks[current.trackIndex]?.staves[current.staffIndex]
    ?.bars[current.barIndex]?.voices[current.voiceIndex]?.beats[current.beatIndex];
  const sourceBounds = sourceBeat ? lookup.findBeat(sourceBeat) : null;
  const targetBar = score.tracks[fallback.trackIndex]?.staves[fallback.staffIndex]
    ?.bars[fallback.barIndex];
  if (!sourceBounds || !targetBar) {
    return { ...fallback, string: snappedString };
  }

  let nearestBeat: alphaTab.model.Beat | null = null;
  let nearestDistance = Infinity;
  for (const voice of targetBar.voices) {
    for (const beat of voice.beats) {
      const bounds = lookup.findBeat(beat);
      if (!bounds) continue;
      const centerX = bounds.realBounds.x + bounds.realBounds.w / 2;
      const distance = Math.abs(sourceBounds.onNotesX - centerX);
      if (distance < nearestDistance) {
        nearestBeat = beat;
        nearestDistance = distance;
      }
    }
  }

  if (!nearestBeat) return { ...fallback, string: snappedString };
  return {
    trackIndex: fallback.trackIndex,
    staffIndex: fallback.staffIndex,
    voiceIndex: nearestBeat.voice.index,
    barIndex: fallback.barIndex,
    beatIndex: nearestBeat.index,
    string: snappedString,
  };
}

export function computeNextStaff(current: SelectedBeat): SelectedBeat | null {
  const target = computeCoreNextStaff(current, {
    visibleTrackIndices: usePlayerStore.getState().visibleTrackIndices,
  });
  return target ? snapRenderedStaffSelection(current, target) : null;
}

export function computePrevStaff(current: SelectedBeat): SelectedBeat | null {
  const target = computeCorePrevStaff(current, {
    visibleTrackIndices: usePlayerStore.getState().visibleTrackIndices,
  });
  return target ? snapRenderedStaffSelection(current, target) : null;
}
