import { engine } from "@/core/engine";
import { DocumentStorageController } from "./document-storage-controller";
import {
  isLocalDiskStorageAvailable,
  TauriLocalDiskProvider,
} from "./tauri-local-disk-provider";
import { DocumentStorageProviderRegistry } from "./provider-registry";

export const documentStorageProviders = new DocumentStorageProviderRegistry(
  isLocalDiskStorageAvailable() ? [new TauriLocalDiskProvider()] : [],
);

function publishAvailableProviders(): void {
  engine.localSetStorageState({
    ...engine.storage,
    availableProviderIds: documentStorageProviders.ids(),
  });
}

publishAvailableProviders();
documentStorageProviders.subscribe(publishAvailableProviders);

export const documentStorageController = new DocumentStorageController({
  providers: documentStorageProviders,
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
