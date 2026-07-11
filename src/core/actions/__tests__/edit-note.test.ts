import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Y from "yjs";
import {
  resetMockState,
  selectBeat,
  setSelectedNoteIndex,
  seedOneTrackScore,
  seedTrackWithConfig,
  placeNoteDirectly,
  placePercussionNoteDirectly,
  expectPercussionNote,
  testContext,
  initDoc,
  destroyDoc,
  getScoreMap,
  resolveYNoteHelper,
  resolveYBeatHelper,
} from "@/test/setup";

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
      getScoreMap: vi.fn(() => refs()?.scoreMap ?? null),
      getUndoManager: vi.fn(() => refs()?.undoManager ?? null),
      localEditYDoc: vi.fn((fn: () => void, _nextSel?: unknown) => {
        const d = refs()?.doc; if (d) d.transact(fn, d.clientID);
      }),
    },
    importTrack: vi.fn(),
    FILE_IMPORT_ORIGIN: "file-import",
  };
});

import { createNote } from "@/core/schema";
import {
  AccentuationType,
  VibratoType,
  BendType,
  BendStyle,
  SlideOutType,
  SlideInType,
  HarmonicType,
  Duration,
  DynamicValue,
  NoteOrnament,
} from "@/core/schema";
import { executeDocumentAction } from "@/core/actions/registry";
import "@/core/actions/edit-note";

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
  seedOneTrackScore(getScoreMap()!, 1);
  placeNoteDirectly(getScoreMap()!, 0, 0, 0, 5, 3);
  selectBeat(defaultSel);
  setSelectedNoteIndex(0);
});

function getNote() {
  return resolveYNoteHelper(0, 0, 0, 0, 0, 0)!;
}

describe("document.note.setIsTieDestination", () => {
  it("sets isTieDestination on note Y.Map", () => {
    executeDocumentAction("document.note.setIsTieDestination", true, ctx);
    expect(getNote().get("isTieDestination")).toBe(true);
  });

  it("unsets tie", () => {
    executeDocumentAction("document.note.setIsTieDestination", true, ctx);
    executeDocumentAction("document.note.setIsTieDestination", false, ctx);
    expect(getNote().get("isTieDestination")).toBe(false);
  });
});

describe("document.note.setIsGhost", () => {
  it("toggles isGhost", () => {
    executeDocumentAction("document.note.setIsGhost", true, ctx);
    expect(getNote().get("isGhost")).toBe(true);
  });
});

describe("document.note.setIsDead", () => {
  it("toggles isDead", () => {
    executeDocumentAction("document.note.setIsDead", true, ctx);
    expect(getNote().get("isDead")).toBe(true);
  });
});

describe("document.note.setAccentuated", () => {
  it("sets accentuated field", () => {
    executeDocumentAction("document.note.setAccentuated", AccentuationType.Heavy, ctx);
    expect(getNote().get("accentuated")).toBe(AccentuationType.Heavy);
  });
});

describe("document.note.setIsStaccato", () => {
  it("toggles isStaccato", () => {
    executeDocumentAction("document.note.setIsStaccato", true, ctx);
    expect(getNote().get("isStaccato")).toBe(true);
  });
});

describe("document.note.setIsLetRing", () => {
  it("toggles isLetRing", () => {
    executeDocumentAction("document.note.setIsLetRing", true, ctx);
    expect(getNote().get("isLetRing")).toBe(true);
  });
});

describe("document.note.setIsPalmMute", () => {
  it("toggles isPalmMute", () => {
    executeDocumentAction("document.note.setIsPalmMute", true, ctx);
    expect(getNote().get("isPalmMute")).toBe(true);
  });
});

describe("document.note.setIsHammerPullOrigin", () => {
  it("toggles isHammerPullOrigin", () => {
    executeDocumentAction("document.note.setIsHammerPullOrigin", true, ctx);
    expect(getNote().get("isHammerPullOrigin")).toBe(true);
  });
});

