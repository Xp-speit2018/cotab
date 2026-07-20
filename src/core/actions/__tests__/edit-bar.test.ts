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
  beat.set("notes", new Y.Array<Y.Map<unknown>>());
  return beat;
};

vi.mock("@/core/engine", () => {
  const refs = () => (globalThis as Record<string, unknown>).__testEngineRefs as { doc: Y.Doc | null; scoreMap: Y.Map<unknown> | null; undoManager: unknown } | undefined;
  const ms = () => (globalThis as Record<string, unknown>).__testMockState as Record<string, unknown> | undefined;
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
      get selector() { return ms()?.selector; },
      get selectedBeat() { return ms()?.selectedBeat ?? null; },
      get selectedNoteIndex() { return (ms()?.selectedNoteIndex as number) ?? -1; },
      get selectionRange() { return ms()?.selectionRange ?? null; },
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
      localEditYDoc: vi.fn((fn: () => void, _nextSel?: unknown) => {
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

import { executeDocumentAction } from "@/core/actions/registry";
import {
  AutomationType,
  Clef,
  KeySignatureType,
  Ottavia,
  SimileMark,
  TripletFeel,
} from "@/core/schema";
import "@/core/actions/edit-bar";
import "@/core/actions/edit-master-bar";

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

function setSystemLayouts(): void {
  const score = getScoreMap()!;
  score.doc!.transact(() => {
    const scoreLayout = score.get("systemsLayout") as Y.Array<number>;
    scoreLayout.push([2, 3]);
    const track = (score.get("tracks") as Y.Array<Y.Map<unknown>>).get(0);
    const trackLayout = track.get("systemsLayout") as Y.Array<number>;
    trackLayout.push([1, 4]);
  });
}

function expectSystemLayoutsUnchanged(): void {
  const score = getScoreMap()!;
  expect(
    (score.get("systemsLayout") as Y.Array<number>).toArray(),
  ).toEqual([2, 3]);
  const track = (score.get("tracks") as Y.Array<Y.Map<unknown>>).get(0);
  expect(
    (track.get("systemsLayout") as Y.Array<number>).toArray(),
  ).toEqual([1, 4]);
}

describe("document.bar.insertAfter", () => {
  it("adds a masterBar and a bar to each staff", () => {
    expect(masterBarCount()).toBe(2);
    expect(staffBarCount()).toBe(2);

    executeDocumentAction("document.bar.insertAfter", {}, ctx);

    expect(masterBarCount()).toBe(3);
    expect(staffBarCount()).toBe(3);
  });

  it("inserts at the correct index (after current bar)", () => {
    const barBefore = resolveYBarHelper(0, 0, 1)!;
    const uuidBefore = barBefore.get("uuid");

    executeDocumentAction("document.bar.insertAfter", {}, ctx);

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

    executeDocumentAction("document.bar.insertAfter", {}, ctx);

    const newMb = mbs.get(1);
    expect(newMb.get("timeSignatureNumerator")).toBe(3);
    expect(newMb.get("timeSignatureDenominator")).toBe(8);
  });

  it("does nothing without selection", () => {
    selectBeat(null);
    executeDocumentAction("document.bar.insertAfter", {}, ctx);
    expect(masterBarCount()).toBe(2);
  });

  it("does not reinterpret explicit system layout", () => {
    setSystemLayouts();
    executeDocumentAction("document.bar.insertAfter", {}, ctx);
    expectSystemLayoutsUnchanged();
  });
});

describe("document.bar.insertBefore", () => {
  it("inserts a bar before the current bar", () => {
    const bar0uuid = resolveYBarHelper(0, 0, 0)!.get("uuid");

    executeDocumentAction("document.bar.insertBefore", {}, ctx);

    expect(masterBarCount()).toBe(3);
    expect(staffBarCount()).toBe(3);

    const shiftedBar = resolveYBarHelper(0, 0, 1)!;
    expect(shiftedBar.get("uuid")).toBe(bar0uuid);
  });

});

describe("document.bar.delete", () => {
  it("removes bar when bar is empty", () => {
    selectBeat({ ...defaultSel, barIndex: 1 });
    executeDocumentAction("document.bar.delete", {}, ctx);
    expect(masterBarCount()).toBe(1);
    expect(staffBarCount()).toBe(1);
  });

  it("is blocked when only 1 bar remains", () => {
    selectBeat({ ...defaultSel, barIndex: 0 });
    executeDocumentAction("document.bar.delete", {}, ctx);
    expect(masterBarCount()).toBe(1);
    expect(staffBarCount()).toBe(1);

    const result = executeDocumentAction("document.bar.delete", {}, ctx);
    expect(result).toBe(false);
  });

  it("is blocked when bar is not empty", () => {
    const yBar = resolveYBarHelper(0, 0, 0)!;
    const yVoice = (yBar.get("voices") as Y.Array<Y.Map<unknown>>).get(0);
    const yBeat = (yVoice.get("beats") as Y.Array<Y.Map<unknown>>).get(0);
    const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;

    getScoreMap()!.doc!.transact(() => {
      const yNote = new Y.Map<unknown>();
      yNote.set("fret", 3);
      yNote.set("string", 1);
      yNotes.push([yNote]);
      yBeat.set("isEmpty", false);
    });

    const result = executeDocumentAction("document.bar.delete", {}, ctx);
    expect(result).toBe(false);
    expect(masterBarCount()).toBe(2);
  });

  it("does not reinterpret explicit system layout", () => {
    setSystemLayouts();
    selectBeat({ ...defaultSel, barIndex: 1 });
    executeDocumentAction("document.bar.delete", {}, ctx);
    expectSystemLayoutsUnchanged();
  });
});

describe("document.bar field actions", () => {
  it.each([
    ["document.bar.setClef", "clef", Clef.F4],
    ["document.bar.setClefOttava", "clefOttava", Ottavia._8vb],
    ["document.bar.setSimileMark", "simileMark", SimileMark.Simple],
    ["document.bar.setKeySignature", "keySignature", -3],
    ["document.bar.setKeySignatureType", "keySignatureType", KeySignatureType.Minor],
  ] as const)("%s updates %s", (actionId, field, value) => {
    executeDocumentAction(actionId, { value }, ctx);
    expect(resolveYBarHelper(0, 0, 0)!.get(field)).toBe(value);
  });

  it("sets the key signature and mode atomically", () => {
    executeDocumentAction("document.bar.setKey", {
      keySignature: 3,
      keySignatureType: KeySignatureType.Minor,
    }, ctx);
    const bar = resolveYBarHelper(0, 0, 0)!;
    expect(bar.get("keySignature")).toBe(3);
    expect(bar.get("keySignatureType")).toBe(KeySignatureType.Minor);
  });
});

describe("document.masterBar field actions", () => {
  function masterBar(): Y.Map<unknown> {
    return (getScoreMap()!.get("masterBars") as Y.Array<Y.Map<unknown>>).get(0);
  }

  it.each([
    ["document.masterBar.setTimeSignatureNumerator", "timeSignatureNumerator", 7],
    ["document.masterBar.setTimeSignatureDenominator", "timeSignatureDenominator", 8],
    ["document.masterBar.setIsRepeatStart", "isRepeatStart", true],
    ["document.masterBar.setRepeatCount", "repeatCount", 3],
    ["document.masterBar.setAlternateEndings", "alternateEndings", 5],
    ["document.masterBar.setTripletFeel", "tripletFeel", TripletFeel.Triplet8th],
    ["document.masterBar.setIsFreeTime", "isFreeTime", true],
  ] as const)("%s updates %s", (actionId, field, value) => {
    executeDocumentAction(actionId, { value }, ctx);
    expect(masterBar().get(field)).toBe(value);
  });

  it("sets a complete time signature atomically", () => {
    executeDocumentAction("document.masterBar.setTimeSignature", {
      numerator: 7,
      denominator: 8,
    }, ctx);

    expect(masterBar().get("timeSignatureNumerator")).toBe(7);
    expect(masterBar().get("timeSignatureDenominator")).toBe(8);
  });

  it("sets and clears section", () => {
    executeDocumentAction("document.masterBar.setSection", { section: {
      text: "Verse",
      marker: "A",
    } }, ctx);
    expect((masterBar().get("section") as Y.Map<unknown>).toJSON()).toEqual({
      text: "Verse",
      marker: "A",
    });

    executeDocumentAction("document.masterBar.setSection", { section: null }, ctx);
    expect(masterBar().get("section")).toBeNull();
  });

  it("replaces tempoAutomations", () => {
    executeDocumentAction("document.masterBar.setTempoAutomations", { automations: [
      {
        isLinear: false,
        type: AutomationType.Tempo,
        value: 96,
        ratioPosition: 0.25,
        text: "Andante",
        isVisible: true,
      },
    ] }, ctx);

    const automations = masterBar().get(
      "tempoAutomations",
    ) as Y.Array<Y.Map<unknown>>;
    expect(automations.get(0).toJSON()).toEqual({
      isLinear: false,
      type: AutomationType.Tempo,
      value: 96,
      ratioPosition: 0.25,
      text: "Andante",
      isVisible: true,
    });
  });

  it("updates and removes only the tempo automation", () => {
    executeDocumentAction("document.masterBar.setTempoAutomations", { automations: [
      {
        isLinear: false,
        type: AutomationType.Volume,
        value: 12,
        ratioPosition: 0,
        text: "",
        isVisible: true,
      },
    ] }, ctx);

    executeDocumentAction("document.masterBar.setTempo", { tempo: 132 }, ctx);
    const automations = masterBar().get(
      "tempoAutomations",
    ) as Y.Array<Y.Map<unknown>>;
    expect(automations.length).toBe(2);
    expect(automations.get(0).get("type")).toBe(AutomationType.Volume);
    expect(automations.get(1).get("value")).toBe(132);

    executeDocumentAction("document.masterBar.setTempo", { tempo: null }, ctx);
    expect(automations.length).toBe(1);
    expect(automations.get(0).get("type")).toBe(AutomationType.Volume);
  });

  it("does nothing without a selected bar", () => {
    selectBeat(null);
    executeDocumentAction("document.masterBar.setRepeatCount", { value: 4 }, ctx);
    expect(masterBar().get("repeatCount")).toBe(0);
  });
});
