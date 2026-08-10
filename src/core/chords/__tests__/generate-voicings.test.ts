import { describe, expect, it } from "vitest";
import { analyzeChordFingering } from "../analyze-chord";
import { defaultChordFormula } from "../formula";
import { generateChordVoicings } from "../generate-voicings";

const STANDARD_TUNING = [64, 59, 55, 50, 45, 40];

describe("generateChordVoicings", () => {
  it("generates playable root-position voicings that round-trip through analysis", () => {
    const voicings = generateChordVoicings({
      formula: defaultChordFormula(0),
      tuning: STANDARD_TUNING,
      maxResults: 8,
    });
    expect(voicings.length).toBeGreaterThan(1);
    expect(new Set(voicings.map((voicing) => voicing.familyKey)).size)
      .toBe(voicings.length);
    expect(voicings.some((voicing) => voicing.position === "open")).toBe(true);
    expect(voicings.some((voicing) => voicing.position === "movable")).toBe(true);
    expect(voicings.find((voicing) => voicing.position === "open")?.rootString).toBe(5);
    for (const voicing of voicings) {
      expect(voicing.fretSpan).toBeLessThanOrEqual(4);
      expect(analyzeChordFingering({
        tuning: STANDARD_TUNING,
        frets: voicing.strings,
      })[0]?.symbol).toBe("C");
    }
  });

  it("honors an explicit slash bass", () => {
    const voicings = generateChordVoicings({
      formula: {
        rootPitchClass: 0,
        bassPitchClass: 4,
        tones: ["1", "3", "5"],
      },
      tuning: STANDARD_TUNING,
      maxResults: 4,
    });
    expect(voicings).not.toHaveLength(0);
    expect(analyzeChordFingering({
      tuning: STANDARD_TUNING,
      frets: voicings[0].strings,
    })[0]?.symbol).toBe("C/E");
  });

  it("generates complete power-chord voicings", () => {
    const voicings = generateChordVoicings({
      formula: { rootPitchClass: 5, bassPitchClass: 5, tones: ["1", "5"] },
      tuning: STANDARD_TUNING,
      maxResults: 4,
    });
    expect(voicings).not.toHaveLength(0);
    expect(analyzeChordFingering({
      tuning: STANDARD_TUNING,
      frets: voicings[0].strings,
    })[0]?.symbol).toBe("F5");
  });

  it("changes the family representative instead of flooding results with variants", () => {
    const formula = defaultChordFormula(0);
    const compact = generateChordVoicings({
      formula,
      tuning: STANDARD_TUNING,
      density: "compact",
      maxResults: 8,
    });
    const balanced = generateChordVoicings({
      formula,
      tuning: STANDARD_TUNING,
      density: "balanced",
      maxResults: 8,
    });
    const full = generateChordVoicings({
      formula,
      tuning: STANDARD_TUNING,
      density: "full",
      maxResults: 8,
    });

    const openShape = (voicings: typeof balanced) => voicings
      .find((voicing) => voicing.position === "open")?.strings;
    expect(openShape(compact)?.filter((fret) => fret >= 0)).toHaveLength(3);
    expect(openShape(balanced)?.filter((fret) => fret >= 0)).toHaveLength(5);
    expect(openShape(full)?.filter((fret) => fret >= 0)).toHaveLength(5);
    expect(full.some((voicing) => voicing.soundingStrings === 6)).toBe(true);
    expect(balanced[0]?.variantCount).toBeGreaterThan(1);
  });
});
