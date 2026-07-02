import { describe, expect, it, vi } from "vitest";
import type { SelectedBeat, SelectionRange } from "@/core/engine";
import {
  togglePlayback,
  type PlaybackApi,
  type PlaybackBeatResolver,
  type PlaybackSelectionState,
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
  playerState: PlaybackSelectionState["playerState"],
  selectedBeat: SelectedBeat | null = null,
  selectionRange: SelectionRange | null = null,
): PlaybackSelectionState {
  return {
    playerState,
    selectedBeat,
    selectionRange,
  };
}

describe("playback-control", () => {
  it("starts stopped playback from the selected beat", () => {
    const api = createApi();
    const resolveBeat = vi.fn(() => ({ absolutePlaybackStart: 3840 }));
    const selectedBeat: SelectedBeat = {
      trackIndex: 1,
      staffIndex: 0,
      voiceIndex: 0,
      barIndex: 4,
      beatIndex: 2,
      string: null,
    };

    togglePlayback(api, state("stopped", selectedBeat), resolveBeat);

    expect(resolveBeat).toHaveBeenCalledWith(1, 4, 2, 0, 0);
    expect(api.tickPosition).toBe(3840);
    expect(api.play).toHaveBeenCalledTimes(1);
    expect(api.pause).not.toHaveBeenCalled();
  });

  it("starts stopped playback from the first beat of a selected bar range", () => {
    const api = createApi();
    const resolveBeat = vi.fn(() => ({ absolutePlaybackStart: 9600 }));
    const selectedBeat: SelectedBeat = {
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      barIndex: 1,
      beatIndex: 1,
      string: null,
    };
    const selectionRange: SelectionRange = {
      trackIndex: 2,
      staffIndex: 1,
      voiceIndex: 0,
      startBarIndex: 5,
      endBarIndex: 7,
    };

    togglePlayback(api, state("stopped", selectedBeat, selectionRange), resolveBeat);

    expect(resolveBeat).toHaveBeenCalledWith(2, 5, 0, 1, 0);
    expect(api.tickPosition).toBe(9600);
    expect(api.play).toHaveBeenCalledTimes(1);
  });

  it("keeps the current transport position when resuming from pause", () => {
    const api = createApi(4800);
    const resolveBeat = vi.fn(() => ({ absolutePlaybackStart: 9600 }));
    const selectedBeat: SelectedBeat = {
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      barIndex: 3,
      beatIndex: 0,
      string: null,
    };

    togglePlayback(api, state("paused", selectedBeat), resolveBeat);

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

  it("plays without seeking when there is no current selection", () => {
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
    const selectedBeat: SelectedBeat = {
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      barIndex: 0,
      beatIndex: 1,
      string: null,
    };

    togglePlayback(api, state("stopped", selectedBeat), resolveBeat);

    expect(api.tickPosition).toBe(1920);
    expect(api.play).toHaveBeenCalledTimes(1);
  });
});
