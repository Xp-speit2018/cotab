import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  resetMockState,
  testContext,
  initDoc,
  destroyDoc,
} from "@/test/setup";

// Track API calls
const mockApiCalls = {
  play: vi.fn(),
  pause: vi.fn(),
  stop: vi.fn(),
};

// Track whether getApi should return null
let shouldReturnNull = false;

vi.mock("@/stores/render-internals", () => {
  const ms = () =>
    (globalThis as Record<string, unknown>).__testMockState as {
      mockApiAvailable?: boolean;
    } | undefined;
  return {
    getApi: vi.fn(() => {
      const s = ms();
      if (s?.mockApiAvailable === false) return null;
      return {
        play: mockApiCalls.play,
        pause: mockApiCalls.pause,
        stop: mockApiCalls.stop,
        settings: { display: { scale: 1.0 } },
        render: vi.fn(),
        updateSettings: vi.fn(),
      };
    }),
    setPendingSelection: vi.fn(),
    getTrack: vi.fn(() => null),
    resolveBeat: vi.fn(() => null),
    isBarEmptyAllTracks: vi.fn(() => true),
    applyBarWarningStyles: vi.fn(),
    createTrackFromPreset: vi.fn(),
    insertBarAtIndex: vi.fn(),
    extractTrackInfo: vi.fn(() => ({})),
    extractStaffInfo: vi.fn(() => ({})),
    extractVoiceInfo: vi.fn(() => ({})),
    extractBarInfo: vi.fn(() => ({})),
    formatPitch: vi.fn((o: number, t: number) => `${t}/${o}`),
    snapPositionToPitch: vi.fn((_clef: number, pos: number) => ({
      octave: 4,
      tone: pos,
    })),
    getSnapGrids: vi.fn(() => new Map()),
    updateSnapGridOverlay: vi.fn(),
    ALPHATAB_PERCUSSION_DEFS: [],
    DRUM_STAFFLINE_DEFAULTS: {} as Record<number, number>,
    PERC_SNAP_GROUPS: [],
    ESSENTIAL_ARTICULATION_GROUPS: [],
    ESSENTIAL_GP7_IDS: [],
    GP7_ARTICULATION_MAP: new Map(),
    GP7_DEF_BY_ID: new Map(),
    GP7_STAFF_LINE_MAP: new Map(),
    gp7IdToPercussionArticulation: vi.fn((_track: unknown, gp7Id: number) => gp7Id),
    resolveGp7Id: vi.fn(() => -1),
    QUARTER_TICKS: 960,
    TRACK_PRESETS: [],
    SCORE_FIELD_TO_STATE: {},
  };
});

// Helper to control mock API availability
function setMockApiAvailable(available: boolean): void {
  const ms = (globalThis as Record<string, unknown>).__testMockState as {
    mockApiAvailable?: boolean;
  };
  if (ms) ms.mockApiAvailable = available;
}

import { executeAction } from "@/actions/registry";
import { usePlayerStore } from "@/stores/render-store";
import "@/actions/playback";

const ctx = testContext();

beforeEach(() => {
  resetMockState();
  destroyDoc();
  initDoc();
  setMockApiAvailable(true);
  mockApiCalls.play.mockClear();
  mockApiCalls.pause.mockClear();
  mockApiCalls.stop.mockClear();
});

// ─── setPlaying ───────────────────────────────────────────────────────────────

describe("playback.setPlaying", () => {
  it("calls api.play when value is true", () => {
    executeAction("playback.setPlaying", true, ctx);

    expect(mockApiCalls.play).toHaveBeenCalledTimes(1);
    expect(mockApiCalls.pause).not.toHaveBeenCalled();
  });

  it("calls api.pause when value is false", () => {
    executeAction("playback.setPlaying", false, ctx);

    expect(mockApiCalls.pause).toHaveBeenCalledTimes(1);
    expect(mockApiCalls.play).not.toHaveBeenCalled();
  });

  it("does nothing when api is not available", () => {
    setMockApiAvailable(false);

    executeAction("playback.setPlaying", true, ctx);

    expect(mockApiCalls.play).not.toHaveBeenCalled();
    expect(mockApiCalls.pause).not.toHaveBeenCalled();
  });
});

// ─── stop ─────────────────────────────────────────────────────────────────────

describe("playback.stop", () => {
  it("calls api.stop when api is available", () => {
    executeAction("playback.stop", undefined, ctx);

    expect(mockApiCalls.stop).toHaveBeenCalledTimes(1);
  });

  it("updates player state to stopped via usePlayerStore", () => {
    executeAction("playback.stop", undefined, ctx);

    expect(usePlayerStore.setState).toHaveBeenCalledWith({
      playerState: "stopped",
      currentTime: 0,
    });
  });

  it("updates local state even when api is not available", () => {
    setMockApiAvailable(false);

    executeAction("playback.stop", undefined, ctx);

    // State should still be updated
    expect(usePlayerStore.setState).toHaveBeenCalledWith({
      playerState: "stopped",
      currentTime: 0,
    });
  });
});
