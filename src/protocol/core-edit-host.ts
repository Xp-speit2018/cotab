import "@/core/actions";
import { createIdentityDocumentActionContext } from "@/core/actions/context";
import { executeDocumentActionUnsafe, getAllDocumentActions } from "@/core/actions/registry";
import { engine, EditorEngine } from "@/core/engine";
import { snapshotScore } from "@/core/schema";
import type {
  CoreEditActionDescriptor,
  CoreEditSelection,
  MinimalMcpHost,
} from "./minimal-mcp";

export interface CoreEditEngineHost extends MinimalMcpHost {
  ensureDocument(): void;
  resetDocument(): void;
  createDefaultScore(): void;
  listActionIds(): string[];
}

export function createCoreEditEngineHost(): CoreEditEngineHost {
  const context = createIdentityDocumentActionContext();

  function ensureDocument(): void {
    if (!engine.getDoc()) engine.initDoc();
  }

  function resetDocument(): void {
    engine.destroyDoc();
    engine.initDoc();
  }

  function currentSelection(): CoreEditSelection | null {
    const {
      trackIndex,
      staffIndex,
      voiceIndex,
      barIndex,
      beatIndex,
      string,
      beatUuid,
      noteIndex,
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
      noteIndex,
      ...(beatUuid ? { beatUuid } : {}),
    };
  }

  return {
    ensureDocument,
    resetDocument,

    createDefaultScore(): void {
      resetDocument();
      const scoreMap = engine.getScoreMap();
      if (scoreMap) EditorEngine.createNewScore(scoreMap);
    },

    snapshot(): unknown {
      ensureDocument();
      const scoreMap = engine.getScoreMap();
      if (!scoreMap) throw new Error("No score document is loaded.");
      return snapshotScore(scoreMap);
    },

    listActionIds(): string[] {
      return getAllDocumentActions().map((action) => action.id).sort();
    },

    listActions(): CoreEditActionDescriptor[] {
      return getAllDocumentActions()
        .map((action) => ({
          id: action.id,
          category: action.category,
          i18nKey: action.i18nKey,
          params: action.params ?? [],
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
    },

    executeDocumentAction(id: string, args?: unknown): unknown {
      ensureDocument();
      if (!getAllDocumentActions().some((action) => action.id === id)) {
        throw new Error(`Unknown core-edit action: ${id}`);
      }
      return executeDocumentActionUnsafe(id, args, context);
    },

    setSelection(selection: CoreEditSelection): CoreEditSelection | null {
      ensureDocument();
      engine.localSetSelection(selection, selection.noteIndex ?? -1);
      return currentSelection();
    },

    getSelection(): CoreEditSelection | null {
      ensureDocument();
      return currentSelection();
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

export const coreEditEngineHost = createCoreEditEngineHost();
