import * as Y from "yjs";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  resetMockState,
  testContext,
  seedOneTrackScore,
  selectBeat,
  setSelectionRange,
  placeNoteDirectly,
  addBeatsDirectly,
} from "@/test/setup";
import {
  initDoc,
  destroyDoc,
  getScoreMap,
  getUndoManager,
  transact,
} from "@/test/setup";

// Shared clipboard state on globalThis (hoisting-safe)
(globalThis as Record<string, unknown>).__testClipboard = null;
const getClipboard = () => (globalThis as Record<string, unknown>).__testClipboard as string | null;
const setClipboard = (text: string | null) => { (globalThis as Record<string, unknown>).__testClipboard = text; };

// Mock engine in test file (vi.mock is hoisted)
vi.mock("@/core/engine", () => {
  const ms = () => (globalThis as Record<string, unknown>).__testMockState as Record<string, unknown> | undefined;
  return {
    engine: {
      get selectedBeat() { return ms()?.selectedBeat ?? null; },
      get selectedNoteIndex() { return (ms()?.selectedNoteIndex as number) ?? -1; },
      get selectionRange() { return ms()?.selectionRange ?? null; },
      pendingSelection: null as unknown,
      resolveYTrack: vi.fn((idx: number) => {
        const sm = (globalThis as Record<string, unknown>).__testEngineRefs?.scoreMap as Y.Map<unknown> | undefined;
        if (!sm) return null;
        const tracks = sm.get("tracks") as Y.Array<Y.Map<unknown>> | undefined;
        if (!tracks || idx < 0 || idx >= tracks.length) return null;
        return tracks.get(idx);
      }),
      resolveYStaff: vi.fn((trackIdx: number, staffIdx: number) => {
        const sm = (globalThis as Record<string, unknown>).__testEngineRefs?.scoreMap as Y.Map<unknown> | undefined;
        if (!sm) return null;
        const tracks = sm.get("tracks") as Y.Array<Y.Map<unknown>> | undefined;
        if (!tracks || trackIdx < 0 || trackIdx >= tracks.length) return null;
        const track = tracks.get(trackIdx);
        const staves = track.get("staves") as Y.Array<Y.Map<unknown>> | undefined;
        if (!staves || staffIdx < 0 || staffIdx >= staves.length) return null;
        return staves.get(staffIdx);
      }),
      resolveYVoice: vi.fn((trackIdx: number, staffIdx: number, barIdx: number, voiceIdx: number) => {
        const sm = (globalThis as Record<string, unknown>).__testEngineRefs?.scoreMap as Y.Map<unknown> | undefined;
        if (!sm) return null;
        const tracks = sm.get("tracks") as Y.Array<Y.Map<unknown>> | undefined;
        if (!tracks || trackIdx < 0 || trackIdx >= tracks.length) return null;
        const track = tracks.get(trackIdx);
        const staves = track.get("staves") as Y.Array<Y.Map<unknown>> | undefined;
        if (!staves || staffIdx < 0 || staffIdx >= staves.length) return null;
        const staff = staves.get(staffIdx);
        const bars = staff.get("bars") as Y.Array<Y.Map<unknown>> | undefined;
        if (!bars || barIdx < 0 || barIdx >= bars.length) return null;
        const bar = bars.get(barIdx);
        const voices = bar.get("voices") as Y.Array<Y.Map<unknown>> | undefined;
        if (!voices || voiceIdx < 0 || voiceIdx >= voices.length) return null;
        return voices.get(voiceIdx);
      }),
      getScoreMap: vi.fn(() => (globalThis as Record<string, unknown>).__testEngineRefs?.scoreMap ?? null),
      getUndoManager: vi.fn(() => (globalThis as Record<string, unknown>).__testEngineRefs?.undoManager ?? null),
      localEditYDoc: vi.fn((fn: () => void, _nextSelection?: unknown) => {
        const doc = (globalThis as Record<string, unknown>).__testEngineRefs?.doc as Y.Doc | undefined;
        if (doc) doc.transact(fn, doc.clientID);
      }),
      // Clipboard methods - use globalThis for hoisting safety
      setClipboard: vi.fn((text: string | null) => {
        (globalThis as Record<string, unknown>).__testClipboard = text;
      }),
      getClipboard: vi.fn(() => (globalThis as Record<string, unknown>).__testClipboard as string | null),
    },
    importTrack: vi.fn(),
    FILE_IMPORT_ORIGIN: "file-import",
  };
});

