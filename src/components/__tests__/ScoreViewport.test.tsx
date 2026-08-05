/**
 * @vitest-environment happy-dom
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { ScoreViewport } from "../ScoreViewport";

const viewportState = vi.hoisted(() => ({
  scoreLayout: "horizontal" as "horizontal" | "parchment",
  showLoadingOverlay: false,
  tracks: [] as unknown[],
  scoreTitle: "Untitled",
  scoreSubTitle: "",
  scoreArtist: "",
  scoreAlbum: "",
}));

vi.mock("@/stores/render-store", () => ({
  usePlayerStore: vi.fn((selector: (s: unknown) => unknown) => {
    const mockState = {
      initialize: vi.fn(),
      destroy: vi.fn(),
      showLoadingOverlay: viewportState.showLoadingOverlay,
      scoreLayout: viewportState.scoreLayout,
      tracks: viewportState.tracks,
      scoreTitle: viewportState.scoreTitle,
      scoreSubTitle: viewportState.scoreSubTitle,
      scoreArtist: viewportState.scoreArtist,
      scoreAlbum: viewportState.scoreAlbum,
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
    viewportState.showLoadingOverlay = false;
    viewportState.tracks = [];
    viewportState.scoreTitle = "Untitled";
    viewportState.scoreSubTitle = "";
    viewportState.scoreArtist = "";
    viewportState.scoreAlbum = "";
  });

  it("mounts without throwing", () => {
    expect(() => render(<ScoreViewport />)).not.toThrow();
  });

  it("renders the viewport container when not loading", () => {
    render(<ScoreViewport />);
    const viewport = document.querySelector(".at-viewport");
    expect(viewport).toBeInTheDocument();
  });

  it("shows the loading overlay only when its delayed state is visible", () => {
    viewportState.showLoadingOverlay = true;

    render(<ScoreViewport />);

    expect(document.body).toHaveTextContent("viewport.loadingScore");
  });

  it("renders the main AlphaTab div", () => {
    render(<ScoreViewport />);
    const main = document.querySelector(".at-main");
    expect(main).toBeInTheDocument();
  });

  it("renders score metadata when no staff can be laid out", () => {
    viewportState.scoreTitle = "Empty score";
    viewportState.scoreSubTitle = "Sketch";
    viewportState.scoreArtist = "Composer";

    render(<ScoreViewport />);

    const header = document.querySelector('[data-testid="empty-score-header"]');
    expect(header).toHaveTextContent("Empty score");
    expect(header).toHaveTextContent("Sketch");
    expect(header).toHaveTextContent("Composer");
  });

  it("leaves score metadata rendering to AlphaTab when tracks exist", () => {
    viewportState.tracks = [{}];

    render(<ScoreViewport />);

    expect(document.querySelector('[data-testid="empty-score-header"]'))
      .not.toBeInTheDocument();
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
