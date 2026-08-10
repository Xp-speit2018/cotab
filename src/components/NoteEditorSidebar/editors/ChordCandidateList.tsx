import type { ChordCandidate } from "@/core/chords";
import { cn } from "@/lib/utils";

export function ChordCandidateList({
  candidates,
  selectedName,
  labels,
  onSelect,
}: {
  candidates: readonly ChordCandidate[];
  selectedName: string;
  labels: {
    noCandidates: string;
    bestMatch: string;
    alternatives: string;
    bass: string;
  };
  onSelect: (candidate: ChordCandidate) => void;
}) {
  return (
    <div data-chord-candidates>
      {candidates.length === 0 ? (
        <div className="rounded border border-dashed px-2 py-3 text-center text-[11px] text-muted-foreground">
          {labels.noCandidates}
        </div>
      ) : (
        <div className="space-y-2">
          {candidates.slice(0, 1).map((candidate) => (
            <button
              key={`${candidate.rootPitchClass}-${candidate.symbol}`}
              type="button"
              aria-pressed={selectedName === candidate.symbol}
              className={cn(
                "w-full rounded-md border-2 px-3 py-2 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selectedName === candidate.symbol
                  ? "border-input bg-accent text-accent-foreground"
                  : "border-primary/55 bg-primary/5 hover:bg-primary/10",
              )}
              onClick={() => onSelect(candidate)}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden="true" className="text-primary">★</span>
                  <span className="truncate font-mono text-lg font-semibold">
                    {candidate.symbol}
                  </span>
                </span>
                <span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground">
                  {labels.bestMatch}
                </span>
              </span>
              <span className="mt-1 block text-[10px] text-muted-foreground">
                {candidate.intervals.join(" · ")} · {labels.bass} {candidate.bassName}
              </span>
            </button>
          ))}

          {candidates.length > 1 && (
            <div className="space-y-1">
              <div className="text-[10px] text-muted-foreground">{labels.alternatives}</div>
              <div className="flex flex-wrap gap-1.5">
                {candidates.slice(1, 6).map((candidate) => (
                  <button
                    key={`${candidate.rootPitchClass}-${candidate.symbol}`}
                    type="button"
                    aria-pressed={selectedName === candidate.symbol}
                    title={`${candidate.intervals.join(" · ")} · ${labels.bass} ${candidate.bassName}`}
                    className={cn(
                      "rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selectedName === candidate.symbol
                        ? "border-input bg-accent font-semibold text-accent-foreground"
                        : "border-border bg-background hover:bg-accent/50",
                    )}
                    onClick={() => onSelect(candidate)}
                  >
                    {candidate.symbol}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
