/**
 * compose-flow.test.ts — "Happy Birthday" end-to-end composition integration test.
 *
 * Exercises the action layer as a human composer would: set metadata, add bars,
 * place notes, delete, rewrite, add/delete tracks, and verify Y.Doc state after
 * each major phase.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Y from "yjs";
import {
  resetMockState,
  selectBeat,
  setSelectedNoteIndex,
  setMockApiScore,
  seedOneTrackScore,
  addBeatsDirectly,
  buildMockAlphaTabScore,
  snapshotDoc,
  testContext,
  initDoc,
  destroyDoc,
  getScoreMap,
  transact,
  resolveYBeatHelper,
  resolveYTrackHelper,
  resolveYNoteHelper,
} from "@/test/setup";

// Mock render-store for edit-track.ts which calls usePlayerStore.setState
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

import { EditorEngine } from "@/core/engine";
import { createTrack, createStaff, Duration } from "@/core/schema";
import { executeAction } from "@/core/actions/registry";
import { resolveBeat, isBarEmptyAllTracks } from "@/stores/render-internals";
import "@/core/actions/edit-score";
import "@/core/actions/edit-bar";
import "@/core/actions/edit-beat";
import "@/core/actions/edit-note";
import "@/core/actions/edit-track";
import "@/core/actions/edit-history";
import "@/core/actions/edit-staff";

const ctx = testContext();

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
    string: 3 as number | null,
    ...overrides,
  };
}

function mockTabBeat(_beatSel: ReturnType<typeof sel>) {
  const mockBeat = {
    notes: [] as Array<{ string: number; fret: number }>,
    duration: 4,
    isEmpty: true,
    isRest: false,
    voice: { bar: { clef: 4 } },
  };
  (resolveBeat as ReturnType<typeof vi.fn>).mockReturnValue(mockBeat as never);
  return mockBeat;
}

function masterBarCount(): number {
  return (getScoreMap()!.get("masterBars") as Y.Array<unknown>).length;
}

function trackCount(): number {
  return (getScoreMap()!.get("tracks") as Y.Array<unknown>).length;
}

function barCount(trackIdx = 0, staffIdx = 0): number {
  const tracks = getScoreMap()!.get("tracks") as Y.Array<Y.Map<unknown>>;
  const staves = tracks.get(trackIdx).get("staves") as Y.Array<Y.Map<unknown>>;
  return (staves.get(staffIdx).get("bars") as Y.Array<unknown>).length;
}

/**
 * Happy Birthday in 3/4, key of C, simplified guitar tab.
 * Bar 1: C5 C5 D5 C5   (pickup: two eighth notes on beat 3)
 * Bar 2: F5 E5 (half, half)
 * Bar 3: C5 C5 D5 C5
 * Bar 4: G5 F5 (half, half)
 *
 * Simplified fret/string mapping for tab:
 *   C5 = fret 1, string 2
 *   D5 = fret 3, string 2
 *   E5 = fret 0, string 1
 *   F5 = fret 1, string 1
 *   G5 = fret 3, string 1
 */
const HB_NOTES = {
  C5: { fret: 1, string: 2 },
  D5: { fret: 3, string: 2 },
  E5: { fret: 0, string: 1 },
  F5: { fret: 1, string: 1 },
  G5: { fret: 3, string: 1 },
};

