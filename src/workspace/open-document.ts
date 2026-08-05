import type { TFunction } from "i18next";
import {
  documentStorageController,
  documentStorageProviders,
} from "@/storage/document-storage-runtime";
import { selectStorageProvider } from "@/storage/provider-selection";
import { pickLocalScoreFile } from "@/storage/tauri-local-disk-provider";
import {
  selectDemoDocument,
  type DemoDocument,
} from "@/storage/demo-selection";
import { scoreFileKind } from "@/storage/score-file-types";
import {
  usePlayerStore,
  waitForActiveRenderer,
} from "@/stores/render-store";
import {
  openBlankDocumentSession,
  openSourceDocumentSession,
  openStoredDocumentInSession,
} from "./document-workspace";

export function openBlankDocument(): void {
  openBlankDocumentSession();
}

export async function openDemoDocument(demo: DemoDocument): Promise<void> {
  openSourceDocumentSession(demo.name);
  await waitForActiveRenderer();
  usePlayerStore.getState().loadUrl(demo.url);
}

async function openGuitarProDocument(
  displayName: string,
  data: Uint8Array,
): Promise<void> {
  openSourceDocumentSession(displayName);
  await waitForActiveRenderer();
  usePlayerStore.getState().loadFile(data);
}

export async function openDocumentFromProvider(t: TFunction): Promise<void> {
  try {
    const providerId = await selectStorageProvider("open");
    if (!providerId) return;

    if (providerId === "blank-file") {
      openBlankDocument();
      return;
    }

    if (providerId === "demo-library") {
      const demo = await selectDemoDocument();
      if (!demo) return;
      await openDemoDocument(demo);
      return;
    }

    if (providerId === "local-disk") {
      const picked = await pickLocalScoreFile();
      if (!picked) return;
      if (picked.kind === "cotab") {
        await openStoredDocumentInSession("local-disk", picked.document);
      } else {
        await openGuitarProDocument(
          picked.document.displayName,
          picked.document.data,
        );
      }
      return;
    }

    const provider = documentStorageProviders.get(providerId);
    const picked = await provider?.pickOpen();
    if (!picked) return;
    const kind = scoreFileKind(picked.displayName);
    if (kind === "cotab") {
      await openStoredDocumentInSession(providerId, picked);
    } else if (kind === "guitarPro") {
      await openGuitarProDocument(picked.displayName, picked.data);
    } else {
      throw new Error(t("storage.unsupportedScoreFile"));
    }
  } catch (error) {
    documentStorageController.reportError(error);
  }
}
