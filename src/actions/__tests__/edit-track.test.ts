import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Y from "yjs";
import {
  resetMockState,
  selectBeat,
  setMockApiScore,
  seedOneTrackScore,
  seedTrackWithConfig,
  buildMockAlphaTabScore,
  testContext,
  initDoc,
  destroyDoc,
  getScoreMap,
  transact,
  resolveYTrackHelper,
} from "@/test/setup";

// Inline factory helpers to avoid module resolution issues in hoisted mock
const _createYMap = () => new Y.Map<unknown>();
const _createBar = (clef?: number) => {
  const bar = _createYMap();
  bar.set("clef", clef ?? 4);
  bar.set("voices", new Y.Array<Y.Map<unknown>>());
  bar.set("uuid", `bar-${Math.random().toString(36).slice(2)}`);
  return bar;
};
const _createVoice = () => {
  const voice = _createYMap();
  voice.set("beats", new Y.Array<Y.Map<unknown>>());
  return voice;
};
const _createBeat = (duration?: number) => {
  const beat = _createYMap();
  beat.set("duration", duration ?? 4);
  beat.set("isEmpty", true);
  beat.set("isRest", false);
  beat.set("notes", new Y.Array<Y.Map<unknown>>());
  return beat;
};
const _createTrack = (name?: string) => {
  const track = _createYMap();
  track.set("name", name ?? "Track");
  track.set("staves", new Y.Array<Y.Map<unknown>>());
  track.set("playbackProgram", 24);
  return track;
};

vi.mock("@/core/engine", () => {
  const refs = () => (globalThis as Record<string, unknown>).__testEngineRefs as { doc: Y.Doc | null; scoreMap: Y.Map<unknown> | null; undoManager: unknown } | undefined;
  return {
    engine: {
      resolveYTrack: vi.fn((idx: number) => {
        const sm = refs()?.scoreMap; if (!sm) return null;
        const tracks = sm.get("tracks") as Y.Array<Y.Map<unknown>> | undefined;
        if (!tracks || idx < 0 || idx >= tracks.length) return null;
        return tracks.get(idx);
      }),
      getScoreMap: vi.fn(() => refs()?.scoreMap ?? null),
      localEditYDoc: vi.fn((fn: () => void) => {
        const d = refs()?.doc; if (d) d.transact(fn, d.clientID);
      }),
    },
    EditorEngine: {
      pushDefaultBar: vi.fn((yBars: Y.Array<Y.Map<unknown>>, index?: number, clef?: number) => {
        const bar = _createBar(clef);
        if (index !== undefined) yBars.insert(index, [bar]); else yBars.push([bar]);
        const intBar = yBars.get(index ?? yBars.length - 1);
        const voices = intBar.get("voices") as Y.Array<Y.Map<unknown>>;
        voices.push([_createVoice()]);
        const intVoice = voices.get(0);
        (intVoice.get("beats") as Y.Array<Y.Map<unknown>>).push([_createBeat()]);
        return intBar;
      }),
    },
    importTrack: vi.fn(() => _createTrack("Imported")),
    FILE_IMPORT_ORIGIN: "file-import",
  };
});

// Use a mutable variable that both the mock and tests can access
let _mockScoreRef: unknown = null;

// Mock render-store for edit-track.ts (setState must be available)
vi.mock("@/stores/render-store", () => {
  const ms = () => (globalThis as Record<string, unknown>).__testMockState as Record<string, unknown> | undefined;
  const mockGetState = vi.fn(() => {
    const s = ms();
    return {
      selectedBeat: s?.selectedBeat ?? null,
      selectionRange: s?.selectionRange ?? null,
      selectedNoteIndex: s?.selectedNoteIndex ?? -1,
      visibleTrackIndices: s?.visibleTrackIndices ?? [0],
      addTrackDialogOpen: s?.addTrackDialogOpen ?? false,
      ...(s?.storeOverrides ?? {}),
    };
  });
  const mockSetState = vi.fn((partial: Record<string, unknown>) => {
    const s = ms();
    if (!s) return;
    if ("selectedBeat" in partial) s.selectedBeat = partial.selectedBeat;
    if ("selectionRange" in partial) s.selectionRange = partial.selectionRange;
    if ("selectedNoteIndex" in partial) s.selectedNoteIndex = partial.selectedNoteIndex;
    if ("visibleTrackIndices" in partial) s.visibleTrackIndices = partial.visibleTrackIndices;
    if ("addTrackDialogOpen" in partial) s.addTrackDialogOpen = partial.addTrackDialogOpen;
    Object.assign(s.storeOverrides, partial);
  });
  const mockSubscribe = vi.fn(() => vi.fn());
  return {
    usePlayerStore: Object.assign(
      vi.fn(() => mockGetState()),
      {
        getState: mockGetState,
        setState: mockSetState,
        subscribe: mockSubscribe,
      }
    ),
  };
});

