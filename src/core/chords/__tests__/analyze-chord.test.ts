import { describe, expect, it } from "vitest";
import { analyzeChordFingering } from "../analyze-chord";

const STANDARD_TUNING = [64, 59, 55, 50, 45, 40];

function analyze(frets: number[], capo = 0) {
  return analyzeChordFingering({ tuning: STANDARD_TUNING, frets, capo });
}

describe("analyzeChordFingering", () => {
  it.each([
    [[0, 1, 0, 2, 3, -1], "C"],
    [[3, 0, 0, 0, 2, 3], "G"],
    [[0, 1, 2, 2, 0, -1], "Am"],
    [[0, 0, 0, 2, 3, -1], "Cmaj7"],
  ] as const)("ranks %s as %s", (frets, expected) => {
    expect(analyze([...frets])[0]?.symbol).toBe(expected);
  });

  it.each([
    [[0, 1, 3, 2, 3, -1], "C7"],
    [[1, 1, 2, 0, -1, -1], "Dm7"],
    [[0, 3, 0, 2, 3, -1], "Cadd9"],
    [[-1, 4, 3, 2, 3, -1], "C7(#9)"],
    [[-1, 10, 9, 8, -1, 8], "C13"],
  ] as const)("handles extended shape %s as %s", (frets, expected) => {
    expect(analyze([...frets])[0]?.symbol).toBe(expected);
  });

  it("prefers a conventional slash chord over a rare bass-root spelling", () => {
    expect(analyze([0, 1, 0, 2, 3, 0])[0]?.symbol).toBe("C/E");
  });

  it.each([
    [[-1, -1, -1, 3, 3, 1], "F5"],
    [[-1, -1, -1, 2, 2, 0], "E5"],
    [[-1, -1, 2, 2, 0, -1], "A5"],
  ] as const)("treats the root-fifth dyad %s as a complete %s power chord", (
    frets,
    expected,
  ) => {
    const candidates = analyze([...frets]);
    expect(candidates[0]?.symbol).toBe(expected);
    expect(candidates[0]?.diagnostics).not.toContain("incomplete");
  });

  it("keeps a bare suspended dyad incomplete and below the bass-root power chord", () => {
    const candidates = analyze([-1, -1, -1, 3, 3, 1]);
    const suspended = candidates.find((candidate) => candidate.symbol === "Csus4/F");
    expect(suspended?.diagnostics).toContain("incomplete");
    expect(candidates.findIndex((candidate) => candidate.symbol === "F5"))
      .toBeLessThan(candidates.findIndex((candidate) => candidate.symbol === "Csus4/F"));
  });

  it("ignores muted strings and duplicate chord tones", () => {
    expect(analyze([3, 1, 0, 2, 3, -1])[0]?.symbol).toBe("C");
  });

  it("uses the actual lowest MIDI pitch for alternate tunings", () => {
    const candidates = analyzeChordFingering({
      tuning: [76, 69, 62, 55],
      frets: [0, 0, 0, 0],
      capo: 0,
    });
    expect(candidates.every((candidate) => candidate.bassPitchClass === 7)).toBe(true);
  });

  it("applies capo to the sounding chord name", () => {
    expect(analyze([0, 1, 0, 2, 3, -1], 2)[0]?.symbol).toBe("D");
  });

  it("returns no candidates for an entirely muted shape", () => {
    expect(analyze([-1, -1, -1, -1, -1, -1])).toEqual([]);
  });

  it("does not mutate its inputs and is deterministic", () => {
    const tuning = [...STANDARD_TUNING];
    const frets = [0, 1, 0, 2, 3, -1];
    const first = analyzeChordFingering({ tuning, frets });
    const second = analyzeChordFingering({ tuning, frets });
    expect(second).toEqual(first);
    expect(tuning).toEqual(STANDARD_TUNING);
    expect(frets).toEqual([0, 1, 0, 2, 3, -1]);
  });
});
