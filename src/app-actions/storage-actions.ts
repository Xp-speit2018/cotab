import {
  documentStorageController,
} from "@/storage/document-storage-runtime";
import { engine } from "@/core/engine";
import { selectStorageProvider } from "@/storage/provider-selection";
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
    execute: async (args) => {
      if (engine.storage.availableProviderIds.length === 0) {
        return false;
      }
      let providerId = args?.providerId;
      if (
        !engine.storage.binding &&
        !providerId &&
        engine.storage.availableProviderIds.length > 1
      ) {
        providerId = await selectStorageProvider("save") ?? undefined;
        if (!providerId) return false;
      }
      return documentStorageController.save(providerId);
    },
  });

  registerAppAction<{ providerId?: string } | undefined, Promise<boolean>>({
    id: "storage.saveAs",
    domain: "storage",
    i18nKey: "shortcuts.file.saveAs",
    category: "file",
    execute: async (args) => {
      if (engine.storage.availableProviderIds.length === 0) {
        return false;
      }
      let providerId = args?.providerId;
      if (!providerId && engine.storage.availableProviderIds.length > 1) {
        providerId = await selectStorageProvider("save") ?? undefined;
        if (!providerId) return false;
      }
      return documentStorageController.saveAs(providerId);
    },
  });
}

export {};
