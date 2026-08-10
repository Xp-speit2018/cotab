import { formatPitchClass, modulo12 } from "./pitch-class";
import type {
  AnalyzeChordFingeringInput,
  ChordCandidate,
  ChordDiagnosticCode,
} from "./types";

interface Classification {
  suffix: string;
  intervals: string[];
  diagnostics: ChordDiagnosticCode[];
  score: number;
}

function hasConsecutiveCluster(intervals: ReadonlySet<number>): boolean {
  for (let value = 0; value < 12; value++) {
    if (
      intervals.has(value)
      && intervals.has(modulo12(value + 1))
      && intervals.has(modulo12(value + 2))
    ) return true;
  }
  return false;
}

function classify(intervalValues: readonly number[]): Classification {
  const present = new Set(intervalValues);
  const hasMinorThird = present.has(3);
  const hasMajorThird = present.has(4);
  const hasFourth = present.has(5);
  const hasFlatFifth = present.has(6);
  const hasFifth = present.has(7);
  const hasSharpFifth = present.has(8);
  const hasSixth = present.has(9);
  const hasMinorSeventh = present.has(10);
  const hasMajorSeventh = present.has(11);
  const hasSecond = present.has(2);

  let quality: "major" | "minor" | "dim" | "aug" | "sus2" | "sus4" | "power" | "none";
  if (hasMinorThird && !hasMajorThird) {
    quality = hasFlatFifth && !hasFifth && !hasMinorSeventh ? "dim" : "minor";
  } else if (hasMajorThird) {
    quality = hasSharpFifth && !hasFifth && !hasMinorSeventh && !hasMajorSeventh
      ? "aug"
      : "major";
  } else if (hasFourth) {
    quality = "sus4";
  } else if (hasSecond) {
    quality = "sus2";
  } else if (hasFifth && intervalValues.length <= 2) {
    quality = "power";
  } else {
    quality = "none";
  }

  const diagnostics: ChordDiagnosticCode[] = [];
  // A root-fifth dyad is the complete definition of a power chord, not an
  // incomplete triad. Other two-note qualities still need the diagnostic.
  if (intervalValues.length < 3 && quality !== "power") diagnostics.push("incomplete");
  if (quality === "none") diagnostics.push("missing-third");
  if (hasConsecutiveCluster(present)) diagnostics.push("cluster");
  if (hasFifth && (hasFlatFifth || hasSharpFifth)) diagnostics.push("ambiguous-fifth");
  if (hasMinorSeventh && hasMajorSeventh) diagnostics.push("ambiguous-seventh");

  let suffix = "";
  if (quality === "minor") suffix = "m";
  else if (quality === "dim") suffix = "dim";
  else if (quality === "aug") suffix = "aug";
  else if (quality === "sus2") suffix = "sus2";
  else if (quality === "sus4") suffix = "sus4";
  else if (quality === "power") suffix = "5";

  const naturalTensions: string[] = [];
  const alterations: string[] = [];
  const additions: string[] = [];

  if (hasFlatFifth && quality !== "dim") alterations.push("b5");
  if (hasSharpFifth && quality !== "aug") alterations.push("#5");
  if (present.has(1)) alterations.push("b9");
  if (hasMinorThird && hasMajorThird) alterations.push("#9");

  const hasSeventh = hasMinorSeventh || hasMajorSeventh;
  const appendExtension = (extension: string) => {
    suffix = quality === "sus2" || quality === "sus4"
      ? `${extension}${suffix}`
      : `${suffix}${extension}`;
  };
  if (hasFlatFifth && hasFifth && hasSeventh) {
    alterations.splice(alterations.indexOf("b5"), 1, "#11");
  }
  if (hasSharpFifth && hasFifth && hasSeventh) {
    alterations.splice(alterations.indexOf("#5"), 1, "b13");
  }

  if (hasSecond && quality !== "sus2") {
    (hasSeventh ? naturalTensions : additions).push(hasSeventh ? "9" : "add9");
  }
  if (hasFourth && quality !== "sus4") {
    (hasSeventh ? naturalTensions : additions).push(hasSeventh ? "11" : "add11");
  }
  if (hasSixth && quality !== "dim") {
    if (hasSeventh) naturalTensions.push("13");
  }

  if (quality === "dim" && hasSixth) {
    suffix = "dim7";
  } else if (hasMajorSeventh) {
    const extension = naturalTensions.includes("13")
      ? "maj13"
      : naturalTensions.includes("11")
        ? "maj11"
        : naturalTensions.includes("9") ? "maj9" : "maj7";
    appendExtension(extension);
    naturalTensions.length = 0;
  } else if (hasMinorSeventh) {
    const extension = naturalTensions.includes("13")
      ? "13"
      : naturalTensions.includes("11")
        ? "11"
        : naturalTensions.includes("9") ? "9" : "7";
    appendExtension(extension);
    naturalTensions.length = 0;
  } else if (hasSixth && quality !== "dim") {
    appendExtension("6");
  }

  if (quality === "none" && intervalValues.length > 1) additions.push("no3");

  const modifiers = [...naturalTensions, ...alterations, ...additions];
  if (modifiers.length === 1 && modifiers[0].startsWith("add")) {
    suffix += modifiers[0];
  } else if (modifiers.length > 0) {
    suffix += `(${modifiers.join(",")})`;
  }

  const labels = intervalValues.map((interval) => {
    switch (interval) {
      case 0: return "1";
      case 1: return "b9";
      case 2: return quality === "sus2" ? "sus2" : "9";
      case 3: return hasMajorThird ? "#9" : "m3";
      case 4: return "3";
      case 5: return quality === "sus4" ? "sus4" : "11";
      case 6: return hasFifth && hasSeventh ? "#11" : "b5";
      case 7: return "5";
      case 8: return hasFifth && hasSeventh ? "b13" : "#5";
      case 9: return quality === "dim" ? "dim7" : hasSeventh ? "13" : "6";
      case 10: return "7";
      case 11: return "maj7";
      default: return "?";
    }
  });

  let score = 100;
  if (quality === "none") score -= 38;
  if ((hasMinorThird || hasMajorThird) && hasFifth) score += 12;
  if (hasSeventh && (hasMinorThird || hasMajorThird)) score += 6;
  score -= alterations.length * 5;
  score -= additions.length * 4;
  score -= diagnostics.length * 8;
  score -= suffix.length * 0.15;

  return { suffix, intervals: labels, diagnostics, score };
}

