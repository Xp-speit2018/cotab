import type { ChordCandidate } from "@/core/chords";
import { formatPitchClass, modulo12 } from "@/core/chords";
import { cn } from "@/lib/utils";
import {
  CHORD_FUNCTION_COLORS,
  chordFunctionForInterval,
} from "./chord-function-colors";

const DISPLAYED_FRET_COUNT = 15;
const FRET_COLUMN_WIDTH = 36;
const STRING_LABEL_WIDTH = 58;
const STRING_STATE_WIDTH = 30;

export interface InteractiveFretboardLabels {
  fretboard: string;
  mute: string;
  open: string;
  string: string;
  fret: string;
}

export type FretboardLabelMode = "notes" | "intervals";

export function InteractiveFretboard({
  tuning,
  frets,
  firstFret,
  fretWindowSize = 5,
  capo,
  candidate,
  labelMode,
  labels,
  onChange,
}: {
  tuning: readonly number[];
  frets: readonly number[];
  firstFret: number;
  fretWindowSize?: number;
  capo: number;
  candidate: ChordCandidate | null;
  labelMode: FretboardLabelMode;
  labels: InteractiveFretboardLabels;
  onChange: (frets: number[]) => void;
}) {
  const normalizedFirstFret = Math.max(1, Math.floor(firstFret || 1));
  const highestSelectedFret = Math.max(0, ...frets);
  const lastDisplayedFret = Math.max(
    DISPLAYED_FRET_COUNT,
    normalizedFirstFret + Math.max(1, fretWindowSize) - 1,
    highestSelectedFret,
  );
  const displayedFrets = Array.from(
    { length: lastDisplayedFret },
    (_, index) => index + 1,
  );
  const fretGridStyle = {
    gridTemplateColumns: `repeat(${lastDisplayedFret}, minmax(${FRET_COLUMN_WIDTH}px, 1fr))`,
  };
  const contentMinWidth = STRING_LABEL_WIDTH
    + STRING_STATE_WIDTH * 2
    + lastDisplayedFret * FRET_COLUMN_WIDTH;

  const selectFret = (highToLowIndex: number, fret: number) => {
    const next = [...frets];
    next[highToLowIndex] = next[highToLowIndex] === fret ? -1 : fret;
    onChange(next);
  };

  const markerLabel = (openMidi: number, fret: number): string => {
    const pitchClass = modulo12(openMidi + capo + fret);
    const tone = candidate?.tones.find((item) => item.pitchClass === pitchClass);
    return labelMode === "intervals"
      ? tone?.interval ?? "?"
      : tone?.noteName ?? formatPitchClass(pitchClass);
  };

  const markerFunction = (openMidi: number, fret: number) => {
    const pitchClass = modulo12(openMidi + capo + fret);
    const interval = candidate?.tones.find((item) => item.pitchClass === pitchClass)?.interval;
    return chordFunctionForInterval(interval);
  };

  const markerColor = (openMidi: number, fret: number): string => {
    const chordFunction = markerFunction(openMidi, fret);
    return chordFunction
      ? CHORD_FUNCTION_COLORS[chordFunction].marker
      : "bg-primary text-primary-foreground";
  };

  return (
    <div
      role="group"
      aria-label={labels.fretboard}
      data-interactive-fretboard
      data-last-displayed-fret={lastDisplayedFret}
      className="overflow-x-auto rounded-md border bg-muted/10 p-2"
    >
      <div style={{ minWidth: Math.max(670, contentMinWidth) }}>
        <div
          className="grid items-end text-center text-[9px] text-muted-foreground"
          style={{
            gridTemplateColumns: `${STRING_LABEL_WIDTH}px ${STRING_STATE_WIDTH}px ${STRING_STATE_WIDTH}px minmax(0, 1fr)`,
          }}
        >
          <span />
          <span>×</span>
          <span>0</span>
          <div className="grid" style={fretGridStyle}>
            {displayedFrets.map((fret) => <span key={fret}>{fret}</span>)}
          </div>
        </div>

        <div className="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-4 left-[118px] right-0 top-4 z-0 grid"
            style={fretGridStyle}
          >
            {displayedFrets.map((fret, index) => (
              <span
                key={fret}
                data-fret-line={fret}
                className={cn(
                  "border-l border-foreground/50",
                  index === 0 && "border-l-2",
                  index === displayedFrets.length - 1 && "border-r border-foreground/50",
                )}
              />
            ))}
          </div>
          {tuning.map((openMidi, highToLowIndex) => {
            const selected = frets[highToLowIndex] ?? -1;
            const stringNumber = highToLowIndex + 1;
            const openNote = formatPitchClass(modulo12(openMidi));
            return (
              <div
                key={`${highToLowIndex}-${openMidi}`}
                className="grid items-center"
                style={{
                  gridTemplateColumns: `${STRING_LABEL_WIDTH}px ${STRING_STATE_WIDTH}px ${STRING_STATE_WIDTH}px minmax(0, 1fr)`,
                }}
              >
                <span className="truncate pr-2 text-right font-mono text-[10px] text-muted-foreground">
                  {stringNumber} · {openNote}
                </span>
                <button
                  type="button"
                  aria-label={`${labels.string} ${stringNumber}, ${labels.mute}`}
                  aria-pressed={selected < 0}
                  className={cn(
                    "mx-auto flex h-6 min-w-6 items-center justify-center rounded px-0.5 font-mono text-[9px] transition-colors",
                    selected < 0
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                  onClick={() => selectFret(highToLowIndex, -1)}
                >
                  ×
                </button>
                <button
                  type="button"
                  aria-label={`${labels.string} ${stringNumber}, ${labels.open}`}
                  aria-pressed={selected === 0}
                  data-chord-function={selected === 0
                    ? markerFunction(openMidi, 0) ?? undefined
                    : undefined}
                  className={cn(
                    "mx-auto flex h-6 w-6 items-center justify-center rounded text-xs transition-colors",
                    selected === 0
                      ? markerColor(openMidi, 0)
                      : "text-muted-foreground hover:bg-accent",
                  )}
                  onClick={() => selectFret(highToLowIndex, 0)}
                >
                  {selected === 0 ? markerLabel(openMidi, 0) : "○"}
                </button>
                <div className="relative z-10 grid h-8" style={fretGridStyle}>
                  <span
                    data-string-line={stringNumber}
                    className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-px -translate-y-1/2 bg-foreground/65"
                  />
                  {displayedFrets.map((fret) => (
                    <button
                      key={fret}
                      type="button"
                      aria-label={`${labels.string} ${stringNumber}, ${labels.fret} ${fret}`}
                      aria-pressed={selected === fret}
                      className={cn(
                        "relative flex items-center justify-center",
                        "focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                      onClick={() => selectFret(highToLowIndex, fret)}
                    >
                      {selected === fret && (
                        <span
                          data-fret-marker
                          data-chord-function={markerFunction(openMidi, fret) ?? undefined}
                          className={cn(
                            "z-10 flex h-6 min-w-6 items-center justify-center rounded-full px-1 font-mono text-[9px] font-semibold shadow-sm",
                            markerColor(openMidi, fret),
                          )}
                        >
                          {markerLabel(openMidi, fret)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
