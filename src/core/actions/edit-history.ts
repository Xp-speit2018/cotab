import { engine } from "@/core/engine";
import { defineDocumentAction, emptyActionArgs } from "./definition";

const getUndoManager = () => engine.getUndoManager();

const undoAction = defineDocumentAction({
  id: "document.undo",
  i18nKey: "actions.edit.undo",
  category: "document.history",
  argsSchema: emptyActionArgs,
  execute: () => {
    const um = getUndoManager();
    if (um && um.undoStack.length > 0) {
      um.undo();
    }
  },
});

const redoAction = defineDocumentAction({
  id: "document.redo",
  i18nKey: "actions.edit.redo",
  category: "document.history",
  argsSchema: emptyActionArgs,
  execute: () => {
    const um = getUndoManager();
    if (um && um.redoStack.length > 0) {
      um.redo();
    }
  },
});

export const historyDocumentActions = [undoAction, redoAction] as const;