describe("compose Happy Birthday", () => {
  beforeEach(() => {
    resetMockState();
    destroyDoc();
    initDoc();
    seedOneTrackScore(getScoreMap()!, 1, [3, 4]);
    (isBarEmptyAllTracks as ReturnType<typeof vi.fn>).mockReturnValue(true);

    setMockApiScore(buildMockAlphaTabScore({
      tracks: [{
        staves: [{
          showTablature: true,
          tuning: [40, 45, 50, 55, 59, 64],
          bars: [{ voices: [{ beats: [{ notes: [], isEmpty: true }] }] }],
        }],
      }],
    }));
  });

  // ─── Phase 1: Set metadata ───────────────────────────────────────────────

  it("Phase 1: sets score metadata", () => {
    executeAction("edit.score.setTitle", "Happy Birthday to You", ctx);
    executeAction("edit.score.setArtist", "Traditional", ctx);
    executeAction("edit.score.setTempo", 100, ctx);

    const snap = snapshotDoc();
    expect(snap.title).toBe("Happy Birthday to You");
    expect(snap.artist).toBe("Traditional");
    expect(snap.tempo).toBe(100);
  });

  // ─── Phase 2: Build out bars ─────────────────────────────────────────────

  it("Phase 2: adds 3 more bars for a total of 4", () => {
    selectBeat(sel({ barIndex: 0 }));
    executeAction("edit.bar.insertAfter", undefined, ctx);
    selectBeat(sel({ barIndex: 1 }));
    executeAction("edit.bar.insertAfter", undefined, ctx);
    selectBeat(sel({ barIndex: 2 }));
    executeAction("edit.bar.insertAfter", undefined, ctx);

    expect(masterBarCount()).toBe(4);
    expect(barCount()).toBe(4);

    const mbs = getScoreMap()!.get("masterBars") as Y.Array<Y.Map<unknown>>;
    for (let i = 0; i < 4; i++) {
      expect(mbs.get(i).get("timeSignatureNumerator")).toBe(3);
      expect(mbs.get(i).get("timeSignatureDenominator")).toBe(4);
    }
  });

  // ─── Phase 3: Write melody with placeNote ─────────────────────────────────

  it("Phase 3: places notes into bar 1", () => {
    addBeatsDirectly(getScoreMap()!, 0, 0, 3);

    const notes = [HB_NOTES.C5, HB_NOTES.C5, HB_NOTES.D5, HB_NOTES.C5];
    for (let i = 0; i < notes.length; i++) {
      const s = sel({ barIndex: 0, beatIndex: i, string: notes[i].string });
      selectBeat(s);
      mockTabBeat(s);
      executeAction("edit.beat.placeNote", notes[i].fret, ctx);
    }

    for (let i = 0; i < notes.length; i++) {
      const yBeat = resolveYBeatHelper(0, 0, 0, 0, i)!;
      const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
      expect(yNotes.length).toBe(1);
      expect(yNotes.get(0).get("fret")).toBe(notes[i].fret);
      expect(yNotes.get(0).get("string")).toBe(notes[i].string);
      expect(yBeat.get("isEmpty")).toBe(false);
    }
  });

  // ─── Phase 4: Set durations ───────────────────────────────────────────────

  it("Phase 4: sets durations on beats", () => {
    selectBeat(sel({ barIndex: 0, beatIndex: 0 }));
    executeAction("edit.beat.setDuration", Duration.Eighth, ctx);

    const yBeat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    expect(yBeat.get("duration")).toBe(Duration.Eighth);
  });

  // ─── Phase 5: Delete and rewrite ──────────────────────────────────────────

  it("Phase 5: delete bars down to 1, then rebuild", () => {
    selectBeat(sel({ barIndex: 0 }));
    executeAction("edit.bar.insertAfter", undefined, ctx);
    selectBeat(sel({ barIndex: 1 }));
    executeAction("edit.bar.insertAfter", undefined, ctx);
    expect(masterBarCount()).toBe(3);

    selectBeat(sel({ barIndex: 2 }));
    executeAction("edit.bar.delete", undefined, ctx);
    selectBeat(sel({ barIndex: 1 }));
    executeAction("edit.bar.delete", undefined, ctx);
    expect(masterBarCount()).toBe(1);

    selectBeat(sel({ barIndex: 0 }));
    executeAction("edit.bar.insertAfter", undefined, ctx);
    expect(masterBarCount()).toBe(2);
  });

  // ─── Phase 6: Add second track ────────────────────────────────────────────

  it("Phase 6: add a second track directly and verify", () => {
    const scoreMap = getScoreMap()!;

    transact(() => {
      const yTracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;
      yTracks.push([createTrack("Piano")]);
      const intTrack = yTracks.get(yTracks.length - 1);
      const staves = intTrack.get("staves") as Y.Array<Y.Map<unknown>>;
      staves.push([createStaff([])]);
      const intStaff = staves.get(0);
      intStaff.set("showTablature", false);
      const bars = intStaff.get("bars") as Y.Array<Y.Map<unknown>>;
      EditorEngine.pushDefaultBar(bars);
    });

    expect(trackCount()).toBe(2);
    expect(resolveYTrackHelper(1)!.get("name")).toBe("Piano");

    const snap = snapshotDoc();
    expect(snap.tracks).toHaveLength(2);
    expect(snap.tracks[1].name).toBe("Piano");
    expect(snap.tracks[1].staves[0].showTablature).toBe(false);
  });

  // ─── Phase 7: Delete guitar track, keep piano ─────────────────────────────

  it("Phase 7: delete first track leaves only second track", () => {
    const scoreMap = getScoreMap()!;
    transact(() => {
      const yTracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;
      yTracks.push([createTrack("Piano")]);
      const intTrack = yTracks.get(yTracks.length - 1);
      const staves = intTrack.get("staves") as Y.Array<Y.Map<unknown>>;
      staves.push([createStaff([])]);
      const intStaff = staves.get(0);
      const bars = intStaff.get("bars") as Y.Array<Y.Map<unknown>>;
      EditorEngine.pushDefaultBar(bars);
    });

    setMockApiScore(buildMockAlphaTabScore({
      tracks: [
        { staves: [{ showTablature: true, bars: [{ voices: [{ beats: [{ notes: [], isEmpty: true }] }] }] }] },
        { staves: [{ showTablature: false, tuning: [], bars: [{ voices: [{ beats: [{ notes: [], isEmpty: true }] }] }] }] },
      ],
    }));

    expect(trackCount()).toBe(2);
    selectBeat(sel({ trackIndex: 0 }));
    executeAction("edit.track.delete", 0, ctx);
    expect(trackCount()).toBe(1);
    expect(resolveYTrackHelper(0)!.get("name")).toBe("Piano");
  });

  // ─── Phase 8: Note property modifications ─────────────────────────────────

  it("Phase 8: apply note properties after placing", () => {
    const s = sel({ barIndex: 0, beatIndex: 0, string: 2 });
    selectBeat(s);
    mockTabBeat(s);
    executeAction("edit.beat.placeNote", 1, ctx);

    setSelectedNoteIndex(0);
    executeAction("edit.note.setGhost", true, ctx);
    executeAction("edit.note.setStaccato", true, ctx);
    executeAction("edit.note.setVibrato", 2, ctx);

    const note = resolveYNoteHelper(0, 0, 0, 0, 0, 0)!;
    expect(note.get("isGhost")).toBe(true);
    expect(note.get("isStaccato")).toBe(true);
    expect(note.get("vibrato")).toBe(2);
  });

  // ─── Phase 9: Undo/redo round trip ─────────────────────────────────────────

  it("Phase 9: undo reverts title change", () => {
    executeAction("edit.score.setTitle", "Happy Birthday", ctx);
    expect(getScoreMap()!.get("title")).toBe("Happy Birthday");

    executeAction("edit.undo", undefined, ctx);
    expect(getScoreMap()!.get("title")).toBe("Untitled");

    executeAction("edit.redo", undefined, ctx);
    expect(getScoreMap()!.get("title")).toBe("Happy Birthday");
  });

  // ─── Phase 10: Full snapshot verification ──────────────────────────────────

  it("Phase 10: full composition snapshot", () => {
    executeAction("edit.score.setTitle", "Happy Birthday to You", ctx);
    executeAction("edit.score.setArtist", "Traditional", ctx);
    executeAction("edit.score.setTempo", 100, ctx);

    selectBeat(sel({ barIndex: 0 }));
    executeAction("edit.bar.insertAfter", undefined, ctx);
    selectBeat(sel({ barIndex: 1 }));
    executeAction("edit.bar.insertAfter", undefined, ctx);
    selectBeat(sel({ barIndex: 2 }));
    executeAction("edit.bar.insertAfter", undefined, ctx);

    addBeatsDirectly(getScoreMap()!, 0, 0, 2);
    const bar1Notes = [HB_NOTES.C5, HB_NOTES.C5, HB_NOTES.D5];
    for (let i = 0; i < bar1Notes.length; i++) {
      const s = sel({ barIndex: 0, beatIndex: i, string: bar1Notes[i].string });
      selectBeat(s);
      mockTabBeat(s);
      executeAction("edit.beat.placeNote", bar1Notes[i].fret, ctx);
    }

    const snap = snapshotDoc();
    expect(snap.title).toBe("Happy Birthday to You");
    expect(snap.artist).toBe("Traditional");
    expect(snap.tempo).toBe(100);
    expect(snap.masterBars).toHaveLength(4);
    expect(snap.tracks).toHaveLength(1);
    expect(snap.tracks[0].name).toBe("Test Guitar");

    const bar0beats = snap.tracks[0].staves[0].bars[0].voices[0].beats;
    expect(bar0beats[0].notes).toHaveLength(1);
    expect(bar0beats[0].notes[0].fret).toBe(HB_NOTES.C5.fret);
    expect(bar0beats[0].notes[0].string).toBe(HB_NOTES.C5.string);
    expect(bar0beats[1].notes).toHaveLength(1);
    expect(bar0beats[1].notes[0].fret).toBe(HB_NOTES.C5.fret);
    expect(bar0beats[2].notes).toHaveLength(1);
    expect(bar0beats[2].notes[0].fret).toBe(HB_NOTES.D5.fret);

    for (let i = 0; i < 4; i++) {
      expect(snap.masterBars[i].timeSignatureNumerator).toBe(3);
      expect(snap.masterBars[i].timeSignatureDenominator).toBe(4);
    }
  });
});
