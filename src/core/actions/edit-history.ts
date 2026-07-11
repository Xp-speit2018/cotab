import { documentActionRegistry } from "./registry";
import type { DocumentActionDefinition } from "./types";
import { engine } from "@/core/engine";

const getUndoManager = () => engine.getUndoManager();

const undoAction: DocumentActionDefinition<void> = {
  id: "document.undo",
  i18nKey: "actions.edit.undo",
  category: "document.history",
  execute: () => {
    const um = getUndoManager();
    if (um && um.undoStack.length > 0) {
      um.undo();
    }
  },
};

const redoAction: DocumentActionDefinition<void> = {
  id: "document.redo",
  i18nKey: "actions.edit.redo",
  category: "document.history",
  execute: () => {
    const um = getUndoManager();
    if (um && um.redoStack.length > 0) {
      um.redo();
    }
  },
};

documentActionRegistry.register(undoAction);
documentActionRegistry.register(redoAction);

declare global {
  interface DocumentActionMap {
    "document.undo": { args: void; result: void };
    "document.redo": { args: void; result: void };
  }
}

export {};
