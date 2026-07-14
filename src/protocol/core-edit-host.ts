import { createIdentityDocumentActionContext } from "@/core/actions/context";
import {
  executeDocumentActionById,
  getAllDocumentActions,
} from "@/core/actions/registry";
import { DOCUMENT_ACTION_DESCRIPTORS } from "@/core/actions/projections";
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
      return [...DOCUMENT_ACTION_DESCRIPTORS];
    },

    executeDocumentAction(id: string, args: unknown): unknown {
      ensureDocument();
      return executeDocumentActionById(id, args, context);
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
