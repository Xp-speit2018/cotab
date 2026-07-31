import { create } from "zustand";

export type StorageProviderOperation = "open" | "save";

interface ProviderSelectionRequest {
  readonly operation: StorageProviderOperation;
  readonly resolve: (providerId: string | null) => void;
}

interface ProviderSelectionState {
  readonly request: ProviderSelectionRequest | null;
  setRequest(request: ProviderSelectionRequest | null): void;
}

export const useStorageProviderSelection = create<ProviderSelectionState>(
  (set) => ({
    request: null,
    setRequest: (request) => set({ request }),
  }),
);

export function selectStorageProvider(
  operation: StorageProviderOperation,
): Promise<string | null> {
  const current = useStorageProviderSelection.getState().request;
  if (current) current.resolve(null);

  return new Promise((resolve) => {
    useStorageProviderSelection.getState().setRequest({ operation, resolve });
  });
}

export function finishStorageProviderSelection(
  providerId: string | null,
): void {
  const request = useStorageProviderSelection.getState().request;
  if (!request) return;
  useStorageProviderSelection.getState().setRequest(null);
  request.resolve(providerId);
}
