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
  addBeatsDirectly,
  expectPercussionNote,
  VIOLIN_TUNING,
  testContext,
  initDoc,
  destroyDoc,
  getScoreMap,
  resolveYBeatHelper,
  resolveYVoiceHelper,
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
      pendingSelection: null as unknown,
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
      localEditYDoc: vi.fn((fn: () => void, _nextSelection?: unknown) => {
        const d = refs()?.doc; if (d) d.transact(fn, d.clientID);
      }),
    },
    importTrack: vi.fn(),
    FILE_IMPORT_ORIGIN: "file-import",
  };
});

import {
  AutomationType,
  BendStyle,
  Duration,
  GraceType,
  Rasgueado,
  TremoloPickingStyle,
} from "@/core/schema";
import { executeAction } from "@/core/actions/registry";
import "@/core/actions/edit-beat";

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
  selectBeat(defaultSel);
});

function configureBeat(opts?: { duration?: number; isEmpty?: boolean }) {
  const yBeat = resolveYBeatHelper(0, 0, 0, 0, 0);
  if (!yBeat) return;
  if (opts?.duration !== undefined) yBeat.set("duration", opts.duration);
  if (opts?.isEmpty !== undefined) yBeat.set("isEmpty", opts.isEmpty);
}

// ─── setDuration ──────────────────────────────────────────────────────────────

describe("edit.beat.setDuration", () => {
  it("updates Y.Map duration field", () => {
    executeAction("edit.beat.setDuration", Duration.Eighth, ctx);
    const yBeat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    expect(yBeat.get("duration")).toBe(Duration.Eighth);
  });

  it("can cycle through durations", () => {
    executeAction("edit.beat.setDuration", Duration.Sixteenth, ctx);
    expect(resolveYBeatHelper(0, 0, 0, 0, 0)!.get("duration")).toBe(Duration.Sixteenth);
    executeAction("edit.beat.setDuration", Duration.Half, ctx);
    expect(resolveYBeatHelper(0, 0, 0, 0, 0)!.get("duration")).toBe(Duration.Half);
  });
});

// ─── placeNote (guitar tab) ───────────────────────────────────────────────────

describe("edit.beat.placeNote (guitar tab)", () => {
  it("adds note to beat's notes array", () => {
    executeAction("edit.beat.placeNote", 5, ctx);

    const yBeat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(1);
    expect(yNotes.get(0).get("fret")).toBe(5);
    expect(yNotes.get(0).get("string")).toBe(3);
  });

  it("sets isEmpty to false", () => {
    executeAction("edit.beat.placeNote", 3, ctx);
    expect(resolveYBeatHelper(0, 0, 0, 0, 0)!.get("isEmpty")).toBe(false);
  });

  it("updates fret on existing string", () => {
    placeNoteDirectly(getScoreMap()!, 0, 0, 0, 5, 3);

    executeAction("edit.beat.placeNote", 7, ctx);

    const yNotes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(1);
    expect(yNotes.get(0).get("fret")).toBe(7);
  });

  it("does nothing without selection", () => {
    selectBeat(null);
    executeAction("edit.beat.placeNote", 5, ctx);
    const yNotes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(0);
  });
});

// ─── deleteNote ───────────────────────────────────────────────────────────────

