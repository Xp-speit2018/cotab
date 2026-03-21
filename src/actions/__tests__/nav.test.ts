import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Y from "yjs";
import {
  resetMockState,
  seedOneTrackScore,
  testContext,
  initDoc,
  destroyDoc,
  getScoreMap,
  addBeatsDirectly,
  seedTrackWithConfig,
} from "@/test/setup";
import { createStaff, createBar, createVoice, createBeat } from "@/core/schema";

// Track localSetSelection calls
let lastSelection: Record<string, unknown> | null = null;

vi.mock("@/core/engine", () => {
  const refs = () =>
    (globalThis as Record<string, unknown>).__testEngineRefs as
      | { doc: Y.Doc | null; scoreMap: Y.Map<unknown> | null; undoManager: unknown }
      | undefined;
  const resolve = (path: number[]) => {
    const sm = refs()?.scoreMap;
    if (!sm) return null;
    let node: Y.Map<unknown> | null = null;
    const keys = ["tracks", "staves", "bars", "voices", "beats", "notes"];
    for (let i = 0; i < path.length; i++) {
      const arr = (i === 0 ? sm : node!).get(keys[i]) as Y.Array<Y.Map<unknown>> | undefined;
      if (!arr || path[i] < 0 || path[i] >= arr.length) return null;
      node = arr.get(path[i]);
    }
    return node;
  };

  // Create engine object with selectedBeat getter that reads from mock state
  const engineObj = {
    resolveYTrack: vi.fn((t: number) => resolve([t])),
    resolveYStaff: vi.fn((t: number, s: number) => resolve([t, s])),
    resolveYBar: vi.fn((t: number, s: number, b: number) => resolve([t, s, b])),
    resolveYVoice: vi.fn((t: number, s: number, b: number, v: number) =>
      resolve([t, s, b, v]),
    ),
    resolveYBeat: vi.fn((t: number, s: number, b: number, v: number, bt: number) =>
      resolve([t, s, b, v, bt]),
    ),
    resolveYNote: vi.fn((t: number, s: number, b: number, v: number, bt: number, n: number) =>
      resolve([t, s, b, v, bt, n]),
    ),
    getScoreMap: vi.fn(() => refs()?.scoreMap ?? null),
    getUndoManager: vi.fn(() => refs()?.undoManager ?? null),
    localEditYDoc: vi.fn((fn: () => void) => {
      const d = refs()?.doc;
      if (d) d.transact(fn, d.clientID);
    }),
    localSetSelection: vi.fn((sel: Record<string, unknown>) => {
      lastSelection = sel;
      // Also update mock state for subsequent reads
      const ms = (globalThis as Record<string, unknown>).__testMockState as Record<
        string,
        unknown
      >;
      if (ms) ms.selectedBeat = sel;
    }),
    // Getter for selectedBeat that reads from mock state
    get selectedBeat() {
      const ms = (globalThis as Record<string, unknown>).__testMockState as Record<
        string,
        unknown
      >;
      return (ms?.selectedBeat as Record<string, unknown> | undefined) ?? null;
    },
    set selectedBeat(val: Record<string, unknown> | null) {
      const ms = (globalThis as Record<string, unknown>).__testMockState as Record<
        string,
        unknown
      >;
      if (ms) ms.selectedBeat = val;
    },
  };

  return { engine: engineObj };
});

// Mock the render-store for computeNextStaff/computePrevStaff
vi.mock("@/stores/render-store", () => ({
  usePlayerStore: {
    getState: vi.fn(() => ({
      visibleTrackIndices: [0],
    })),
  },
}));

import { executeAction } from "@/actions/registry";
import {
  computeNextBeat,
  computePrevBeat,
  computeMoveUp,
  computeMoveDown,
  computeNextBar,
  computePrevBar,
  computeNextStaff,
  computePrevStaff,
} from "@/components/navigation/navigation-helpers";
import "@/actions/navigation";

