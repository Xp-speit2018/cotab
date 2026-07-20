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
  CrescendoType,
  Duration,
  GolpeType,
  GraceType,
  Ottavia,
  PickStroke,
  Rasgueado,
  TremoloPickingStyle,
  VibratoType,
  WahPedal,
} from "@/core/schema";
import {
  DocumentActionArgumentsError,
  executeDocumentAction,
  executeDocumentActionById,
} from "@/core/actions/registry";
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

describe("document.beat discrete effects", () => {
  const enumCases = [
    ["document.beat.setPickStroke", "pickStroke", PickStroke.Up],
    ["document.beat.setCrescendo", "crescendo", CrescendoType.Decrescendo],
    ["document.beat.setOttava", "ottava", Ottavia._8vb],
    ["document.beat.setGolpe", "golpe", GolpeType.Finger],
    ["document.beat.setWahPedal", "wahPedal", WahPedal.Open],
  ] as const;

  for (const [id, field, value] of enumCases) {
    it(`sets ${field} through a bounded enum action`, () => {
      executeDocumentActionById(id, { value }, ctx);
      expect(resolveYBeatHelper(0, 0, 0, 0, 0)!.get(field)).toBe(value);
    });
  }

  const toggleCases = [
    ["document.beat.setTap", "tap"],
    ["document.beat.setSlap", "slap"],
    ["document.beat.setPop", "pop"],
    ["document.beat.setSlashed", "slashed"],
    ["document.beat.setIsLegatoOrigin", "isLegatoOrigin"],
  ] as const;

  for (const [id, field] of toggleCases) {
    it(`sets ${field} through a boolean action`, () => {
      executeDocumentActionById(id, { value: true }, ctx);
      expect(resolveYBeatHelper(0, 0, 0, 0, 0)!.get(field)).toBe(true);
    });
  }

  it("rejects an out-of-range enum before updating Y.Doc", () => {
    const doc = getScoreMap()!.doc!;
    let updates = 0;
    doc.on("update", () => updates++);

    expect(() => executeDocumentActionById(
      "document.beat.setPickStroke",
      { value: 99 },
      ctx,
    )).toThrow(DocumentActionArgumentsError);
    expect(updates).toBe(0);
  });
});

// ─── setDuration ──────────────────────────────────────────────────────────────

describe("document.beat.setDuration", () => {
  it("updates Y.Map duration field", () => {
    executeDocumentAction("document.beat.setDuration", { value: Duration.Eighth }, ctx);
    const yBeat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    expect(yBeat.get("duration")).toBe(Duration.Eighth);
  });

  it("can cycle through durations", () => {
    executeDocumentAction("document.beat.setDuration", { value: Duration.Sixteenth }, ctx);
    expect(resolveYBeatHelper(0, 0, 0, 0, 0)!.get("duration")).toBe(Duration.Sixteenth);
    executeDocumentAction("document.beat.setDuration", { value: Duration.Half }, ctx);
    expect(resolveYBeatHelper(0, 0, 0, 0, 0)!.get("duration")).toBe(Duration.Half);
  });

  it("rejects nested object values before producing a Y.Doc update", () => {
    const doc = getScoreMap()!.doc!;
    const yBeat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    const originalDuration = yBeat.get("duration");
    let updateCount = 0;
    const onUpdate = () => {
      updateCount += 1;
    };
    doc.on("update", onUpdate);

    expect(() =>
      executeDocumentActionById(
        "document.beat.setDuration",
        { value: { value: Duration.Eighth } },
        ctx,
      ),
    ).toThrow(DocumentActionArgumentsError);

    doc.off("update", onUpdate);
    expect(updateCount).toBe(0);
    expect(yBeat.get("duration")).toBe(originalDuration);
  });
});

// ─── placeNote (guitar tab) ───────────────────────────────────────────────────

