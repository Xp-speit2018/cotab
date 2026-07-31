import { create } from "zustand";

export interface DemoDocument {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly url: string;
}

export const DEMO_DOCUMENTS: readonly DemoDocument[] = [
  {
    id: "taijin-kyofusho",
    name: "Taijin Kyofusho",
    description: "The Evapatoria Report",
    url: "/demos/Taijin_kyofusho.gp",
  },
];

interface DemoSelectionRequest {
  readonly resolve: (demo: DemoDocument | null) => void;
}

interface DemoSelectionState {
  readonly request: DemoSelectionRequest | null;
  setRequest(request: DemoSelectionRequest | null): void;
}

export const useDemoSelection = create<DemoSelectionState>((set) => ({
  request: null,
  setRequest: (request) => set({ request }),
}));

export function selectDemoDocument(): Promise<DemoDocument | null> {
  const current = useDemoSelection.getState().request;
  if (current) current.resolve(null);
  return new Promise((resolve) => {
    useDemoSelection.getState().setRequest({ resolve });
  });
}

export function finishDemoSelection(demo: DemoDocument | null): void {
  const request = useDemoSelection.getState().request;
  if (!request) return;
  useDemoSelection.getState().setRequest(null);
  request.resolve(demo);
}
