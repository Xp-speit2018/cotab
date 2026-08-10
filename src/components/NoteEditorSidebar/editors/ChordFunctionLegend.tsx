import { CHORD_FUNCTION_COLORS, type ChordFunction } from "./chord-function-colors";

const FUNCTIONS: ChordFunction[] = [
  "root",
  "third",
  "fifth",
  "sixthSeventh",
  "extensions",
];

export function ChordFunctionLegend({
  labels,
}: {
  labels: Record<ChordFunction, string>;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[9px] text-muted-foreground"
      data-chord-function-legend
    >
      {FUNCTIONS.map((chordFunction) => (
        <span key={chordFunction} className="inline-flex items-center gap-1">
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${CHORD_FUNCTION_COLORS[chordFunction].marker}`}
          />
          {labels[chordFunction]}
        </span>
      ))}
    </div>
  );
}
