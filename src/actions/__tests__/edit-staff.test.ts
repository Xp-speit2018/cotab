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

import { executeAction } from "@/actions/registry";
import "@/actions/edit-staff";

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

describe("edit.staff.setTransposition", () => {
  it("updates transpositionPitch on the Y.Map", () => {
    executeAction("edit.staff.setTransposition", { trackIndex: 0, staffIndex: 0, semitones: -2 }, ctx);
    const staff = resolveYStaffHelper(0, 0)!;
    expect(staff.get("transpositionPitch")).toBe(-2);
  });
});

describe("edit.staff.setTuning", () => {
  it("replaces tuning array", () => {
    const dropD = [38, 45, 50, 55, 59, 64];
    executeAction("edit.staff.setTuning", { trackIndex: 0, staffIndex: 0, tuningValues: dropD }, ctx);
    const staff = resolveYStaffHelper(0, 0)!;
    const tuning = staff.get("tuning") as Y.Array<number>;
    expect(tuning.toArray()).toEqual(dropD);
  });

  it("can set 7-string tuning", () => {
    const sevenString = [35, 40, 45, 50, 55, 59, 64];
    executeAction("edit.staff.setTuning", { trackIndex: 0, staffIndex: 0, tuningValues: sevenString }, ctx);
    const tuning = resolveYStaffHelper(0, 0)!.get("tuning") as Y.Array<number>;
    expect(tuning.toArray()).toEqual(sevenString);
  });
});
