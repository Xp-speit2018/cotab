import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Y from "yjs";
import {
  resetMockState,
  selectBeat,
  setSelectedNoteIndex,
  setMockApiScore,
  seedOneTrackScore,
  seedTrackWithConfig,
  placeNoteDirectly,
  placePercussionNoteDirectly,
  addBeatsDirectly,
  buildMockAlphaTabScore,
  expectPercussionNote,
  VIOLIN_TUNING,
  testContext,
} from "@/test/setup";
import {
  initDoc,
  destroyDoc,
  getScoreMap,
  resolveYBeat,
  resolveYVoice,
} from "@/core/sync";
import { Duration } from "@/core/schema";
import { executeAction } from "@/actions/registry";
import { resolveBeat } from "@/stores/player-helpers";
import "@/actions/edit-beat";

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

function mockTabBeat(opts?: { notes?: Array<{ string: number; fret: number }>; duration?: number; isEmpty?: boolean; isRest?: boolean }) {
  const notes = opts?.notes ?? [];
  const mockBeat = {
    notes,
    duration: opts?.duration ?? 4,
    isEmpty: opts?.isEmpty ?? notes.length === 0,
    isRest: opts?.isRest ?? false,
    voice: { bar: { clef: 4 } },
  };
  vi.mocked(resolveBeat).mockReturnValue(mockBeat as never);
  setMockApiScore(buildMockAlphaTabScore({
    tracks: [{
      staves: [{
        showTablature: true,
        tuning: [40, 45, 50, 55, 59, 64],
        bars: [{ voices: [{ beats: [mockBeat as never] }] }],
      }],
    }],
  }));
  return mockBeat;
}

// ─── setDuration ──────────────────────────────────────────────────────────────

describe("edit.beat.setDuration", () => {
  it("updates Y.Map duration field", () => {
    executeAction("edit.beat.setDuration", Duration.Eighth, ctx);
    const yBeat = resolveYBeat(0, 0, 0, 0, 0)!;
    expect(yBeat.get("duration")).toBe(Duration.Eighth);
  });

  it("can cycle through durations", () => {
    executeAction("edit.beat.setDuration", Duration.Sixteenth, ctx);
    expect(resolveYBeat(0, 0, 0, 0, 0)!.get("duration")).toBe(Duration.Sixteenth);
    executeAction("edit.beat.setDuration", Duration.Half, ctx);
    expect(resolveYBeat(0, 0, 0, 0, 0)!.get("duration")).toBe(Duration.Half);
  });
});

// ─── toggleEmpty ──────────────────────────────────────────────────────────────

describe("edit.beat.toggleEmpty", () => {
  it("flips isEmpty flag from true to false", () => {
    expect(resolveYBeat(0, 0, 0, 0, 0)!.get("isEmpty")).toBe(true);
    executeAction("edit.beat.toggleEmpty", undefined, ctx);
    expect(resolveYBeat(0, 0, 0, 0, 0)!.get("isEmpty")).toBe(false);
  });

  it("flips isEmpty flag from false to true", () => {
    executeAction("edit.beat.toggleEmpty", undefined, ctx);
    executeAction("edit.beat.toggleEmpty", undefined, ctx);
    expect(resolveYBeat(0, 0, 0, 0, 0)!.get("isEmpty")).toBe(true);
  });
});

// ─── placeNote (guitar tab) ───────────────────────────────────────────────────

