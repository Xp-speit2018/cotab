/**
 * @vitest-environment happy-dom
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  LongTextEditor,
  longTextSummary,
} from "../editors/LongTextEditor";

describe("LongTextEditor", () => {
  it("collapses multiline content for the inspector summary", () => {
    expect(longTextSummary("First line\n  second line", "None"))
      .toBe("First line second line");
    expect(longTextSummary("  \n", "None")).toBe("None");
  });

  it("preserves multiline drafts until Apply", () => {
    const onCommit = vi.fn();
    const onDone = vi.fn();
    render(
      <LongTextEditor
        value="Original"
        label="Instructions"
        placeholder="Playing notes"
        applyLabel="Apply"
        onCommit={onCommit}
        onDone={onDone}
      />,
    );

    fireEvent.change(screen.getByLabelText("Instructions"), {
      target: { value: "Line one\nLine two" },
    });
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onCommit).toHaveBeenCalledOnce();
    expect(onCommit).toHaveBeenCalledWith("Line one\nLine two");
    expect(onDone).toHaveBeenCalledOnce();
  });
});
