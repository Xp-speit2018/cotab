const DEGREE_SEMITONES = [0, 2, 4, 5, 7, 9, 11] as const;

/**
 * Mirrors AlphaTab AccidentalHelper._octaveSteps.
 * Index order: [Neutral=0, C3=1, C4=2, F4=3, G2=4]
 */
const CLEF_OCTAVE_STEPS: Record<number, number> = {
  0: 38,
  1: 32,
  2: 30,
  3: 26,
  4: 38,
};

export function formatPitch(
  octave: number | null | undefined,
  tone: number | null | undefined,
): string {
  if (octave === null || octave === undefined || tone === null || tone === undefined) {
    return "n/a";
  }
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const idx = ((tone % 12) + 12) % 12;
  return `${names[idx] ?? "?"}${octave}`;
}

export function snapPositionToPitch(
  clef: number,
  position: number,
): { octave: number; tone: number } {
  const staffStep = position - 7;
  const octaveSteps = CLEF_OCTAVE_STEPS[clef] ?? 38;

  const total = octaveSteps - staffStep;
  const spellingOctave = Math.floor(total / 7);
  const degree = ((total % 7) + 7) % 7;

  return { octave: spellingOctave + 1, tone: DEGREE_SEMITONES[degree] };
}
