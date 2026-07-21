import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRenderLoadingController,
  type RenderLoadingState,
} from "@/stores/render-loading";

afterEach(() => {
  vi.useRealTimers();
});

function setup(delayMs = 250, minVisibleMs = 250) {
  vi.useFakeTimers();
  const state: RenderLoadingState = {
    isRendering: false,
    showLoadingOverlay: false,
  };
  const controller = createRenderLoadingController({
    delayMs,
    minVisibleMs,
    now: () => Date.now(),
    publish: (patch) => Object.assign(state, patch),
  });
  return { controller, state };
}

describe("render loading controller", () => {
  it("never shows the overlay for a short render", () => {
    const { controller, state } = setup();

    controller.start();
    expect(state).toEqual({ isRendering: true, showLoadingOverlay: false });
    vi.advanceTimersByTime(249);
    controller.finish();
    vi.runAllTimers();

    expect(state).toEqual({ isRendering: false, showLoadingOverlay: false });
  });

  it("shows the overlay after the delay for a long render", () => {
    const { controller, state } = setup();

    controller.start();
    vi.advanceTimersByTime(250);

    expect(state).toEqual({ isRendering: true, showLoadingOverlay: true });
  });

  it("keeps a visible overlay stable for its minimum duration", () => {
    const { controller, state } = setup();

    controller.start();
    vi.advanceTimersByTime(250);
    vi.advanceTimersByTime(50);
    controller.finish();

    expect(state).toEqual({ isRendering: false, showLoadingOverlay: true });
    vi.advanceTimersByTime(199);
    expect(state.showLoadingOverlay).toBe(true);
    vi.advanceTimersByTime(1);
    expect(state.showLoadingOverlay).toBe(false);
  });

  it("keeps the overlay visible when another render starts", () => {
    const { controller, state } = setup();

    controller.start();
    vi.advanceTimersByTime(250);
    controller.finish();
    controller.start();
    vi.advanceTimersByTime(250);

    expect(state).toEqual({ isRendering: true, showLoadingOverlay: true });
  });

  it("clears pending and visible state on dispose", () => {
    const { controller, state } = setup();

    controller.start();
    vi.advanceTimersByTime(250);
    controller.dispose();
    vi.runAllTimers();

    expect(state).toEqual({ isRendering: false, showLoadingOverlay: false });
  });
});
