import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import {
  resetMockState,
  seedOneTrackScore,
} from "@/test/setup";
import {
  initDoc,
  destroyDoc,
  getScoreMap,
  resolveYStaff,
} from "@/core/sync";
import { executeAction } from "@/actions/registry";
import "@/actions/edit-staff";

beforeEach(() => {
  resetMockState();
  destroyDoc();
  initDoc();
  seedOneTrackScore(getScoreMap()!, 1);
});

const ctx = { source: "test" as const };

describe("edit.staff.setCapo", () => {
  it("updates capo on the Y.Map", () => {
    executeAction("edit.staff.setCapo", { trackIndex: 0, staffIndex: 0, capo: 3 }, ctx);
    const staff = resolveYStaff(0, 0)!;
    expect(staff.get("capo")).toBe(3);
  });

  it("sets capo to 0", () => {
    executeAction("edit.staff.setCapo", { trackIndex: 0, staffIndex: 0, capo: 5 }, ctx);
    executeAction("edit.staff.setCapo", { trackIndex: 0, staffIndex: 0, capo: 0 }, ctx);
    expect(resolveYStaff(0, 0)!.get("capo")).toBe(0);
  });

  it("does nothing for invalid track index", () => {
    executeAction("edit.staff.setCapo", { trackIndex: 99, staffIndex: 0, capo: 3 }, ctx);
    expect(resolveYStaff(0, 0)!.get("capo")).toBe(0);
  });
});

describe("edit.staff.setTransposition", () => {
  it("updates transpositionPitch on the Y.Map", () => {
    executeAction("edit.staff.setTransposition", { trackIndex: 0, staffIndex: 0, semitones: -2 }, ctx);
    const staff = resolveYStaff(0, 0)!;
    expect(staff.get("transpositionPitch")).toBe(-2);
  });
});

describe("edit.staff.setTuning", () => {
  it("replaces tuning array", () => {
    const dropD = [38, 45, 50, 55, 59, 64];
    executeAction("edit.staff.setTuning", { trackIndex: 0, staffIndex: 0, tuningValues: dropD }, ctx);
    const staff = resolveYStaff(0, 0)!;
    const tuning = staff.get("tuning") as Y.Array<number>;
    expect(tuning.toArray()).toEqual(dropD);
  });

  it("can set 7-string tuning", () => {
    const sevenString = [35, 40, 45, 50, 55, 59, 64];
    executeAction("edit.staff.setTuning", { trackIndex: 0, staffIndex: 0, tuningValues: sevenString }, ctx);
    const tuning = resolveYStaff(0, 0)!.get("tuning") as Y.Array<number>;
    expect(tuning.toArray()).toEqual(sevenString);
  });
});
