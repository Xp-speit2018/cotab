import {
  documentStorageController,
  documentStorageProviders,
} from "@/storage/document-storage-runtime";
import { engine } from "@/core/engine";
import { selectStorageProvider } from "@/storage/provider-selection";
import { exportCurrentScoreAsGp7 } from "@/storage/guitar-pro-export";
import { saveScoreFileKind } from "@/storage/score-file-types";
import { registerAppAction } from "./registry";

async function saveAsSelectedFormat(providerId: string): Promise<boolean> {
  try {
    const provider = documentStorageProviders.get(providerId);
    if (!provider) {
      throw new Error(`Storage provider "${providerId}" is not available.`);
    }
    const target = await provider.pickSave(
      documentStorageController.getSuggestedSaveName(),
    );
    if (!target) return false;

    const kind = saveScoreFileKind(target.displayName);
    if (kind === "cotab") {
      return documentStorageController.saveCotabToTarget(providerId, target);
    }
    if (kind !== "guitarPro") {
      throw new Error("Save As supports .cotab and .gp files.");
    }

    const result = await provider.write(
      target.locator,
      exportCurrentScoreAsGp7(),
      target.revision,
    );
    if (result.kind === "conflict") {
      throw new Error("The export target changed. Choose Save As and try again.");
    }
    return true;
  } catch (error) {
    documentStorageController.reportError(error);
    return false;
  }
}

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
        !providerId
      ) {
        providerId = await selectStorageProvider("save") ?? undefined;
        if (!providerId) return false;
      }
      if (!engine.storage.binding && providerId) {
        return saveAsSelectedFormat(providerId);
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
      if (!providerId) {
        providerId = await selectStorageProvider("save") ?? undefined;
        if (!providerId) return false;
      }
      return saveAsSelectedFormat(providerId);
    },
  });
}

export {};
