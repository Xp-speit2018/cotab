import * as Y from "yjs";

export interface PeerInfo {
  id: string;
  name: string;
}

export interface CollaborationProvider {
  on(event: string, callback: () => void): void;
  destroy(): void;
}

export interface CollaborationPersistence {
  on(event: string, callback: () => void): void;
  destroy(): void;
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
