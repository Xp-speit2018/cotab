/**
 * @vitest-environment happy-dom
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  AutomationType,
  type AutomationSchema,
} from "@/core/schema";
import {
  BeatAutomationsEditor,
  beatAutomationsSummary,
  type BeatAutomationLabels,
} from "../editors/BeatAutomationsEditor";

const labels: BeatAutomationLabels = {
  none: "None",
  count: (count) => `${count} changes`,
  type: "Parameter",
  value: "Value",
  volume: "Volume",
  balance: "Pan",
  instrument: "Instrument",
  bank: "MIDI Bank",
  add: "Add playback change",
  remove: "Remove playback change",
  apply: "Apply",
  duplicateType: "Duplicate parameter",
};

const volume: AutomationSchema = {
  isLinear: false,
  type: AutomationType.Volume,
  value: 12,
  ratioPosition: 0.25,
  text: "retained",
  isVisible: false,
};

describe("BeatAutomationsEditor", () => {
  it("summarizes semantic playback parameters", () => {
    expect(beatAutomationsSummary([], labels)).toBe("None");
    expect(beatAutomationsSummary([volume], labels)).toBe("Volume 12");
    expect(beatAutomationsSummary([{
      ...volume,
      type: AutomationType.Instrument,
      value: 40,
    }], labels)).toBe("Violin");
    expect(beatAutomationsSummary([
      volume,
      { ...volume, type: AutomationType.Balance, value: 8 },
    ], labels)).toBe("2 changes · Volume, Pan");
  });

  it("edits drafts atomically and retains alphaTab roundtrip metadata", () => {
    const onCommit = vi.fn();
    const onDone = vi.fn();
    render(
      <BeatAutomationsEditor
        automations={[volume]}
        labels={labels}
        onCommit={onCommit}
        onDone={onDone}
      />,
    );

    fireEvent.change(screen.getByLabelText("Value 1"), {
      target: { value: "14" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add playback change" }));
    fireEvent.change(screen.getByLabelText("Parameter 2"), {
      target: { value: String(AutomationType.Instrument) },
    });
    fireEvent.change(screen.getByLabelText("Value 2"), {
      target: { value: "40" },
    });

    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onCommit).toHaveBeenCalledWith([
      { ...volume, value: 14 },
      {
        isLinear: false,
        type: AutomationType.Instrument,
        value: 40,
        ratioPosition: 0,
        text: "",
        isVisible: false,
      },
    ]);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("allows only one change for each playback parameter", () => {
    render(
      <BeatAutomationsEditor
        automations={[
          volume,
          { ...volume, value: 8 },
        ]}
        labels={labels}
        onCommit={vi.fn()}
        onDone={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Duplicate parameter");
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });
});
