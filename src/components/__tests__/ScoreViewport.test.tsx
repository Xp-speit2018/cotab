/**
 * @vitest-environment happy-dom
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { ScoreViewport } from "../ScoreViewport";

vi.mock("@/stores/render-store", () => ({
  usePlayerStore: vi.fn((selector: (s: unknown) => unknown) => {
    const mockState = {
      initialize: vi.fn(),
      destroy: vi.fn(),
      isLoading: false,
      tracks: [],
      visibleTrackIndices: [],
      trackBounds: [],
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
});
