import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Y from "yjs";
import {
  resetMockState,
  seedOneTrackScore,
  testContext,
  initDoc,
  destroyDoc,
  getScoreMap,
  resolveYStaffHelper,
} from "@/test/setup";

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

import { executeAction } from "@/core/actions/registry";
import "@/core/actions/edit-staff";

beforeEach(() => {
  resetMockState();
  destroyDoc();
  initDoc();
  seedOneTrackScore(getScoreMap()!, 1);
});

const ctx = testContext();

describe("edit.staff.setCapo", () => {
  it("updates capo on the Y.Map", () => {
    executeAction("edit.staff.setCapo", { trackIndex: 0, staffIndex: 0, capo: 3 }, ctx);
    const staff = resolveYStaffHelper(0, 0)!;
    expect(staff.get("capo")).toBe(3);
  });

  it("sets capo to 0", () => {
    executeAction("edit.staff.setCapo", { trackIndex: 0, staffIndex: 0, capo: 5 }, ctx);
    executeAction("edit.staff.setCapo", { trackIndex: 0, staffIndex: 0, capo: 0 }, ctx);
    expect(resolveYStaffHelper(0, 0)!.get("capo")).toBe(0);
  });

  it("does nothing for invalid track index", () => {
    executeAction("edit.staff.setCapo", { trackIndex: 99, staffIndex: 0, capo: 3 }, ctx);
    expect(resolveYStaffHelper(0, 0)!.get("capo")).toBe(0);
  });
});

describe("edit.staff.setTranspositionPitch", () => {
  it("updates only transpositionPitch on the Y.Map", () => {
    executeAction("edit.staff.setTranspositionPitch", {
      trackIndex: 0,
      staffIndex: 0,
      transpositionPitch: -2,
    }, ctx);
    const staff = resolveYStaffHelper(0, 0)!;
    expect(staff.get("transpositionPitch")).toBe(-2);
    expect(staff.get("displayTranspositionPitch")).toBe(0);
  });
});

describe("edit.staff.setStringTuning", () => {
  it("replaces the complete stringTuning object", () => {
    const dropD = [64, 59, 55, 50, 45, 38];
    executeAction("edit.staff.setStringTuning", {
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
    executeAction("edit.staff.setStringTuning", {
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

describe("edit.staff.setIsPercussion", () => {
  it("updates isPercussion directly", () => {
    executeAction("edit.staff.setIsPercussion", {
      trackIndex: 0,
      staffIndex: 0,
      isPercussion: true,
    }, ctx);

    expect(resolveYStaffHelper(0, 0)!.get("isPercussion")).toBe(true);
  });
});

describe("edit.staff.setChord", () => {
  it("sets and removes a chord by id", () => {
    executeAction("edit.staff.setChord", {
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

    executeAction("edit.staff.setChord", {
      trackIndex: 0,
      staffIndex: 0,
      id: "c-major",
      chord: null,
    }, ctx);
    expect(staff.get("chords")).toBeNull();
  });
});
