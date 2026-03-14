import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Y from "yjs";
import {
  resetMockState,
  selectBeat,
  setSelectedNoteIndex,
  setMockApiScore,
  seedOneTrackScore,
  placeNoteDirectly,
  addBeatsDirectly,
  buildMockAlphaTabScore,
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
const ctx = { source: "test" as const };

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

// ─── placeNote (tab mode) ─────────────────────────────────────────────────────

describe("edit.beat.placeNote (tab mode)", () => {
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
