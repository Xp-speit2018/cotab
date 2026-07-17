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

  it("registers score layout as a ViewAction", () => {
    const action = getAllAppActions().find(
      (candidate) => candidate.id === "view.setScoreLayout",
    );

    expect(action?.domain).toBe("view");
  });

  it("registers layout design mode as a ViewAction", () => {
    const action = getAllAppActions().find(
      (candidate) => candidate.id === "view.setLayoutDesignMode",
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

  it("dispatches score layout without a document action", () => {
    const originalSetScoreLayout = usePlayerStore.getState().setScoreLayout;
    const setScoreLayout = vi.fn();

    usePlayerStore.setState({ setScoreLayout });
    try {
      const result = executeAppActionUnsafe(
        "view.setScoreLayout",
        { layout: "parchment" },
        context,
      );
      expect(result).toBe(true);
      expect(setScoreLayout).toHaveBeenCalledWith("parchment");
    } finally {
      usePlayerStore.setState({ setScoreLayout: originalSetScoreLayout });
    }
  });

  it("enables layout design mode only in parchment layout", () => {
    const originalLayout = usePlayerStore.getState().scoreLayout;
    const originalSetLayoutDesignMode =
      usePlayerStore.getState().setLayoutDesignMode;
    const setLayoutDesignMode = vi.fn();

    usePlayerStore.setState({
      scoreLayout: "horizontal",
      setLayoutDesignMode,
    });
    try {
      expect(executeAppActionUnsafe(
        "view.setLayoutDesignMode",
        { enabled: true },
        context,
      )).toBe(false);
      expect(setLayoutDesignMode).not.toHaveBeenCalled();

      usePlayerStore.setState({ scoreLayout: "parchment" });
      expect(executeAppActionUnsafe(
        "view.setLayoutDesignMode",
        { enabled: true },
        context,
      )).toBe(true);
      expect(setLayoutDesignMode).toHaveBeenCalledWith(true);
    } finally {
      usePlayerStore.setState({
        scoreLayout: originalLayout,
        setLayoutDesignMode: originalSetLayoutDesignMode,
      });
    }
  });
});
