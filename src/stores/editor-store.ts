/**
 * editor-store.ts — Thin Zustand reactive shell for the EditorEngine.
 *
 * All logic lives in the EditorEngine class (src/core/engine.ts).
 * This store subscribes to engine state changes and exposes them to React.
 */

import { create } from "zustand";
import { engine } from "@/core/engine";

// Re-export types that components need
export type { SelectedBeat, SelectionRange } from "@/core/engine";

// Local type for reactive state (mirrors engine's reactive properties)
export interface EditorReactiveState {
  selectedBeat: typeof engine.selectedBeat;
  selectedNoteIndex: typeof engine.selectedNoteIndex;
  selectionRange: typeof engine.selectionRange;
  canUndo: boolean;
  canRedo: boolean;
  connected: typeof engine.connected;
  roomCode: typeof engine.roomCode;
  peers: typeof engine.peers;
  connectionStatus: typeof engine.connectionStatus;
  connectionError: typeof engine.connectionError;
  userName: typeof engine.userName;
}

// Derive undo state from UndoManager
function getUndoState(): { canUndo: boolean; canRedo: boolean } {
  const um = engine.getUndoManager();
  return {
    canUndo: um ? um.undoStack.length > 0 : false,
    canRedo: um ? um.redoStack.length > 0 : false,
  };
}

export const useEditorStore = create<EditorReactiveState>(() => ({
  selectedBeat: engine.selectedBeat,
  selectedNoteIndex: engine.selectedNoteIndex,
  selectionRange: engine.selectionRange,
  ...getUndoState(),
  connected: engine.connected,
  roomCode: engine.roomCode,
  peers: engine.peers,
  connectionStatus: engine.connectionStatus,
  connectionError: engine.connectionError,
  userName: engine.userName,
}));

// Register hooks to sync engine state to Zustand store
// (Module-level registration lives for app lifetime; ignore return value)
engine.registerHooks({
  // Selection changes: sync from engine to Zustand
  onLocalSelectionSet: () => {
    useEditorStore.setState({
      selectedBeat: engine.selectedBeat,
      selectedNoteIndex: engine.selectedNoteIndex,
      selectionRange: engine.selectionRange,
      ...getUndoState(),
    });
  },
  // Connection metadata changes: sync from engine to Zustand
  onConnectionMetaChange: () => {
    useEditorStore.setState({
      connected: engine.connected,
      roomCode: engine.roomCode,
      peers: engine.peers,
      connectionStatus: engine.connectionStatus,
      connectionError: engine.connectionError,
      userName: engine.userName,
    });
  },
});