describe("edit.beat.deleteNote", () => {
  it("clears notes array when single note", () => {
    placeNoteDirectly(getScoreMap()!, 0, 0, 0, 5, 3);
    setSelectedNoteIndex(0);

    executeAction("edit.beat.deleteNote", undefined, ctx);

    const yNotes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(0);
  });

  it("removes only selected note when multiple", () => {
    placeNoteDirectly(getScoreMap()!, 0, 0, 0, 5, 3);
    placeNoteDirectly(getScoreMap()!, 0, 0, 0, 7, 1);
    setSelectedNoteIndex(0);

    executeAction("edit.beat.deleteNote", undefined, ctx);

    const yNotes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(1);
    expect(yNotes.get(0).get("string")).toBe(1);
  });

  it("removes beat from voice when beat is rest", () => {
    addBeatsDirectly(getScoreMap()!, 0, 0, 1);
    configureBeat({ isEmpty: false });

    const yVoiceBefore = resolveYVoiceHelper(0, 0, 0, 0)!;
    const beatsBefore = (yVoiceBefore.get("beats") as Y.Array<unknown>).length;

    const result = executeAction("edit.beat.deleteNote", undefined, ctx);

    const yVoiceAfter = resolveYVoiceHelper(0, 0, 0, 0)!;
    const beatsAfter = (yVoiceAfter.get("beats") as Y.Array<unknown>).length;
    expect(beatsAfter).toBe(beatsBefore - 1);
    expect(result).toBe(true);
  });

  it("blocks when voice has only 1 beat and beat is rest", () => {
    configureBeat({ isEmpty: false });
    const result = executeAction("edit.beat.deleteNote", undefined, ctx);
    expect(result).toBe(false);
  });
});

// ─── insertRestBefore / insertRestAfter ───────────────────────────────────────

describe("edit.beat.insertRestBefore", () => {
  it("inserts a beat before the current position", () => {
    const beatsBefore = (resolveYVoiceHelper(0, 0, 0, 0)!.get("beats") as Y.Array<unknown>).length;

    executeAction("edit.beat.insertRestBefore", 8, ctx);

    const beatsAfter = (resolveYVoiceHelper(0, 0, 0, 0)!.get("beats") as Y.Array<unknown>).length;
    expect(beatsAfter).toBe(beatsBefore + 1);

    const newBeat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    expect(newBeat.get("duration")).toBe(8);
    expect(newBeat.get("isEmpty")).toBe(false);
  });
});

describe("edit.beat.insertRestAfter", () => {
  it("inserts a beat after the current position", () => {
    executeAction("edit.beat.insertRestAfter", 16, ctx);

    const beats = resolveYVoiceHelper(0, 0, 0, 0)!.get("beats") as Y.Array<Y.Map<unknown>>;
    expect(beats.length).toBe(2);

    const newBeat = beats.get(1);
    expect(newBeat.get("duration")).toBe(16);
    expect(newBeat.get("isEmpty")).toBe(false);
  });
});

// ─── setDots ──────────────────────────────────────────────────────────────────

describe("edit.beat.setDots", () => {
  it("sets dot count on beat", () => {
    executeAction("edit.beat.setDots", 1, ctx);
    expect(resolveYBeatHelper(0, 0, 0, 0, 0)!.get("dots")).toBe(1);
  });
});

// ─── violin (4-string tab) ────────────────────────────────────────────────────

describe("edit.beat (violin tab)", () => {
  const violinSel = { ...defaultSel, string: 2 as number | null };

  beforeEach(() => {
    resetMockState();
    destroyDoc();
    initDoc();
    seedTrackWithConfig(getScoreMap()!, 1, {
      name: "Violin",
      tuning: VIOLIN_TUNING,
    });
    selectBeat(violinSel);
  });

  it("setDuration updates Y.Map", () => {
    executeAction("edit.beat.setDuration", Duration.Eighth, ctx);
    expect(resolveYBeatHelper(0, 0, 0, 0, 0)!.get("duration")).toBe(Duration.Eighth);
  });

  it("placeNote adds note on 4-string staff", () => {
    executeAction("edit.beat.placeNote", 3, ctx);
    const yNotes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(1);
    expect(yNotes.get(0).get("fret")).toBe(3);
    expect(yNotes.get(0).get("string")).toBe(2);
  });
});

// ─── piano (notation only) ─────────────────────────────────────────────────────