// Mock render-internals for edit-track.ts
vi.mock("@/stores/render-internals", () => ({
  createTrackFromPreset: vi.fn((_score: unknown, preset: { id: string; defaultName: string }) => ({
    name: preset.defaultName,
    staves: [{ showTablature: true }],
  })),
  getApi: vi.fn(() => {
    if (_mockScoreRef) {
      return {
        score: _mockScoreRef,
        renderTracks: vi.fn(),
      };
    }
    return null;
  }),
  setPendingSelection: vi.fn(),
  getPendingSelection: vi.fn(() => null),
  TRACK_PRESETS: [
    { id: "guitar", defaultName: "Guitar", program: 24, tuning: [40, 45, 50, 55, 59, 64] },
    { id: "bass", defaultName: "Bass", program: 33, tuning: [28, 33, 38, 43] },
    { id: "drums", defaultName: "Drums", program: 0, isPercussion: true },
  ],
}));

import { EditorEngine } from "@/core/engine";
import { createTrack, createStaff } from "@/core/schema";
import { executeAction } from "@/actions/registry";
import "@/actions/edit-bar";
import "@/actions/edit-track";

const defaultSel = {
  trackIndex: 0,
  staffIndex: 0,
  barIndex: 0,
  voiceIndex: 0,
  beatIndex: 0,
  string: 1 as number | null,
};
const ctx = testContext();

function trackCount(): number {
  return (getScoreMap()!.get("tracks") as Y.Array<unknown>).length;
}

function setupMockScore(trackNames: string[] = ["Guitar"]) {
  const score = buildMockAlphaTabScore({
    tracks: trackNames.map(() => ({
      staves: [{ showTablature: true, bars: [{ voices: [{ beats: [{ notes: [], isEmpty: true }] }] }] }],
    })),
  });
  setMockApiScore(score);
  _mockScoreRef = score;
}

beforeEach(() => {
  resetMockState();
  destroyDoc();
  initDoc();
  seedOneTrackScore(getScoreMap()!, 1);
  selectBeat(defaultSel);
});

describe("edit.track.setName", () => {
  it("updates track name in Y.Doc", () => {
    const result = executeAction("edit.track.setName", { trackIndex: 0, name: "Lead Guitar" }, ctx);
    expect(resolveYTrackHelper(0)!.get("name")).toBe("Lead Guitar");
  });

  it("does nothing for invalid index", () => {
    executeAction("edit.track.setName", { trackIndex: 99, name: "Nope" }, ctx);
    expect(resolveYTrackHelper(0)!.get("name")).toBe("Test Guitar");
  });
});

describe("edit.track.setShortName", () => {
  it("updates shortName in Y.Doc", () => {
    executeAction("edit.track.setShortName", { trackIndex: 0, shortName: "Gtr" }, ctx);
    expect(resolveYTrackHelper(0)!.get("shortName")).toBe("Gtr");
  });
});

describe("edit.track.setProgram", () => {
  it("updates playbackProgram in Y.Doc", () => {
    executeAction("edit.track.setProgram", { trackIndex: 0, program: 30 }, ctx);
    expect(resolveYTrackHelper(0)!.get("playbackProgram")).toBe(30);
  });
});

