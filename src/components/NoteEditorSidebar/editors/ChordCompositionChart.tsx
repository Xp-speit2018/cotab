import type { ChordCandidate } from "@/core/chords";
import { formatPitchClass, modulo12 } from "@/core/chords";
import { cn } from "@/lib/utils";
import {
  CHORD_FUNCTION_COLORS,
  type ChordFunction,
} from "./chord-function-colors";

interface LaneOption {
  semitones: number;
  labels: string[];
}

interface Lane {
  key: ChordFunction;
  options: LaneOption[];
}

const LANES: Lane[] = [
  {
    key: "extensions",
    options: [
      { semitones: 1, labels: ["b9"] },
      { semitones: 2, labels: ["9"] },
      { semitones: 3, labels: ["#9"] },
      { semitones: 5, labels: ["11"] },
      { semitones: 6, labels: ["#11"] },
      { semitones: 8, labels: ["b13"] },
      { semitones: 9, labels: ["13"] },
    ],
  },
  {
    key: "sixthSeventh",
    options: [
      { semitones: 8, labels: ["b6"] },
      { semitones: 9, labels: ["6", "dim7"] },
      { semitones: 10, labels: ["7"] },
      { semitones: 11, labels: ["maj7"] },
    ],
  },
  {
    key: "fifth",
    options: [
      { semitones: 6, labels: ["b5"] },
      { semitones: 7, labels: ["5"] },
      { semitones: 8, labels: ["#5"] },
    ],
  },
  {
    key: "third",
    options: [
      { semitones: 2, labels: ["sus2"] },
      { semitones: 3, labels: ["m3"] },
      { semitones: 4, labels: ["3"] },
      { semitones: 5, labels: ["sus4"] },
    ],
  },
  {
    key: "root",
    options: [{ semitones: 0, labels: ["1"] }],
  },
];

export function ChordCompositionChart({
  candidate,
  labels,
}: {
  candidate: ChordCandidate | null;
  labels: {
    empty: string;
    semitones: string;
    extensions: string;
    sixthSeventh: string;
    fifth: string;
    third: string;
    root: string;
    bass: string;
  };
}) {
  if (!candidate) {
    return (
      <div className="rounded-md border border-dashed px-3 py-4 text-center text-[11px] text-muted-foreground">
        {labels.empty}
      </div>
    );
  }

  const selectedIntervals = new Set(candidate.tones.map((tone) => tone.interval));
  const bassSemitones = modulo12(candidate.bassPitchClass - candidate.rootPitchClass);

  return (
    <div data-chord-composition>
      <div className="overflow-x-auto rounded-md border bg-muted/10 p-1.5">
        <div className="min-w-[540px]">
          <div className="grid h-7 grid-cols-[64px_repeat(12,minmax(39px,1fr))] items-center border-b border-border/50 text-center text-[10px] text-muted-foreground">
            <span className="pr-1 text-right">{labels.semitones}</span>
            {Array.from({ length: 12 }, (_, semitones) => (
              <span
                key={semitones}
                className="relative self-stretch border-l border-border/45 pt-0.5"
              >
                <span className="block font-mono leading-none text-foreground">{semitones}</span>
                <span className="leading-none">
                  {formatPitchClass(candidate.rootPitchClass + semitones)}
                </span>
                {semitones === bassSemitones && (
                  <span
                    className="absolute -top-0.5 right-0.5 font-mono text-[9px] font-semibold text-foreground"
                    title={`${labels.bass} ${candidate.bassName}`}
                  >
                    ↓
                  </span>
                )}
              </span>
            ))}
          </div>

          {LANES.map((lane) => (
            <div
              key={lane.key}
              data-chord-lane={lane.key}
              className="grid h-6 grid-cols-[64px_repeat(12,minmax(39px,1fr))] items-center"
            >
              <span className="truncate pr-1.5 text-right text-[10px] text-muted-foreground">
                {labels[lane.key]}
              </span>
              {Array.from({ length: 12 }, (_, semitones) => {
                const option = lane.options.find((item) => item.semitones === semitones);
                const selected = option?.labels.some((label) => selectedIntervals.has(label));
                const colors = CHORD_FUNCTION_COLORS[lane.key];
                return (
                  <div
                    key={semitones}
                    className="flex h-full items-center justify-center border-l border-border/30"
                  >
                    {option && (
                      <span
                        data-chord-option
                        data-chord-function={lane.key}
                        data-semitones={semitones}
                        data-selected={selected || undefined}
                        className={cn(
                          "rounded-full border px-1 py-px font-mono text-[10px] leading-none",
                          selected
                            ? colors.selected
                            : cn("border-transparent bg-transparent opacity-45", colors.quiet),
                        )}
                      >
                        {option.labels.join("/")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
