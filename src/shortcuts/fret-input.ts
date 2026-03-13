import type { ActionExecutionContext } from "@/actions/types";
import { executeAction } from "@/actions";
import { usePlayerStore } from "@/stores/player-store";
import { useShortcutStore } from "./shortcut-store";
import { debugLog } from "@/stores/debug-log-store";

const DIGIT_TIMEOUT_MS = 500;

interface FretInputState {
  accumulated: string;
  timer: ReturnType<typeof setTimeout> | null;
}

const state: FretInputState = {
  accumulated: "",
  timer: null,
};

function reset(): void {
  if (state.timer !== null) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  state.accumulated = "";
}

function isTabTrack(): boolean {
  const sel = usePlayerStore.getState().selectedBeat;
  const trackInfo = usePlayerStore.getState().selectedTrackInfo;
  const staffInfo = usePlayerStore.getState().selectedStaffInfo;
  if (!sel || !trackInfo) return false;
  if (trackInfo.isPercussion) return false;
  return (staffInfo?.showTablature ?? false) && (staffInfo?.stringCount ?? 0) > 0;
}

function isPercussionTrack(): boolean {
  return usePlayerStore.getState().selectedTrackInfo?.isPercussion ?? false;
}

/**
 * Handle a digit key press (0-9). Returns true if consumed.
 *
 * - Tab tracks: accumulate digits with timeout, dispatch placeNote for each digit.
 * - Percussion tracks: directly toggle the mapped articulation.
 * - Notation tracks (e.g. piano): only `1` places a note at the current grid position.
 */
export function handleDigitInput(digit: number, context: ActionExecutionContext): boolean {
  if (isPercussionTrack()) {
    const gp7Id = useShortcutStore.getState().getPercussionGp7Id(digit);
    if (gp7Id !== undefined) {
      executeAction("edit.beat.togglePercussionArticulation", gp7Id, context);
      debugLog("debug", "fretInput", "percussion digit", { digit, gp7Id });
    }
    reset();
    return true;
  }

  if (isTabTrack()) {
    state.accumulated += String(digit);
    const fretValue = parseInt(state.accumulated, 10);

    executeAction("edit.beat.placeNote", fretValue, context);
    debugLog("debug", "fretInput", "tab digit", {
      digit,
      accumulated: state.accumulated,
      fret: fretValue,
    });

    if (state.timer !== null) {
      clearTimeout(state.timer);
    }
    state.timer = setTimeout(() => {
      debugLog("debug", "fretInput", "timeout finalize", { fret: fretValue });
      reset();
    }, DIGIT_TIMEOUT_MS);

    return true;
  }

  // Notation tracks (e.g. piano): only "1" triggers placeNote at the
  // current grid position. The clef of the active staff determines
  // the pitch mapping, so Treble and Alto/Bass staves resolve correctly.
  if (digit === 1) {
    executeAction("edit.beat.placeNote", undefined, context);
    debugLog("debug", "fretInput", "notation placeNote", { digit });
  }
  reset();
  return true;
}

/**
 * Called when any non-digit key is pressed, to finalize any pending accumulation.
 */
export function cancelDigitInput(): void {
  reset();
}

export function isAccumulating(): boolean {
  return state.accumulated.length > 0;
}
