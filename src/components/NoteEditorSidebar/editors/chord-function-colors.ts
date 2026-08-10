export type ChordFunction =
  | "root"
  | "third"
  | "fifth"
  | "sixthSeventh"
  | "extensions";

export const CHORD_FUNCTION_COLORS: Record<
  ChordFunction,
  { selected: string; quiet: string; marker: string }
> = {
  root: {
    selected: "border-lime-600 bg-lime-600 text-white",
    quiet: "text-lime-700 dark:text-lime-300",
    marker: "bg-lime-600 text-white",
  },
  third: {
    selected: "border-amber-500 bg-amber-500 text-white",
    quiet: "text-amber-700 dark:text-amber-300",
    marker: "bg-amber-500 text-white",
  },
  fifth: {
    selected: "border-sky-600 bg-sky-600 text-white",
    quiet: "text-sky-700 dark:text-sky-300",
    marker: "bg-sky-600 text-white",
  },
  sixthSeventh: {
    selected: "border-orange-500 bg-orange-500 text-white",
    quiet: "text-orange-700 dark:text-orange-300",
    marker: "bg-orange-500 text-white",
  },
  extensions: {
    selected: "border-rose-600 bg-rose-600 text-white",
    quiet: "text-rose-700 dark:text-rose-300",
    marker: "bg-rose-600 text-white",
  },
};

const INTERVAL_FUNCTIONS: Record<string, ChordFunction> = {
  "1": "root",
  sus2: "third",
  m3: "third",
  "3": "third",
  sus4: "third",
  b5: "fifth",
  "5": "fifth",
  "#5": "fifth",
  b6: "sixthSeventh",
  "6": "sixthSeventh",
  dim7: "sixthSeventh",
  "7": "sixthSeventh",
  maj7: "sixthSeventh",
  b9: "extensions",
  "9": "extensions",
  "#9": "extensions",
  "11": "extensions",
  "#11": "extensions",
  b13: "extensions",
  "13": "extensions",
};

export function chordFunctionForInterval(interval: string | undefined): ChordFunction | null {
  return interval ? INTERVAL_FUNCTIONS[interval] ?? null : null;
}
