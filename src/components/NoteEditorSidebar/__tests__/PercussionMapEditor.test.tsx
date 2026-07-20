/**
 * @vitest-environment happy-dom
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  GENERAL_MIDI_PERCUSSION,
  generalMidiPercussionName,
} from "@/core/general-midi";
import {
  PercussionMapEditor,
  type PercussionArticulationEditorInfo,
} from "../editors/PercussionMapEditor";

const articulation = (
  articulationIndex: number,
  id: number,
  elementType: string,
  outputMidiNumber: number,
  technique: string,
): PercussionArticulationEditorInfo => ({
  articulationIndex,
  id,
  elementType,
  staffLine: 3,
  noteHeadDefault: 0,
  noteHeadHalf: 0,
  noteHeadWhole: 0,
  techniqueSymbol: 0,
  techniqueSymbolPlacement: 0,
  outputMidiNumber,
  technique,
});

const labels = {
  search: "Search mappings",
  midiNote: "MIDI drum note",
  customSound: "Custom MIDI sound",
  noResults: "No results",
  apply: "Apply",
};

describe("PercussionMapEditor", () => {
  it("covers the General MIDI percussion range", () => {
    expect(GENERAL_MIDI_PERCUSSION).toHaveLength(47);
    expect(generalMidiPercussionName(35)).toBe("Acoustic Bass Drum");
    expect(generalMidiPercussionName(81)).toBe("Open Triangle");
  });

  it("searches semantic articulations and commits one complete mapping", () => {
    const onCommit = vi.fn();
    const onDone = vi.fn();
    render(
      <PercussionMapEditor
        articulations={[
          articulation(0, 83, "Snare", 38, "hit"),
          articulation(1, 83, "Charley", 42, "closed"),
        ]}
        labels={labels}
        onCommit={onCommit}
        onDone={onDone}
      />,
    );

    fireEvent.change(screen.getByLabelText("Search mappings"), {
      target: { value: "snare" },
    });
    fireEvent.change(screen.getByLabelText("Snare · hit"), {
      target: { value: "40" },
    });
    expect(screen.getByText("Electric Snare")).toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onCommit).toHaveBeenCalledWith([
      { articulationIndex: 0, outputMidiNumber: 40 },
      { articulationIndex: 1, outputMidiNumber: 42 },
    ]);
    expect(onDone).toHaveBeenCalledOnce();
  });
});
