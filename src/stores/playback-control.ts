import type { PlaybackState, RenderTransportState } from "./render-types";

export interface PlaybackApi {
  tickPosition: number;
  play(): boolean;
  pause(): void;
}

export interface PlaybackBeat {
  absolutePlaybackStart?: number;
  playbackStart?: number;
}

export interface PlaybackTransportState {
  playerState: PlaybackState;
  transport: Pick<RenderTransportState, "playhead">;
}

export type PlaybackBeatResolver = (
  trackIndex: number,
  barIndex: number,
  beatIndex: number,
  staffIndex?: number,
  voiceIndex?: number,
) => PlaybackBeat | null;

export function resolveTransportPlayheadBeat(
  state: Pick<PlaybackTransportState, "transport">,
  resolveBeat: PlaybackBeatResolver,
): PlaybackBeat | null {
  const playhead = state.transport.playhead;
  if (!playhead) return null;
  return resolveBeat(
    playhead.trackIndex,
    playhead.barIndex,
    playhead.beatIndex,
    playhead.staffIndex,
    playhead.voiceIndex,
  );
}

function beatPlaybackStartTick(beat: PlaybackBeat): number | null {
  const tick = beat.absolutePlaybackStart ?? beat.playbackStart;
  return typeof tick === "number" && Number.isFinite(tick) && tick >= 0
    ? tick
    : null;
}

export function seekToTransportPlayhead(
  api: PlaybackApi,
  state: Pick<PlaybackTransportState, "transport">,
  resolveBeat: PlaybackBeatResolver,
): boolean {
  const beat = resolveTransportPlayheadBeat(state, resolveBeat);
  if (!beat) return false;

  const tick = beatPlaybackStartTick(beat);
  if (tick === null) return false;
  api.tickPosition = tick;
  return true;
}

export function togglePlayback(
  api: PlaybackApi,
  state: PlaybackTransportState,
  resolveBeat: PlaybackBeatResolver,
): void {
  if (state.playerState === "playing") {
    api.pause();
    return;
  }

  if (state.playerState === "stopped") {
    seekToTransportPlayhead(api, state, resolveBeat);
  }
  api.play();
}