import { createNote } from "@/core/schema";
import { executeAction } from "@/core/actions/registry";
import { engine } from "@/core/engine";
import "@/core/actions/edit-clipboard";
import "@/core/actions/edit-history";

const ctx = testContext();

function getVoiceBeats(
  scoreMap: Y.Map<unknown>,
  trackIndex: number,
  barIndex: number,
  staffIndex = 0,
  voiceIndex = 0,
): Y.Array<Y.Map<unknown>> {
  const yTracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;
  const yStaves = yTracks.get(trackIndex).get("staves") as Y.Array<Y.Map<unknown>>;
  const yBars = yStaves.get(staffIndex).get("bars") as Y.Array<Y.Map<unknown>>;
  const yVoices = yBars.get(barIndex).get("voices") as Y.Array<Y.Map<unknown>>;
  return yVoices.get(voiceIndex).get("beats") as Y.Array<Y.Map<unknown>>;
}

function sel(overrides: Partial<{
  trackIndex: number;
  staffIndex: number;
  barIndex: number;
  voiceIndex: number;
  beatIndex: number;
  string: number | null;
}> = {}) {
  return {
    trackIndex: 0,
    staffIndex: 0,
    barIndex: 0,
    voiceIndex: 0,
    beatIndex: 0,
    string: 1 as number | null,
    ...overrides,
  };
}

/** Get clipboard buffer as parsed object. */
function getClipboardBuffer(): { bars: unknown[]; trackUuid: string; staffUuid: string } | null {
  const text = getClipboard();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Clear clipboard buffer. */
function clearClipboardBuffer(): void {
  setClipboard(null);
}

beforeEach(() => {
  resetMockState();
  clearClipboardBuffer();
  destroyDoc();
  initDoc();
});

// ─── Basic operations ────────────────────────────────────────────────────────

describe("edit.copy", () => {
  it("stores all beats from bar's voice", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 1);
    placeNoteDirectly(scoreMap, 0, 0, 0, 5, 1);

    selectBeat(sel());
    executeAction("edit.copy", undefined, ctx);

    const buf = getClipboardBuffer();
    expect(buf).not.toBeNull();
    expect(buf!.bars).toHaveLength(1);
    expect(buf!.bars[0]).toHaveLength(1);
    expect(buf!.bars[0][0].notes).toHaveLength(1);
    expect(buf!.bars[0][0].notes[0].fret).toBe(5);
  });

  it("does nothing without selection", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 1);

    selectBeat(null);
    executeAction("edit.copy", undefined, ctx);

    expect(getClipboardBuffer()).toBeNull();
  });

  it("does not create an undo entry", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 1);
    const um = getUndoManager()!;
    um.clear();

    selectBeat(sel());
    executeAction("edit.copy", undefined, ctx);

    expect(um.undoStack.length).toBe(0);
  });
});

describe("edit.cut", () => {
  it("copies then clears bar (leaves single empty beat)", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 1);
    placeNoteDirectly(scoreMap, 0, 0, 0, 7, 2);

    const um = getUndoManager()!;
    um.clear();

    selectBeat(sel());
    executeAction("edit.cut", undefined, ctx);

    // Buffer has original beat with note
    const buf = getClipboardBuffer();
    expect(buf).not.toBeNull();
    expect(buf!.bars[0][0].notes).toHaveLength(1);
    expect(buf!.bars[0][0].notes[0].fret).toBe(7);

    // Bar now has single empty beat
    const yBeats = getVoiceBeats(scoreMap, 0, 0);
    expect(yBeats.length).toBe(1);
    expect((yBeats.get(0).get("notes") as Y.Array<unknown>).length).toBe(0);
    expect(yBeats.get(0).get("isEmpty")).toBe(true);
  });

  it("does nothing without selection", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 1);

    selectBeat(null);
    executeAction("edit.cut", undefined, ctx);

    expect(getClipboardBuffer()).toBeNull();
  });

  it("creates a single undo step", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 1);
    placeNoteDirectly(scoreMap, 0, 0, 0, 3, 1);

    const um = getUndoManager()!;
    um.clear();

    selectBeat(sel());
    executeAction("edit.cut", undefined, ctx);

    expect(um.undoStack.length).toBe(1);
  });
});