const defaultSel = {
  trackIndex: 0,
  staffIndex: 0,
  barIndex: 0,
  voiceIndex: 0,
  beatIndex: 0,
  string: 3 as number | null,
};

const ctx = testContext();

beforeEach(() => {
  resetMockState();
  destroyDoc();
  initDoc();
  lastSelection = null;
});

// ─── nav.setSelection ─────────────────────────────────────────────────────────

describe("nav.setSelection", () => {
  beforeEach(() => {
    seedOneTrackScore(getScoreMap()!, 2);
  });

  it("sets selection to target", () => {
    const target = { ...defaultSel, beatIndex: 1 };

    executeAction("nav.setSelection", target, ctx);

    expect(lastSelection).toMatchObject({
      trackIndex: 0,
      staffIndex: 0,
      barIndex: 0,
      voiceIndex: 0,
      beatIndex: 1,
      string: 3,
    });
  });

  it("does nothing with null target", () => {
    executeAction("nav.setSelection", null as unknown as typeof defaultSel, ctx);
    expect(lastSelection).toBeNull();
  });
});

// ─── computeNextBeat ─────────────────────────────────────────────────────────

describe("computeNextBeat", () => {
  beforeEach(() => {
    seedOneTrackScore(getScoreMap()!, 2);
  });

  it("computes next beat in same bar", () => {
    addBeatsDirectly(getScoreMap()!, 0, 0, 2);

    const target = computeNextBeat(defaultSel);

    expect(target).toMatchObject({
      trackIndex: 0,
      staffIndex: 0,
      barIndex: 0,
      voiceIndex: 0,
      beatIndex: 1,
      string: 3,
    });
  });

  it("computes first beat of next bar when at last beat", () => {
    addBeatsDirectly(getScoreMap()!, 0, 0, 1);
    const sel = { ...defaultSel, beatIndex: 1 };

    const target = computeNextBeat(sel);

    expect(target).toMatchObject({
      barIndex: 1,
      beatIndex: 0,
    });
  });

  it("returns null when at last beat of last bar", () => {
    const sel = { ...defaultSel, barIndex: 1 };

    const target = computeNextBeat(sel);

    expect(target).toBeNull();
  });
});

// ─── computePrevBeat ─────────────────────────────────────────────────────────

describe("computePrevBeat", () => {
  beforeEach(() => {
    seedOneTrackScore(getScoreMap()!, 2);
    addBeatsDirectly(getScoreMap()!, 0, 0, 2);
    addBeatsDirectly(getScoreMap()!, 0, 1, 2);
  });

  it("computes previous beat in same bar", () => {
    const sel = { ...defaultSel, beatIndex: 1 };

    const target = computePrevBeat(sel);

    expect(target).toMatchObject({
      barIndex: 0,
      beatIndex: 0,
    });
  });

  it("computes last beat of previous bar when at first beat", () => {
    const sel = { ...defaultSel, barIndex: 1, beatIndex: 0 };

    const target = computePrevBeat(sel);

    expect(target).toMatchObject({
      barIndex: 0,
      beatIndex: 2,
    });
  });

  it("returns null when at first beat of first bar", () => {
    const target = computePrevBeat(defaultSel);
    expect(target).toBeNull();
  });
});

// ─── computeMoveUp ────────────────────────────────────────────────────────────

describe("computeMoveUp", () => {
  beforeEach(() => {
    seedOneTrackScore(getScoreMap()!, 1);
  });

  it("computes move from string 3 to string 4", () => {
    const sel = { ...defaultSel, string: 3 };

    const target = computeMoveUp(sel);

    expect(target).toMatchObject({
      string: 4,
    });
  });

  it("returns null at string 6 (lowest on guitar)", () => {
    const sel = { ...defaultSel, string: 6 };

    const target = computeMoveUp(sel);

    expect(target).toBeNull();
  });

  it("places on middle+1 string when string is null", () => {
    const sel = { ...defaultSel, string: null };

    const target = computeMoveUp(sel);

    // 6 strings, middle is ceil(6/2) = 3, then +1 = 4, clamped to min(6, 4) = 4
    expect(target).toMatchObject({
      string: 4,
    });
  });

  it("respects 4-string violin tuning", () => {
    resetMockState();
    destroyDoc();
    initDoc();
    seedTrackWithConfig(getScoreMap()!, 1, {
      name: "Violin",
      tuning: [55, 62, 69, 76],
    });
    const sel = { ...defaultSel, string: 3 };

    const target = computeMoveUp(sel);

    expect(target).toMatchObject({
      string: 4,
    });
  });
});

