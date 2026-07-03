import { describe, expect, it, vi } from "vitest";
import type { SelectedBeat } from "@/core/engine";
import {
  resolvePlaybackFinishedState,
  togglePlayback,
  type PlaybackApi,
  type PlaybackBeatResolver,
  type PlaybackTransportState,
} from "../playback-control";

function createApi(tickPosition = 0): PlaybackApi & {
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
} {
  return {
    tickPosition,
    play: vi.fn(() => true),
    pause: vi.fn(),
  };
}

function state(
  playerState: PlaybackTransportState["playerState"],
  playhead: SelectedBeat | null = null,
): PlaybackTransportState {
  return {
    playerState,
    transport: { playhead },
  };
}

describe("playback-control", () => {
  it("starts stopped playback from the transport playhead", () => {
    const api = createApi();
    const resolveBeat = vi.fn(() => ({ absolutePlaybackStart: 3840 }));
    const playhead: SelectedBeat = {
      trackIndex: 1,
      staffIndex: 0,
      voiceIndex: 0,
      barIndex: 4,
      beatIndex: 2,
      string: null,
    };

    togglePlayback(api, state("stopped", playhead), resolveBeat);

    expect(resolveBeat).toHaveBeenCalledWith(1, 4, 2, 0, 0);
    expect(api.tickPosition).toBe(3840);
    expect(api.play).toHaveBeenCalledTimes(1);
    expect(api.pause).not.toHaveBeenCalled();
  });

  it("keeps the current transport position when resuming from pause", () => {
    const api = createApi(4800);
    const resolveBeat = vi.fn(() => ({ absolutePlaybackStart: 9600 }));
    const playhead: SelectedBeat = {
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      barIndex: 3,
      beatIndex: 0,
      string: null,
    };

    togglePlayback(api, state("paused", playhead), resolveBeat);

    expect(resolveBeat).not.toHaveBeenCalled();
    expect(api.tickPosition).toBe(4800);
    expect(api.play).toHaveBeenCalledTimes(1);
    expect(api.pause).not.toHaveBeenCalled();
  });

  it("pauses without seeking when playback is already running", () => {
    const api = createApi(7200);
    const resolveBeat = vi.fn(() => ({ absolutePlaybackStart: 9600 }));

    togglePlayback(api, state("playing"), resolveBeat);

    expect(resolveBeat).not.toHaveBeenCalled();
    expect(api.tickPosition).toBe(7200);
    expect(api.pause).toHaveBeenCalledTimes(1);
    expect(api.play).not.toHaveBeenCalled();
  });

  it("plays without seeking when there is no transport playhead", () => {
    const api = createApi(0);
    const resolveBeat = vi.fn() as PlaybackBeatResolver;

    togglePlayback(api, state("stopped"), resolveBeat);

    expect(resolveBeat).not.toHaveBeenCalled();
    expect(api.tickPosition).toBe(0);
    expect(api.play).toHaveBeenCalledTimes(1);
  });

  it("falls back to beat playbackStart when absolutePlaybackStart is unavailable", () => {
    const api = createApi();
    const resolveBeat = vi.fn(() => ({ playbackStart: 1920 }));
    const playhead: SelectedBeat = {
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      barIndex: 0,
      beatIndex: 1,
      string: null,
    };

    togglePlayback(api, state("stopped", playhead), resolveBeat);

    expect(api.tickPosition).toBe(1920);
    expect(api.play).toHaveBeenCalledTimes(1);
  });

  it("pauses at the loop range end when looping is disabled", () => {
    const result = resolvePlaybackFinishedState(
      {
        currentTime: 12_500,
        isLooping: false,
        transport: {
          currentTime: 12_500,
          loopRange: {
            start: {
              trackIndex: 0,
              staffIndex: 0,
              voiceIndex: 0,
              barIndex: 2,
              beatIndex: 0,
            },
            end: {
              trackIndex: 0,
              staffIndex: 0,
              voiceIndex: 0,
              barIndex: 4,
              beatIndex: 0,
            },
          },
        },
      },
      { tickPosition: 9_600 },
    );

    expect(result).toEqual({
      playerState: "paused",
      currentTime: 12_500,
      transportPlayerState: "paused",
      transportCurrentTime: 12_500,
      transportTickPosition: 9_600,
    });
  });

  it("resets finished playback when loop range looping is enabled", () => {
    const result = resolvePlaybackFinishedState(
      {
        currentTime: 12_500,
        isLooping: true,
        transport: {
          currentTime: 12_500,
          loopRange: {
            start: {
              trackIndex: 0,
              staffIndex: 0,
              voiceIndex: 0,
              barIndex: 2,
              beatIndex: 0,
            },
            end: {
              trackIndex: 0,
              staffIndex: 0,
              voiceIndex: 0,
              barIndex: 4,
              beatIndex: 0,
            },
          },
        },
      },
      { tickPosition: 9_600 },
    );

    expect(result).toEqual({
      playerState: "stopped",
      currentTime: 0,
      transportPlayerState: "stopped",
      transportCurrentTime: 0,
      transportTickPosition: 0,
    });
  });
});