describe("edit.beat (piano notation)", () => {
  const pianoSel = { ...defaultSel, string: 5 as number | null };

  beforeEach(() => {
    resetMockState();
    destroyDoc();
    initDoc();
    seedTrackWithConfig(getScoreMap()!, 1, {
      name: "Piano",
      showTablature: false,
    });
    selectBeat(pianoSel);
  });

  it("setDuration updates Y.Map", () => {
    executeAction("edit.beat.setDuration", Duration.Quarter, ctx);
    expect(resolveYBeatHelper(0, 0, 0, 0, 0)!.get("duration")).toBe(Duration.Quarter);
  });

  it("placeNote adds note with octave and tone from snapPositionToPitch", () => {
    executeAction("edit.beat.placeNote", 7, ctx);
    const yNotes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(1);
    expect(yNotes.get(0).get("octave")).toBe(6);
    expect(yNotes.get(0).get("tone")).toBe(5);
  });
});

// ─── applyBeatUpdates property setters (parametrized) ──────────────────────────

describe("applyBeatUpdates property setters", () => {
  it.each([
    ["edit.beat.setIsEmpty",          "isEmpty",          false],
    ["edit.beat.setTupletNumerator",  "tupletNumerator",  3],
    ["edit.beat.setTupletDenominator","tupletDenominator",2],
    ["edit.beat.setGraceType",        "graceType",        GraceType.BeforeBeat],
    ["edit.beat.setDynamics",      "dynamics",       5],
    ["edit.beat.setVibrato",       "vibrato",        1],
    ["edit.beat.setDeadSlapped",   "deadSlapped",    true],
    ["edit.beat.setWhammyBarType", "whammyBarType",  1],
    ["edit.beat.setWhammyStyle",   "whammyStyle",    BendStyle.Fast],
    ["edit.beat.setIsContinuedWhammy", "isContinuedWhammy", true],
    ["edit.beat.setBrushType",     "brushType",      1],
    ["edit.beat.setBrushDuration", "brushDuration",  120],
    ["edit.beat.setFade",          "fade",           1],
    ["edit.beat.setRasgueado",     "rasgueado",      Rasgueado.PmpTriplet],
  ] as const)("%s sets %s on Y.Map", (actionId, field, value) => {
    executeAction(actionId, value, ctx);
    expect(resolveYBeatHelper(0, 0, 0, 0, 0)!.get(field)).toBe(value);
  });

  it("does nothing without selection", () => {
    const before = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("vibrato");
    selectBeat(null);
    executeAction("edit.beat.setVibrato", 1, ctx);
    expect(resolveYBeatHelper(0, 0, 0, 0, 0)!.get("vibrato")).toBe(before);
  });
});

