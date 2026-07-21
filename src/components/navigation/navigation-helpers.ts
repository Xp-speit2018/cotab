import type { RenderedStave, SelectedBeat } from "@/core/engine";
import {
  computeMoveDown as computeCoreMoveDown,
  computeMoveUp as computeCoreMoveUp,
} from "@/core/navigation";
import { usePlayerStore } from "@/stores/render-store";
import { getApi } from "@/stores/render-api";
import {
  getNavigablePositions,
  getRenderedStaveForBarBounds,
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

type StaffSnapGrid = NonNullable<ReturnType<typeof getSnapGridForBar>>;

function getStaffNavigationPositions(
  trackIndex: number,
  grid: StaffSnapGrid,
): StaffSnapGrid["positions"] {
  if (!getApi()?.score?.tracks[trackIndex]?.isPercussion) {
    return grid.positions;
  }
  const visiblePositions = grid.positions.filter(
    (position) => position.string >= 0 && position.string <= 8,
  );
  return visiblePositions.length > 0 ? visiblePositions : grid.positions;
}

function findNearestPosition(
  positions: StaffSnapGrid["positions"],
  y: number,
) {
  let nearest = positions[0];
  let nearestDistance = Math.abs(y - nearest.y);
  for (let index = 1; index < positions.length; index++) {
    const distance = Math.abs(y - positions[index].y);
    if (distance < nearestDistance) {
      nearest = positions[index];
      nearestDistance = distance;
    }
  }
  return nearest;
}

function projectStringToStaff(
  current: SelectedBeat,
  target: SelectedBeat,
): number | null {
  const targetGrid = getSnapGridForBar(
    target.trackIndex,
    target.staffIndex,
    target.barIndex,
    target.renderedStave,
  );
  if (!targetGrid || targetGrid.positions.length === 0) return null;
  const targetPositions = getStaffNavigationPositions(target.trackIndex, targetGrid);

  let relativeY = 0.5;
  const sourceGrid = getSnapGridForBar(
    current.trackIndex,
    current.staffIndex,
    current.barIndex,
    current.renderedStave,
  );
  const sourcePositions = sourceGrid
    ? getStaffNavigationPositions(current.trackIndex, sourceGrid)
    : null;
  const sourcePosition = current.string === null
    ? null
    : sourcePositions?.find((position) => position.string === current.string) ?? null;
  if (sourcePositions && sourcePosition && sourcePositions.length > 1) {
    const first = sourcePositions[0].y;
    const last = sourcePositions.at(-1)!.y;
    if (last !== first) {
      relativeY = (sourcePosition.y - first) / (last - first);
    }
  }

  const targetFirst = targetPositions[0].y;
  const targetLast = targetPositions.at(-1)!.y;
  const targetY = targetFirst + relativeY * (targetLast - targetFirst);
  return findNearestPosition(targetPositions, targetY).string;
}

function snapRenderedStaffSelection(
  current: SelectedBeat,
  fallback: SelectedBeat,
): SelectedBeat {
  const api = getApi();
  const snappedString = projectStringToStaff(current, fallback);
  if (!api?.boundsLookup || !api.score || current.barIndex !== fallback.barIndex) {
    return { ...fallback, string: snappedString };
  }

  const sourceBarBounds = findRenderedBarBounds(current);
  const targetBarBounds = findRenderedBarBounds(fallback);
  const sourceBounds = sourceBarBounds?.beats.find((bounds) =>
    bounds.beat.voice.index === current.voiceIndex
    && bounds.beat.index === current.beatIndex
  ) ?? null;
  if (!sourceBounds || !targetBarBounds) {
    return { ...fallback, string: snappedString };
  }

  let nearestBeat = null as typeof sourceBounds.beat | null;
  let nearestDistance = Infinity;
  for (const bounds of targetBarBounds.beats) {
    const centerX = bounds.realBounds.x + bounds.realBounds.w / 2;
    const distance = Math.abs(sourceBounds.onNotesX - centerX);
    if (distance < nearestDistance) {
      nearestBeat = bounds.beat;
      nearestDistance = distance;
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
    renderedStave: fallback.renderedStave,
  };
}

type VisibleStaff = {
  trackIndex: number;
  staffIndex: number;
  renderedStave: RenderedStave;
};

function findRenderedBarBounds(selection: SelectedBeat) {
  const lookup = getApi()?.boundsLookup;
  if (!lookup || !selection.renderedStave) return null;
  for (const system of lookup.staffSystems) {
    for (const masterBar of system.bars) {
      for (const barBounds of masterBar.bars) {
        const bar = barBounds.bar ?? barBounds.beats[0]?.beat.voice.bar;
        if (
          bar?.staff.track.index === selection.trackIndex
          && bar.staff.index === selection.staffIndex
          && bar.index === selection.barIndex
          && getRenderedStaveForBarBounds(barBounds) === selection.renderedStave
        ) {
          return barBounds;
        }
      }
    }
  }
  return null;
}

function getVisibleStaffs(): VisibleStaff[] {
  const score = getApi()?.score;
  if (!score) return [];
  const visibleTracks = new Set(
    usePlayerStore.getState().visibleTrackIndices,
  );
  const result: VisibleStaff[] = [];
  for (const track of score.tracks) {
    if (!visibleTracks.has(track.index)) continue;
    for (const staff of track.staves) {
      if (staff.showStandardNotation) {
        result.push({
          trackIndex: track.index,
          staffIndex: staff.index,
          renderedStave: "standard",
        });
      }
      if (staff.showTablature) {
        result.push({
          trackIndex: track.index,
          staffIndex: staff.index,
          renderedStave: "tablature",
        });
      }
    }
  }
  return result;
}

function buildVisibleStaffSelection(
  current: SelectedBeat,
  target: VisibleStaff,
): SelectedBeat | null {
  const staff = getApi()?.score?.tracks[target.trackIndex]
    ?.staves[target.staffIndex];
  if (!staff || staff.bars.length === 0) return null;
  const barIndex = Math.min(current.barIndex, staff.bars.length - 1);
  return {
    trackIndex: target.trackIndex,
    staffIndex: target.staffIndex,
    voiceIndex: 0,
    barIndex,
    beatIndex: 0,
    string: null,
    renderedStave: target.renderedStave,
  };
}

function computeVisibleStaffTarget(
  current: SelectedBeat,
  offset: -1 | 1,
): SelectedBeat | null {
  const visibleStaffs = getVisibleStaffs();
  const currentStaff = current.renderedStave
    ?? (getApi()?.score?.tracks[current.trackIndex]?.staves[current.staffIndex]
      ?.showTablature ? "tablature" : "standard");
  const currentIndex = visibleStaffs.findIndex((staff) =>
    staff.trackIndex === current.trackIndex
    && staff.staffIndex === current.staffIndex
    && staff.renderedStave === currentStaff
  );
  const target = visibleStaffs[currentIndex + offset];
  return target ? buildVisibleStaffSelection(current, target) : null;
}

export function computeNextVisibleStaff(current: SelectedBeat): SelectedBeat | null {
  const target = computeVisibleStaffTarget(current, 1);
  return target ? snapRenderedStaffSelection(current, target) : null;
}

export function computePreviousVisibleStaff(current: SelectedBeat): SelectedBeat | null {
  const target = computeVisibleStaffTarget(current, -1);
  return target ? snapRenderedStaffSelection(current, target) : null;
}