describe("document.beat.placeNote (guitar tab)", () => {
  it("adds note to beat's notes array", () => {
    executeDocumentAction("document.beat.placeNote", { targetValue: 5 }, ctx);

    const yBeat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(1);
    expect(yNotes.get(0).get("fret")).toBe(5);
    expect(yNotes.get(0).get("string")).toBe(3);
  });

  it("sets isEmpty to false", () => {
    executeDocumentAction("document.beat.placeNote", { targetValue: 3 }, ctx);
    expect(resolveYBeatHelper(0, 0, 0, 0, 0)!.get("isEmpty")).toBe(false);
  });

  it("updates fret on existing string", () => {
    placeNoteDirectly(getScoreMap()!, 0, 0, 0, 5, 3);

    executeDocumentAction("document.beat.placeNote", { targetValue: 7 }, ctx);

    const yNotes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(1);
    expect(yNotes.get(0).get("fret")).toBe(7);
  });

  it("does nothing without selection", () => {
    selectBeat(null);
    executeDocumentAction("document.beat.placeNote", { targetValue: 5 }, ctx);
    const yNotes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(0);
  });
});

// ─── deleteNote ───────────────────────────────────────────────────────────────

describe("document.beat.deleteNote", () => {
  it("clears notes array when single note", () => {
    placeNoteDirectly(getScoreMap()!, 0, 0, 0, 5, 3);
    setSelectedNoteIndex(0);

    executeDocumentAction("document.beat.deleteNote", {}, ctx);

    const yNotes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(0);
  });

  it("removes only selected note when multiple", () => {
    placeNoteDirectly(getScoreMap()!, 0, 0, 0, 5, 3);
    placeNoteDirectly(getScoreMap()!, 0, 0, 0, 7, 1);
    setSelectedNoteIndex(0);

    executeDocumentAction("document.beat.deleteNote", {}, ctx);

    const yNotes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(1);
    expect(yNotes.get(0).get("string")).toBe(1);
  });

  it("removes beat from voice when beat is rest", () => {
    addBeatsDirectly(getScoreMap()!, 0, 0, 1);
    configureBeat({ isEmpty: false });

    const yVoiceBefore = resolveYVoiceHelper(0, 0, 0, 0)!;
    const beatsBefore = (yVoiceBefore.get("beats") as Y.Array<unknown>).length;

    const result = executeDocumentAction("document.beat.deleteNote", {}, ctx);

    const yVoiceAfter = resolveYVoiceHelper(0, 0, 0, 0)!;
    const beatsAfter = (yVoiceAfter.get("beats") as Y.Array<unknown>).length;
    expect(beatsAfter).toBe(beatsBefore - 1);
    expect(result).toBe(true);
  });

  it("blocks when voice has only 1 beat and beat is rest", () => {
    configureBeat({ isEmpty: false });
    const result = executeDocumentAction("document.beat.deleteNote", {}, ctx);
    expect(result).toBe(false);
  });
});

// ─── insertRestBefore / insertRestAfter ───────────────────────────────────────

describe("document.beat.insertRestBefore", () => {
  it("inserts a beat before the current position", () => {
    const beatsBefore = (resolveYVoiceHelper(0, 0, 0, 0)!.get("beats") as Y.Array<unknown>).length;

    executeDocumentAction("document.beat.insertRestBefore", { duration: 8 }, ctx);

    const beatsAfter = (resolveYVoiceHelper(0, 0, 0, 0)!.get("beats") as Y.Array<unknown>).length;
    expect(beatsAfter).toBe(beatsBefore + 1);

    const newBeat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    expect(newBeat.get("duration")).toBe(8);
    expect(newBeat.get("isEmpty")).toBe(false);
  });
});

describe("document.beat.insertRestAfter", () => {
  it("inserts a beat after the current position", () => {
    executeDocumentAction("document.beat.insertRestAfter", { duration: 16 }, ctx);

    const beats = resolveYVoiceHelper(0, 0, 0, 0)!.get("beats") as Y.Array<Y.Map<unknown>>;
    expect(beats.length).toBe(2);

    const newBeat = beats.get(1);
    expect(newBeat.get("duration")).toBe(16);
    expect(newBeat.get("isEmpty")).toBe(false);
  });
});

