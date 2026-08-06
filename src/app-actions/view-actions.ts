import { getApi } from "@/stores/render-api";
import { usePlayerStore } from "@/stores/render-store";
import type { ScoreLayout } from "@/stores/render-types";
import { useDocumentWorkspaceStore } from "@/workspace/document-workspace";
import { useWorkspaceUiStore } from "@/workspace/workspace-ui-store";
import { registerAppAction } from "./registry";

declare global {
  interface AppActionMap {
    "view.setTrackVisible": {
      args: { trackIndex: number; visible: boolean };
      result: boolean;
    };
    "view.setScoreLayout": {
      args: { layout: ScoreLayout };
      result: boolean;
    };
    "view.setLayoutDesignMode": {
      args: { enabled: boolean };
      result: boolean;
    };
    "view.openTrackCreator": {
      args: undefined;
      result: boolean;
    };
  }
}

export function registerViewActions(): void {
  registerAppAction<undefined, boolean>({
    id: "view.openTrackCreator",
    domain: "view",
    i18nKey: "actions.view.openTrackCreator",
    category: "view",
    execute: () => {
      if (!useDocumentWorkspaceStore.getState().activeTabId) return false;
      useWorkspaceUiStore.getState().setTrackCreatorOpen(true);
      return true;
    },
  });

  registerAppAction<{ layout: ScoreLayout }, boolean>({
    id: "view.setScoreLayout",
    domain: "view",
    i18nKey: "actions.view.setScoreLayout",
    category: "view",
    execute: ({ layout }) => {
      if (layout !== "horizontal" && layout !== "parchment") return false;
      usePlayerStore.getState().setScoreLayout(layout);
      return true;
    },
  });

  registerAppAction<{ enabled: boolean }, boolean>({
    id: "view.setLayoutDesignMode",
    domain: "view",
    i18nKey: "actions.view.setLayoutDesignMode",
    category: "view",
    execute: ({ enabled }) => {
      const state = usePlayerStore.getState();
      if (enabled && state.scoreLayout !== "parchment") return false;
      state.setLayoutDesignMode(enabled);
      return true;
    },
  });

  registerAppAction<
    { trackIndex: number; visible: boolean },
    boolean
  >({
    id: "view.setTrackVisible",
    domain: "view",
    i18nKey: "actions.view.setTrackVisible",
    category: "view",
    execute: ({ trackIndex, visible }) => {
      const api = getApi();
      const score = api?.score;
      if (!api || !score || trackIndex < 0 || trackIndex >= score.tracks.length) {
        return false;
      }

      const state = usePlayerStore.getState();
      const current = state.visibleTrackIndices.length > 0
        ? state.visibleTrackIndices
        : score.tracks.map((track) => track.index);
      const next = new Set(current);
      if (visible) next.add(trackIndex);
      else next.delete(trackIndex);
      if (next.size === 0) return false;

      const visibleTrackIndices = [...next].sort((left, right) => left - right);
      if (!visible && state.selectedBeat?.trackIndex === trackIndex) {
        state.clearSelection();
      }
      usePlayerStore.setState({ visibleTrackIndices });
      api.renderTracks(
        visibleTrackIndices
          .map((index) => score.tracks[index])
          .filter((track) => track !== undefined),
      );
      return true;
    },
  });
}

export {};
