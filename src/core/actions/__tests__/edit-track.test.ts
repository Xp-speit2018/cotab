import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Y from "yjs";
import {
  resetMockState,
  selectBeat,
  seedOneTrackScore,
  seedTrackWithConfig,
  testContext,
  initDoc,
  destroyDoc,
  getScoreMap,
  transact,
  resolveYTrackHelper,
} from "@tests/unit/setup";

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
const _createTrack = (name?: string) => {
  const track = _createYMap();
  track.set("name", name ?? "Track");
  track.set("staves", new Y.Array<Y.Map<unknown>>());
  const playbackInfo = _createYMap();
  playbackInfo.set("program", 24);
  track.set("playbackInfo", playbackInfo);
  return track;
};

vi.mock("@/core/engine", () => {
  const refs = () => (globalThis as Record<string, unknown>).__testEngineRefs as { doc: Y.Doc | null; scoreMap: Y.Map<unknown> | null; undoManager: unknown } | undefined;
  const ms = () => (globalThis as Record<string, unknown>).__testMockState as Record<string, unknown> | undefined;
  return {
    engine: {
      get selector() { return ms()?.selector; },
      get selectedBeat() { return ms()?.selectedBeat ?? null; },
      get selectedNoteIndex() { return (ms()?.selectedNoteIndex as number) ?? -1; },
      get selectionRange() { return ms()?.selectionRange ?? null; },
      resolveYTrack: vi.fn((idx: number) => {
        const sm = refs()?.scoreMap; if (!sm) return null;
        const tracks = sm.get("tracks") as Y.Array<Y.Map<unknown>> | undefined;
        if (!tracks || idx < 0 || idx >= tracks.length) return null;
        return tracks.get(idx);
      }),
      getScoreMap: vi.fn(() => refs()?.scoreMap ?? null),
      localEditYDoc: vi.fn((fn: () => void, _nextSel?: unknown) => {
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

import { EditorEngine } from "@/core/engine";
import { createTrack, createStaff } from "@/core/schema";
import {
  DocumentActionArgumentsError,
  executeDocumentAction,
  executeDocumentActionById,
} from "@/core/actions/registry";
import "@/core/actions/edit-bar";
import "@/core/actions/edit-track";

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

beforeEach(() => {
  resetMockState();
  destroyDoc();
  initDoc();
  seedOneTrackScore(getScoreMap()!, 1);
  selectBeat(defaultSel);
});

describe("document.track.setName", () => {
  it("updates track name in Y.Doc", () => {
    const result = executeDocumentAction("document.track.setName", { trackIndex: 0, name: "Lead Guitar" }, ctx);
    expect(resolveYTrackHelper(0)!.get("name")).toBe("Lead Guitar");
  });

  it("does nothing for invalid index", () => {
    executeDocumentAction("document.track.setName", { trackIndex: 99, name: "Nope" }, ctx);
    expect(resolveYTrackHelper(0)!.get("name")).toBe("Test Guitar");
  });
});

describe("document.track.setShortName", () => {
  it("updates shortName in Y.Doc", () => {
    executeDocumentAction("document.track.setShortName", { trackIndex: 0, shortName: "Gtr" }, ctx);
    expect(resolveYTrackHelper(0)!.get("shortName")).toBe("Gtr");
  });
});

describe("document.track.setColor", () => {
  it("updates the AlphaTab ARGB color atomically", () => {
    executeDocumentAction("document.track.setColor", {
      trackIndex: 0,
      raw: -13408615,
    }, ctx);
    const color = resolveYTrackHelper(0)!.get("color") as Y.Map<unknown>;
    expect(color.get("raw")).toBe(-13408615);
  });

  it("rejects values outside the signed 32-bit color range", () => {
    expect(() => executeDocumentActionById(
      "document.track.setColor",
      { trackIndex: 0, raw: 2147483648 },
      ctx,
    )).toThrow(DocumentActionArgumentsError);
  });
});

describe("track system layout actions", () => {
  function resetSystemLayoutScore(barCount = 12) {
    destroyDoc();
    initDoc();
    seedOneTrackScore(getScoreMap()!, barCount);
  }

  it("updates the default and explicit system layout", () => {
    executeDocumentAction(
      "document.track.setDefaultSystemsLayout",
      { trackIndex: 0, value: 4 },
      ctx,
    );
    executeDocumentAction(
      "document.track.setSystemsLayout",
      { trackIndex: 0, value: [3, 2, 1] },
      ctx,
    );

    const track = resolveYTrackHelper(0)!;
    expect(track.get("defaultSystemsLayout")).toBe(4);
    expect(
      (track.get("systemsLayout") as Y.Array<number>).toArray(),
    ).toEqual([3, 2, 1]);
  });

  it("rejects non-positive entries before updating Y.Doc", () => {
    const doc = getScoreMap()!.doc!;
    let updates = 0;
    doc.on("update", () => updates++);

    expect(() =>
      executeDocumentAction(
        "document.track.setSystemsLayout",
        { trackIndex: 0, value: [-1] },
        ctx,
      ),
    ).toThrow(DocumentActionArgumentsError);

    expect(updates).toBe(0);
    expect(
      (
        resolveYTrackHelper(0)!.get("systemsLayout") as Y.Array<number>
      ).toArray(),
    ).toEqual([]);
  });

  it("supports Guitar Pro-style track reflow and break editing", () => {
    resetSystemLayoutScore();
    executeDocumentAction(
      "document.track.reflowSystems",
      {
        trackIndex: 0,
        barsPerSystem: 4,
        startBarIndex: null,
      },
      ctx,
    );
    expect(executeDocumentAction(
      "document.track.forceSystemBreak",
      { trackIndex: 0, barIndex: 2 },
      ctx,
    )).toBe(true);
    expect(
      (
        resolveYTrackHelper(0)!.get("systemsLayout") as Y.Array<number>
      ).toArray(),
    ).toEqual([3, 1]);

    expect(executeDocumentAction(
      "document.track.preventSystemBreak",
      { trackIndex: 0, barIndex: 2 },
      ctx,
    )).toBe(true);
    expect(
      (
        resolveYTrackHelper(0)!.get("systemsLayout") as Y.Array<number>
      ).toArray(),
    ).toEqual([]);
  });
});

describe("document.track.setInstrument", () => {
  it("updates playbackInfo program and bank atomically", () => {
    executeDocumentAction("document.track.setInstrument", {
      trackIndex: 0,
      program: 30,
      bank: 2,
    }, ctx);
    const playbackInfo = resolveYTrackHelper(0)!.get(
      "playbackInfo",
    ) as Y.Map<unknown>;
    expect(playbackInfo.get("program")).toBe(30);
    expect(playbackInfo.get("bank")).toBe(2);
    expect(resolveYTrackHelper(0)!.has("playbackProgram")).toBe(false);
  });

  it.each([
    { trackIndex: 0, program: -1, bank: 0 },
    { trackIndex: 0, program: 128, bank: 0 },
    { trackIndex: 0, program: 30, bank: -1 },
    { trackIndex: 0, program: 30, bank: 16384 },
  ])("rejects invalid instrument args before updating Y.Doc: %o", (args) => {
    const playbackInfo = resolveYTrackHelper(0)!.get(
      "playbackInfo",
    ) as Y.Map<unknown>;
    const before = playbackInfo.toJSON();
    let updates = 0;
    const listener = () => updates++;
    playbackInfo.observe(listener);

    expect(() => executeDocumentActionById(
      "document.track.setInstrument",
      args,
      ctx,
    )).toThrow(DocumentActionArgumentsError);
    expect(playbackInfo.toJSON()).toEqual(before);
    expect(updates).toBe(0);
    playbackInfo.unobserve(listener);
  });
});

describe("document.track.setPercussionMap", () => {
  function addArticulation(id: number, outputMidiNumber: number) {
    const track = resolveYTrackHelper(0)!;
    const articulations = track.get(
      "percussionArticulations",
    ) as Y.Array<Y.Map<unknown>>;
    const articulation = new Y.Map<unknown>();
    articulation.set("id", id);
    articulation.set("outputMidiNumber", outputMidiNumber);
    getScoreMap()!.doc!.transact(() => {
      articulations.push([articulation]);
    });
    return articulations;
  }

  it("updates multiple articulations in one action", () => {
    const articulations = addArticulation(83, 38);
    addArticulation(83, 42);

    expect(executeDocumentAction("document.track.setPercussionMap", {
      trackIndex: 0,
      mappings: [
        { articulationIndex: 0, outputMidiNumber: 40 },
        { articulationIndex: 1, outputMidiNumber: 46 },
      ],
    }, ctx)).toBe(true);

    expect(articulations.get(0).get("outputMidiNumber")).toBe(40);
    expect(articulations.get(1).get("outputMidiNumber")).toBe(46);
  });

  it("rejects duplicate indices before updating Y.Doc", () => {
    const articulations = addArticulation(38, 38);
    let updates = 0;
    const listener = () => updates++;
    articulations.observeDeep(listener);

    expect(() => executeDocumentActionById(
      "document.track.setPercussionMap",
      {
        trackIndex: 0,
        mappings: [
          { articulationIndex: 0, outputMidiNumber: 40 },
          { articulationIndex: 0, outputMidiNumber: 41 },
        ],
      },
      ctx,
    )).toThrow(DocumentActionArgumentsError);
    expect(articulations.get(0).get("outputMidiNumber")).toBe(38);
    expect(updates).toBe(0);
    articulations.unobserveDeep(listener);
  });

  it("does not partially update when an articulation index is unknown", () => {
    const articulations = addArticulation(38, 38);
    expect(executeDocumentAction("document.track.setPercussionMap", {
      trackIndex: 0,
      mappings: [
        { articulationIndex: 0, outputMidiNumber: 40 },
        { articulationIndex: 999, outputMidiNumber: 41 },
      ],
    }, ctx)).toBe(false);
    expect(articulations.get(0).get("outputMidiNumber")).toBe(38);
  });
});

describe("document.track.delete", () => {
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
  });

  it("removes track from Y.Array", () => {
    expect(trackCount()).toBe(2);
    const trackUuid = resolveYTrackHelper(1)!.get("uuid") as string;
    executeDocumentAction("document.track.delete", { trackUuid }, ctx);
    expect(trackCount()).toBe(1);
    expect(resolveYTrackHelper(0)!.get("name")).toBe("Test Guitar");
  });

  it("allows the last track to be removed", () => {
    resetMockState();
    destroyDoc();
    initDoc();
    seedOneTrackScore(getScoreMap()!, 1);

    expect(trackCount()).toBe(1);
    const trackUuid = resolveYTrackHelper(0)!.get("uuid") as string;
    const result = executeDocumentAction("document.track.delete", { trackUuid }, ctx);
    expect(result).toBe(true);
    expect(trackCount()).toBe(0);
  });

  it("returns false for an unknown track UUID", () => {
    const result = executeDocumentAction("document.track.delete", {
      trackUuid: "missing-track",
    }, ctx);
    expect(result).toBe(false);
  });

  it("keeps the target bound when another track changes its index", () => {
    const targetUuid = resolveYTrackHelper(1)!.get("uuid") as string;
    const scoreMap = getScoreMap()!;
    scoreMap.doc!.transact(() => {
      const yTracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;
      yTracks.insert(0, [createTrack("Inserted")]);
    });

    expect(resolveYTrackHelper(2)!.get("uuid")).toBe(targetUuid);
    executeDocumentAction("document.track.delete", {
      trackUuid: targetUuid,
    }, ctx);

    expect(trackCount()).toBe(2);
    expect(
      Array.from({ length: trackCount() }, (_, index) =>
        resolveYTrackHelper(index)!.get("uuid")),
    ).not.toContain(targetUuid);
    expect(resolveYTrackHelper(0)!.get("name")).toBe("Inserted");
  });
});

describe("document.track.setName (all track types)", () => {
  it("updates violin track name", () => {
    resetMockState();
    destroyDoc();
    initDoc();
    seedTrackWithConfig(getScoreMap()!, 1, { name: "Violin", tuning: [76, 69, 62, 55] });
    selectBeat({ ...defaultSel, string: 2 as number | null });

    executeDocumentAction("document.track.setName", { trackIndex: 0, name: "Solo Violin" }, ctx);
    expect(resolveYTrackHelper(0)!.get("name")).toBe("Solo Violin");
  });

  it("updates piano track name", () => {
    resetMockState();
    destroyDoc();
    initDoc();
    seedTrackWithConfig(getScoreMap()!, 1, { name: "Piano", showTablature: false });
    selectBeat(defaultSel);

    executeDocumentAction("document.track.setName", { trackIndex: 0, name: "Grand Piano" }, ctx);
    expect(resolveYTrackHelper(0)!.get("name")).toBe("Grand Piano");
  });

  it("updates drumkit track name", () => {
    resetMockState();
    destroyDoc();
    initDoc();
    seedTrackWithConfig(getScoreMap()!, 1, { name: "Drums", isPercussion: true });
    selectBeat(defaultSel);

    executeDocumentAction("document.track.setName", { trackIndex: 0, name: "Kit" }, ctx);
    expect(resolveYTrackHelper(0)!.get("name")).toBe("Kit");
  });
});

describe("document.track.add", () => {
  it("adds a preset track directly to Y.Doc without a renderer score", () => {
    const tracksBefore = trackCount();

    executeDocumentAction("document.track.add", { presetId: "acousticPiano" }, ctx);

    expect(trackCount()).toBe(tracksBefore + 1);
    const yTrack = resolveYTrackHelper(tracksBefore)!;
    expect(yTrack.get("name")).toBe("Acoustic Piano");
    expect(yTrack.get("shortName")).toBe("Pno.");
    expect(yTrack.get("defaultSystemsLayout")).toBe(3);
    const yPlaybackInfo = yTrack.get("playbackInfo") as Y.Map<unknown>;
    expect(yPlaybackInfo.get("program")).toBe(0);
    expect(yPlaybackInfo.get("bank")).toBe(0);
    const yStaves = yTrack.get("staves") as Y.Array<Y.Map<unknown>>;
    expect(yStaves.length).toBe(2);
    expect(yStaves.get(0).get("showTablature")).toBe(false);
    expect(yStaves.get(1).get("showTablature")).toBe(false);
    expect(yStaves.get(0).get("showStandardNotation")).toBe(true);
    expect(yStaves.get(1).get("showStandardNotation")).toBe(true);
    expect(
      (yStaves.get(0).get("bars") as Y.Array<Y.Map<unknown>>).get(0).get("clef"),
    ).toBe(4);
    expect(
      (yStaves.get(1).get("bars") as Y.Array<Y.Map<unknown>>).get(0).get("clef"),
    ).toBe(3);
  });

  it("creates explicit current Track and Staff metadata from presets", () => {
    const tracksBefore = trackCount();
    executeDocumentAction("document.track.add", { presetId: "acousticGuitar" }, ctx);
    executeDocumentAction("document.track.add", { presetId: "violin" }, ctx);

    const guitar = resolveYTrackHelper(tracksBefore)!;
    expect(guitar.get("shortName")).toBe("Ac. Gtr.");
    expect((guitar.get("color") as Y.Map<unknown>).get("raw")).toBe(-40121);
    const guitarStaff = (guitar.get("staves") as Y.Array<Y.Map<unknown>>).get(0);
    expect(guitarStaff.get("showStandardNotation")).toBe(true);
    expect(guitarStaff.get("showTablature")).toBe(true);
    const guitarTuning = guitarStaff.get("stringTuning") as Y.Map<unknown>;
    expect(guitarTuning.get("name")).toBe("Standard");
    expect(guitarTuning.get("isStandard")).toBe(true);
    expect(
      (guitarTuning.get("tunings") as Y.Array<number>).toArray(),
    ).toEqual([64, 59, 55, 50, 45, 40]);

    const violin = resolveYTrackHelper(tracksBefore + 1)!;
    const violinStaff = (violin.get("staves") as Y.Array<Y.Map<unknown>>).get(0);
    expect(violinStaff.get("showStandardNotation")).toBe(true);
    expect(violinStaff.get("showTablature")).toBe(false);
  });

  it("creates the first master bar when adding to an empty headless document", () => {
    resetMockState();
    destroyDoc();
    initDoc();

    executeDocumentAction("document.track.add", { presetId: "drumkit" }, ctx);

    const scoreMap = getScoreMap()!;
    const yMasterBars = scoreMap.get("masterBars") as Y.Array<Y.Map<unknown>>;
    expect(yMasterBars.length).toBe(1);
    expect(trackCount()).toBe(1);

    const yTrack = resolveYTrackHelper(0)!;
    expect(yTrack.get("name")).toBe("Drums");
    expect(yTrack.get("shortName")).toBe("Dr.");
    const yPlaybackInfo = yTrack.get("playbackInfo") as Y.Map<unknown>;
    expect(yPlaybackInfo.get("primaryChannel")).toBe(9);
    const yStaff = (yTrack.get("staves") as Y.Array<Y.Map<unknown>>).get(0);
    expect(yStaff.get("isPercussion")).toBe(true);
    expect(yStaff.get("showStandardNotation")).toBe(true);
    expect(yStaff.get("showTablature")).toBe(false);
  });
});

describe("document.track.addInstrument", () => {
  it("adds any General MIDI instrument as a standard-notation track", () => {
    const tracksBefore = trackCount();

    executeDocumentAction("document.track.addInstrument", {
      program: 73,
      bank: 0,
    }, ctx);

    expect(trackCount()).toBe(tracksBefore + 1);
    const yTrack = resolveYTrackHelper(tracksBefore)!;
    expect(yTrack.get("name")).toBe("Flute");
    expect(yTrack.get("shortName")).toBe("");
    const yPlaybackInfo = yTrack.get("playbackInfo") as Y.Map<unknown>;
    expect(yPlaybackInfo.get("program")).toBe(73);
    expect(yPlaybackInfo.get("bank")).toBe(0);
    const yStaves = yTrack.get("staves") as Y.Array<Y.Map<unknown>>;
    expect(yStaves.length).toBe(1);
    expect(yStaves.get(0).get("showStandardNotation")).toBe(true);
    expect(yStaves.get(0).get("showTablature")).toBe(false);
    expect(
      (yStaves.get(0).get("stringTuning") as Y.Map<unknown>)
        .get("tunings"),
    ).toBeInstanceOf(Y.Array);
  });

  it("rejects invalid General MIDI programs before mutation", () => {
    const tracksBefore = trackCount();

    expect(() => executeDocumentActionById(
      "document.track.addInstrument",
      { program: 128, bank: 0 },
      ctx,
    )).toThrow(DocumentActionArgumentsError);
    expect(trackCount()).toBe(tracksBefore);
  });
});
