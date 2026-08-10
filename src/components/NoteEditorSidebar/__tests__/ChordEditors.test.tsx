/**
 * @vitest-environment happy-dom
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChordLibraryEditor } from "../editors/ChordEditors";

const labels = {
  newChord: "New chord",
  name: "Name",
  firstFret: "First fret",
  barreFrets: "Barre hint",
  showName: "Show name in score",
  showDiagram: "Show diagram in score",
  showFingering: "Show fingering",
  save: "Save",
  delete: "Delete",
  confirmDelete: "Confirm delete",
  fretboard: "Fretboard",
  mute: "Muted",
  open: "Open",
  string: "String",
  fret: "Fret",
  possibleChords: "Chord recognition",
  noChordCandidates: "Choose notes",
  bestMatch: "Recommended",
  alternativeChords: "Other possibilities",
  bass: "Bass",
  showNoteNames: "Note names",
  showIntervals: "Intervals",
  chordComposition: "Chord structure",
  chordCompositionEmpty: "Choose notes to inspect their harmonic functions.",
  semitoneDistance: "Semitones",
  extensions: "Extensions",
  sixthSeventh: "6th / 7th",
  fifthFunction: "Fifth",
  thirdFunction: "Third",
  rootFunction: "Root",
  scoreDisplay: "Score display and fingering",
  diagramPreview: "Diagram preview",
  diagramHidden: "The chord diagram is hidden in the score.",
  fingeringUnavailable: "Per-string finger numbers are unavailable.",
};

const STANDARD_TUNING = [64, 59, 55, 50, 45, 40];

describe("ChordLibraryEditor", () => {
  it("builds a shape on the fretboard, suggests C, and saves only on request", () => {
    const onSave = vi.fn();
    const { container } = render(
      <ChordLibraryEditor
        definitions={[]}
        stringCount={6}
        tuning={STANDARD_TUNING}
        capo={0}
        labels={labels}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "String 1, Open", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "String 2, Fret 1", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "String 3, Open", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "String 4, Fret 2", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "String 5, Fret 3", exact: true }));

    const candidates = screen.getByText("Chord recognition").parentElement!;
    const cCandidate = within(candidates).getByRole("button", { name: /^C / });
    expect(cCandidate).toHaveTextContent("Recommended");
    const fretboard = screen.getByRole("group", { name: "Fretboard" });
    expect(within(fretboard).getByRole("button", { name: "String 1, Open", exact: true }))
      .toHaveTextContent("E");
    expect(within(fretboard).getByRole("button", { name: "String 2, Fret 1", exact: true }))
      .toHaveTextContent("C");

    fireEvent.click(screen.getByRole("button", { name: "Intervals" }));
    expect(within(fretboard).getByRole("button", { name: "String 1, Open", exact: true }))
      .toHaveTextContent("3");
    expect(within(fretboard).getByRole("button", { name: "String 2, Fret 1", exact: true }))
      .toHaveTextContent("1");

    const composition = container.querySelector("[data-chord-composition]")!;
    expect(screen.getByText("Chord structure")).toBeInTheDocument();
    expect(Array.from(composition.querySelectorAll("[data-chord-lane]"))
      .map((lane) => lane.getAttribute("data-chord-lane")))
      .toEqual(["extensions", "sixthSeventh", "fifth", "third", "root"]);
    expect(composition.querySelector("[data-chord-option][data-chord-function='root'][data-selected='true']"))
      .toHaveTextContent("1");
    expect(composition.querySelector("[data-chord-option][data-chord-function='third'][data-selected='true']"))
      .toHaveTextContent("3");
    expect(composition.querySelector("[data-chord-option][data-chord-function='fifth'][data-selected='true']"))
      .toHaveTextContent("5");
    expect(composition.querySelector("[data-chord-function='third'][data-semitones='2']"))
      .toHaveClass("opacity-45");
    expect(container.querySelector("[data-chord-function-legend]"))
      .toHaveTextContent("RootThirdFifth6th / 7thExtensions");
    expect(container.querySelector("[data-chord-function='root']"))
      .toHaveClass("bg-lime-600");
    expect(container.querySelector("[data-chord-function='third']"))
      .toHaveClass("bg-amber-500");
    expect(container.querySelector("[data-chord-function='fifth']"))
      .toHaveClass("bg-sky-600");
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(cCandidate);
    expect(screen.getByLabelText("Name")).toHaveValue("C");
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][1]).toMatchObject({
      name: "C",
      strings: [0, 1, 0, 2, 3, -1],
    });
  });

  it("uses capo when suggesting the sounding chord name", () => {
    render(
      <ChordLibraryEditor
        definitions={[]}
        stringCount={6}
        tuning={STANDARD_TUNING}
        capo={2}
        labels={labels}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    for (const [string, choice] of [
      [1, "Open"], [2, "Fret 1"], [3, "Open"], [4, "Fret 2"], [5, "Fret 3"],
    ] as const) {
      fireEvent.click(screen.getByRole("button", {
        name: `String ${string}, ${choice}`,
        exact: true,
      }));
    }

    const candidates = screen.getByText("Chord recognition").parentElement!;
    expect(within(candidates).getByRole("button", { name: /^D / }))
      .toHaveTextContent("Recommended");
  });

  it("shows score options directly and honors diagram visibility in preview", () => {
    const { container } = render(
      <ChordLibraryEditor
        definitions={[{
          id: "c-major",
          name: "C",
          firstFret: 1,
          strings: [0, 1, 0, 2, 3, -1],
          barreFrets: [],
          showName: true,
          showDiagram: true,
          showFingering: false,
        }]}
        stringCount={6}
        tuning={STANDARD_TUNING}
        capo={0}
        labels={labels}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText(/^Strings /)).not.toBeInTheDocument();
    expect(screen.getByLabelText("First fret")).toHaveValue(1);
    expect(screen.getByText("Diagram preview")).toBeInTheDocument();
    expect(container.querySelector("[data-chord-diagram]")).toBeInTheDocument();
    expect(container.querySelector("[data-diagram-string='6']")).toHaveTextContent("×");
    expect(container.querySelector("[data-diagram-string='1']")).toHaveTextContent("○");

    fireEvent.click(screen.getByRole("button", { name: "1", exact: true }));
    expect(container.querySelector("[data-chord-barre='1']")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Show diagram in score"));
    expect(container.querySelector("[data-chord-diagram]")).not.toBeInTheDocument();
    expect(container.querySelector("[data-chord-diagram-hidden]"))
      .toHaveTextContent("The chord diagram is hidden in the score.");
    expect(screen.getByText(/Per-string finger numbers are unavailable/))
      .toBeInTheDocument();
  });
});
