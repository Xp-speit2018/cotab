import { create } from "zustand";

interface WorkspaceUiState {
  trackCreatorOpen: boolean;
  setTrackCreatorOpen: (open: boolean) => void;
}

export const useWorkspaceUiStore = create<WorkspaceUiState>((set) => ({
  trackCreatorOpen: false,
  setTrackCreatorOpen: (open) => set({ trackCreatorOpen: open }),
}));
