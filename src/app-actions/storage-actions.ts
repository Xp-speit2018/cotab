import {
  documentStorageController,
  useDocumentStorageStore,
} from "@/stores/document-storage-store";
import { registerAppAction } from "./registry";

declare global {
  interface AppActionMap {
    "storage.save": {
      args: void;
      result: Promise<boolean>;
    };
    "storage.saveAs": {
      args: void;
      result: Promise<boolean>;
    };
  }
}

export function registerStorageActions(): void {
  registerAppAction<void, Promise<boolean>>({
    id: "storage.save",
    domain: "storage",
    i18nKey: "shortcuts.file.save",
    category: "file",
    execute: () => {
      if (!useDocumentStorageStore.getState().available) {
        return Promise.resolve(false);
      }
      return documentStorageController.save();
    },
  });

  registerAppAction<void, Promise<boolean>>({
    id: "storage.saveAs",
    domain: "storage",
    i18nKey: "shortcuts.file.saveAs",
    category: "file",
    execute: () => {
      if (!useDocumentStorageStore.getState().available) {
        return Promise.resolve(false);
      }
      return documentStorageController.saveAs();
    },
  });
}

export {};
