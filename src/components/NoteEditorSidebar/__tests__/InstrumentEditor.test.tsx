/**
 * @vitest-environment happy-dom
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  GENERAL_MIDI_INSTRUMENTS,
  generalMidiInstrument,
} from "@/core/general-midi";
import {
  InstrumentEditor,
  instrumentSummary,
} from "../editors/InstrumentEditor";

const labels = {
  search: "Search instruments",
  bank: "Sound bank",
  apply: "Apply",
  noResults: "No results",
};

describe("InstrumentEditor", () => {
  it("covers every General MIDI program exactly once", () => {
    expect(GENERAL_MIDI_INSTRUMENTS).toHaveLength(128);
    expect(GENERAL_MIDI_INSTRUMENTS.map((item) => item.program))
      .toEqual(Array.from({ length: 128 }, (_, index) => index));
    expect(generalMidiInstrument(0)?.name).toBe("Acoustic Grand Piano");
    expect(generalMidiInstrument(127)?.name).toBe("Gunshot");
  });

  it("summarizes the semantic instrument name and non-default bank", () => {
    expect(instrumentSummary(30, 0, "Unknown", "Bank"))
      .toBe("Distortion Guitar");
    expect(instrumentSummary(30, 2, "Unknown", "Bank"))
      .toBe("Distortion Guitar · Bank 2");
  });

  it("searches and commits program with bank as one draft", () => {
    const onCommit = vi.fn();
    const onDone = vi.fn();
    render(
      <InstrumentEditor
        program={27}
        bank={0}
        labels={labels}
        onCommit={onCommit}
        onDone={onDone}
      />,
    );

    fireEvent.change(screen.getByLabelText("Search instruments"), {
      target: { value: "distortion" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Distortion Guitar" }));
    fireEvent.change(screen.getByLabelText("Sound bank"), {
      target: { value: "2" },
    });
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onCommit).toHaveBeenCalledOnce();
    expect(onCommit).toHaveBeenCalledWith(30, 2);
    expect(onDone).toHaveBeenCalledOnce();
  });
});