describe("document.note.setVibrato", () => {
  it("sets vibrato enum", () => {
    executeDocumentAction("document.note.setVibrato", VibratoType.Wide, ctx);
    expect(getNote().get("vibrato")).toBe(VibratoType.Wide);
  });
});

describe("document.note.setBendType", () => {
  it("sets bendType enum", () => {
    executeDocumentAction("document.note.setBendType", BendType.Bend, ctx);
    expect(getNote().get("bendType")).toBe(BendType.Bend);
  });
});

describe("document.note bend data", () => {
  it("sets bend style and continuation independently", () => {
    executeDocumentAction("document.note.setBendStyle", BendStyle.Gradual, ctx);
    executeDocumentAction("document.note.setIsContinuedBend", true, ctx);

    expect(getNote().get("bendStyle")).toBe(BendStyle.Gradual);
    expect(getNote().get("isContinuedBend")).toBe(true);
  });

  it("replaces bend points using the schema field names", () => {
    executeDocumentAction("document.note.setBendPoints", [
      { offset: 0, value: 0 },
      { offset: 30, value: 4 },
      { offset: 60, value: 2 },
    ], ctx);

    const yPoints = getNote().get("bendPoints") as Y.Array<Y.Map<unknown>>;
    expect(yPoints.toArray().map((point) => point.toJSON())).toEqual([
      { offset: 0, value: 0 },
      { offset: 30, value: 4 },
      { offset: 60, value: 2 },
    ]);

    executeDocumentAction("document.note.setBendPoints", null, ctx);
    expect(getNote().get("bendPoints")).toBeNull();
  });

  it("sets a complete bend atomically", () => {
    executeDocumentAction("document.note.setBend", {
      bendType: BendType.BendRelease,
      bendStyle: BendStyle.Fast,
      isContinuedBend: true,
      bendPoints: [
        { offset: 0, value: 0 },
        { offset: 30, value: 4 },
        { offset: 60, value: 0 },
      ],
    }, ctx);

    expect(getNote().get("bendType")).toBe(BendType.BendRelease);
    expect(getNote().get("bendStyle")).toBe(BendStyle.Fast);
    expect(getNote().get("isContinuedBend")).toBe(true);
    const points = getNote().get("bendPoints") as Y.Array<Y.Map<unknown>>;
    expect(points.length).toBe(3);
  });
});

describe("document.note.setSlideOutType", () => {
  it("sets slideOutType enum", () => {
    executeDocumentAction("document.note.setSlideOutType", SlideOutType.Shift, ctx);
    expect(getNote().get("slideOutType")).toBe(SlideOutType.Shift);
  });
});

describe("document.note.setSlideInType", () => {
  it("sets slideInType enum", () => {
    executeDocumentAction("document.note.setSlideInType", SlideInType.IntoFromBelow, ctx);
    expect(getNote().get("slideInType")).toBe(SlideInType.IntoFromBelow);
  });
});

describe("document.note.setHarmonicType", () => {
  it("sets harmonicType enum", () => {
    executeDocumentAction("document.note.setHarmonicType", HarmonicType.Natural, ctx);
    expect(getNote().get("harmonicType")).toBe(HarmonicType.Natural);
  });
});

describe("document.note scalar playback fields", () => {
  it("sets harmonicValue and note dynamics", () => {
    executeDocumentAction("document.note.setHarmonicValue", 12, ctx);
    executeDocumentAction("document.note.setDynamics", DynamicValue.PP, ctx);

    expect(getNote().get("harmonicValue")).toBe(12);
    expect(getNote().get("dynamics")).toBe(DynamicValue.PP);
  });

  it.each([
    ["document.note.setFret", "fret", 9],
    ["document.note.setOctave", "octave", 5],
    ["document.note.setTone", "tone", 7],
    ["document.note.setPercussionArticulation", "percussionArticulation", 42],
  ] as const)("%s writes %s directly", (actionId, field, value) => {
    executeDocumentAction(actionId, value, ctx);
    expect(getNote().get(field)).toBe(value);
  });

  it("sets string directly", () => {
    executeDocumentAction("document.note.setString", 4, ctx);
    expect(getNote().get("string")).toBe(4);
  });
});

