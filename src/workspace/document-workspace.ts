import { create } from "zustand";
import {
  EditorEngine,
  engine,
  setActiveEngine,
} from "@/core/engine";
import {
  createWebCollaborationAdapter,
  parseIceServers,
} from "@/adapters/web/collaboration";
import {
  createDocumentStorageRuntime,
  getInitialDocumentStorageRuntime,
  setActiveDocumentStorageController,
  type DocumentStorageRuntime,
} from "@/storage/document-storage-runtime";
import type { StoredDocument } from "@/storage/types";
import {
  activateCurrentDocumentRenderer,
  captureActiveDocumentViewState,
  type DocumentViewState,
} from "@/stores/render-store";

export interface DocumentTabSummary {
  readonly id: string;
  readonly title: string;
  readonly storageStatus: EditorEngine["storage"]["status"];
  readonly connected: boolean;
  readonly roomCode: string | null;
}

interface DocumentSession {
  readonly id: string;
  readonly engine: EditorEngine;
  readonly storage: DocumentStorageRuntime;
  readonly disposeObservers: () => void;
  titleHint: string | null;
  view: DocumentViewState;
}

interface DocumentWorkspaceState {
  readonly tabs: readonly DocumentTabSummary[];
  readonly activeTabId: string;
}

const DEFAULT_VIEW: DocumentViewState = {
  zoom: 1,
  scoreLayout: "parchment",
  scrollLeft: 0,
  scrollTop: 0,
};

const sessions = new Map<string, DocumentSession>();

export const useDocumentWorkspaceStore = create<DocumentWorkspaceState>(() => ({
  tabs: [],
  activeTabId: "",
}));

function configureSessionEngine(sessionEngine: EditorEngine): void {
  sessionEngine.setCollaborationAdapter(createWebCollaborationAdapter({
    signalingUrl: import.meta.env.VITE_SIGNALING_URL,
    iceServers: parseIceServers(import.meta.env.VITE_WEBRTC_ICE_SERVERS),
  }));
}

function scoreTitle(session: DocumentSession): string {
  const title = session.engine.getScoreMap()?.get("title");
  if (typeof title === "string" && title.trim()) return title.trim();
  const bindingName = session.engine.storage.binding?.displayName;
  if (bindingName) return bindingName.replace(/\.(cotab|gp\d?|gpx)$/i, "");
  return session.titleHint?.replace(/\.(cotab|gp\d?|gpx)$/i, "") || "";
}

function tabSummary(session: DocumentSession): DocumentTabSummary {
  return {
    id: session.id,
    title: scoreTitle(session),
    storageStatus: session.engine.storage.status,
    connected: session.engine.connected,
    roomCode: session.engine.roomCode,
  };
}

function publishWorkspace(activeTabId?: string): void {
  const current = useDocumentWorkspaceStore.getState();
  useDocumentWorkspaceStore.setState({
    tabs: [...sessions.values()].map(tabSummary),
    activeTabId: activeTabId ?? current.activeTabId,
  });
}

function observeSession(session: Omit<DocumentSession, "disposeObservers">): () => void {
  let observedDoc = session.engine.getDoc();
  const publish = () => queueMicrotask(() => publishWorkspace());
  const handleDocumentUpdate = () => publish();
  observedDoc?.on("update", handleDocumentUpdate);

  const unregister = session.engine.registerHooks({
    onDocumentReplaced: (doc) => {
      observedDoc?.off("update", handleDocumentUpdate);
      observedDoc = doc;
      observedDoc?.on("update", handleDocumentUpdate);
      publish();
    },
    onLocalStorageChange: publish,
    onConnectionMetaChange: publish,
  });

  return () => {
    unregister();
    observedDoc?.off("update", handleDocumentUpdate);
  };
}

function buildSession(
  sessionEngine: EditorEngine,
  storage: DocumentStorageRuntime,
  titleHint: string | null,
): DocumentSession {
  const partial = {
    id: crypto.randomUUID(),
    engine: sessionEngine,
    storage,
    titleHint,
    view: { ...DEFAULT_VIEW },
  };
  return {
    ...partial,
    disposeObservers: observeSession(partial),
  };
}

let initialRuntimeAvailable = true;

export function createDocumentSession(titleHint: string | null = null): string {
  const useInitialRuntime = initialRuntimeAvailable;
  initialRuntimeAvailable = false;
  const sessionEngine = useInitialRuntime ? engine : new EditorEngine();
  sessionEngine.initDoc();
  configureSessionEngine(sessionEngine);
  const session = buildSession(
    sessionEngine,
    useInitialRuntime
      ? getInitialDocumentStorageRuntime()
      : createDocumentStorageRuntime(sessionEngine),
    titleHint,
  );
  sessions.set(session.id, session);
  publishWorkspace();
  return session.id;
}

export function activateDocumentSession(id: string): boolean {
  const target = sessions.get(id);
  if (!target) return false;
  const state = useDocumentWorkspaceStore.getState();
  if (state.activeTabId === id) return true;

  const current = sessions.get(state.activeTabId);
  if (current) current.view = captureActiveDocumentViewState();

  setActiveEngine(target.engine);
  setActiveDocumentStorageController(target.storage.controller);
  publishWorkspace(id);
  activateCurrentDocumentRenderer(target.view);
  return true;
}

export function closeDocumentSession(id: string): boolean {
  const session = sessions.get(id);
  if (!session) return false;

  const state = useDocumentWorkspaceStore.getState();
  if (state.activeTabId === id) {
    const ids = [...sessions.keys()];
    const index = ids.indexOf(id);
    const replacementId = ids[index + 1] ?? ids[index - 1];
    if (replacementId) activateDocumentSession(replacementId);
  }

  sessions.delete(id);
  session.disposeObservers();
  session.storage.dispose();
  void session.engine.disconnect();
  session.engine.destroyDoc();
  publishWorkspace(sessions.size === 0 ? "" : undefined);
  return true;
}

export async function openStoredDocumentInSession(
  providerId: string,
  stored: StoredDocument,
): Promise<string> {
  const existing = [...sessions.values()].find((session) => {
    const binding = session.engine.storage.binding;
    return binding?.providerId === providerId && binding.locator === stored.locator;
  });
  if (existing) {
    activateDocumentSession(existing.id);
    return existing.id;
  }

  const previousId = useDocumentWorkspaceStore.getState().activeTabId;
  const id = createDocumentSession(stored.displayName);
  const session = sessions.get(id)!;
  try {
    await session.storage.controller.openStoredDocument(providerId, stored);
    activateDocumentSession(id);
    return id;
  } catch (error) {
    closeDocumentSession(id);
    if (previousId) activateDocumentSession(previousId);
    throw error;
  }
}

export function openSourceDocumentSession(titleHint: string): string {
  const id = createDocumentSession(titleHint);
  activateDocumentSession(id);
  return id;
}

export function openBlankDocumentSession(): string {
  const id = createDocumentSession();
  activateDocumentSession(id);
  return id;
}

export function activeDocumentSessionId(): string {
  return useDocumentWorkspaceStore.getState().activeTabId;
}

export function setWorkspaceAutoSaveEnabled(enabled: boolean): void {
  for (const session of sessions.values()) {
    session.storage.controller.setAutoSaveEnabled(enabled);
  }
}
