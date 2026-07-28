import { engine } from "@/core/engine";
import { DocumentStorageController } from "./document-storage-controller";
import {
  isLocalDiskStorageAvailable,
  TauriLocalDiskProvider,
} from "./tauri-local-disk-provider";

const provider = new TauriLocalDiskProvider();

engine.localSetStorageState({
  ...engine.storage,
  available: isLocalDiskStorageAvailable(),
});

export const documentStorageController = new DocumentStorageController({
  provider,
  getDocument: () => engine.getDoc(),
  replaceDocument: (doc) => {
    const previous = engine.getDoc();
    engine.replaceDoc(doc, doc.getMap("score"));
    engine.getUndoManager()?.clear();
    if (previous && previous !== doc) previous.destroy();
  },
  getStorageState: () => engine.storage,
  setStorageState: (storage) => engine.localSetStorageState(storage),
});

engine.registerHooks({
  onDocumentReplaced: (doc) => {
    documentStorageController.handleDocumentReplaced(doc);
  },
});
