import type { ChordFormula } from "./formula";
import { chordFormulaPitchClasses } from "./formula";
import { modulo12 } from "./pitch-class";

export interface ChordVoicingCandidate {
  strings: number[];
  firstFret: number;
  fretSpan: number;
  score: number;
  soundingStrings: number;
  openStrings: number;
  rootString: number | null;
  position: "open" | "movable";
  familyKey: string;
  variantCount: number;
}

export type VoicingDensity = "compact" | "balanced" | "full";

export interface GenerateChordVoicingsInput {
  formula: ChordFormula;
  tuning: readonly number[];
  capo?: number;
  maxFret?: number;
  maxSpan?: number;
  maxResults?: number;
  maxScoreGap?: number;
  density?: VoicingDensity;
}

export function generateChordVoicings({
  formula,
  tuning,
  capo = 0,
  maxFret = 12,
  maxSpan = 4,
  maxResults = 12,
  maxScoreGap = 60,
  density = "balanced",
}: GenerateChordVoicingsInput): ChordVoicingCandidate[] {
  const pitchClasses = chordFormulaPitchClasses(formula);
  const allowed = new Set(pitchClasses);
  const choices = tuning.map((openMidi) => [
    -1,
    ...Array.from({ length: maxFret + 1 }, (_, fret) => fret)
      .filter((fret) => allowed.has(modulo12(openMidi + capo + fret))),
  ]);
  const results: ChordVoicingCandidate[] = [];
  const strings = Array.from({ length: tuning.length }, () => -1);

  const visit = (stringIndex: number, minFret: number, maxUsedFret: number) => {
    if (stringIndex === tuning.length) {
      const sounding = strings
        .map((fret, index) => fret < 0 ? null : {
          midi: tuning[index] + capo + fret,
          pitchClass: modulo12(tuning[index] + capo + fret),
          index,
        })
        .filter((note): note is NonNullable<typeof note> => note !== null);
      if (sounding.length < Math.min(3, pitchClasses.length)) return;
      const soundingPitchClasses = new Set(sounding.map((note) => note.pitchClass));
      if (pitchClasses.some((pitchClass) => !soundingPitchClasses.has(pitchClass))) return;
      const bass = sounding.reduce((lowest, note) => note.midi < lowest.midi ? note : lowest);
      if (bass.pitchClass !== modulo12(formula.bassPitchClass)) return;

      const positiveFrets = strings.filter((fret) => fret > 0);
      const lowestPositive = positiveFrets.length > 0 ? Math.min(...positiveFrets) : 1;
      const highestPositive = positiveFrets.length > 0 ? Math.max(...positiveFrets) : 1;
      const fretSpan = positiveFrets.length > 0 ? highestPositive - lowestPositive : 0;
      const firstFret = highestPositive <= 5 ? 1 : lowestPositive;
      const firstSounding = strings.findIndex((fret) => fret >= 0);
      let lastSounding = strings.length - 1;
      while (lastSounding >= 0 && strings[lastSounding] < 0) lastSounding--;
      let internalMutes = 0;
      for (let index = firstSounding; index <= lastSounding; index++) {
        if (strings[index] < 0) internalMutes++;
      }
      const openStrings = strings.filter((fret) => fret === 0).length;
      const frettedStrings = strings.filter((fret) => fret > 0).length;
      const mutedStrings = strings.filter((fret) => fret < 0).length;
      const soundingStrings = sounding.length;
      const targetStrings = density === "compact"
        ? pitchClasses.length
        : density === "full"
          ? tuning.length
          : Math.min(tuning.length, pitchClasses.length + 2);
      const densityPenalty = Math.abs(soundingStrings - targetStrings) * 16;
      const lowestRoot = sounding
        .filter((note) => note.pitchClass === modulo12(formula.rootPitchClass))
        .reduce<(typeof sounding)[number] | null>(
          (lowest, note) => !lowest || note.midi < lowest.midi ? note : lowest,
          null,
        );
      const position = openStrings > 0 ? "open" : "movable";
      const positionBucket = position === "open"
        ? "open"
        : `fret-${Math.floor((lowestPositive - 1) / 3)}`;
      const familyKey = `${position}:${positionBucket}`;
      const score = 1000
        - fretSpan * 18
        - Math.max(0, lowestPositive - 1) * 3
        - frettedStrings * 3
        - mutedStrings * 2
        - internalMutes * 14
        + openStrings * 3
        + soundingStrings
        - densityPenalty;
      results.push({
        strings: [...strings],
        firstFret,
        fretSpan,
        score,
        soundingStrings,
        openStrings,
        rootString: lowestRoot ? lowestRoot.index + 1 : null,
        position,
        familyKey,
        variantCount: 1,
      });
      return;
    }

    for (const fret of choices[stringIndex]) {
      const nextMin = fret > 0 ? Math.min(minFret, fret) : minFret;
      const nextMax = fret > 0 ? Math.max(maxUsedFret, fret) : maxUsedFret;
      if (nextMin !== Number.POSITIVE_INFINITY && nextMax - nextMin > maxSpan) continue;
      strings[stringIndex] = fret;
      visit(stringIndex + 1, nextMin, nextMax);
    }
    strings[stringIndex] = -1;
  };

  visit(0, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY);
  const ranked = results.sort((left, right) => right.score - left.score
    || left.strings.join(",").localeCompare(right.strings.join(",")));
  const familyRepresentatives = new Map<string, ChordVoicingCandidate>();
  for (const candidate of ranked) {
    const representative = familyRepresentatives.get(candidate.familyKey);
    if (representative) {
      representative.variantCount += 1;
    } else {
      familyRepresentatives.set(candidate.familyKey, candidate);
    }
  }
  const representatives = [...familyRepresentatives.values()]
    .sort((left, right) => right.score - left.score
      || left.familyKey.localeCompare(right.familyKey));
  const bestScore = representatives[0]?.score ?? Number.NEGATIVE_INFINITY;
  return representatives
    .filter((candidate) => candidate.score >= bestScore - maxScoreGap)
    .slice(0, maxResults);
}