describe("edit.beat nested playback fields", () => {
  it("sets brush type and duration together", () => {
    executeAction("edit.beat.setBrush", {
      brushType: 1,
      brushDuration: 120,
    }, ctx);
    const beat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    expect(beat.get("brushType")).toBe(1);
    expect(beat.get("brushDuration")).toBe(120);
  });

  it("sets a tuplet pair in one action", () => {
    executeAction("edit.beat.setTuplet", {
      numerator: 5,
      denominator: 4,
    }, ctx);
    const beat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    expect(beat.get("tupletNumerator")).toBe(5);
    expect(beat.get("tupletDenominator")).toBe(4);
  });

  it("replaces whammyBarPoints", () => {
    executeAction("edit.beat.setWhammyBarPoints", [
      { offset: 0, value: 0 },
      { offset: 60, value: -4 },
    ], ctx);

    const yPoints = resolveYBeatHelper(0, 0, 0, 0, 0)!.get(
      "whammyBarPoints",
    ) as Y.Array<Y.Map<unknown>>;
    expect(yPoints.toArray().map((point) => point.toJSON())).toEqual([
      { offset: 0, value: 0 },
      { offset: 60, value: -4 },
    ]);

    executeAction("edit.beat.setWhammyBarPoints", null, ctx);
    expect(
      resolveYBeatHelper(0, 0, 0, 0, 0)!.get("whammyBarPoints"),
    ).toBeNull();
  });

  it("sets a complete whammy bar effect atomically", () => {
    executeAction("edit.beat.setWhammyBar", {
      whammyBarType: 2,
      whammyStyle: BendStyle.Gradual,
      isContinuedWhammy: true,
      whammyBarPoints: [
        { offset: 0, value: 0 },
        { offset: 60, value: -4 },
      ],
    }, ctx);
    const beat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    expect(beat.get("whammyBarType")).toBe(2);
    expect(beat.get("whammyStyle")).toBe(BendStyle.Gradual);
    expect(beat.get("isContinuedWhammy")).toBe(true);
    expect(
      (beat.get("whammyBarPoints") as Y.Array<Y.Map<unknown>>).length,
    ).toBe(2);
  });

  it("replaces automations without renaming fields", () => {
    executeAction("edit.beat.setAutomations", [
      {
        isLinear: true,
        type: AutomationType.Tempo,
        value: 144,
        ratioPosition: 0.5,
        text: "rit.",
        isVisible: true,
      },
    ], ctx);

    const yAutomations = resolveYBeatHelper(0, 0, 0, 0, 0)!.get(
      "automations",
    ) as Y.Array<Y.Map<unknown>>;
    expect(yAutomations.get(0).toJSON()).toEqual({
      isLinear: true,
      type: AutomationType.Tempo,
      value: 144,
      ratioPosition: 0.5,
      text: "rit.",
      isVisible: true,
    });
  });

  it("sets and clears lyrics", () => {
    executeAction("edit.beat.setLyrics", ["hel", "lo"], ctx);
    const beat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    expect((beat.get("lyrics") as Y.Array<string>).toArray()).toEqual([
      "hel",
      "lo",
    ]);

    executeAction("edit.beat.setLyrics", null, ctx);
    expect(beat.get("lyrics")).toBeNull();
  });

  it("sets nullable text and chordId", () => {
    executeAction("edit.beat.setText", "let ring", ctx);
    executeAction("edit.beat.setChordId", "Cmaj7", ctx);
    const beat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    expect(beat.get("text")).toBe("let ring");
    expect(beat.get("chordId")).toBe("Cmaj7");

    executeAction("edit.beat.setText", null, ctx);
    executeAction("edit.beat.setChordId", null, ctx);
    expect(beat.get("text")).toBeNull();
    expect(beat.get("chordId")).toBeNull();
  });

  it("sets and clears tremoloPicking", () => {
    executeAction("edit.beat.setTremoloPicking", {
      marks: 3,
      style: TremoloPickingStyle.Default,
    }, ctx);
    const beat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    expect((beat.get("tremoloPicking") as Y.Map<unknown>).toJSON()).toEqual({
      marks: 3,
      style: TremoloPickingStyle.Default,
    });

    executeAction("edit.beat.setTremoloPicking", null, ctx);
    expect(beat.get("tremoloPicking")).toBeNull();
  });
});

// ─── setRest ──────────────────────────────────────────────────────────────────

describe("edit.beat.setRest", () => {
  it("setRest(true) clears notes and sets isEmpty=false", () => {
    placeNoteDirectly(getScoreMap()!, 0, 0, 0, 5, 3);

    executeAction("edit.beat.setRest", true, ctx);

    const yBeat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(0);
    expect(yBeat.get("isEmpty")).toBe(false);
  });

  it("setRest(false) on tab track adds default fret-0 note", () => {
    executeAction("edit.beat.setRest", false, ctx);

    const yBeat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(1);
    expect(yNotes.get(0).get("fret")).toBe(0);
    expect(yNotes.get(0).get("string")).toBe(3);
    expect(yBeat.get("isEmpty")).toBe(false);
  });

  it("setRest(false) on notation-only track does NOT add a note", () => {
    resetMockState();
    destroyDoc();
    initDoc();
    seedTrackWithConfig(getScoreMap()!, 1, { name: "Piano", showTablature: false, tuning: [] });
    selectBeat(defaultSel);

    executeAction("edit.beat.setRest", false, ctx);

    const yNotes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(0);
  });

  it("does nothing without selection", () => {
    selectBeat(null);
    executeAction("edit.beat.setRest", true, ctx);
    // beat should still have its default isEmpty=true (unchanged)
    expect(resolveYBeatHelper(0, 0, 0, 0, 0)!.get("isEmpty")).toBe(true);
  });
});