describe("document.note.setTrill", () => {
  it("sets trillValue and trillSpeed", () => {
    executeDocumentAction("document.note.setTrill", { trillValue: 7, trillSpeed: Duration.Sixteenth }, ctx);
    expect(getNote().get("trillValue")).toBe(7);
    expect(getNote().get("trillSpeed")).toBe(Duration.Sixteenth);
  });
});

describe("document.note.setOrnament", () => {
  it("sets ornament enum", () => {
    executeDocumentAction("document.note.setOrnament", NoteOrnament.Turn, ctx);
    expect(getNote().get("ornament")).toBe(NoteOrnament.Turn);
  });
});

describe("document.note.setIsLeftHandTapped", () => {
  it("toggles isLeftHandTapped", () => {
    executeDocumentAction("document.note.setIsLeftHandTapped", true, ctx);
    expect(getNote().get("isLeftHandTapped")).toBe(true);
  });
});

describe("applyNoteUpdates guards", () => {
  it("does nothing without selection", () => {
    selectBeat(null);
    executeDocumentAction("document.note.setIsGhost", true, ctx);
    expect(getNote().get("isGhost")).toBe(false);
  });

  it("does nothing with negative note index", () => {
    setSelectedNoteIndex(-1);
    executeDocumentAction("document.note.setIsGhost", true, ctx);
    expect(getNote().get("isGhost")).toBe(false);
  });
});

describe("document.note (violin tab)", () => {
  beforeEach(() => {
    resetMockState();
    destroyDoc();
    initDoc();
    seedTrackWithConfig(getScoreMap()!, 1, { name: "Violin", tuning: [76, 69, 62, 55] });
    placeNoteDirectly(getScoreMap()!, 0, 0, 0, 2, 2);
    selectBeat({ ...defaultSel, string: 2 as number | null });
    setSelectedNoteIndex(0);
  });

  it("setGhost applies to violin note", () => {
    executeDocumentAction("document.note.setIsGhost", true, ctx);
    expect(getNote().get("isGhost")).toBe(true);
  });
});

describe("document.note (piano notation)", () => {
  beforeEach(() => {
    resetMockState();
    destroyDoc();
    initDoc();
    seedTrackWithConfig(getScoreMap()!, 1, { name: "Piano", showTablature: false });
    const scoreMap = getScoreMap()!;
    scoreMap.doc!.transact(() => {
      const yTracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;
      const yStaves = yTracks.get(0).get("staves") as Y.Array<Y.Map<unknown>>;
      const yBars = yStaves.get(0).get("bars") as Y.Array<Y.Map<unknown>>;
      const yVoices = yBars.get(0).get("voices") as Y.Array<Y.Map<unknown>>;
      const yBeats = yVoices.get(0).get("beats") as Y.Array<Y.Map<unknown>>;
      const yBeat = yBeats.get(0);
      const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
      const yNote = createNote(0, 0);
      yNote.set("octave", 4);
      yNote.set("tone", 5);
      yNotes.push([yNote]);
      yBeat.set("isEmpty", false);
    });
    selectBeat(defaultSel);
    setSelectedNoteIndex(0);
  });

  it("setGhost applies to piano note", () => {
    executeDocumentAction("document.note.setIsGhost", true, ctx);
    expect(getNote().get("isGhost")).toBe(true);
  });
});

describe("document.note (drumkit percussion)", () => {
  beforeEach(() => {
    resetMockState();
    destroyDoc();
    initDoc();
    seedTrackWithConfig(getScoreMap()!, 1, { name: "Drums", isPercussion: true });
    placePercussionNoteDirectly(getScoreMap()!, 0, 0, 0, 42);
    selectBeat(defaultSel);
    setSelectedNoteIndex(0);
  });

  it("setGhost applies to percussion note", () => {
    executeDocumentAction("document.note.setIsGhost", true, ctx);
    expect(getNote().get("isGhost")).toBe(true);
  });
});

