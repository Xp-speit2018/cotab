/**
 * @vitest-environment happy-dom
 */

import "@testing-library/jest-dom/vitest";
import "@/i18n";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
  common: "Common",
  bank: "Sound bank",
  apply: "Apply",
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

    fireEvent.click(screen.getByRole("combobox", { name: "Search instruments" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search presets" }), {
      target: { value: "distortion" },
    });
    const common = screen.getByRole("group", { name: "Common" });
    const guitar = screen.getByRole("group", { name: "Guitar" });
    expect(common).toHaveTextContent("Distortion Guitar");
    expect(guitar).toHaveTextContent("Distortion Guitar");
    fireEvent.click(within(common).getByRole("option", { name: "Distortion Guitar" }));
    fireEvent.change(screen.getByLabelText("Sound bank"), {
      target: { value: "2" },
    });
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onCommit).toHaveBeenCalledOnce();
    expect(onCommit).toHaveBeenCalledWith(30, 2);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("treats common and family copies as one exact preset", () => {
    const onCommit = vi.fn();
    render(
      <InstrumentEditor
        program={27}
        bank={0}
        labels={labels}
        onCommit={onCommit}
        onDone={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Search instruments" }));
    const search = screen.getByRole("searchbox", { name: "Search presets" });
    fireEvent.change(search, { target: { value: "Distortion Guitar" } });
    fireEvent.keyDown(search, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onCommit).toHaveBeenCalledWith(30, 0);
  });
});
