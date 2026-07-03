import { getApi, usePlayerStore } from "@/stores/render-store";
import { registerAppAction } from "./registry";

declare global {
  interface AppActionMap {
    "transport.playPause": { args: void; result: void };
    "transport.stop": { args: void; result: void };
    "transport.setPlayheadToSelector": { args: void; result: void };
    "transport.toggleLoop": { args: void; result: void };
  }
}

export function registerTransportActions(): void {
  registerAppAction({
    id: "transport.playPause",
    domain: "transport",
    i18nKey: "actions.transport.playPause",
    category: "transport",
    execute: () => {
      usePlayerStore.getState().togglePlayback();
    },
  });

  registerAppAction({
    id: "transport.stop",
    domain: "transport",
    i18nKey: "actions.transport.stop",
    category: "transport",
    execute: () => {
      getApi()?.stop();
      usePlayerStore.setState({ playerState: "stopped", currentTime: 0 });
    },
  });

  registerAppAction({
    id: "transport.setPlayheadToSelector",
    domain: "transport",
    i18nKey: "actions.transport.setPlayheadToSelector",
    category: "transport",
    execute: () => {
      usePlayerStore.getState().setTransportPlayheadToSelection();
    },
  });

  registerAppAction({
    id: "transport.toggleLoop",
    domain: "transport",
    i18nKey: "actions.transport.toggleLoop",
    category: "transport",
    execute: () => {
      usePlayerStore.getState().toggleLoop();
    },
  });
}

export {};
