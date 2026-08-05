import {
  engine,
  type EditorEngine,
} from "@/core/engine";
import { DocumentStorageController } from "./document-storage-controller";
import {
  BrowserLocalFileProvider,
  isBrowserLocalFileStorageAvailable,
} from "./browser-local-file-provider";
import {
  isLocalDiskStorageAvailable,
  TauriLocalDiskProvider,
} from "./tauri-local-disk-provider";
import { DocumentStorageProviderRegistry } from "./provider-registry";
import { WebDavStorageProvider } from "./webdav-provider";
import { loadAutoSavePreference } from "./storage-preferences";

const localDiskAvailable = isLocalDiskStorageAvailable();

export const documentStorageProviders = new DocumentStorageProviderRegistry(
  [
    ...(localDiskAvailable ? [new TauriLocalDiskProvider()] : []),
    ...(!localDiskAvailable && isBrowserLocalFileStorageAvailable()
      ? [new BrowserLocalFileProvider()]
      : []),
    new WebDavStorageProvider(),
  ],
);

export interface DocumentStorageRuntime {
  readonly controller: DocumentStorageController;
  dispose(): void;
}

const storageEngines = new Set<EditorEngine>();

export function createDocumentStorageRuntime(
  sessionEngine: EditorEngine,
): DocumentStorageRuntime {
  storageEngines.add(sessionEngine);
  sessionEngine.localSetStorageState({
    ...sessionEngine.storage,
    availableProviderIds: documentStorageProviders.ids(),
  });

  const controller = new DocumentStorageController({
    providers: documentStorageProviders,
    getDocument: () => sessionEngine.getDoc(),
    replaceDocument: (doc) => {
      const previous = sessionEngine.getDoc();
      sessionEngine.replaceDoc(doc, doc.getMap("score"));
      sessionEngine.getUndoManager()?.clear();
      if (previous && previous !== doc) previous.destroy();
    },
    getStorageState: () => sessionEngine.storage,
    setStorageState: (storage) => sessionEngine.localSetStorageState(storage),
  });
  controller.setAutoSaveEnabled(loadAutoSavePreference());

  const unregisterEngineHooks = sessionEngine.registerHooks({
    onDocumentReplaced: (doc) => controller.handleDocumentReplaced(doc),
  });

  return {
    controller,
    dispose: () => {
      storageEngines.delete(sessionEngine);
      unregisterEngineHooks();
      controller.destroy();
    },
  };
}

const initialRuntime = createDocumentStorageRuntime(engine);

/** Live binding for storage actions targeting the active document session. */
export let documentStorageController = initialRuntime.controller;

export function setActiveDocumentStorageController(
  controller: DocumentStorageController,
): void {
  documentStorageController = controller;
}

export function getInitialDocumentStorageRuntime(): DocumentStorageRuntime {
  return initialRuntime;
}

documentStorageProviders.subscribe(() => {
  for (const sessionEngine of storageEngines) {
    sessionEngine.localSetStorageState({
      ...sessionEngine.storage,
      availableProviderIds: documentStorageProviders.ids(),
    });
  }
});
