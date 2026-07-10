import { getApi } from "@/stores/render-api";
import { usePlayerStore } from "@/stores/render-store";
import { registerAppAction } from "./registry";

declare global {
  interface AppActionMap {
    "view.setTrackVisible": {
      args: { trackIndex: number; visible: boolean };
      result: boolean;
    };
  }
}

export function registerViewActions(): void {
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
