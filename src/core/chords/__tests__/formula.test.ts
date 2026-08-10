import { describe, expect, it } from "vitest";
import {
  candidateToChordFormula,
  chordFormulaPitchClasses,
  defaultChordFormula,
  formatChordFormula,
} from "../formula";
import { analyzeChordFingering } from "../analyze-chord";

const STANDARD_TUNING = [64, 59, 55, 50, 45, 40];

describe("ChordFormula", () => {
  it.each([
    [defaultChordFormula(0), "C"],
    [{ rootPitchClass: 5, bassPitchClass: 5, tones: ["1", "5"] }, "F5"],
    [{ rootPitchClass: 0, bassPitchClass: 4, tones: ["1", "3", "5"] }, "C/E"],
    [{ rootPitchClass: 0, bassPitchClass: 0, tones: ["1", "3", "5", "7", "#9"] }, "C7(#9)"],
  ] as const)("formats %o as %s", (formula, symbol) => {
    expect(formatChordFormula(formula)).toBe(symbol);
  });

  it("keeps semantic tone roles while resolving sounding pitch classes", () => {
    expect(chordFormulaPitchClasses({
      rootPitchClass: 0,
      bassPitchClass: 0,
      tones: ["1", "3", "5", "7", "#9"],
    })).toEqual([0, 3, 4, 7, 10]);
  });

  it("converts an analyzed voicing into the shared formula", () => {
    const candidate = analyzeChordFingering({
      tuning: STANDARD_TUNING,
      frets: [0, 1, 0, 2, 3, -1],
    })[0]!;
    expect(candidateToChordFormula(candidate)).toEqual({
      rootPitchClass: 0,
      bassPitchClass: 0,
      tones: ["1", "3", "5"],
    });
  });
});