describe("edit.track.delete", () => {
  beforeEach(() => {
    const scoreMap = getScoreMap()!;
    scoreMap.doc!.transact(() => {
      const yTracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;
      yTracks.push([createTrack("Bass")]);
      const intTrack = yTracks.get(yTracks.length - 1);
      const staves = intTrack.get("staves") as Y.Array<Y.Map<unknown>>;
      staves.push([createStaff()]);
      const intStaff = staves.get(0);
      const bars = intStaff.get("bars") as Y.Array<Y.Map<unknown>>;
      EditorEngine.pushDefaultBar(bars);
    });

    setupMockScore(["Guitar", "Bass"]);
  });

  it("removes track from Y.Array", () => {
    expect(trackCount()).toBe(2);
    executeAction("edit.track.delete", 1, ctx);
    expect(trackCount()).toBe(1);
    expect(resolveYTrackHelper(0)!.get("name")).toBe("Test Guitar");
  });

  it("is blocked when only 1 track remains", () => {
    // Reset to single track state
    resetMockState();
    destroyDoc();
    initDoc();
    seedOneTrackScore(getScoreMap()!, 1);
    setupMockScore(["Guitar"]);

    expect(trackCount()).toBe(1);
    const result = executeAction("edit.track.delete", 0, ctx);
    expect(result).toBe(false);
    expect(trackCount()).toBe(1);
  });

  it("returns false for invalid track index", () => {
    const result = executeAction("edit.track.delete", 99, ctx);
    expect(result).toBe(false);
  });
});

describe("edit.track.setName (all track types)", () => {
  it("updates violin track name", () => {
    resetMockState();
    destroyDoc();
    initDoc();
    seedTrackWithConfig(getScoreMap()!, 1, { name: "Violin", tuning: [55, 62, 69, 76] });
    setMockApiScore(buildMockAlphaTabScore({
      tracks: [{ staves: [{ showTablature: true, tuning: [55, 62, 69, 76], bars: [{ voices: [{ beats: [{ notes: [], isEmpty: true }] }] }] }] }],
    }));
    selectBeat({ ...defaultSel, string: 2 as number | null });

    executeAction("edit.track.setName", { trackIndex: 0, name: "Solo Violin" }, ctx);
    expect(resolveYTrackHelper(0)!.get("name")).toBe("Solo Violin");
  });

  it("updates piano track name", () => {
    resetMockState();
    destroyDoc();
    initDoc();
    seedTrackWithConfig(getScoreMap()!, 1, { name: "Piano", showTablature: false });
    setMockApiScore(buildMockAlphaTabScore({
      tracks: [{ staves: [{ showTablature: false, tuning: [], bars: [{ voices: [{ beats: [{ notes: [], isEmpty: true }] }] }] }] }],
    }));
    selectBeat(defaultSel);

    executeAction("edit.track.setName", { trackIndex: 0, name: "Grand Piano" }, ctx);
    expect(resolveYTrackHelper(0)!.get("name")).toBe("Grand Piano");
  });

  it("updates drumkit track name", () => {
    resetMockState();
    destroyDoc();
    initDoc();
    seedTrackWithConfig(getScoreMap()!, 1, { name: "Drums", isPercussion: true });
    setMockApiScore(buildMockAlphaTabScore({
      tracks: [{ isPercussion: true, staves: [{ showTablature: false, tuning: [], bars: [{ voices: [{ beats: [{ notes: [], isEmpty: true }] }] }] }] }],
    }));
    selectBeat(defaultSel);

    executeAction("edit.track.setName", { trackIndex: 0, name: "Kit" }, ctx);
    expect(resolveYTrackHelper(0)!.get("name")).toBe("Kit");
  });
});

describe("edit.track.add", () => {
  it("pushes a new Y.Map track via direct transact", () => {
    const scoreMap = getScoreMap()!;
    const tracksBefore = trackCount();

    transact(() => {
      const yTracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;
      yTracks.push([createTrack("Piano")]);
      const intTrack = yTracks.get(yTracks.length - 1);
      const staves = intTrack.get("staves") as Y.Array<Y.Map<unknown>>;
      staves.push([createStaff()]);
      const intStaff = staves.get(0);
      const bars = intStaff.get("bars") as Y.Array<Y.Map<unknown>>;
      EditorEngine.pushDefaultBar(bars);
    });

    expect(trackCount()).toBe(tracksBefore + 1);
    expect(resolveYTrackHelper(tracksBefore)!.get("name")).toBe("Piano");
  });
});
