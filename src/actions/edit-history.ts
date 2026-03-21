import { actionRegistry } from "./registry";
import type { ActionDefinition } from "./types";
import { engine } from "@/core/engine";

const getUndoManager = () => engine.getUndoManager();

const undoAction: ActionDefinition<void> = {
  id: "edit.undo",
  i18nKey: "actions.edit.undo",
  category: "edit.history",
  execute: () => {
    const um = getUndoManager();
    if (um && um.undoStack.length > 0) {
      um.undo();
    }
  },
};

const redoAction: ActionDefinition<void> = {
  id: "edit.redo",
  i18nKey: "actions.edit.redo",
  category: "edit.history",
  execute: () => {
    const um = getUndoManager();
    if (um && um.redoStack.length > 0) {
      um.redo();
    }
  },
};

actionRegistry.register(undoAction);
actionRegistry.register(redoAction);

declare global {
  interface ActionMap {
    "edit.undo": { args: void; result: void };
    "edit.redo": { args: void; result: void };
  }
}

export {};
