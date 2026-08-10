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
  rootPicker: "Root note",
  scoreDisplay: "Score display",
  diagramPreview: "Diagram preview",
  diagramHidden: "The chord diagram is hidden in the score.",
  voicingSuggestions: "Fingering recommendations",
  voicingDensity: "Voicing density",
  voicingCompact: "Compact",
  voicingBalanced: "Balanced",
  voicingFull: "Full",
  voicingOpen: "Open",
  voicingMovable: "Movable",
  voicingStrings: "strings",
  voicingRootPosition: (stringNumber: number) => `Root on string ${stringNumber}`,
  fretboardHelp: "Choose which strings sound and select frets. Labels can show note names or intervals.",
  chordRecognitionHelp: "Ranks chord names that match the notes selected on the fretboard.",
  chordCompositionHelp: "Choose the root, bass, and chord tones. Changes update the chord and recommendations.",
  voicingSuggestionsHelp: "Compares playable shapes for this chord. Density favors fewer or more sounding strings.",
  voicingSuggestionsEmpty: "Choose at least two chord tones to generate playable fingerings.",
  scoreDisplayHelp: "Controls how the chord name and diagram appear in the score.",
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

    const candidates = container.querySelector("[data-chord-section='recognition']")!;
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
    expect(composition.querySelector("[data-chord-bass]")).toHaveTextContent("BassC");
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
    const { container } = render(
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

    const candidates = container.querySelector("[data-chord-section='recognition']")!;
    expect(within(candidates).getByRole("button", { name: /^D / }))
      .toHaveTextContent("Recommended");
  });

  it("keeps chord structure visible and generates a voicing from direct edits", () => {
    const { container } = render(
      <ChordLibraryEditor
        definitions={[]}
        stringCount={6}
        tuning={STANDARD_TUNING}
        capo={0}
        labels={labels}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const composition = container.querySelector("[data-chord-composition]")!;
    expect(composition).toBeInTheDocument();
    expect(composition.querySelector("[data-tone='1']"))
      .toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("combobox", { name: "Root note" }));
    fireEvent.click(screen.getByRole("option", { name: "F", exact: true }));
    fireEvent.click(within(composition).getByRole("button", { name: "5", exact: true }));

    expect(screen.getByLabelText("Name")).toHaveValue("F5");
    expect(composition.querySelector("[data-tone='5']"))
      .toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector("[data-chord-voicings]")).toHaveTextContent(
      "Fingering recommendations",
    );
    expect(container.querySelector("[data-chord-section='recognition']"))
      .toHaveTextContent("F5");
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

    const barreControls = screen.getByText("Barre hint").parentElement!;
    fireEvent.click(within(barreControls).getByRole("button", { name: "1", exact: true }));
    expect(container.querySelector("[data-chord-barre='1']")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Show diagram in score"));
    expect(container.querySelector("[data-chord-diagram]")).not.toBeInTheDocument();
    expect(container.querySelector("[data-chord-diagram-hidden]"))
      .toHaveTextContent("The chord diagram is hidden in the score.");
    expect(screen.queryByText(/Per-string finger numbers are unavailable/))
      .not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("First fret"), { target: { value: "5" } });
    const fretboard = container.querySelector("[data-interactive-fretboard]")!;
    expect(fretboard).toHaveAttribute("data-last-displayed-fret", "15");
    expect(fretboard.querySelector("[data-fret-line='1']")).toBeInTheDocument();
    expect(fretboard.querySelector("[data-fret-line='16']")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("First fret"), { target: { value: "13" } });
    expect(fretboard).toHaveAttribute("data-last-displayed-fret", "17");
    expect(fretboard.querySelector("[data-fret-line='17']")).toBeInTheDocument();
    expect(fretboard.querySelector("[data-fret-line='18']")).not.toBeInTheDocument();
  });
});
