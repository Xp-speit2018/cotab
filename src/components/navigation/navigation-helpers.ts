import type { SelectedBeat } from "@/core/engine";
import {
  computeMoveDown as computeCoreMoveDown,
  computeMoveUp as computeCoreMoveUp,
  computeNextStaff as computeCoreNextStaff,
  computePrevStaff as computeCorePrevStaff,
} from "@/core/navigation";
import { usePlayerStore } from "@/stores/render-store";
import { getNavigablePositions } from "@/stores/snap-grid";

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

export function computeNextStaff(current: SelectedBeat): SelectedBeat | null {
  return computeCoreNextStaff(current, {
    visibleTrackIndices: usePlayerStore.getState().visibleTrackIndices,
  });
}

export function computePrevStaff(current: SelectedBeat): SelectedBeat | null {
  return computeCorePrevStaff(current, {
    visibleTrackIndices: usePlayerStore.getState().visibleTrackIndices,
  });
}
