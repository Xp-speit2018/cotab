/**
 * @vitest-environment happy-dom
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  PitchEditor,
  pitchSummary,
} from "../editors/PitchEditor";

describe("PitchEditor", () => {
  it("formats chromatic pitches for the inspector summary", () => {
    expect(pitchSummary(4, 0)).toBe("C4");
    expect(pitchSummary(5, 10)).toBe("A♯5");
  });

  it("keeps pitch changes in draft state until one atomic commit", () => {
    const onCommit = vi.fn();
    const onDone = vi.fn();
    render(
      <PitchEditor
        octave={4}
        tone={0}
        pitchClassLabel="Pitch class"
        octaveLabel="Octave"
        applyLabel="Apply"
        onCommit={onCommit}
        onDone={onDone}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "C♯" }));
    fireEvent.change(screen.getByLabelText("Octave"), {
      target: { value: "5" },
    });

    expect(screen.getByText("C♯5")).toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onCommit).toHaveBeenCalledOnce();
    expect(onCommit).toHaveBeenCalledWith(5, 1);
    expect(onDone).toHaveBeenCalledOnce();
  });
});
