import {
  documentStorageController,
} from "@/storage/document-storage-runtime";
import { engine } from "@/core/engine";
import { registerAppAction } from "./registry";

declare global {
  interface AppActionMap {
    "storage.save": {
      args: { providerId?: string } | undefined;
      result: Promise<boolean>;
    };
    "storage.saveAs": {
      args: { providerId?: string } | undefined;
      result: Promise<boolean>;
    };
  }
}

export function registerStorageActions(): void {
  registerAppAction<{ providerId?: string } | undefined, Promise<boolean>>({
    id: "storage.save",
    domain: "storage",
    i18nKey: "shortcuts.file.save",
    category: "file",
    execute: (args) => {
      if (engine.storage.availableProviderIds.length === 0) {
        return Promise.resolve(false);
      }
      return documentStorageController.save(args?.providerId);
    },
  });

  registerAppAction<{ providerId?: string } | undefined, Promise<boolean>>({
    id: "storage.saveAs",
    domain: "storage",
    i18nKey: "shortcuts.file.saveAs",
    category: "file",
    execute: (args) => {
      if (engine.storage.availableProviderIds.length === 0) {
        return Promise.resolve(false);
      }
      return documentStorageController.saveAs(args?.providerId);
    },
  });
}

export {};
