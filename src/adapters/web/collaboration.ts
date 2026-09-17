import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import type { CollaborationAdapter, CollaborationPersistence } from "@/core/engine";
import { createRoomProvider } from "./room-provider";

export interface PersistenceAdapter {
  new(id: string, doc: Y.Doc): CollaborationPersistence;
}

export interface WebCollaborationConfig {
  serviceUrl: string;
  persistence?: PersistenceAdapter | null;
}

/** Invitations are local capabilities, never document or awareness state. */
export function parseRoomInvitation(invitation: string): { code: string; accessToken: string } {
  const match = /^([A-Za-z0-9]{12})\.([A-Za-z0-9_-]{43})$/.exec(invitation.trim());
  if (!match) throw new Error("Invalid room invitation.");
  return { code: match[1], accessToken: match[2] };
}

export function createWebCollaborationAdapter(config: WebCollaborationConfig): CollaborationAdapter {
  const serviceUrl = config.serviceUrl.replace(/\/$/, "");
  const capabilities = new Map<string, string>();
  const resolveRoomCode = (invitation: string): string => {
    if (capabilities.has(invitation)) return invitation;
    const { code, accessToken } = parseRoomInvitation(invitation);
    capabilities.set(code, accessToken);
    return code;
  };
  return {
    resolveRoomCode,
    getRoomInvitation(code) {
      const token = capabilities.get(code);
      return token ? `${code}.${token}` : null;
    },
    async createRoom() {
      const res = await fetch(`${serviceUrl}/api/rooms`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to create room.");
      const data = await res.json() as { code?: unknown; accessToken?: unknown };
      return resolveRoomCode(`${data.code}.${data.accessToken}`);
    },
    async roomExists(roomCode) {
      return (await fetch(`${serviceUrl}/api/rooms/${encodeURIComponent(roomCode)}`)).ok;
    },
    createProvider(args) {
      const accessToken = capabilities.get(args.roomCode);
      if (!accessToken) throw new Error("Room invitation required.");
      return createRoomProvider({ ...args, serviceUrl, accessToken });
    },
    createPersistence(roomCode, doc) {
      const Adapter = config.persistence === undefined ? IndexeddbPersistence : config.persistence;
      if (!Adapter) return null;
      // Namespace by service as well as room, and keep capabilities out of storage keys.
      const persistence: CollaborationPersistence = new Adapter(`cotab:${serviceUrl}:${roomCode}`, doc);
      return {
        on: (event, callback) => persistence.on(event, callback),
        ownsOrigin: (origin) => persistence.ownsOrigin?.(origin) ?? origin === persistence,
        destroy: () => persistence.destroy(),
      };
    },
  };
}