// ─── setDots ──────────────────────────────────────────────────────────────────

describe("document.beat.setDots", () => {
  it("sets dot count on beat", () => {
    executeDocumentAction("document.beat.setDots", { value: 1 }, ctx);
    expect(resolveYBeatHelper(0, 0, 0, 0, 0)!.get("dots")).toBe(1);
  });
});

// ─── violin (4-string tab) ────────────────────────────────────────────────────

describe("document.beat (violin tab)", () => {
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
    executeDocumentAction("document.beat.setDuration", { value: Duration.Eighth }, ctx);
    expect(resolveYBeatHelper(0, 0, 0, 0, 0)!.get("duration")).toBe(Duration.Eighth);
  });

  it("placeNote adds note on 4-string staff", () => {
    executeDocumentAction("document.beat.placeNote", { targetValue: 3 }, ctx);
    const yNotes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(1);
    expect(yNotes.get(0).get("fret")).toBe(3);
    expect(yNotes.get(0).get("string")).toBe(2);
  });
});

// ─── piano (notation only) ─────────────────────────────────────────────────────

describe("document.beat (piano notation)", () => {
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
    executeDocumentAction("document.beat.setDuration", { value: Duration.Quarter }, ctx);
    expect(resolveYBeatHelper(0, 0, 0, 0, 0)!.get("duration")).toBe(Duration.Quarter);
  });

  it("placeNote adds note with octave and tone from snapPositionToPitch", () => {
    executeDocumentAction("document.beat.placeNote", { targetValue: 7 }, ctx);
    const yNotes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(1);
    expect(yNotes.get(0).get("octave")).toBe(6);
    expect(yNotes.get(0).get("tone")).toBe(5);
  });
});

// ─── applyBeatUpdates property setters (parametrized) ──────────────────────────

describe("applyBeatUpdates property setters", () => {
  it.each([
    ["document.beat.setIsEmpty",          "isEmpty",          false],
    ["document.beat.setTupletNumerator",  "tupletNumerator",  3],
    ["document.beat.setTupletDenominator","tupletDenominator",2],
    ["document.beat.setGraceType",        "graceType",        GraceType.BeforeBeat],
    ["document.beat.setDynamics",      "dynamics",       5],
    ["document.beat.setVibrato",       "vibrato",        1],
    ["document.beat.setDeadSlapped",   "deadSlapped",    true],
    ["document.beat.setWhammyBarType", "whammyBarType",  1],
    ["document.beat.setWhammyStyle",   "whammyStyle",    BendStyle.Fast],
    ["document.beat.setIsContinuedWhammy", "isContinuedWhammy", true],
    ["document.beat.setBrushType",     "brushType",      1],
    ["document.beat.setBrushDuration", "brushDuration",  120],
    ["document.beat.setFade",          "fade",           1],
    ["document.beat.setRasgueado",     "rasgueado",      Rasgueado.PmpTriplet],
  ] as const)("%s sets %s on Y.Map", (actionId, field, value) => {
    executeDocumentAction(actionId, { value }, ctx);
    expect(resolveYBeatHelper(0, 0, 0, 0, 0)!.get(field)).toBe(value);
  });

  it("does nothing without selection", () => {
    const before = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("vibrato");
    selectBeat(null);
    executeDocumentAction("document.beat.setVibrato", { value: 1 }, ctx);
    expect(resolveYBeatHelper(0, 0, 0, 0, 0)!.get("vibrato")).toBe(before);
  });

  it.each([-1, VibratoType.Wide + 1])(
    "rejects invalid beat vibrato %i before updating Y.Doc",
    (value) => {
      const beat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
      const before = beat.get("vibrato");
      let updates = 0;
      const listener = () => updates++;
      beat.observe(listener);

      expect(() => executeDocumentActionById(
        "document.beat.setVibrato",
        { value },
        ctx,
      )).toThrow(DocumentActionArgumentsError);
      expect(beat.get("vibrato")).toBe(before);
      expect(updates).toBe(0);
      beat.unobserve(listener);
    },
  );
});