// ─── computeMoveDown ──────────────────────────────────────────────────────────

describe("computeMoveDown", () => {
  beforeEach(() => {
    seedOneTrackScore(getScoreMap()!, 1);
  });

  it("computes move from string 3 to string 2", () => {
    const sel = { ...defaultSel, string: 3 };

    const target = computeMoveDown(sel);

    expect(target).toMatchObject({
      string: 2,
    });
  });

  it("computes move from string 6 to string 5 on guitar", () => {
    const sel = { ...defaultSel, string: 6 };

    const target = computeMoveDown(sel);

    expect(target).toMatchObject({
      string: 5,
    });
  });

  it("returns null at string 1 (highest)", () => {
    const sel = { ...defaultSel, string: 1 };

    const target = computeMoveDown(sel);

    expect(target).toBeNull();
  });

  it("places on middle-1 string when string is null", () => {
    const sel = { ...defaultSel, string: null };

    const target = computeMoveDown(sel);

    // 6 strings, middle is ceil(6/2) = 3, then -1 = 2, clamped to max(1, 2) = 2
    expect(target).toMatchObject({
      string: 2,
    });
  });

  it("respects 4-string violin tuning", () => {
    resetMockState();
    destroyDoc();
    initDoc();
    seedTrackWithConfig(getScoreMap()!, 1, {
      name: "Violin",
      tuning: [55, 62, 69, 76],
    });
    const sel = { ...defaultSel, string: 2 };

    const target = computeMoveDown(sel);

    expect(target).toMatchObject({
      string: 1,
    });

    const sel2 = { ...defaultSel, string: 1 };
    const target2 = computeMoveDown(sel2);
    expect(target2).toBeNull();
  });
});

// ─── computeNextBar ───────────────────────────────────────────────────────────

describe("computeNextBar", () => {
  beforeEach(() => {
    seedOneTrackScore(getScoreMap()!, 3);
  });

  it("computes jump to first beat of next bar", () => {
    const target = computeNextBar(defaultSel);

    expect(target).toMatchObject({
      barIndex: 1,
      beatIndex: 0,
    });
  });

  it("returns null at last bar", () => {
    const sel = { ...defaultSel, barIndex: 2 };

    const target = computeNextBar(sel);

    expect(target).toBeNull();
  });
});

// ─── computePrevBar ───────────────────────────────────────────────────────────

describe("computePrevBar", () => {
  beforeEach(() => {
    seedOneTrackScore(getScoreMap()!, 3);
    addBeatsDirectly(getScoreMap()!, 0, 0, 2);
    addBeatsDirectly(getScoreMap()!, 0, 1, 2);
    addBeatsDirectly(getScoreMap()!, 0, 2, 2);
  });

  it("computes jump to last beat of previous bar", () => {
    const sel = { ...defaultSel, barIndex: 1 };

    const target = computePrevBar(sel);

    expect(target).toMatchObject({
      barIndex: 0,
      beatIndex: 2,
    });
  });

  it("returns null at first bar", () => {
    const target = computePrevBar(defaultSel);
    expect(target).toBeNull();
  });
});

// ─── computeNextStaff ─────────────────────────────────────────────────────────

