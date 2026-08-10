export interface AnalyzeChordFingeringInput {
  /** AlphaTab tuning order: highest-pitched string to lowest-pitched string. */
  tuning: readonly number[];
  /** AlphaTab chord order: highest-pitched string to lowest-pitched string. */
  frets: readonly number[];
  capo?: number;
}

export type ChordDiagnosticCode =
  | "incomplete"
  | "missing-third"
  | "cluster"
  | "ambiguous-fifth"
  | "ambiguous-seventh";

export interface ChordCandidate {
  symbol: string;
  rootPitchClass: number;
  rootName: string;
  bassPitchClass: number;
  bassName: string;
  intervals: string[];
  notes: string[];
  tones: Array<{
    pitchClass: number;
    noteName: string;
    interval: string;
    semitonesFromRoot: number;
  }>;
  diagnostics: ChordDiagnosticCode[];
  score: number;
}