describe("document.beat nested playback fields", () => {
  it("sets brush type and duration together", () => {
    executeDocumentAction("document.beat.setBrush", {
      brushType: 1,
      brushDuration: 120,
    }, ctx);
    const beat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    expect(beat.get("brushType")).toBe(1);
    expect(beat.get("brushDuration")).toBe(120);
  });

  it("sets a tuplet pair in one action", () => {
    executeDocumentAction("document.beat.setTuplet", {
      numerator: 5,
      denominator: 4,
    }, ctx);
    const beat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    expect(beat.get("tupletNumerator")).toBe(5);
    expect(beat.get("tupletDenominator")).toBe(4);
  });

  it("replaces whammyBarPoints", () => {
    executeDocumentAction("document.beat.setWhammyBarPoints", { points: [
      { offset: 0, value: 0 },
      { offset: 60, value: -4 },
    ] }, ctx);

    const yPoints = resolveYBeatHelper(0, 0, 0, 0, 0)!.get(
      "whammyBarPoints",
    ) as Y.Array<Y.Map<unknown>>;
    expect(yPoints.toArray().map((point) => point.toJSON())).toEqual([
      { offset: 0, value: 0 },
      { offset: 60, value: -4 },
    ]);

    executeDocumentAction("document.beat.setWhammyBarPoints", { points: null }, ctx);
    expect(
      resolveYBeatHelper(0, 0, 0, 0, 0)!.get("whammyBarPoints"),
    ).toBeNull();
  });

  it("sets a complete whammy bar effect atomically", () => {
    executeDocumentAction("document.beat.setWhammyBar", {
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

  it("rejects an invalid whammy shape before changing Y.Doc", () => {
    const beat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    const before = beat.toJSON();

    expect(() => executeDocumentActionById("document.beat.setWhammyBar", {
      whammyBarType: 2,
      whammyStyle: BendStyle.Default,
      isContinuedWhammy: false,
      whammyBarPoints: [
        { offset: 0, value: 0 },
        { offset: 30, value: -4 },
        { offset: 60, value: -8 },
      ],
    }, ctx)).toThrow(DocumentActionArgumentsError);

    expect(beat.toJSON()).toEqual(before);
  });

  it("replaces automations without renaming fields", () => {
    executeDocumentAction("document.beat.setAutomations", { automations: [
      {
        isLinear: true,
        type: AutomationType.Tempo,
        value: 144,
        ratioPosition: 0.5,
        text: "rit.",
        isVisible: true,
      },
    ] }, ctx);

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
    executeDocumentAction("document.beat.setLyrics", { lyrics: ["hel", "lo"] }, ctx);
    const beat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    expect((beat.get("lyrics") as Y.Array<string>).toArray()).toEqual([
      "hel",
      "lo",
    ]);

    executeDocumentAction("document.beat.setLyrics", { lyrics: null }, ctx);
    expect(beat.get("lyrics")).toBeNull();
  });

  it("sets nullable text and chordId", () => {
    executeDocumentAction("document.beat.setText", { value: "let ring" }, ctx);
    executeDocumentAction("document.beat.setChordId", { value: "Cmaj7" }, ctx);
    const beat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    expect(beat.get("text")).toBe("let ring");
    expect(beat.get("chordId")).toBe("Cmaj7");

    executeDocumentAction("document.beat.setText", { value: null }, ctx);
    executeDocumentAction("document.beat.setChordId", { value: null }, ctx);
    expect(beat.get("text")).toBeNull();
    expect(beat.get("chordId")).toBeNull();
  });

  it("sets and clears tremoloPicking", () => {
    executeDocumentAction("document.beat.setTremoloPicking", { effect: {
      marks: 3,
      style: TremoloPickingStyle.Default,
    } }, ctx);
    const beat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    expect((beat.get("tremoloPicking") as Y.Map<unknown>).toJSON()).toEqual({
      marks: 3,
      style: TremoloPickingStyle.Default,
    });

    executeDocumentAction("document.beat.setTremoloPicking", { effect: null }, ctx);
    expect(beat.get("tremoloPicking")).toBeNull();
  });
});

// ─── setRest ──────────────────────────────────────────────────────────────────

describe("document.beat.setRest", () => {
  it("setRest(true) clears notes and sets isEmpty=false", () => {
    placeNoteDirectly(getScoreMap()!, 0, 0, 0, 5, 3);

    executeDocumentAction("document.beat.setRest", { value: true }, ctx);

    const yBeat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(0);
    expect(yBeat.get("isEmpty")).toBe(false);
  });

  it("setRest(false) on tab track adds default fret-0 note", () => {
    executeDocumentAction("document.beat.setRest", { value: false }, ctx);

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

    executeDocumentAction("document.beat.setRest", { value: false }, ctx);

    const yNotes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(0);
  });

  it("does nothing without selection", () => {
    selectBeat(null);
    executeDocumentAction("document.beat.setRest", { value: true }, ctx);
    // beat should still have its default isEmpty=true (unchanged)
    expect(resolveYBeatHelper(0, 0, 0, 0, 0)!.get("isEmpty")).toBe(true);
  });
});

// ─── drumkit (percussion) ──────────────────────────────────────────────────────

describe("document.beat (drumkit percussion)", () => {
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
    executeDocumentAction("document.beat.setDuration", { value: Duration.Sixteenth }, ctx);
    expect(resolveYBeatHelper(0, 0, 0, 0, 0)!.get("duration")).toBe(Duration.Sixteenth);
  });

  it("placeNote adds note with percussionArticulation", () => {
    executeDocumentAction("document.beat.placeNote", { targetValue: undefined }, ctx);
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

    executeDocumentAction("document.beat.placeNote", { targetValue: undefined }, ctx);

    const notes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get(
      "notes",
    ) as Y.Array<Y.Map<unknown>>;
    expect(notes.get(0).get("percussionArticulation")).toBe(1);
  });

  it("deleteNote removes percussion note", () => {
    placePercussionNoteDirectly(getScoreMap()!, 0, 0, 0, 42);
    setSelectedNoteIndex(0);

    executeDocumentAction("document.beat.deleteNote", {}, ctx);

    const yNotes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(0);
  });
});

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe("document.beat edge cases", () => {
  it("applyBeatUpdates does nothing when Y.Beat cannot be resolved", () => {
    // Select a beat at an invalid index
    selectBeat({ ...defaultSel, beatIndex: 999 });
    const result = executeDocumentAction("document.beat.setDuration", { value: 8 }, ctx);
    // Should not throw, should just return without doing anything
    expect(result).toBeUndefined();
  });

  it("placeNote does nothing when string is null", () => {
    selectBeat({ ...defaultSel, string: null });

    executeDocumentAction("document.beat.placeNote", { targetValue: 5 }, ctx);

    const yNotes = resolveYBeatHelper(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(0);
  });

  it("insertRestBefore uses beat duration when not specified", () => {
    getScoreMap()!.doc!.transact(() => {
      resolveYBeatHelper(0, 0, 0, 0, 0)!.set("duration", 8);
    });

    executeDocumentAction("document.beat.insertRestBefore", { duration: undefined }, ctx);

    const yBeat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    expect(yBeat.get("duration")).toBe(8);
  });

  it("insertRestAfter uses beat duration when not specified", () => {
    getScoreMap()!.doc!.transact(() => {
      resolveYBeatHelper(0, 0, 0, 0, 0)!.set("duration", 16);
    });

    executeDocumentAction("document.beat.insertRestAfter", { duration: undefined }, ctx);

    const yVoice = resolveYVoiceHelper(0, 0, 0, 0)!;
    const yBeats = yVoice.get("beats") as Y.Array<Y.Map<unknown>>;
    expect(yBeats.length).toBe(2);
    expect(yBeats.get(1).get("duration")).toBe(16);
  });
});
