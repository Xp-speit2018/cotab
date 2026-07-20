/**
 * @vitest-environment happy-dom
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  AutomationType,
  type TempoAutomationSchema,
} from "@/core/schema";
import {
  TempoAutomationsEditor,
  tempoAutomationsSummary,
} from "../editors/TempoAutomationsEditor";

const initial: TempoAutomationSchema[] = [{
  isLinear: false,
  type: AutomationType.Tempo,
  value: 70,
  ratioPosition: 0,
  text: "Moderato",
  isVisible: true,
}];

const labels = {
  bpm: "Tempo (BPM)",
  position: "Position in bar",
  text: "Expression",
  gradual: "Linear transition",
  visible: "Show marker",
  add: "Add tempo change",
  remove: "Remove tempo change",
  apply: "Apply",
  positionConflict: "Positions conflict",
};

describe("TempoAutomationsEditor", () => {
  it("summarizes one or multiple tempo events", () => {
    expect(tempoAutomationsSummary([], "None", (count) => `${count} changes`))
      .toBe("None");
    expect(tempoAutomationsSummary(initial, "None", (count) => `${count} changes`))
      .toBe("70 BPM");
    expect(tempoAutomationsSummary([
      initial[0],
      { ...initial[0], value: 96, ratioPosition: 0.5 },
    ], "None", (count) => `${count} changes`)).toBe("2 changes · 70–96 BPM");
  });

  it("adds and edits tempo events without committing intermediate drafts", () => {
    const onCommit = vi.fn();
    const onDone = vi.fn();
    render(
      <TempoAutomationsEditor
        automations={initial}
        labels={labels}
        onCommit={onCommit}
        onDone={onDone}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add tempo change" }));
    fireEvent.change(screen.getByLabelText("Tempo (BPM) 2"), {
      target: { value: "96" },
    });
    fireEvent.change(screen.getByLabelText("Expression 2"), {
      target: { value: "rit." },
    });
    expect(screen.getByLabelText("Position in bar 2")).toHaveValue(50);
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onCommit).toHaveBeenCalledOnce();
    expect(onCommit).toHaveBeenCalledWith([
      initial[0],
      {
        isLinear: false,
        type: AutomationType.Tempo,
        value: 96,
        ratioPosition: 0.5,
        text: "rit.",
        isVisible: true,
      },
    ]);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("blocks duplicate positions", () => {
    render(
      <TempoAutomationsEditor
        automations={[
          initial[0],
          { ...initial[0], value: 96, ratioPosition: 0.5 },
        ]}
        labels={labels}
        onCommit={vi.fn()}
        onDone={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Position in bar 2"), {
      target: { value: "0" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Positions conflict");
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });
});