// ─── togglePercussionArticulation ─────────────────────────────────────────────

describe("document.beat.togglePercussionArticulation", () => {
  const drumSel = { ...defaultSel, string: 2 as number | null };

  function setupDrumTrack() {
    resetMockState();
    destroyDoc();
    initDoc();
    seedTrackWithConfig(getScoreMap()!, 1, { name: "Drums", isPercussion: true });
    selectBeat(drumSel);
  }

  it("adds percussion note when gp7Id not present in beat", () => {
    setupDrumTrack();

    executeDocumentAction("document.beat.togglePercussionArticulation", 38, ctx);

    const yNotes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(1);
    expectPercussionNote(yNotes.get(0), 38);
  });

  it("removes existing percussion note when gp7Id matches", () => {
    setupDrumTrack();
    placePercussionNoteDirectly(getScoreMap()!, 0, 0, 0, 42);

    executeDocumentAction("document.beat.togglePercussionArticulation", 42, ctx);

    const yNotes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(0);
  });

  it("stores the AlphaTab articulation index for custom track definitions", () => {
    setupDrumTrack();
    const tracks = getScoreMap()!.get("tracks") as Y.Array<Y.Map<unknown>>;
    const articulations = tracks
      .get(0)
      .get("percussionArticulations") as Y.Array<Y.Map<unknown>>;
    const first = new Y.Map<unknown>();
    first.set("id", 42);
    const second = new Y.Map<unknown>();
    second.set("id", 38);
    articulations.push([first, second]);

    executeDocumentAction("document.beat.togglePercussionArticulation", 38, ctx);

    const notes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get(
      "notes",
    ) as Y.Array<Y.Map<unknown>>;
    expect(notes.get(0).get("percussionArticulation")).toBe(1);
  });

  it("does nothing when track.isPercussion is false", () => {
    resetMockState();
    destroyDoc();
    initDoc();
    seedOneTrackScore(getScoreMap()!, 1);
    selectBeat(defaultSel);

    executeDocumentAction("document.beat.togglePercussionArticulation", 38, ctx);

    const yNotes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(0);
  });

  it("does nothing without selection", () => {
    setupDrumTrack();
    selectBeat(null);

    executeDocumentAction("document.beat.togglePercussionArticulation", 38, ctx);

    const yNotes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(0);
  });
});

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe("document.note edge cases", () => {
  it("applyNoteUpdates does nothing when Y.Note cannot be resolved", () => {
    // Set selection with invalid note index
    setSelectedNoteIndex(999);

    const result = executeDocumentAction("document.note.setIsTieDestination", true, ctx);

    // Should not throw, should just return without doing anything
    expect(result).toBeUndefined();
    // Note should be unchanged
    expect(getNote().get("isTieDestination")).toBe(false);
  });

  it("togglePercussionArticulation works without a renderer score", () => {
    resetMockState();
    destroyDoc();
    initDoc();
    seedTrackWithConfig(getScoreMap()!, 1, { name: "Drums", isPercussion: true });
    selectBeat({ ...defaultSel, string: 2 as number | null });

    executeDocumentAction("document.beat.togglePercussionArticulation", 38, ctx);

    const yNotes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(1);
    expectPercussionNote(yNotes.get(0), 38);
  });

  it("togglePercussionArticulation does nothing when Y.Beat cannot be resolved", () => {
    resetMockState();
    destroyDoc();
    initDoc();
    seedTrackWithConfig(getScoreMap()!, 1, { name: "Drums", isPercussion: true });
    selectBeat({ ...defaultSel, beatIndex: 999, string: 2 as number | null });

    executeDocumentAction("document.beat.togglePercussionArticulation", 38, ctx);

    const yNotes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(0);
  });
});
