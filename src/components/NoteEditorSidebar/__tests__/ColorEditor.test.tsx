/**
 * @vitest-environment happy-dom
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ColorEditor,
  colorHexToRaw,
  colorRgbToHex,
} from "../editors/ColorEditor";

describe("ColorEditor", () => {
  it("converts between RGB display values and AlphaTab ARGB", () => {
    expect(colorRgbToHex(51, 102, 153)).toBe("#336699");
    expect(colorHexToRaw("#336699")).toBe(-13408615);
  });

  it("keeps color changes as a draft until Apply", () => {
    const onCommit = vi.fn();
    const onDone = vi.fn();
    render(
      <ColorEditor
        value="#ef4444"
        labels={{ custom: "Custom color", apply: "Apply" }}
        onCommit={onCommit}
        onDone={onDone}
      />,
    );

    fireEvent.change(screen.getByLabelText("Custom color"), {
      target: { value: "#336699" },
    });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onCommit).toHaveBeenCalledWith(-13408615);
    expect(onDone).toHaveBeenCalledOnce();
  });
});
