/**
 * @vitest-environment happy-dom
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { ScoreViewport } from "../ScoreViewport";

const viewportState = vi.hoisted(() => ({
  scoreLayout: "horizontal" as "horizontal" | "parchment",
}));

vi.mock("@/stores/render-store", () => ({
  usePlayerStore: vi.fn((selector: (s: unknown) => unknown) => {
    const mockState = {
      initialize: vi.fn(),
      destroy: vi.fn(),
      isLoading: false,
      scoreLayout: viewportState.scoreLayout,
    };
    return selector(mockState);
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

describe("ScoreViewport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    viewportState.scoreLayout = "horizontal";
  });

  it("mounts without throwing", () => {
    expect(() => render(<ScoreViewport />)).not.toThrow();
  });

  it("renders the viewport container when not loading", () => {
    render(<ScoreViewport />);
    const viewport = document.querySelector(".at-viewport");
    expect(viewport).toBeInTheDocument();
  });

  it("renders the main AlphaTab div", () => {
    render(<ScoreViewport />);
    const main = document.querySelector(".at-main");
    expect(main).toBeInTheDocument();
  });

  it("maps vertical wheel movement to the horizontal timeline", () => {
    render(<ScoreViewport />);
    const viewport = document.querySelector(".at-viewport") as HTMLElement;

    fireEvent.wheel(viewport, { deltaY: 80 });

    expect(viewport.scrollLeft).toBe(80);
  });

  it("keeps native vertical wheel behavior in parchment layout", () => {
    viewportState.scoreLayout = "parchment";
    render(<ScoreViewport />);
    const viewport = document.querySelector(".at-viewport") as HTMLElement;

    fireEvent.wheel(viewport, { deltaY: 80 });

    expect(viewport.scrollLeft).toBe(0);
  });
});
