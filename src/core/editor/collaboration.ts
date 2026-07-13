import * as Y from "yjs";

export interface PeerInfo {
  id: string;
  name: string;
  kind: "human" | "agent";
  status: "connecting" | "synced" | "offline" | "error";
}

export interface CollaborationTransportProfile {
  signalingConnected: boolean;
  webRtcPeerCount: number;
  broadcastChannelPeerCount: number;
  connectedPeerCount: number;
  syncedPeerCount: number;
  bytesSent: number;
  bytesReceived: number;
  messagesSent: number;
  messagesReceived: number;
  roundTripTimeMs: number | null;
  lastSampleAt: number | null;
}

export type YjsUpdateSource =
  | "local"
  | "network"
  | "persistence"
  | "agent"
  | "logicalPeer"
  | "system";

export interface YjsUpdateStats {
  updates: number;
  bytes: number;
  maxBytes: number;
  lastAt: number | null;
}

export interface YjsUpdateSample {
  at: number;
  source: YjsUpdateSource;
  peerId: string | null;
  bytes: number;
}

export interface LogicalPeerTransferProfile {
  resetCount: number;
  resetBytes: number;
  sentUpdates: number;
  sentBytes: number;
  receivedUpdates: number;
  receivedBytes: number;
  lastTransferAt: number | null;
}

export interface SyncState {
  phase: "offline" | "connecting" | "ready" | "syncing" | "synced" | "error";
  error: string | null;
  networkPeerCount: number;
  logicalPeerCount: number;
  lastSyncedAt: number | null;
  transport: CollaborationTransportProfile;
  yjs: {
    bySource: Record<YjsUpdateSource, YjsUpdateStats>;
    lastUpdate: YjsUpdateSample | null;
    recentUpdates: YjsUpdateSample[];
  };
  logicalPeers: Record<string, LogicalPeerTransferProfile>;
}

const emptyUpdateStats = (): YjsUpdateStats => ({
  updates: 0,
  bytes: 0,
  maxBytes: 0,
  lastAt: null,
});

export function createSyncState(
  phase: SyncState["phase"] = "offline",
): SyncState {
  return {
    phase,
    error: null,
    networkPeerCount: 0,
    logicalPeerCount: 0,
    lastSyncedAt: null,
    transport: {
      signalingConnected: false,
      webRtcPeerCount: 0,
      broadcastChannelPeerCount: 0,
      connectedPeerCount: 0,
      syncedPeerCount: 0,
      bytesSent: 0,
      bytesReceived: 0,
      messagesSent: 0,
      messagesReceived: 0,
      roundTripTimeMs: null,
      lastSampleAt: null,
    },
    yjs: {
      bySource: {
        local: emptyUpdateStats(),
        network: emptyUpdateStats(),
        persistence: emptyUpdateStats(),
        agent: emptyUpdateStats(),
        logicalPeer: emptyUpdateStats(),
        system: emptyUpdateStats(),
      },
      lastUpdate: null,
      recentUpdates: [],
    },
    logicalPeers: {},
  };
}

export interface CollaborationProvider {
  on(event: string, callback: (event: unknown) => void): void;
  ownsOrigin?(origin: unknown): boolean;
  destroy(): void;
}

export interface CollaborationPersistence {
  on(event: string, callback: () => void): void;
  ownsOrigin?(origin: unknown): boolean;
  destroy(): void;
}

/**
 * A logical peer attached to the current document without prescribing a
 * network transport. EditorEngine owns document rebinding and update routing.
 */
export interface DocumentPeerConnection {
  peer?: PeerInfo;
  resetDocument(update: Uint8Array): void;
  updateDocument(update: Uint8Array): void;
  onDocumentUpdate(callback: (update: Uint8Array) => void): () => void;
  onPeerStatusChange?(callback: (status: PeerInfo["status"]) => void): () => void;
}

export interface CollaborationAdapter {
  createRoom?: () => Promise<string>;
  roomExists?: (roomCode: string) => Promise<boolean>;
  createProvider(args: {
    roomCode: string;
    userName: string;
    doc: Y.Doc;
    onPresenceMessage: (msg: Record<string, unknown>) => void;
  }): CollaborationProvider;
  createPersistence?: (
    roomCode: string,
    doc: Y.Doc,
  ) => CollaborationPersistence | null;
}
