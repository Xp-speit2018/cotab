export const COTAB_FILE_EXTENSIONS = [".cotab"] as const;
export const GUITAR_PRO_FILE_EXTENSIONS = [
  ".gp",
  ".gp3",
  ".gp4",
  ".gp5",
  ".gpx",
] as const;
export const OPEN_SCORE_FILE_EXTENSIONS = [
  ...COTAB_FILE_EXTENSIONS,
  ...GUITAR_PRO_FILE_EXTENSIONS,
] as const;

export type ScoreFileKind = "cotab" | "guitarPro";

export function scoreFileKind(name: string): ScoreFileKind | null {
  const normalized = name.trim().toLowerCase();
  if (normalized.endsWith(".cotab")) return "cotab";
  return GUITAR_PRO_FILE_EXTENSIONS.some((extension) =>
      normalized.endsWith(extension))
    ? "guitarPro"
    : null;
}
