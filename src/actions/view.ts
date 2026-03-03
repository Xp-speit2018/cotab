import { actionRegistry } from "./registry";
import type { ActionDefinition } from "./types";
import { usePlayerStore } from "@/stores/player-store";
import { getApi, updateSnapGridOverlay } from "@/stores/player-internals";

const EDITOR_MODE_STORAGE_KEY = "cotab:editorMode";

const setSidebarVisibleAction: ActionDefinition<boolean> = {
  id: "view.setSidebarVisible",
  i18nKey: "actions.view.setSidebarVisible",
  category: "view",
  params: [
    { name: "value", type: "boolean", i18nKey: "actions.view.setSidebarVisible.params.value" },
  ],
  execute: (value, _context) => {
    usePlayerStore.setState({ sidebarVisible: value });
  },
};

const setEditorModeAction: ActionDefinition<"essentials" | "advanced"> = {
  id: "view.setEditorMode",
  i18nKey: "actions.view.setEditorMode",
  category: "view",
  params: [
    {
      name: "mode",
      type: "enum",
      enumValues: ["essentials", "advanced"],
      i18nKey: "actions.view.setEditorMode.params.mode",
    },
  ],
  execute: (mode, _context) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(EDITOR_MODE_STORAGE_KEY, mode);
    }
    usePlayerStore.setState({ editorMode: mode });
  },
};

const setZoomAction: ActionDefinition<number> = {
  id: "view.setZoom",
  i18nKey: "actions.view.setZoom",
  category: "view",
  params: [
    { name: "zoom", type: "number", i18nKey: "actions.view.setZoom.params.zoom" },
  ],
  execute: (zoom, _context) => {
    const api = getApi();
    if (!api) return;
    api.settings.display.scale = zoom;
    api.updateSettings();
    api.render();
    usePlayerStore.setState({ zoom });
  },
};

const setShowSnapGridAction: ActionDefinition<boolean> = {
  id: "view.setShowSnapGrid",
  i18nKey: "actions.view.setShowSnapGrid",
  category: "view",
  params: [
    { name: "show", type: "boolean", i18nKey: "actions.view.setShowSnapGrid.params.show" },
  ],
  execute: (show, _context) => {
    usePlayerStore.setState({ showSnapGrid: show });
    const sel = usePlayerStore.getState().selectedBeat;
    updateSnapGridOverlay(
      show,
      sel
        ? {
            selectedString: sel.string ?? null,
            trackIndex: sel.trackIndex,
            staffIndex: sel.staffIndex,
          }
        : undefined,
    );
  },
};

actionRegistry.register(setSidebarVisibleAction);
actionRegistry.register(setEditorModeAction);
actionRegistry.register(setZoomAction);
actionRegistry.register(setShowSnapGridAction);

declare global {
  interface ActionMap {
    "view.setSidebarVisible": { args: boolean; result: void };
    "view.setEditorMode": { args: "essentials" | "advanced"; result: void };
    "view.setZoom": { args: number; result: void };
    "view.setShowSnapGrid": { args: boolean; result: void };
  }
}

export {};

