import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Y from "yjs";
import {
  resetMockState,
  selectBeat,
  seedOneTrackScore,
  testContext,
  initDoc,
  destroyDoc,
  getScoreMap,
  resolveYBarHelper,
  pushDefaultBarHelper,
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

vi.mock("@/core/engine", () => {
  const refs = () => (globalThis as Record<string, unknown>).__testEngineRefs as { doc: Y.Doc | null; scoreMap: Y.Map<unknown> | null; undoManager: unknown } | undefined;
  const resolve = (path: number[]) => {
    const sm = refs()?.scoreMap; if (!sm) return null;
    let node: Y.Map<unknown> | null = null;
    const keys = ["tracks", "staves", "bars", "voices", "beats", "notes"];
    for (let i = 0; i < path.length; i++) {
      const arr = (i === 0 ? sm : node!).get(keys[i]) as Y.Array<Y.Map<unknown>> | undefined;
      if (!arr || path[i] < 0 || path[i] >= arr.length) return null;
      node = arr.get(path[i]);
    }
    return node;
  };
  return {
    engine: {
      resolveYTrack: vi.fn((t: number) => resolve([t])),
      resolveYStaff: vi.fn((t: number, s: number) => resolve([t, s])),
      resolveYBar: vi.fn((t: number, s: number, b: number) => resolve([t, s, b])),
      resolveYVoice: vi.fn((t: number, s: number, b: number, v: number) => resolve([t, s, b, v])),
      resolveYBeat: vi.fn((t: number, s: number, b: number, v: number, bt: number) => resolve([t, s, b, v, bt])),
      resolveYNote: vi.fn((t: number, s: number, b: number, v: number, bt: number, n: number) => resolve([t, s, b, v, bt, n])),
      resolveYMasterBar: vi.fn((idx: number) => {
        const sm = refs()?.scoreMap; if (!sm) return null;
        const mbs = sm.get("masterBars") as Y.Array<Y.Map<unknown>> | undefined;
        if (!mbs || idx < 0 || idx >= mbs.length) return null;
        return mbs.get(idx);
      }),
      getScoreMap: vi.fn(() => refs()?.scoreMap ?? null),
      getUndoManager: vi.fn(() => refs()?.undoManager ?? null),
      localEditYDoc: vi.fn((fn: () => void) => {
        const r = refs();
        const d = r?.doc;
        if (d) {
          d.transact(fn, d.clientID);
        } else {
          // Fallback: execute without transaction for tests that don't init doc
          fn();
        }
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
    importTrack: vi.fn(),
    FILE_IMPORT_ORIGIN: "file-import",
  };
});

import { executeAction } from "@/actions/registry";
import { isBarEmptyAllTracks } from "@/stores/render-internals";
import "@/actions/edit-bar";

const defaultSel = {
  trackIndex: 0,
  staffIndex: 0,
  barIndex: 0,
  voiceIndex: 0,
  beatIndex: 0,
  string: 1 as number | null,
};
const ctx = testContext();

beforeEach(() => {
  resetMockState();
  destroyDoc();
  initDoc();
  seedOneTrackScore(getScoreMap()!, 2);
  selectBeat(defaultSel);
  (isBarEmptyAllTracks as ReturnType<typeof vi.fn>).mockReturnValue(true);
});

function masterBarCount(): number {
  return (getScoreMap()!.get("masterBars") as Y.Array<unknown>).length;
}

function staffBarCount(trackIdx = 0, staffIdx = 0): number {
  const tracks = getScoreMap()!.get("tracks") as Y.Array<Y.Map<unknown>>;
  const staves = tracks.get(trackIdx).get("staves") as Y.Array<Y.Map<unknown>>;
  const bars = staves.get(staffIdx).get("bars") as Y.Array<Y.Map<unknown>>;
  return bars.length;
}

describe("edit.bar.insertAfter", () => {
  it("adds a masterBar and a bar to each staff", () => {
    expect(masterBarCount()).toBe(2);
    expect(staffBarCount()).toBe(2);

    executeAction("edit.bar.insertAfter", undefined, ctx);

    expect(masterBarCount()).toBe(3);
    expect(staffBarCount()).toBe(3);
  });

  it("inserts at the correct index (after current bar)", () => {
    const barBefore = resolveYBarHelper(0, 0, 1)!;
    const uuidBefore = barBefore.get("uuid");

    executeAction("edit.bar.insertAfter", undefined, ctx);

    const barAtIdx1 = resolveYBarHelper(0, 0, 1)!;
    expect(barAtIdx1.get("uuid")).not.toBe(uuidBefore);

    const barAtIdx2 = resolveYBarHelper(0, 0, 2)!;
    expect(barAtIdx2.get("uuid")).toBe(uuidBefore);
  });

  it("new bar inherits time signature from reference bar", () => {
    const scoreMap = getScoreMap()!;
    const mbs = scoreMap.get("masterBars") as Y.Array<Y.Map<unknown>>;
    scoreMap.doc!.transact(() => {
      mbs.get(0).set("timeSignatureNumerator", 3);
      mbs.get(0).set("timeSignatureDenominator", 8);
    });

    executeAction("edit.bar.insertAfter", undefined, ctx);

    const newMb = mbs.get(1);
    expect(newMb.get("timeSignatureNumerator")).toBe(3);
    expect(newMb.get("timeSignatureDenominator")).toBe(8);
  });

  it("does nothing without selection", () => {
    selectBeat(null);
    executeAction("edit.bar.insertAfter", undefined, ctx);
    expect(masterBarCount()).toBe(2);
  });
});

describe("edit.bar.insertBefore", () => {
  it("inserts a bar before the current bar", () => {
    const bar0uuid = resolveYBarHelper(0, 0, 0)!.get("uuid");

    executeAction("edit.bar.insertBefore", undefined, ctx);

    expect(masterBarCount()).toBe(3);
    expect(staffBarCount()).toBe(3);

    const shiftedBar = resolveYBarHelper(0, 0, 1)!;
    expect(shiftedBar.get("uuid")).toBe(bar0uuid);
  });

});

describe("edit.bar.delete", () => {
  it("removes bar when bar is empty", () => {
    selectBeat({ ...defaultSel, barIndex: 1 });
    executeAction("edit.bar.delete", undefined, ctx);
    expect(masterBarCount()).toBe(1);
    expect(staffBarCount()).toBe(1);
  });

  it("is blocked when only 1 bar remains", () => {
    selectBeat({ ...defaultSel, barIndex: 0 });
    executeAction("edit.bar.delete", undefined, ctx);
    expect(masterBarCount()).toBe(1);
    expect(staffBarCount()).toBe(1);

    const result = executeAction("edit.bar.delete", undefined, ctx);
    expect(result).toBe(false);
  });

  it("is blocked when bar is not empty", () => {
    (isBarEmptyAllTracks as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const result = executeAction("edit.bar.delete", undefined, ctx);
    expect(result).toBe(false);
    expect(masterBarCount()).toBe(2);
  });
});
