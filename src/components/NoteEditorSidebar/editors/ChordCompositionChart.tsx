import type { ChordFormula, ChordToneId } from "@/core/chords";
import { CHORD_TONE_DEFINITIONS, formatPitchClass, modulo12 } from "@/core/chords";
import { cn } from "@/lib/utils";
import {
  CHORD_FUNCTION_COLORS,
  type ChordFunction,
} from "./chord-function-colors";

interface LaneOption {
  semitones: number;
  tones: ChordToneId[];
}

interface Lane {
  key: ChordFunction;
  options: LaneOption[];
}

const LANES: Lane[] = [
  {
    key: "extensions",
    options: [
      { semitones: 1, tones: ["b9"] },
      { semitones: 2, tones: ["9"] },
      { semitones: 3, tones: ["#9"] },
      { semitones: 5, tones: ["11"] },
      { semitones: 6, tones: ["#11"] },
      { semitones: 8, tones: ["b13"] },
      { semitones: 9, tones: ["13"] },
    ],
  },
  {
    key: "sixthSeventh",
    options: [
      { semitones: 8, tones: ["b6"] },
      { semitones: 9, tones: ["6", "dim7"] },
      { semitones: 10, tones: ["7"] },
      { semitones: 11, tones: ["maj7"] },
    ],
  },
  {
    key: "fifth",
    options: [
      { semitones: 6, tones: ["b5"] },
      { semitones: 7, tones: ["5"] },
      { semitones: 8, tones: ["#5"] },
    ],
  },
  {
    key: "third",
    options: [
      { semitones: 2, tones: ["sus2"] },
      { semitones: 3, tones: ["m3"] },
      { semitones: 4, tones: ["3"] },
      { semitones: 5, tones: ["sus4"] },
    ],
  },
  {
    key: "root",
    options: [{ semitones: 0, tones: ["1"] }],
  },
];

export function ChordCompositionChart({
  formula,
  labels,
  onToneToggle,
  onBassChange,
}: {
  formula: ChordFormula;
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
  onToneToggle: (tone: ChordToneId) => void;
  onBassChange: (pitchClass: number) => void;
}) {
  const selectedTones = new Set(formula.tones);
  const soundingSemitones = new Set(formula.tones.map((tone) =>
    CHORD_TONE_DEFINITIONS[tone].semitones));
  const bassSemitones = modulo12(formula.bassPitchClass - formula.rootPitchClass);

  return (
    <div data-chord-composition>
      <div className="overflow-x-auto rounded-md border bg-muted/10 p-1.5">
        <div className="min-w-[540px]">
          <div className="grid h-7 grid-cols-[64px_repeat(12,minmax(39px,1fr))] items-center border-b border-border/50 text-center text-[10px] text-muted-foreground">
            <span className="pr-1 text-right">{labels.semitones}</span>
            {Array.from({ length: 12 }, (_, semitones) => (
              <span
                key={semitones}
                className="self-stretch border-l border-border/45 pt-0.5"
              >
                <span className="block font-mono leading-none text-foreground">{semitones}</span>
                <span className="leading-none">
                  {formatPitchClass(formula.rootPitchClass + semitones)}
                </span>
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
                const colors = CHORD_FUNCTION_COLORS[lane.key];
                return (
                  <div
                    key={semitones}
                    className="flex h-full items-center justify-center border-l border-border/30"
                  >
                    {option && (
                      <div className="flex flex-wrap justify-center gap-px">
                        {option.tones.map((tone) => {
                          const selected = selectedTones.has(tone);
                          return (
                            <button
                              key={tone}
                              type="button"
                              data-chord-option
                              data-chord-function={lane.key}
                              data-semitones={semitones}
                              data-tone={tone}
                              data-selected={selected || undefined}
                              aria-pressed={selected}
                              disabled={lane.key === "root"}
                              className={cn(
                                "rounded-full border px-1 py-px font-mono text-[10px] leading-none",
                                selected
                                  ? colors.selected
                                  : cn(
                                    "border-transparent bg-transparent opacity-45 hover:opacity-80",
                                    colors.quiet,
                                  ),
                                lane.key === "root" && "disabled:opacity-100",
                              )}
                              onClick={() => onToneToggle(tone)}
                            >
                              {tone}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          <div
            data-chord-bass
            className="grid h-6 grid-cols-[64px_repeat(12,minmax(39px,1fr))] items-center border-t border-border/50"
          >
            <span className="truncate pr-1.5 text-right text-[10px] text-muted-foreground">
              {labels.bass}
            </span>
            {Array.from({ length: 12 }, (_, semitones) => (
              <div
                key={semitones}
                className="flex h-full items-center justify-center border-l border-border/30"
              >
                {soundingSemitones.has(semitones) && (
                  <button
                    type="button"
                    aria-pressed={semitones === bassSemitones}
                    className={cn(
                      "rounded-full border px-1.5 py-px font-mono text-[10px] font-semibold leading-none",
                      semitones === bassSemitones
                        ? "border-input bg-accent text-accent-foreground"
                        : "border-transparent text-muted-foreground hover:bg-accent",
                    )}
                    onClick={() => onBassChange(modulo12(formula.rootPitchClass + semitones))}
                  >
                    {formatPitchClass(formula.rootPitchClass + semitones)}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
