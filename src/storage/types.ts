export interface StoredDocument {
  readonly locator: string;
  readonly displayName: string;
  readonly revision: string;
  readonly data: Uint8Array;
}

export interface DocumentStorageTarget {
  readonly locator: string;
  readonly displayName: string;
  readonly revision: string | null;
}

export type DocumentWriteResult =
  | {
      readonly kind: "saved";
      readonly revision: string;
    }
  | {
      readonly kind: "conflict";
      readonly current: StoredDocument | null;
    };

export interface DocumentStorageProvider {
  readonly id: string;
  readonly name: string;
  pickOpen(): Promise<StoredDocument | null>;
  pickSave(suggestedName: string): Promise<DocumentStorageTarget | null>;
  read(locator: string): Promise<StoredDocument | null>;
  write(
    locator: string,
    data: Uint8Array,
    expectedRevision: string | null,
  ): Promise<DocumentWriteResult>;
}