export function analyzeChordFingering(
  input: AnalyzeChordFingeringInput,
): ChordCandidate[] {
  const capo = input.capo ?? 0;
  const stringCount = Math.min(input.tuning.length, input.frets.length);
  const sounding: Array<{ midi: number; pitchClass: number }> = [];

  for (let highToLowIndex = 0; highToLowIndex < stringCount; highToLowIndex++) {
    const fret = input.frets[highToLowIndex];
    if (!Number.isInteger(fret) || fret < 0) continue;
    const midi = input.tuning[highToLowIndex] + capo + fret;
    sounding.push({ midi, pitchClass: modulo12(midi) });
  }

  if (sounding.length === 0) return [];
  const bassPitchClass = sounding.reduce((lowest, note) =>
    note.midi < lowest.midi ? note : lowest).pitchClass;
  const pitchClasses = [...new Set(sounding.map((note) => note.pitchClass))];

  return pitchClasses.map((rootPitchClass): ChordCandidate => {
    const intervalValues = pitchClasses
      .map((pitchClass) => modulo12(pitchClass - rootPitchClass))
      .sort((a, b) => a - b);
    const classification = classify(intervalValues);
    const rootName = formatPitchClass(rootPitchClass);
    const bassName = formatPitchClass(bassPitchClass,
      rootName.includes("b") ? "flat" : rootName.includes("#") ? "sharp" : "auto");
    const slash = bassPitchClass === rootPitchClass ? "" : `/${bassName}`;
    const spelling = rootName.includes("b")
      ? "flat"
      : rootName.includes("#") ? "sharp" : "auto";
    const tones = intervalValues.map((interval, index) => {
      const pitchClass = modulo12(rootPitchClass + interval);
      return {
        pitchClass,
        noteName: formatPitchClass(pitchClass, spelling),
        interval: classification.intervals[index],
        semitonesFromRoot: interval,
      };
    });

    return {
      symbol: `${rootName}${classification.suffix}${slash}`,
      rootPitchClass,
      rootName,
      bassPitchClass,
      bassName,
      intervals: classification.intervals,
      notes: tones.map((tone) => tone.noteName),
      tones,
      diagnostics: classification.diagnostics,
      score: classification.score + (bassPitchClass === rootPitchClass ? 2 : 0),
    };
  }).sort((left, right) => right.score - left.score || left.symbol.localeCompare(right.symbol));
}