describe("edit.beat.placeNote (guitar tab)", () => {
  it("adds note to beat's notes array", () => {
    mockTabBeat();
    executeAction("edit.beat.placeNote", 5, ctx);

    const yBeat = resolveYBeat(0, 0, 0, 0, 0)!;
    const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(1);
    expect(yNotes.get(0).get("fret")).toBe(5);
    expect(yNotes.get(0).get("string")).toBe(3);
  });

  it("sets isEmpty to false", () => {
    mockTabBeat();
    executeAction("edit.beat.placeNote", 3, ctx);
    expect(resolveYBeat(0, 0, 0, 0, 0)!.get("isEmpty")).toBe(false);
  });

  it("updates fret on existing string", () => {
    placeNoteDirectly(getScoreMap()!, 0, 0, 0, 5, 3);
    mockTabBeat({ notes: [{ string: 3, fret: 5 }] });

    executeAction("edit.beat.placeNote", 7, ctx);

    const yNotes = resolveYBeat(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(1);
    expect(yNotes.get(0).get("fret")).toBe(7);
  });

  it("does nothing without selection", () => {
    selectBeat(null);
    mockTabBeat();
    executeAction("edit.beat.placeNote", 5, ctx);
    const yNotes = resolveYBeat(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(0);
  });
});

// ─── deleteNote ───────────────────────────────────────────────────────────────

describe("edit.beat.deleteNote", () => {
  it("clears notes array when single note", () => {
    placeNoteDirectly(getScoreMap()!, 0, 0, 0, 5, 3);
    mockTabBeat({ notes: [{ string: 3, fret: 5 }] });
    setSelectedNoteIndex(0);

    executeAction("edit.beat.deleteNote", undefined, ctx);

    const yNotes = resolveYBeat(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(0);
  });

  it("removes only selected note when multiple", () => {
    placeNoteDirectly(getScoreMap()!, 0, 0, 0, 5, 3);
    placeNoteDirectly(getScoreMap()!, 0, 0, 0, 7, 1);
    mockTabBeat({ notes: [{ string: 3, fret: 5 }, { string: 1, fret: 7 }] });
    setSelectedNoteIndex(0);

    executeAction("edit.beat.deleteNote", undefined, ctx);

    const yNotes = resolveYBeat(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(1);
    expect(yNotes.get(0).get("string")).toBe(1);
  });

  it("removes beat from voice when beat is rest", () => {
    addBeatsDirectly(getScoreMap()!, 0, 0, 1);
    mockTabBeat({ notes: [], isRest: true });

    const yVoiceBefore = resolveYVoice(0, 0, 0, 0)!;
    const beatsBefore = (yVoiceBefore.get("beats") as Y.Array<unknown>).length;

    const result = executeAction("edit.beat.deleteNote", undefined, ctx);

    const yVoiceAfter = resolveYVoice(0, 0, 0, 0)!;
    const beatsAfter = (yVoiceAfter.get("beats") as Y.Array<unknown>).length;
    expect(beatsAfter).toBe(beatsBefore - 1);
    expect(result).toBe(true);
  });

  it("blocks when voice has only 1 beat and beat is rest", () => {
    mockTabBeat({ notes: [], isRest: true });
    const result = executeAction("edit.beat.deleteNote", undefined, ctx);
    expect(result).toBe(false);
  });
});

// ─── insertRestBefore / insertRestAfter ───────────────────────────────────────

describe("edit.beat.insertRestBefore", () => {
  it("inserts a beat before the current position", () => {
    mockTabBeat({ duration: 4 });
    const beatsBefore = (resolveYVoice(0, 0, 0, 0)!.get("beats") as Y.Array<unknown>).length;

    executeAction("edit.beat.insertRestBefore", 8, ctx);

    const beatsAfter = (resolveYVoice(0, 0, 0, 0)!.get("beats") as Y.Array<unknown>).length;
    expect(beatsAfter).toBe(beatsBefore + 1);

    const newBeat = resolveYBeat(0, 0, 0, 0, 0)!;
    expect(newBeat.get("duration")).toBe(8);
    expect(newBeat.get("isEmpty")).toBe(false);
  });
});

describe("edit.beat.insertRestAfter", () => {
  it("inserts a beat after the current position", () => {
    mockTabBeat({ duration: 4 });
    executeAction("edit.beat.insertRestAfter", 16, ctx);

    const beats = resolveYVoice(0, 0, 0, 0)!.get("beats") as Y.Array<Y.Map<unknown>>;
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
    expect(resolveYBeat(0, 0, 0, 0, 0)!.get("dots")).toBe(1);
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
    setMockApiScore(buildMockAlphaTabScore({
      tracks: [{
        staves: [{
          showTablature: true,
          tuning: VIOLIN_TUNING,
          bars: [{ voices: [{ beats: [{ notes: [], duration: 4, isEmpty: true, isRest: false, voice: { bar: { clef: 4 } } }] }] }],
        }],
      }],
    }));
    vi.mocked(resolveBeat).mockReturnValue({
      notes: [],
      duration: 4,
      isEmpty: true,
      isRest: false,
      voice: { bar: { clef: 4 } },
    } as never);
  });

  it("setDuration updates Y.Map", () => {
    executeAction("edit.beat.setDuration", Duration.Eighth, ctx);
    expect(resolveYBeat(0, 0, 0, 0, 0)!.get("duration")).toBe(Duration.Eighth);
  });

  it("placeNote adds note on 4-string staff", () => {
    executeAction("edit.beat.placeNote", 3, ctx);
    const yNotes = resolveYBeat(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
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
    setMockApiScore(buildMockAlphaTabScore({
      tracks: [{
        staves: [{
          showTablature: false,
          tuning: [],
          bars: [{ clef: 4, voices: [{ beats: [{ notes: [], duration: 4, isEmpty: true, isRest: false, voice: { bar: { clef: 4 } } }] }] }],
        }],
      }],
    }));
    vi.mocked(resolveBeat).mockReturnValue({
      notes: [],
      duration: 4,
      isEmpty: true,
      isRest: false,
      voice: { bar: { clef: 4 } },
    } as never);
  });

  it("setDuration updates Y.Map", () => {
    executeAction("edit.beat.setDuration", Duration.Quarter, ctx);
    expect(resolveYBeat(0, 0, 0, 0, 0)!.get("duration")).toBe(Duration.Quarter);
  });

  it("placeNote adds note with octave and tone from snapPositionToPitch", () => {
    executeAction("edit.beat.placeNote", 7, ctx);
    const yNotes = resolveYBeat(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(1);
    expect(yNotes.get(0).get("octave")).toBe(4);
    expect(yNotes.get(0).get("tone")).toBe(7);
  });
});

// ─── applyBeatUpdates property setters (parametrized) ──────────────────────────

describe("applyBeatUpdates property setters", () => {
  it.each([
    ["edit.beat.setSlashed",       "slashed",        true],
    ["edit.beat.setDynamics",      "dynamics",       5],
    ["edit.beat.setVibrato",       "vibrato",        1],
    ["edit.beat.setDeadSlapped",   "deadSlapped",    true],
    ["edit.beat.setLegatoOrigin",  "isLegatoOrigin", true],
    ["edit.beat.setTap",           "tap",            true],
    ["edit.beat.setSlap",          "slap",           true],
    ["edit.beat.setPop",           "pop",            true],
    ["edit.beat.setPickStroke",    "pickStroke",     1],
    ["edit.beat.setWhammyBarType", "whammyBarType",  1],
    ["edit.beat.setBrushType",     "brushType",      1],
    ["edit.beat.setCrescendo",     "crescendo",      1],
    ["edit.beat.setFade",          "fade",           1],
    ["edit.beat.setGolpe",         "golpe",          1],
    ["edit.beat.setWahPedal",      "wahPedal",       1],
  ] as const)("%s sets %s on Y.Map", (actionId, field, value) => {
    executeAction(actionId, value, ctx);
    expect(resolveYBeat(0, 0, 0, 0, 0)!.get(field)).toBe(value);
  });

  it("does nothing without selection", () => {
    const before = resolveYBeat(0, 0, 0, 0, 0)!.get("slashed");
    selectBeat(null);
    executeAction("edit.beat.setSlashed", true, ctx);
    expect(resolveYBeat(0, 0, 0, 0, 0)!.get("slashed")).toBe(before);
  });
});

// ─── setRest ──────────────────────────────────────────────────────────────────

describe("edit.beat.setRest", () => {
  it("setRest(true) clears notes and sets isEmpty=false", () => {
    mockTabBeat();
    placeNoteDirectly(getScoreMap()!, 0, 0, 0, 5, 3);

    executeAction("edit.beat.setRest", true, ctx);

    const yBeat = resolveYBeat(0, 0, 0, 0, 0)!;
    const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(0);
    expect(yBeat.get("isEmpty")).toBe(false);
  });

  it("setRest(false) on tab track adds default fret-0 note", () => {
    mockTabBeat();
    executeAction("edit.beat.setRest", false, ctx);

    const yBeat = resolveYBeat(0, 0, 0, 0, 0)!;
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
    setMockApiScore(buildMockAlphaTabScore({
      tracks: [{
        staves: [{
          showTablature: false,
          tuning: [],
          bars: [{ voices: [{ beats: [{ notes: [], duration: 4, isEmpty: true, isRest: true }] }] }],
        }],
      }],
    }));

    executeAction("edit.beat.setRest", false, ctx);

    const yNotes = resolveYBeat(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(0);
  });

  it("does nothing without selection", () => {
    selectBeat(null);
    mockTabBeat();
    executeAction("edit.beat.setRest", true, ctx);
    // beat should still have its default isEmpty=true (unchanged)
    expect(resolveYBeat(0, 0, 0, 0, 0)!.get("isEmpty")).toBe(true);
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
    setMockApiScore(buildMockAlphaTabScore({
      tracks: [{
        isPercussion: true,
        staves: [{
          showTablature: false,
          tuning: [],
          bars: [{ clef: 0, voices: [{ beats: [{ notes: [], duration: 4, isEmpty: true, isRest: false, voice: { bar: { clef: 0 } } }] }] }],
        }],
      }],
    }));
    vi.mocked(resolveBeat).mockReturnValue({
      notes: [],
      duration: 4,
      isEmpty: true,
      isRest: false,
      voice: { bar: { clef: 0 } },
    } as never);
  });

  it("setDuration updates Y.Map", () => {
    executeAction("edit.beat.setDuration", Duration.Sixteenth, ctx);
    expect(resolveYBeat(0, 0, 0, 0, 0)!.get("duration")).toBe(Duration.Sixteenth);
  });

  it("placeNote adds note with percussionArticulation", () => {
    executeAction("edit.beat.placeNote", undefined, ctx);
    const yNotes = resolveYBeat(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(1);
    expectPercussionNote(yNotes.get(0), 42);
  });

  it("deleteNote removes percussion note", () => {
    placePercussionNoteDirectly(getScoreMap()!, 0, 0, 0, 42);
    setMockApiScore(buildMockAlphaTabScore({
      tracks: [{
        isPercussion: true,
        staves: [{
          bars: [{ voices: [{ beats: [{ notes: [{ percussionArticulation: 42 }], duration: 4, isEmpty: false, isRest: false, voice: { bar: { clef: 0 } } }] }] }],
        }],
      }],
    }));
    vi.mocked(resolveBeat).mockReturnValue({
      notes: [{ percussionArticulation: 42 }],
      duration: 4,
      isEmpty: false,
      isRest: false,
      voice: { bar: { clef: 0 } },
    } as never);
    setSelectedNoteIndex(0);

    executeAction("edit.beat.deleteNote", undefined, ctx);

    const yNotes = resolveYBeat(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(0);
  });
});