describe("computeNextStaff", () => {
  beforeEach(() => {
    seedOneTrackScore(getScoreMap()!, 2);

    // Add a second staff to track 0 using schema helpers
    const scoreMap = getScoreMap()!;
    const doc = scoreMap.doc!;
    doc.transact(() => {
      const tracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;
      const track = tracks.get(0);
      const staves = track.get("staves") as Y.Array<Y.Map<unknown>>;

      // Add second staff with one bar using proper schema helpers
      staves.push([createStaff()]);
      const newStaff = staves.get(1);
      const newStaffBars = newStaff.get("bars") as Y.Array<Y.Map<unknown>>;

      // Add one bar to second staff
      newStaffBars.push([createBar()]);
      const bar = newStaffBars.get(0);
      const voices = bar.get("voices") as Y.Array<Y.Map<unknown>>;
      voices.push([createVoice()]);
      const voice = voices.get(0);
      const beats = voice.get("beats") as Y.Array<Y.Map<unknown>>;
      beats.push([createBeat()]);
    });
  });

  it("computes move from staff 0 to staff 1", () => {
    const target = computeNextStaff(defaultSel);

    expect(target).toMatchObject({
      trackIndex: 0,
      staffIndex: 1,
      barIndex: 0,
      beatIndex: 0,
      string: null,
    });
  });

  it("clamps barIndex if target staff has fewer bars", () => {
    const sel = { ...defaultSel, barIndex: 1 };

    const target = computeNextStaff(sel);

    expect(target).toMatchObject({
      staffIndex: 1,
      barIndex: 0,
    });
  });

  it("returns null when at last staff of last visible track", () => {
    const sel = { ...defaultSel, staffIndex: 1 };

    const target = computeNextStaff(sel);

    expect(target).toBeNull();
  });
});

// ─── computePrevStaff ─────────────────────────────────────────────────────────

describe("computePrevStaff", () => {
  beforeEach(() => {
    seedOneTrackScore(getScoreMap()!, 2);

    // Add a second staff to track 0
    const scoreMap = getScoreMap()!;
    const doc = scoreMap.doc!;
    doc.transact(() => {
      const tracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;
      const track = tracks.get(0);
      const staves = track.get("staves") as Y.Array<Y.Map<unknown>>;

      const staff = new Y.Map<unknown>();
      staff.set("uuid", `staff-${Math.random().toString(36).slice(2)}`);
      staff.set("bars", new Y.Array<Y.Map<unknown>>());
      const tuning = new Y.Array<number>();
      tuning.push([40, 45, 50, 55, 59, 64]);
      staff.set("tuning", tuning);
      staff.set("showStandardNotation", true);
      staff.set("showTablature", true);

      staves.push([staff]);

      const newStaff = staves.get(1);
      const newStaffBars = newStaff.get("bars") as Y.Array<Y.Map<unknown>>;
      const bar = new Y.Map<unknown>();
      bar.set("uuid", `bar-${Math.random().toString(36).slice(2)}`);
      bar.set("clef", 4);
      bar.set("voices", new Y.Array<Y.Map<unknown>>());
      newStaffBars.push([bar]);

      const intBar = newStaffBars.get(0);
      const voices = intBar.get("voices") as Y.Array<Y.Map<unknown>>;
      voices.push([new Y.Map<unknown>()]);

      const intVoice = voices.get(0);
      intVoice.set("beats", new Y.Array<Y.Map<unknown>>());

      const beats = intVoice.get("beats") as Y.Array<Y.Map<unknown>>;
      const newBeat = new Y.Map<unknown>();
      newBeat.set("duration", 4);
      newBeat.set("isEmpty", true);
      newBeat.set("isRest", false);
      newBeat.set("notes", new Y.Array<Y.Map<unknown>>());
      beats.push([newBeat]);
    });
  });

  it("computes move from staff 1 to staff 0", () => {
    const sel = { ...defaultSel, staffIndex: 1 };

    const target = computePrevStaff(sel);

    expect(target).toMatchObject({
      trackIndex: 0,
      staffIndex: 0,
      barIndex: 0,
      beatIndex: 0,
      string: null,
    });
  });

  it("returns null when at first staff of first visible track", () => {
    const target = computePrevStaff(defaultSel);
    expect(target).toBeNull();
  });
});
