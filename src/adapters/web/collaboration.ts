import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebrtcProvider } from "y-webrtc";

import type {
  CollaborationAdapter,
  CollaborationPersistence,
  CollaborationProvider,
} from "@/core/engine";

export interface PersistenceAdapter {
  new(id: string, doc: Y.Doc): CollaborationPersistence;
}

export interface WebCollaborationConfig {
  signalingUrl: string;
  persistence?: PersistenceAdapter | null;
}

function signalingEndpoint(config: WebCollaborationConfig, roomCode: string, userName: string): string {
  const wsBase = config.signalingUrl.replace(/^http/, "ws");
  return `${wsBase}?roomCode=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(userName)}`;
}

export function createWebCollaborationAdapter(config: WebCollaborationConfig): CollaborationAdapter {
  return {
    async createRoom(): Promise<string> {
      const res = await fetch(`${config.signalingUrl}/api/rooms`, { method: "POST" });
      if (!res.ok) {
        throw new Error("Failed to create room.");
      }
      const data = (await res.json()) as { code?: unknown };
      if (typeof data.code !== "string") {
        throw new Error("Room creation response did not include a room code.");
      }
      return data.code;
    },

    async roomExists(roomCode: string): Promise<boolean> {
      const res = await fetch(`${config.signalingUrl}/api/rooms/${encodeURIComponent(roomCode)}`);
      return res.ok;
    },

    createProvider({
      roomCode,
      userName,
      doc,
      onPresenceMessage,
    }): CollaborationProvider {
      const provider = new WebrtcProvider(`room:${roomCode}`, doc, {
        signaling: [signalingEndpoint(config, roomCode, userName)],
      });

      for (const sigConn of provider.signalingConns) {
        sigConn.on("message", onPresenceMessage);
      }

      return provider;
    },

    createPersistence(roomCode: string, doc: Y.Doc): CollaborationPersistence | null {
      const Adapter = config.persistence === undefined ? IndexeddbPersistence : config.persistence;
      if (!Adapter) return null;
      return new Adapter(`cotab:${roomCode}`, doc);
    },
  };
}