describe("edit.paste", () => {
  it("replaces target bar's voice with buffer beats", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 2);
    placeNoteDirectly(scoreMap, 0, 0, 0, 5, 1);

    const um = getUndoManager()!;
    um.clear();

    // Copy from bar 0
    selectBeat(sel({ barIndex: 0 }));
    executeAction("edit.copy", undefined, ctx);

    // Paste into bar 1
    selectBeat(sel({ barIndex: 1 }));
    executeAction("edit.paste", undefined, ctx);

    const yBeats = getVoiceBeats(scoreMap, 0, 1);
    expect(yBeats.length).toBe(1);
    const notes = yBeats.get(0).get("notes") as Y.Array<Y.Map<unknown>>;
    expect(notes.length).toBe(1);
    expect(notes.get(0).get("fret")).toBe(5);
  });

  it("does nothing without buffer", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 1);

    selectBeat(sel());
    executeAction("edit.paste", undefined, ctx);

    // Bar unchanged — still one empty beat
    const yBeats = getVoiceBeats(scoreMap, 0, 0);
    expect(yBeats.length).toBe(1);
  });

  it("does nothing without selection", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 1);

    // Put something in the buffer
    selectBeat(sel());
    executeAction("edit.copy", undefined, ctx);

    selectBeat(null);
    executeAction("edit.paste", undefined, ctx);

    // Should not crash
    expect(getClipboardBuffer()).not.toBeNull();
  });

  it("is blocked for different track/staff", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 1);

    selectBeat(sel());
    executeAction("edit.copy", undefined, ctx);

    const buf = getClipboardBuffer()!;
    // Modify buffer UUIDs to simulate different track
    const originalTrackUuid = buf.trackUuid;
    (buf as { trackUuid: string }).trackUuid = "different-track-uuid";
    // Update engine clipboard with modified data
    engine.setClipboard(JSON.stringify(buf));

    selectBeat(sel());
    const um = getUndoManager()!;
    um.clear();

    executeAction("edit.paste", undefined, ctx);

    // No undo entry = paste was blocked
    expect(um.undoStack.length).toBe(0);

    // Restore
    (buf as { trackUuid: string }).trackUuid = originalTrackUuid;
    engine.setClipboard(JSON.stringify(buf));
  });

  it("creates a single undo step", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 2);
    placeNoteDirectly(scoreMap, 0, 0, 0, 5, 1);

    const um = getUndoManager()!;
    um.clear();

    selectBeat(sel({ barIndex: 0 }));
    executeAction("edit.copy", undefined, ctx);

    selectBeat(sel({ barIndex: 1 }));
    executeAction("edit.paste", undefined, ctx);

    expect(um.undoStack.length).toBe(1);
  });

  it("assigns fresh UUIDs for all pasted beats and notes", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 2);
    placeNoteDirectly(scoreMap, 0, 0, 0, 5, 1);

    // Snapshot original UUIDs
    const origBeats = getVoiceBeats(scoreMap, 0, 0);
    const origBeatUuid = origBeats.get(0).get("uuid") as string;
    const origNoteUuid = (origBeats.get(0).get("notes") as Y.Array<Y.Map<unknown>>)
      .get(0)
      .get("uuid") as string;

    selectBeat(sel({ barIndex: 0 }));
    executeAction("edit.copy", undefined, ctx);

    selectBeat(sel({ barIndex: 1 }));
    executeAction("edit.paste", undefined, ctx);

    const pastedBeats = getVoiceBeats(scoreMap, 0, 1);
    const pastedBeatUuid = pastedBeats.get(0).get("uuid") as string;
    const pastedNoteUuid = (pastedBeats.get(0).get("notes") as Y.Array<Y.Map<unknown>>)
      .get(0)
      .get("uuid") as string;

    expect(pastedBeatUuid).not.toBe(origBeatUuid);
    expect(pastedNoteUuid).not.toBe(origNoteUuid);
  });
});

// ─── Bar content integrity ───────────────────────────────────────────────────

