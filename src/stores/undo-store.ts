import { create } from "zustand";
import { getUndoManager } from "@/core/sync";

interface UndoState {
  canUndo: boolean;
  canRedo: boolean;
}

export const useUndoStore = create<UndoState>()(() => ({
  canUndo: false,
  canRedo: false,
}));

/**
 * Read the current UndoManager stack lengths and push into Zustand.
 * Called from sync.ts whenever the undo manager fires a stack event.
 */
export function syncUndoState(): void {
  const um = getUndoManager();
  const canUndo = um ? um.undoStack.length > 0 : false;
  const canRedo = um ? um.redoStack.length > 0 : false;
  const state = useUndoStore.getState();
  if (state.canUndo !== canUndo || state.canRedo !== canRedo) {
    useUndoStore.setState({ canUndo, canRedo });
  }
}
