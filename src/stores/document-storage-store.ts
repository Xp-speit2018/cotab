import { create } from "zustand";

import { engine } from "@/core/engine";
import { DocumentStorageController } from "@/storage/document-storage-controller";
import {
  isLocalDiskStorageAvailable,
  TauriLocalDiskProvider,
} from "@/storage/tauri-local-disk-provider";
import type { DocumentStorageSnapshot } from "@/storage/types";

export interface DocumentStorageStoreState extends DocumentStorageSnapshot {
  readonly available: boolean;
}

const provider = new TauriLocalDiskProvider();

export const documentStorageController = new DocumentStorageController({
  provider,
  getDocument: () => engine.getDoc(),
  replaceDocument: (doc) => {
    const previous = engine.getDoc();
    engine.replaceDoc(doc, doc.getMap("score"));
    engine.getUndoManager()?.clear();
    if (previous && previous !== doc) previous.destroy();
  },
});

export const useDocumentStorageStore = create<DocumentStorageStoreState>(() => ({
  ...documentStorageController.getSnapshot(),
  available: isLocalDiskStorageAvailable(),
}));

documentStorageController.subscribe((snapshot) => {
  useDocumentStorageStore.setState(snapshot);
});

engine.registerHooks({
  onDocumentReplaced: (doc) => {
    documentStorageController.handleDocumentReplaced(doc);
  },
});