describe("bar content integrity", () => {
  it("multi-beat bar copied and pasted correctly", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 2);
    // Add extra beats to bar 0
    addBeatsDirectly(scoreMap, 0, 0, 3, 8);
    placeNoteDirectly(scoreMap, 0, 0, 0, 5, 1);
    placeNoteDirectly(scoreMap, 0, 0, 1, 7, 2);
    placeNoteDirectly(scoreMap, 0, 0, 2, 9, 3);

    selectBeat(sel({ barIndex: 0 }));
    executeAction("edit.copy", undefined, ctx);

    selectBeat(sel({ barIndex: 1 }));
    executeAction("edit.paste", undefined, ctx);

    const yBeats = getVoiceBeats(scoreMap, 0, 1);
    expect(yBeats.length).toBe(4);
    expect(
      (yBeats.get(0).get("notes") as Y.Array<Y.Map<unknown>>).get(0).get("fret"),
    ).toBe(5);
    expect(
      (yBeats.get(1).get("notes") as Y.Array<Y.Map<unknown>>).get(0).get("fret"),
    ).toBe(7);
    expect(
      (yBeats.get(2).get("notes") as Y.Array<Y.Map<unknown>>).get(0).get("fret"),
    ).toBe(9);
  });

  it("note properties round-trip correctly", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 2);

    // Place a note with special properties
    const doc = scoreMap.doc!;
    doc.transact(() => {
      const yBeats = getVoiceBeats(scoreMap, 0, 0);
      const yBeat = yBeats.get(0);
      const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
      const yNote = createNote(12, 3);
      yNote.set("isGhost", true);
      yNote.set("isDead", true);
      yNote.set("vibrato", 2);
      yNote.set("bendType", 2);
      yNote.set("isLetRing", true);
      yNote.set("isPalmMute", true);
      yNotes.push([yNote]);
      yBeat.set("isEmpty", false);
    }, doc.clientID);

    selectBeat(sel({ barIndex: 0 }));
    executeAction("edit.copy", undefined, ctx);

    selectBeat(sel({ barIndex: 1 }));
    executeAction("edit.paste", undefined, ctx);

    const yBeats = getVoiceBeats(scoreMap, 0, 1);
    const pastedNote = (yBeats.get(0).get("notes") as Y.Array<Y.Map<unknown>>).get(0);
    expect(pastedNote.get("fret")).toBe(12);
    expect(pastedNote.get("string")).toBe(3);
    expect(pastedNote.get("isGhost")).toBe(true);
    expect(pastedNote.get("isDead")).toBe(true);
    expect(pastedNote.get("vibrato")).toBe(2);
    expect(pastedNote.get("bendType")).toBe(2);
    expect(pastedNote.get("isLetRing")).toBe(true);
    expect(pastedNote.get("isPalmMute")).toBe(true);
  });

  it("beat properties round-trip correctly", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 2);

    const doc = scoreMap.doc!;
    doc.transact(() => {
      const yBeats = getVoiceBeats(scoreMap, 0, 0);
      const yBeat = yBeats.get(0);
      yBeat.set("duration", 8);
      yBeat.set("dots", 1);
      yBeat.set("tap", true);
      yBeat.set("slap", true);
      yBeat.set("isEmpty", false);
    }, doc.clientID);

    selectBeat(sel({ barIndex: 0 }));
    executeAction("edit.copy", undefined, ctx);

    selectBeat(sel({ barIndex: 1 }));
    executeAction("edit.paste", undefined, ctx);

    const yBeats = getVoiceBeats(scoreMap, 0, 1);
    const pastedBeat = yBeats.get(0);
    expect(pastedBeat.get("duration")).toBe(8);
    expect(pastedBeat.get("dots")).toBe(1);
    expect(pastedBeat.get("tap")).toBe(true);
    expect(pastedBeat.get("slap")).toBe(true);
    expect(pastedBeat.get("isEmpty")).toBe(false);
  });

  it("empty bar copy+paste works", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 2);
    placeNoteDirectly(scoreMap, 0, 1, 0, 5, 1);

    // Copy empty bar 0
    selectBeat(sel({ barIndex: 0 }));
    executeAction("edit.copy", undefined, ctx);

    // Paste into bar 1 which has a note
    selectBeat(sel({ barIndex: 1 }));
    executeAction("edit.paste", undefined, ctx);

    // Bar 1 should now have single empty beat
    const yBeats = getVoiceBeats(scoreMap, 0, 1);
    expect(yBeats.length).toBe(1);
    expect(yBeats.get(0).get("isEmpty")).toBe(true);
  });

  it("multi-note beats preserved across copy/paste", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 2);
    // Two notes on the same beat
    placeNoteDirectly(scoreMap, 0, 0, 0, 5, 1);
    placeNoteDirectly(scoreMap, 0, 0, 0, 7, 2);

    selectBeat(sel({ barIndex: 0 }));
    executeAction("edit.copy", undefined, ctx);

    selectBeat(sel({ barIndex: 1 }));
    executeAction("edit.paste", undefined, ctx);

    const yBeats = getVoiceBeats(scoreMap, 0, 1);
    const notes = yBeats.get(0).get("notes") as Y.Array<Y.Map<unknown>>;
    expect(notes.length).toBe(2);
    expect(notes.get(0).get("fret")).toBe(5);
    expect(notes.get(1).get("fret")).toBe(7);
  });
});

