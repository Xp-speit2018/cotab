const SHARP_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const;

const FLAT_NAMES = [
  "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B",
] as const;

const PREFER_FLAT = new Set([1, 3, 8, 10]);

export function modulo12(value: number): number {
  return ((value % 12) + 12) % 12;
}

export function formatPitchClass(
  pitchClass: number,
  preference: "auto" | "flat" | "sharp" = "auto",
): string {
  const normalized = modulo12(pitchClass);
  const useFlat = preference === "flat"
    || (preference === "auto" && PREFER_FLAT.has(normalized));
  return (useFlat ? FLAT_NAMES : SHARP_NAMES)[normalized];
}
