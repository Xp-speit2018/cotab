export type EditorStorageStatus =
  | "unbound"
  | "saved"
  | "dirty"
  | "saving"
  | "conflict"
  | "error";

export interface EditorStorageBinding {
  readonly providerId: string;
  readonly locator: string;
  readonly displayName: string;
  readonly revision: string | null;
}

export interface EditorStorageState {
  readonly availableProviderIds: readonly string[];
  readonly status: EditorStorageStatus;
  readonly binding: EditorStorageBinding | null;
  readonly autoSaveEnabled: boolean;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly hasConflict: boolean;
}

export function createEditorStorageState(
  availableProviderIds: readonly string[] = [],
): EditorStorageState {
  return {
    availableProviderIds,
    status: "unbound",
    binding: null,
    autoSaveEnabled: true,
    lastSavedAt: null,
    error: null,
    hasConflict: false,
  };
}
