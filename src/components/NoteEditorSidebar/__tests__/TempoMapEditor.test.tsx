/**
 * @vitest-environment happy-dom
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AutomationType } from "@/core/schema";
import type { TempoMapEntryInfo } from "@/stores/render-types";
import {
  TempoMapEditor,
  tempoMapSummary,
  type TempoMapLabels,
} from "../editors/TempoMapEditor";

const labels: TempoMapLabels = {
  none: "None",
  count: (count) => `${count} points`,
  bar: "Bar",
  bpm: "Tempo (BPM)",
  position: "Position in bar",
  text: "Expression",
  gradual: "Linear transition",
  visible: "Show marker",
  add: "Add tempo point",
  remove: "Remove tempo point",
  apply: "Apply",
  positionConflict: "Positions conflict",
};

const point = (value: number, ratioPosition = 0) => ({
  isLinear: false,
  type: AutomationType.Tempo,
  value,
  ratioPosition,
  text: "",
  isVisible: true,
});

const initial: TempoMapEntryInfo[] = [
  { masterBarIndex: 0, automations: [point(70)] },
  { masterBarIndex: 8, automations: [point(90)] },
];

describe("TempoMapEditor", () => {
  it("summarizes the complete score tempo range", () => {
    expect(tempoMapSummary([], labels)).toBe("None");
    expect(tempoMapSummary(initial, labels)).toBe("2 points · 70–90 BPM");
  });

  it("edits and groups score tempo points in one commit", () => {
    const onCommit = vi.fn();
    const onDone = vi.fn();
    render(
      <TempoMapEditor
        entries={initial}
        masterBarCount={12}
        labels={labels}
        onCommit={onCommit}
        onDone={onDone}
      />,
    );

    fireEvent.change(screen.getByLabelText("Tempo (BPM) 2"), {
      target: { value: "96" },
    });
    fireEvent.change(screen.getByLabelText("Position in bar 2"), {
      target: { value: "50" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add tempo point" }));
    expect(screen.getByLabelText("Bar 3")).toHaveValue(10);
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onCommit).toHaveBeenCalledWith([
      { masterBarIndex: 0, automations: [point(70)] },
      { masterBarIndex: 8, automations: [point(96, 0.5)] },
      { masterBarIndex: 9, automations: [point(96)] },
    ]);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("blocks duplicate positions within one bar", () => {
    render(
      <TempoMapEditor
        entries={[{
          masterBarIndex: 0,
          automations: [point(70), point(80, 0.5)],
        }]}
        masterBarCount={4}
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