// ─── drumkit (percussion) ──────────────────────────────────────────────────────

describe("edit.beat (drumkit percussion)", () => {
  const drumSel = { ...defaultSel, string: 2 as number | null };

  beforeEach(() => {
    resetMockState();
    destroyDoc();
    initDoc();
    seedTrackWithConfig(getScoreMap()!, 1, {
      name: "Drums",
      isPercussion: true,
    });
    selectBeat(drumSel);
  });

  it("setDuration updates Y.Map", () => {
    executeAction("edit.beat.setDuration", Duration.Sixteenth, ctx);
    expect(resolveYBeatHelper(0, 0, 0, 0, 0)!.get("duration")).toBe(Duration.Sixteenth);
  });

  it("placeNote adds note with percussionArticulation", () => {
    executeAction("edit.beat.placeNote", undefined, ctx);
    const yNotes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(1);
    expectPercussionNote(yNotes.get(0), 48);
  });

  it("placeNote uses a custom track articulation index", () => {
    const tracks = getScoreMap()!.get("tracks") as Y.Array<Y.Map<unknown>>;
    const articulations = tracks
      .get(0)
      .get("percussionArticulations") as Y.Array<Y.Map<unknown>>;
    const first = new Y.Map<unknown>();
    first.set("id", 42);
    const second = new Y.Map<unknown>();
    second.set("id", 48);
    articulations.push([first, second]);

    executeAction("edit.beat.placeNote", undefined, ctx);

    const notes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get(
      "notes",
    ) as Y.Array<Y.Map<unknown>>;
    expect(notes.get(0).get("percussionArticulation")).toBe(1);
  });

  it("deleteNote removes percussion note", () => {
    placePercussionNoteDirectly(getScoreMap()!, 0, 0, 0, 42);
    setSelectedNoteIndex(0);

    executeAction("edit.beat.deleteNote", undefined, ctx);

    const yNotes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(0);
  });
});

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe("edit.beat edge cases", () => {
  it("applyBeatUpdates does nothing when Y.Beat cannot be resolved", () => {
    // Select a beat at an invalid index
    selectBeat({ ...defaultSel, beatIndex: 999 });
    const result = executeAction("edit.beat.setDuration", 8, ctx);
    // Should not throw, should just return without doing anything
    expect(result).toBeUndefined();
  });

  it("placeNote does nothing when string is null", () => {
    selectBeat({ ...defaultSel, string: null });

    executeAction("edit.beat.placeNote", 5, ctx);

    const yNotes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(0);
  });

  it("insertRestBefore uses beat duration when not specified", () => {
    getScoreMap()!.doc!.transact(() => {
      resolveYBeatHelper(0, 0, 0, 0, 0)!.set("duration", 8);
    });

    executeAction("edit.beat.insertRestBefore", undefined, ctx);

    const yBeat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    expect(yBeat.get("duration")).toBe(8);
  });

  it("insertRestAfter uses beat duration when not specified", () => {
    getScoreMap()!.doc!.transact(() => {
      resolveYBeatHelper(0, 0, 0, 0, 0)!.set("duration", 16);
    });

    executeAction("edit.beat.insertRestAfter", undefined, ctx);

    const yVoice = resolveYVoiceHelper(0, 0, 0, 0)!;
    const yBeats = yVoice.get("beats") as Y.Array<Y.Map<unknown>>;
    expect(yBeats.length).toBe(2);
    expect(yBeats.get(1).get("duration")).toBe(16);
  });
});
