import type { ChordCandidate } from "./types";
import { formatPitchClass, modulo12 } from "./pitch-class";

export type ChordToneFunction =
  | "root"
  | "third"
  | "fifth"
  | "sixthSeventh"
  | "extensions";

export type ChordToneId =
  | "1"
  | "sus2"
  | "m3"
  | "3"
  | "sus4"
  | "b5"
  | "5"
  | "#5"
  | "b6"
  | "6"
  | "dim7"
  | "7"
  | "maj7"
  | "b9"
  | "9"
  | "#9"
  | "11"
  | "#11"
  | "b13"
  | "13";

export interface ChordToneDefinition {
  id: ChordToneId;
  semitones: number;
  chordFunction: ChordToneFunction;
}

export interface ChordFormula {
  rootPitchClass: number;
  bassPitchClass: number;
  tones: ChordToneId[];
}

export const CHORD_TONE_DEFINITIONS: Record<ChordToneId, ChordToneDefinition> = {
  "1": { id: "1", semitones: 0, chordFunction: "root" },
  sus2: { id: "sus2", semitones: 2, chordFunction: "third" },
  m3: { id: "m3", semitones: 3, chordFunction: "third" },
  "3": { id: "3", semitones: 4, chordFunction: "third" },
  sus4: { id: "sus4", semitones: 5, chordFunction: "third" },
  b5: { id: "b5", semitones: 6, chordFunction: "fifth" },
  "5": { id: "5", semitones: 7, chordFunction: "fifth" },
  "#5": { id: "#5", semitones: 8, chordFunction: "fifth" },
  b6: { id: "b6", semitones: 8, chordFunction: "sixthSeventh" },
  "6": { id: "6", semitones: 9, chordFunction: "sixthSeventh" },
  dim7: { id: "dim7", semitones: 9, chordFunction: "sixthSeventh" },
  "7": { id: "7", semitones: 10, chordFunction: "sixthSeventh" },
  maj7: { id: "maj7", semitones: 11, chordFunction: "sixthSeventh" },
  b9: { id: "b9", semitones: 1, chordFunction: "extensions" },
  "9": { id: "9", semitones: 2, chordFunction: "extensions" },
  "#9": { id: "#9", semitones: 3, chordFunction: "extensions" },
  "11": { id: "11", semitones: 5, chordFunction: "extensions" },
  "#11": { id: "#11", semitones: 6, chordFunction: "extensions" },
  b13: { id: "b13", semitones: 8, chordFunction: "extensions" },
  "13": { id: "13", semitones: 9, chordFunction: "extensions" },
};

export function defaultChordFormula(rootPitchClass = 0): ChordFormula {
  const root = modulo12(rootPitchClass);
  return {
    rootPitchClass: root,
    bassPitchClass: root,
    tones: ["1", "3", "5"],
  };
}

export function candidateToChordFormula(candidate: ChordCandidate): ChordFormula {
  const tones = candidate.tones
    .map((tone) => tone.interval)
    .filter((interval): interval is ChordToneId => interval in CHORD_TONE_DEFINITIONS);
  return {
    rootPitchClass: candidate.rootPitchClass,
    bassPitchClass: candidate.bassPitchClass,
    tones: tones.includes("1") ? tones : ["1", ...tones],
  };
}

export function chordFormulaPitchClasses(formula: ChordFormula): number[] {
  return [...new Set(formula.tones.map((tone) =>
    modulo12(formula.rootPitchClass + CHORD_TONE_DEFINITIONS[tone].semitones)))]
    .sort((left, right) => left - right);
}

export function formatChordFormula(formula: ChordFormula): string {
  const tones = new Set(formula.tones);
  const rootName = formatPitchClass(formula.rootPitchClass);
  const hasMinorThird = tones.has("m3");
  const hasMajorThird = tones.has("3");
  const hasFifth = tones.has("5");
  const isPower = hasFifth && tones.size === 2;
  const isDiminished = hasMinorThird && tones.has("b5") && !hasFifth;
  const isAugmented = hasMajorThird && tones.has("#5") && !hasFifth;
  const isSus2 = !hasMinorThird && !hasMajorThird && tones.has("sus2");
  const isSus4 = !hasMinorThird && !hasMajorThird && tones.has("sus4");

  let quality = "";
  if (isPower) quality = "5";
  else if (isDiminished) quality = "dim";
  else if (isAugmented) quality = "aug";
  else if (hasMinorThird && !hasMajorThird) quality = "m";
  else if (isSus2) quality = "sus2";
  else if (isSus4) quality = "sus4";

  const hasMinorSeventh = tones.has("7");
  const hasMajorSeventh = tones.has("maj7");
  const highestExtension = tones.has("13")
    ? "13"
    : tones.has("11") ? "11" : tones.has("9") ? "9" : null;

  let suffix = quality;
  if (!isPower) {
    if (isDiminished && tones.has("dim7")) {
      suffix = "dim7";
    } else if (hasMajorSeventh) {
      const extension = highestExtension ? `maj${highestExtension}` : "maj7";
      suffix = isSus2 || isSus4 ? `${extension}${quality}` : `${quality}${extension}`;
    } else if (hasMinorSeventh) {
      const extension = highestExtension ?? "7";
      suffix = isSus2 || isSus4 ? `${extension}${quality}` : `${quality}${extension}`;
    } else if (tones.has("6")) {
      suffix = `${quality}6`;
    }
  }

  const modifiers: string[] = [];
  if (tones.has("b5") && !isDiminished) modifiers.push("b5");
  if (tones.has("#5") && !isAugmented) modifiers.push("#5");
  for (const alteration of ["b6", "b9", "#9", "#11", "b13"] as const) {
    if (tones.has(alteration)) modifiers.push(alteration);
  }
  if (!hasMinorSeventh && !hasMajorSeventh) {
    for (const extension of ["9", "11", "13"] as const) {
      if (tones.has(extension)) modifiers.push(`add${extension}`);
    }
  }
  if (tones.has("sus2") && !isSus2) modifiers.push("add9");
  if (tones.has("sus4") && !isSus4) modifiers.push("add11");

  if (modifiers.length === 1 && modifiers[0].startsWith("add")) {
    suffix += modifiers[0];
  } else if (modifiers.length > 0) {
    suffix += `(${modifiers.join(",")})`;
  }

  const bassName = formatPitchClass(formula.bassPitchClass);
  const slash = modulo12(formula.bassPitchClass) === modulo12(formula.rootPitchClass)
    ? ""
    : `/${bassName}`;
  return `${rootName}${suffix}${slash}`;
}