// ─── Multi-bar selection ─────────────────────────────────────────────────────

describe("multi-bar copy/cut/paste", () => {
  it("copy 3 bars → buffer has 3 entries", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 4);
    placeNoteDirectly(scoreMap, 0, 0, 0, 5, 1);
    placeNoteDirectly(scoreMap, 0, 1, 0, 7, 2);
    placeNoteDirectly(scoreMap, 0, 2, 0, 9, 3);

    selectBeat(sel({ barIndex: 0 }));
    setSelectionRange({
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      startBarIndex: 0,
      endBarIndex: 2,
    });
    executeAction("edit.copy", undefined, ctx);

    const buf = getClipboardBuffer();
    expect(buf).not.toBeNull();
    expect(buf!.bars).toHaveLength(3);
    expect(buf!.bars[0][0].notes[0].fret).toBe(5);
    expect(buf!.bars[1][0].notes[0].fret).toBe(7);
    expect(buf!.bars[2][0].notes[0].fret).toBe(9);
  });

  it("paste 3 bars starting at bar 1 → bars 1-3 overwritten", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 5);
    placeNoteDirectly(scoreMap, 0, 0, 0, 5, 1);
    placeNoteDirectly(scoreMap, 0, 1, 0, 7, 2);
    placeNoteDirectly(scoreMap, 0, 2, 0, 9, 3);

    // Copy bars 0-2
    selectBeat(sel({ barIndex: 0 }));
    setSelectionRange({
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      startBarIndex: 0,
      endBarIndex: 2,
    });
    executeAction("edit.copy", undefined, ctx);

    // Clear range, paste at bar 1
    setSelectionRange(null);
    selectBeat(sel({ barIndex: 1 }));
    executeAction("edit.paste", undefined, ctx);

    // Bars 1, 2, 3 should now have frets 5, 7, 9
    const notes1 = getVoiceBeats(scoreMap, 0, 1).get(0).get("notes") as Y.Array<Y.Map<unknown>>;
    expect(notes1.get(0).get("fret")).toBe(5);
    const notes2 = getVoiceBeats(scoreMap, 0, 2).get(0).get("notes") as Y.Array<Y.Map<unknown>>;
    expect(notes2.get(0).get("fret")).toBe(7);
    const notes3 = getVoiceBeats(scoreMap, 0, 3).get(0).get("notes") as Y.Array<Y.Map<unknown>>;
    expect(notes3.get(0).get("fret")).toBe(9);
  });

  it("cut 2 bars → both cleared", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 3);
    placeNoteDirectly(scoreMap, 0, 0, 0, 5, 1);
    placeNoteDirectly(scoreMap, 0, 1, 0, 7, 2);

    selectBeat(sel({ barIndex: 0 }));
    setSelectionRange({
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      startBarIndex: 0,
      endBarIndex: 1,
    });
    executeAction("edit.cut", undefined, ctx);

    // Buffer has 2 bars
    const buf = getClipboardBuffer();
    expect(buf!.bars).toHaveLength(2);

    // Both bars cleared
    const beats0 = getVoiceBeats(scoreMap, 0, 0);
    expect(beats0.length).toBe(1);
    expect(beats0.get(0).get("isEmpty")).toBe(true);
    const beats1 = getVoiceBeats(scoreMap, 0, 1);
    expect(beats1.length).toBe(1);
    expect(beats1.get(0).get("isEmpty")).toBe(true);
  });

  it("multi-bar paste + undo → all bars revert", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 4);
    placeNoteDirectly(scoreMap, 0, 0, 0, 5, 1);
    placeNoteDirectly(scoreMap, 0, 1, 0, 7, 2);

    // Copy bars 0-1
    selectBeat(sel({ barIndex: 0 }));
    setSelectionRange({
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      startBarIndex: 0,
      endBarIndex: 1,
    });
    executeAction("edit.copy", undefined, ctx);

    const um = getUndoManager()!;
    um.clear();

    // Paste at bar 2
    setSelectionRange(null);
    selectBeat(sel({ barIndex: 2 }));
    executeAction("edit.paste", undefined, ctx);

    // Bars 2-3 should have notes
    expect(
      (getVoiceBeats(scoreMap, 0, 2).get(0).get("notes") as Y.Array<Y.Map<unknown>>).get(0).get("fret"),
    ).toBe(5);
    expect(
      (getVoiceBeats(scoreMap, 0, 3).get(0).get("notes") as Y.Array<Y.Map<unknown>>).get(0).get("fret"),
    ).toBe(7);

    // Undo
    um.undo();

    // Bars 2-3 should revert to empty
    const beats2 = getVoiceBeats(scoreMap, 0, 2);
    expect((beats2.get(0).get("notes") as Y.Array<unknown>).length).toBe(0);
    const beats3 = getVoiceBeats(scoreMap, 0, 3);
    expect((beats3.get(0).get("notes") as Y.Array<unknown>).length).toBe(0);
  });

  it("paste clamped to score length", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 3);
    placeNoteDirectly(scoreMap, 0, 0, 0, 5, 1);
    placeNoteDirectly(scoreMap, 0, 1, 0, 7, 2);
    placeNoteDirectly(scoreMap, 0, 2, 0, 9, 3);

    // Copy all 3 bars
    selectBeat(sel({ barIndex: 0 }));
    setSelectionRange({
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      startBarIndex: 0,
      endBarIndex: 2,
    });
    executeAction("edit.copy", undefined, ctx);

    // Paste at bar 2 — only 1 bar fits (bar 2), bars 3 and 4 don't exist
    setSelectionRange(null);
    selectBeat(sel({ barIndex: 2 }));
    executeAction("edit.paste", undefined, ctx);

    // Bar 2 should have the first copied bar's note (fret 5)
    const notes2 = getVoiceBeats(scoreMap, 0, 2).get(0).get("notes") as Y.Array<Y.Map<unknown>>;
    expect(notes2.get(0).get("fret")).toBe(5);

    // Score should still have exactly 3 bars (no new bars created)
    const masterBars = scoreMap.get("masterBars") as Y.Array<unknown>;
    expect(masterBars.length).toBe(3);
  });
});

