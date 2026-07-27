import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Y from "yjs";
import {
  resetMockState,
  seedOneTrackScore,
  testContext,
  initDoc,
  destroyDoc,
  getScoreMap,
  resolveYBeatHelper,
  resolveYStaffHelper,
} from "@tests/unit/setup";

// Mock engine in test file (vi.mock is hoisted)
vi.mock("@/core/engine", () => ({
  engine: {
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
    getScoreMap: vi.fn(() => (globalThis as Record<string, unknown>).__testEngineRefs?.scoreMap ?? null),
    localEditYDoc: vi.fn((fn: () => void) => {
      const doc = (globalThis as Record<string, unknown>).__testEngineRefs?.doc as Y.Doc | undefined;
      if (doc) doc.transact(fn, doc.clientID);
    }),
  },
  importTrack: vi.fn(),
  FILE_IMPORT_ORIGIN: "file-import",
}));

import {
  DocumentActionArgumentsError,
  executeDocumentAction,
  executeDocumentActionById,
} from "@/core/actions/registry";
import "@/core/actions/edit-staff";

beforeEach(() => {
  resetMockState();
  destroyDoc();
  initDoc();
  seedOneTrackScore(getScoreMap()!, 1);
});

const ctx = testContext();

describe("document.staff.setCapo", () => {
  it("updates capo on the Y.Map", () => {
    executeDocumentAction("document.staff.setCapo", { trackIndex: 0, staffIndex: 0, capo: 3 }, ctx);
    const staff = resolveYStaffHelper(0, 0)!;
    expect(staff.get("capo")).toBe(3);
  });

  it("sets capo to 0", () => {
    executeDocumentAction("document.staff.setCapo", { trackIndex: 0, staffIndex: 0, capo: 5 }, ctx);
    executeDocumentAction("document.staff.setCapo", { trackIndex: 0, staffIndex: 0, capo: 0 }, ctx);
    expect(resolveYStaffHelper(0, 0)!.get("capo")).toBe(0);
  });

  it("does nothing for invalid track index", () => {
    executeDocumentAction("document.staff.setCapo", { trackIndex: 99, staffIndex: 0, capo: 3 }, ctx);
    expect(resolveYStaffHelper(0, 0)!.get("capo")).toBe(0);
  });
});

describe("document.staff.setTranspositionPitch", () => {
  it("updates only transpositionPitch on the Y.Map", () => {
    executeDocumentAction("document.staff.setTranspositionPitch", {
      trackIndex: 0,
      staffIndex: 0,
      transpositionPitch: -2,
    }, ctx);
    const staff = resolveYStaffHelper(0, 0)!;
    expect(staff.get("transpositionPitch")).toBe(-2);
    expect(staff.get("displayTranspositionPitch")).toBe(0);
  });
});

describe("document.staff notation configuration", () => {
  it("sets display transposition independently from playback pitch", () => {
    executeDocumentAction("document.staff.setDisplayTranspositionPitch", {
      trackIndex: 0,
      staffIndex: 0,
      displayTranspositionPitch: 12,
    }, ctx);
    const staff = resolveYStaffHelper(0, 0)!;
    expect(staff.get("displayTranspositionPitch")).toBe(12);
    expect(staff.get("transpositionPitch")).toBe(0);
  });

  it("sets both notation visibility fields atomically", () => {
    executeDocumentAction("document.staff.setNotationVisibility", {
      trackIndex: 0,
      staffIndex: 0,
      showStandardNotation: true,
      showTablature: false,
    }, ctx);
    const staff = resolveYStaffHelper(0, 0)!;
    expect(staff.get("showStandardNotation")).toBe(true);
    expect(staff.get("showTablature")).toBe(false);
  });

  it("rejects hiding both notations before updating Y.Doc", () => {
    const staff = resolveYStaffHelper(0, 0)!;
    let updates = 0;
    staff.observeDeep(() => updates++);

    expect(() => executeDocumentActionById(
      "document.staff.setNotationVisibility",
      {
        trackIndex: 0,
        staffIndex: 0,
        showStandardNotation: false,
        showTablature: false,
      },
      ctx,
    )).toThrow(DocumentActionArgumentsError);
    expect(updates).toBe(0);
  });
});

describe("document.staff.setStringTuning", () => {
  it("replaces the complete stringTuning object", () => {
    const dropD = [64, 59, 55, 50, 45, 38];
    executeDocumentAction("document.staff.setStringTuning", {
      trackIndex: 0,
      staffIndex: 0,
      stringTuning: {
        tunings: dropD,
        name: "Drop D",
        isStandard: false,
      },
    }, ctx);
    const staff = resolveYStaffHelper(0, 0)!;
    const stringTuning = staff.get("stringTuning") as Y.Map<unknown>;
    const tunings = stringTuning.get("tunings") as Y.Array<number>;
    expect(tunings.toArray()).toEqual(dropD);
    expect(stringTuning.get("name")).toBe("Drop D");
    expect(stringTuning.get("isStandard")).toBe(false);
    expect(staff.has("tuning")).toBe(false);
  });

  it("can set 7-string tuning", () => {
    const sevenString = [64, 59, 55, 50, 45, 40, 35];
    executeDocumentAction("document.staff.setStringTuning", {
      trackIndex: 0,
      staffIndex: 0,
      stringTuning: {
        tunings: sevenString,
        name: "Standard 7-string",
        isStandard: true,
      },
    }, ctx);
    const stringTuning = resolveYStaffHelper(0, 0)!.get(
      "stringTuning",
    ) as Y.Map<unknown>;
    const tunings = stringTuning.get("tunings") as Y.Array<number>;
    expect(tunings.toArray()).toEqual(sevenString);
  });
});

describe("document.staff.setChord", () => {
  it("sets and removes a chord by id", () => {
    executeDocumentAction("document.staff.setChord", {
      trackIndex: 0,
      staffIndex: 0,
      id: "c-major",
      chord: {
        name: "C",
        firstFret: 1,
        strings: [-1, 3, 2, 0, 1, 0],
        barreFrets: [],
        showName: true,
        showDiagram: true,
        showFingering: true,
      },
    }, ctx);

    const staff = resolveYStaffHelper(0, 0)!;
    const chords = staff.get("chords") as Y.Map<Y.Map<unknown>>;
    expect(chords.get("c-major")?.get("name")).toBe("C");
    expect(
      (chords.get("c-major")?.get("strings") as Y.Array<number>).toArray(),
    ).toEqual([-1, 3, 2, 0, 1, 0]);

    executeDocumentAction("document.staff.setChord", {
      trackIndex: 0,
      staffIndex: 0,
      id: "c-major",
      chord: null,
    }, ctx);
    expect(staff.get("chords")).toBeNull();
  });

  it("clears beat references when a chord definition is removed", () => {
    executeDocumentAction("document.staff.setChord", {
      trackIndex: 0,
      staffIndex: 0,
      id: "c-major",
      chord: {
        name: "C",
        firstFret: 1,
        strings: [-1, 3, 2, 0, 1, 0],
        barreFrets: [],
        showName: true,
        showDiagram: true,
        showFingering: true,
      },
    }, ctx);
    const beat = resolveYBeatHelper(0, 0, 0, 0, 0)!;
    beat.set("chordId", "c-major");

    executeDocumentAction("document.staff.setChord", {
      trackIndex: 0,
      staffIndex: 0,
      id: "c-major",
      chord: null,
    }, ctx);

    expect(beat.get("chordId")).toBeNull();
  });
});
