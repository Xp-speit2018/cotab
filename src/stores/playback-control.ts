import type { SelectedBeat, SelectionRange } from "@/core/engine";

export interface PlaybackApi {
  tickPosition: number;
  play(): boolean;
  pause(): void;
}

export interface PlaybackBeat {
  absolutePlaybackStart?: number;
  playbackStart?: number;
}

export interface PlaybackSelectionState {
  playerState: "stopped" | "playing" | "paused";
  selectedBeat: SelectedBeat | null;
  selectionRange: SelectionRange | null;
}

export type PlaybackBeatResolver = (
  trackIndex: number,
  barIndex: number,
  beatIndex: number,
  staffIndex?: number,
  voiceIndex?: number,
) => PlaybackBeat | null;

export function resolvePlaybackStartBeat(
  state: Pick<PlaybackSelectionState, "selectionRange" | "selectedBeat">,
  resolveBeat: PlaybackBeatResolver,
): PlaybackBeat | null {
  const range = state.selectionRange;
  if (range) {
    return resolveBeat(
      range.trackIndex,
      range.startBarIndex,
      0,
      range.staffIndex,
      range.voiceIndex,
    );
  }

  const sel = state.selectedBeat;
  if (!sel) return null;
  return resolveBeat(
    sel.trackIndex,
    sel.barIndex,
    sel.beatIndex,
    sel.staffIndex,
    sel.voiceIndex,
  );
}

function beatPlaybackStartTick(beat: PlaybackBeat): number | null {
  const tick = beat.absolutePlaybackStart ?? beat.playbackStart;
  return typeof tick === "number" && Number.isFinite(tick) && tick >= 0
    ? tick
    : null;
}

export function seekToPlaybackStart(
  api: PlaybackApi,
  state: Pick<PlaybackSelectionState, "selectionRange" | "selectedBeat">,
  resolveBeat: PlaybackBeatResolver,
): boolean {
  const beat = resolvePlaybackStartBeat(state, resolveBeat);
  if (!beat) return false;

  const tick = beatPlaybackStartTick(beat);
  if (tick === null) return false;
  api.tickPosition = tick;
  return true;
}

export function togglePlayback(
  api: PlaybackApi,
  state: PlaybackSelectionState,
  resolveBeat: PlaybackBeatResolver,
): void {
  if (state.playerState === "playing") {
    api.pause();
    return;
  }

  if (state.playerState === "stopped") {
    seekToPlaybackStart(api, state, resolveBeat);
  }
  api.play();
}