// ─── Undo/Redo interactions ──────────────────────────────────────────────────

describe("undo/redo interactions", () => {
  it("paste → undo → bar reverts to pre-paste state", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 2);
    placeNoteDirectly(scoreMap, 0, 0, 0, 5, 1);

    const um = getUndoManager()!;
    um.clear();

    selectBeat(sel({ barIndex: 0 }));
    executeAction("edit.copy", undefined, ctx);

    selectBeat(sel({ barIndex: 1 }));
    executeAction("edit.paste", undefined, ctx);

    // Bar 1 has pasted note
    let yBeats = getVoiceBeats(scoreMap, 0, 1);
    expect((yBeats.get(0).get("notes") as Y.Array<unknown>).length).toBe(1);

    um.undo();

    // Bar 1 reverts to original empty beat
    yBeats = getVoiceBeats(scoreMap, 0, 1);
    expect(yBeats.length).toBe(1);
    expect((yBeats.get(0).get("notes") as Y.Array<unknown>).length).toBe(0);
  });

  it("paste → undo → redo → paste is re-applied", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 2);
    placeNoteDirectly(scoreMap, 0, 0, 0, 5, 1);

    const um = getUndoManager()!;
    um.clear();

    selectBeat(sel({ barIndex: 0 }));
    executeAction("edit.copy", undefined, ctx);

    selectBeat(sel({ barIndex: 1 }));
    executeAction("edit.paste", undefined, ctx);

    um.undo();
    um.redo();

    const yBeats = getVoiceBeats(scoreMap, 0, 1);
    const notes = yBeats.get(0).get("notes") as Y.Array<Y.Map<unknown>>;
    expect(notes.length).toBe(1);
    expect(notes.get(0).get("fret")).toBe(5);
  });

  it("cut → undo → original beats restored", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 1);
    placeNoteDirectly(scoreMap, 0, 0, 0, 9, 3);

    const um = getUndoManager()!;
    um.clear();

    selectBeat(sel());
    executeAction("edit.cut", undefined, ctx);

    // Bar cleared
    let yBeats = getVoiceBeats(scoreMap, 0, 0);
    expect((yBeats.get(0).get("notes") as Y.Array<unknown>).length).toBe(0);

    um.undo();

    // Original note restored
    yBeats = getVoiceBeats(scoreMap, 0, 0);
    const notes = yBeats.get(0).get("notes") as Y.Array<Y.Map<unknown>>;
    expect(notes.length).toBe(1);
    expect(notes.get(0).get("fret")).toBe(9);
    expect(notes.get(0).get("string")).toBe(3);
  });

  it("cut → undo → redo → bar cleared again", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 1);
    placeNoteDirectly(scoreMap, 0, 0, 0, 9, 3);

    const um = getUndoManager()!;
    um.clear();

    selectBeat(sel());
    executeAction("edit.cut", undefined, ctx);

    um.undo();
    um.redo();

    const yBeats = getVoiceBeats(scoreMap, 0, 0);
    expect(yBeats.length).toBe(1);
    expect((yBeats.get(0).get("notes") as Y.Array<unknown>).length).toBe(0);
    expect(yBeats.get(0).get("isEmpty")).toBe(true);
  });

  it("cut bar A → paste bar B → undo paste → undo cut → both bars restored", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 2);
    placeNoteDirectly(scoreMap, 0, 0, 0, 5, 1);
    placeNoteDirectly(scoreMap, 0, 1, 0, 9, 3);

    const um = getUndoManager()!;
    um.clear();

    // Cut bar 0
    selectBeat(sel({ barIndex: 0 }));
    executeAction("edit.cut", undefined, ctx);

    // Paste into bar 1
    selectBeat(sel({ barIndex: 1 }));
    executeAction("edit.paste", undefined, ctx);

    // Undo paste
    um.undo();

    // Bar 1 should have its original note
    let yBeats1 = getVoiceBeats(scoreMap, 0, 1);
    expect((yBeats1.get(0).get("notes") as Y.Array<Y.Map<unknown>>).get(0).get("fret")).toBe(9);

    // Undo cut
    um.undo();

    // Bar 0 should have its original note
    const yBeats0 = getVoiceBeats(scoreMap, 0, 0);
    expect((yBeats0.get(0).get("notes") as Y.Array<Y.Map<unknown>>).get(0).get("fret")).toBe(5);
  });

  it("place notes → cut → undo → notes restored", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 1);
    placeNoteDirectly(scoreMap, 0, 0, 0, 3, 1);
    placeNoteDirectly(scoreMap, 0, 0, 0, 5, 2);

    const um = getUndoManager()!;
    um.clear();

    selectBeat(sel());
    executeAction("edit.cut", undefined, ctx);

    um.undo();

    const yBeats = getVoiceBeats(scoreMap, 0, 0);
    const notes = yBeats.get(0).get("notes") as Y.Array<Y.Map<unknown>>;
    expect(notes.length).toBe(2);
  });

  it("paste twice into different bars → undo once → only second paste reverted", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 3);
    placeNoteDirectly(scoreMap, 0, 0, 0, 5, 1);

    const um = getUndoManager()!;
    um.clear();

    selectBeat(sel({ barIndex: 0 }));
    executeAction("edit.copy", undefined, ctx);

    // Paste into bar 1
    selectBeat(sel({ barIndex: 1 }));
    executeAction("edit.paste", undefined, ctx);

    // Verify bar 1 has pasted content
    const yBeats1Before = getVoiceBeats(scoreMap, 0, 1);
    expect(yBeats1Before.length).toBe(1);
    expect((yBeats1Before.get(0).get("notes") as Y.Array<unknown>).length).toBe(1);

    // Force separate undo stack entries (Yjs merges rapid transactions within 500ms)
    um.stopCapturing();

    // Paste into bar 2
    selectBeat(sel({ barIndex: 2 }));
    executeAction("edit.paste", undefined, ctx);

    expect(um.undoStack.length).toBe(2);

    // Undo second paste
    um.undo();

    // Bar 2 reverted
    const yBeats2 = getVoiceBeats(scoreMap, 0, 2);
    expect((yBeats2.get(0).get("notes") as Y.Array<unknown>).length).toBe(0);

    // Bar 1 still has pasted content
    const yBeats1 = getVoiceBeats(scoreMap, 0, 1);
    expect(yBeats1.length).toBe(1);
    const notes1 = yBeats1.get(0).get("notes") as Y.Array<Y.Map<unknown>>;
    expect(notes1.length).toBe(1);
    expect(notes1.get(0).get("fret")).toBe(5);
  });

  it("copy (no undo entry) → undo → previous edit action undone, not copy", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 1);

    const um = getUndoManager()!;
    um.clear();

    // Make an edit
    transact(() => {
      scoreMap.set("title", "Edited");
    });
    expect(scoreMap.get("title")).toBe("Edited");

    // Copy (should not create undo entry)
    selectBeat(sel());
    executeAction("edit.copy", undefined, ctx);

    // Undo should revert the title change, not the copy
    um.undo();
    expect(scoreMap.get("title")).toBe("Untitled");
  });

  it("cut → paste → undo all → redo all → final state matches original cut+paste", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 2);
    placeNoteDirectly(scoreMap, 0, 0, 0, 5, 1);

    const um = getUndoManager()!;
    um.clear();

    // Cut bar 0
    selectBeat(sel({ barIndex: 0 }));
    executeAction("edit.cut", undefined, ctx);

    // Paste into bar 1
    selectBeat(sel({ barIndex: 1 }));
    executeAction("edit.paste", undefined, ctx);

    // Snapshot final state
    const bar0BeatCount = getVoiceBeats(scoreMap, 0, 0).length;
    const bar1Notes = (getVoiceBeats(scoreMap, 0, 1).get(0).get("notes") as Y.Array<Y.Map<unknown>>);
    const bar1Fret = bar1Notes.get(0).get("fret");

    // Undo all
    um.undo(); // undo paste
    um.undo(); // undo cut

    // Redo all
    um.redo(); // redo cut
    um.redo(); // redo paste

    // Should match original cut+paste result
    expect(getVoiceBeats(scoreMap, 0, 0).length).toBe(bar0BeatCount);
    const bar1NotesAfter = getVoiceBeats(scoreMap, 0, 1).get(0).get("notes") as Y.Array<Y.Map<unknown>>;
    expect(bar1NotesAfter.get(0).get("fret")).toBe(bar1Fret);
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("cut when bar has single empty beat → buffer still set, no change on undo", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 1);

    const um = getUndoManager()!;
    um.clear();

    selectBeat(sel());
    executeAction("edit.cut", undefined, ctx);

    expect(getClipboardBuffer()).not.toBeNull();

    // Bar still has one empty beat
    const yBeats = getVoiceBeats(scoreMap, 0, 0);
    expect(yBeats.length).toBe(1);
    expect(yBeats.get(0).get("isEmpty")).toBe(true);
  });

  it("paste into bar with multiple beats → all replaced", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 2);
    // Bar 1 gets 3 extra beats
    addBeatsDirectly(scoreMap, 0, 1, 3);
    placeNoteDirectly(scoreMap, 0, 0, 0, 5, 1);

    selectBeat(sel({ barIndex: 0 }));
    executeAction("edit.copy", undefined, ctx);

    // Bar 1 has 4 beats
    expect(getVoiceBeats(scoreMap, 0, 1).length).toBe(4);

    selectBeat(sel({ barIndex: 1 }));
    executeAction("edit.paste", undefined, ctx);

    // Now bar 1 has 1 beat (from source bar 0)
    const yBeats = getVoiceBeats(scoreMap, 0, 1);
    expect(yBeats.length).toBe(1);
    expect((yBeats.get(0).get("notes") as Y.Array<Y.Map<unknown>>).get(0).get("fret")).toBe(5);
  });
});
