import { actionRegistry } from "./registry";
import type { ActionDefinition } from "./types";
import { getApi } from "@/stores/render-internals";
import { usePlayerStore } from "@/stores/render-store";

const setPlayingAction: ActionDefinition<boolean | void> = {
  id: "playback.setPlaying",
  i18nKey: "actions.playback.setPlaying",
  category: "playback",
  params: [
    {
      name: "value",
      type: "boolean",
      i18nKey: "actions.playback.setPlaying.params.value",
    },
  ],
  execute: (value, _context) => {
    const api = getApi();
    if (!api) return;
    const shouldPlay = value === true;
    if (shouldPlay) {
      api.play();
    } else {
      api.pause();
    }
  },
};

const stopAction: ActionDefinition = {
  id: "playback.stop",
  i18nKey: "actions.playback.stop",
  category: "playback",
  execute: (_args, _context) => {
    const api = getApi();
    if (api) {
      api.stop();
    }
    usePlayerStore.setState({
      playerState: "stopped",
      currentTime: 0,
    });
  },
};

actionRegistry.register(setPlayingAction);
actionRegistry.register(stopAction);

declare global {
  interface ActionMap {
    "playback.setPlaying": { args: boolean | void; result: void };
    "playback.stop": { args: void; result: void };
  }
}

export {};


