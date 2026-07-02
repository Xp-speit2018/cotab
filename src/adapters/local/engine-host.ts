import { engine, EditorEngine, type SelectedBeat } from "@/core/engine";
import "@/core/actions";
import { createIdentityActionContext } from "@/core/actions/context";
import { executeActionUnsafe, getAllActions } from "@/core/actions/registry";
import { snapshotScore } from "@/core/schema";

export interface LocalEngineHost {
  ensureDocument(): void;
  resetDocument(): void;
  createDefaultScore(): void;
  snapshot(): unknown;
  listActionIds(): string[];
  executeAction(id: string, args?: unknown): unknown;
  setSelection(selection: SelectedBeat): SelectedBeat | null;
  getSelection(): SelectedBeat | null;
  undo(): boolean;
  redo(): boolean;
}

export function createLocalEngineHost(): LocalEngineHost {
  const context = createIdentityActionContext();

  function ensureDocument(): void {
    if (!engine.getDoc()) {
      engine.initDoc();
    }
  }

  function resetDocument(): void {
    engine.destroyDoc();
    engine.initDoc();
  }

  return {
    ensureDocument,

    resetDocument,

    createDefaultScore(): void {
      resetDocument();
      const scoreMap = engine.getScoreMap();
      if (scoreMap) {
        EditorEngine.createNewScore(scoreMap);
      }
    },

    snapshot(): unknown {
      ensureDocument();
      const scoreMap = engine.getScoreMap();
      if (!scoreMap) {
        throw new Error("No score document is loaded.");
      }
      return snapshotScore(scoreMap);
    },

    listActionIds(): string[] {
      return getAllActions().map((action) => action.id).sort();
    },

    executeAction(id: string, args?: unknown): unknown {
      ensureDocument();
      return executeActionUnsafe(id, args, context);
    },

    setSelection(selection: SelectedBeat): SelectedBeat | null {
      ensureDocument();
      engine.localSetSelection(selection);
      const {
        trackIndex,
        staffIndex,
        voiceIndex,
        barIndex,
        beatIndex,
        string,
        beatUuid,
      } = engine.selector;
      if (
        trackIndex === null ||
        staffIndex === null ||
        voiceIndex === null ||
        barIndex === null ||
        beatIndex === null
      ) {
        return null;
      }
      return {
        trackIndex,
        staffIndex,
        voiceIndex,
        barIndex,
        beatIndex,
        string,
        ...(beatUuid ? { beatUuid } : {}),
      };
    },

    getSelection(): SelectedBeat | null {
      ensureDocument();
      const {
        trackIndex,
        staffIndex,
        voiceIndex,
        barIndex,
        beatIndex,
        string,
        beatUuid,
      } = engine.selector;
      if (
        trackIndex === null ||
        staffIndex === null ||
        voiceIndex === null ||
        barIndex === null ||
        beatIndex === null
      ) {
        return null;
      }
      return {
        trackIndex,
        staffIndex,
        voiceIndex,
        barIndex,
        beatIndex,
        string,
        ...(beatUuid ? { beatUuid } : {}),
      };
    },

    undo(): boolean {
      ensureDocument();
      const undoManager = engine.getUndoManager();
      if (!undoManager) return false;
      undoManager.undo();
      return true;
    },

    redo(): boolean {
      ensureDocument();
      const undoManager = engine.getUndoManager();
      if (!undoManager) return false;
      undoManager.redo();
      return true;
    },
  };
}

export const localEngineHost = createLocalEngineHost();
