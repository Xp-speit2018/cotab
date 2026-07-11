import { describe, expect, it, vi } from "vitest";
import type { AppActionExecutionContext } from "@/app-actions";
import {
  appActionRegistry,
  executeAppActionUnsafe,
  getAllAppActions,
} from "@/app-actions";
import { usePlayerStore } from "@/stores/render-store";

const context: AppActionExecutionContext = {
  t: ((key: string) => key) as AppActionExecutionContext["t"],
};

describe("AppAction registry", () => {
  it("registers core actions as AppActions", () => {
    const actions = getAllAppActions();
    const nav = actions.find((action) => action.id === "selector.set");
    const edit = actions.find((action) => action.id === "document.beat.placeNote");

    expect(nav?.domain).toBe("selector");
    expect(edit?.domain).toBe("document");
    expect(appActionRegistry.get("document.beat.placeNote")).toBeUndefined();
  });

  it("registers transport actions above core", () => {
    const action = getAllAppActions().find((candidate) => candidate.id === "transport.playPause");

    expect(action?.domain).toBe("transport");
  });

  it("registers local track visibility as a ViewAction", () => {
    const action = getAllAppActions().find(
      (candidate) => candidate.id === "view.setTrackVisible",
    );

    expect(action?.domain).toBe("view");
  });

  it("dispatches transport actions through the player store", () => {
    const originalTogglePlayback = usePlayerStore.getState().togglePlayback;
    const togglePlayback = vi.fn();

    usePlayerStore.setState({ togglePlayback });
    try {
      executeAppActionUnsafe("transport.playPause", undefined, context);
      expect(togglePlayback).toHaveBeenCalledOnce();
    } finally {
      usePlayerStore.setState({ togglePlayback: originalTogglePlayback });
    }
  });
});
