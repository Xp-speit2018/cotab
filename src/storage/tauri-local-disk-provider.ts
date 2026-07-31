import type {
  DocumentStorageProvider,
  DocumentStorageTarget,
  DocumentWriteResult,
  StoredDocument,
} from "./types";

interface NativeStoredDocument {
  readonly locator: string;
  readonly displayName: string;
  readonly revision: string;
  readonly data: number[];
}

interface NativeStorageTarget {
  readonly locator: string;
  readonly displayName: string;
  readonly revision: string | null;
}

type NativeWriteResult =
  | {
      readonly kind: "saved";
      readonly revision: string;
    }
  | {
      readonly kind: "conflict";
      readonly current: NativeStoredDocument | null;
    };

export interface PickedLocalScoreFile {
  readonly kind: "cotab" | "guitarPro";
  readonly document: StoredDocument;
}

async function invokeNative<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

function fromNative(document: NativeStoredDocument): StoredDocument {
  return {
    ...document,
    data: Uint8Array.from(document.data),
  };
}

export function isLocalDiskStorageAvailable(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function pickLocalScoreFile(): Promise<PickedLocalScoreFile | null> {
  const result = await invokeNative<{
    kind: "cotab" | "guitarPro";
    document: NativeStoredDocument;
  } | null>("pick_local_score_file");
  return result
    ? {
        kind: result.kind,
        document: fromNative(result.document),
      }
    : null;
}

export class TauriLocalDiskProvider implements DocumentStorageProvider {
  readonly id = "local-disk";
  readonly name = "Local disk";

  async pickOpen(): Promise<StoredDocument | null> {
    const picked = await pickLocalScoreFile();
    if (!picked) return null;
    if (picked.kind !== "cotab") {
      throw new Error("Selected file is not a CoTab document.");
    }
    return picked.document;
  }

  async pickSave(suggestedName: string): Promise<DocumentStorageTarget | null> {
    return invokeNative<NativeStorageTarget | null>("pick_local_document_path", {
      suggestedName,
    });
  }

  async read(locator: string): Promise<StoredDocument | null> {
    const result = await invokeNative<NativeStoredDocument | null>(
      "read_local_document",
      { locator },
    );
    return result ? fromNative(result) : null;
  }

  async write(
    locator: string,
    data: Uint8Array,
    expectedRevision: string | null,
  ): Promise<DocumentWriteResult> {
    const result = await invokeNative<NativeWriteResult>("write_local_document", {
      locator,
      data: Array.from(data),
      expectedRevision,
    });
    return result.kind === "saved"
      ? result
      : {
          kind: "conflict",
          current: result.current ? fromNative(result.current) : null,
        };
  }
}
