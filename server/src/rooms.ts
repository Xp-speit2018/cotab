import crypto from "node:crypto";
import type { WebSocket } from "ws";
import type { Peer, Room } from "./types.js";

const ROOM_CODE_LENGTH = 6;
const GRACE_PERIOD_MS = 60_000; // 60 seconds before cleaning up empty rooms

/** All active rooms keyed by room code */
const rooms = new Map<string, Room>();

/** Reverse lookup: WebSocket → Peer (for fast disconnect handling) */
const peersByConn = new Map<WebSocket, Peer>();

/** Reverse lookup: Peer → Room code */
const roomByPeer = new Map<string, string>();

// ─── Helpers ───────────────────────────────────────────────────────────────────

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(ROOM_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

function generatePeerId(): string {
  return crypto.randomBytes(8).toString("hex");
}

function send(conn: WebSocket, data: Record<string, unknown>): void {
  if (conn.readyState === conn.OPEN) {
    conn.send(JSON.stringify(data));
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

export function createRoom(): Room {
  let code = generateCode();
  // Collision check
  while (rooms.has(code)) {
    code = generateCode();
  }

  const room: Room = {
    code,
    topic: `room:${code}`,
    peers: new Map(),
    createdAt: Date.now(),
    destroyTimer: null,
  };

  rooms.set(code, room);
  return room;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

export function roomExists(code: string): boolean {
  return rooms.has(code);
}

export function joinRoom(
  code: string,
  name: string,
  conn: WebSocket
): { peer: Peer; room: Room } | null {
  const room = rooms.get(code);
  if (!room) return null;

  // Cancel any pending destruction
  if (room.destroyTimer) {
    clearTimeout(room.destroyTimer);
    room.destroyTimer = null;
  }

  const peer: Peer = {
    id: generatePeerId(),
    name,
    conn,
    subscribedTopics: new Set(),
    alive: true,
  };

  room.peers.set(peer.id, peer);
  peersByConn.set(conn, peer);
  roomByPeer.set(peer.id, code);

  // Broadcast peer-joined to existing peers
  for (const [id, existingPeer] of room.peers) {
    if (id !== peer.id) {
      send(existingPeer.conn, {
        type: "peer-joined",
        peerId: peer.id,
        name: peer.name,
      });
    }
  }

  return { peer, room };
}

export function removePeer(conn: WebSocket): void {
  const peer = peersByConn.get(conn);
  if (!peer) return;

  const code = roomByPeer.get(peer.id);
  if (!code) return;

  const room = rooms.get(code);

  // Clean up lookups
  peersByConn.delete(conn);
  roomByPeer.delete(peer.id);

  if (!room) return;

  room.peers.delete(peer.id);

  // Broadcast peer-left
  for (const existingPeer of room.peers.values()) {
    send(existingPeer.conn, {
      type: "peer-left",
      peerId: peer.id,
      name: peer.name,
    });
  }

  // Schedule room cleanup if empty
  if (room.peers.size === 0) {
    room.destroyTimer = setTimeout(() => {
      // Double check it's still empty
      const current = rooms.get(code);
      if (current && current.peers.size === 0) {
        rooms.delete(code);
        console.log(`[rooms] Room ${code} destroyed after grace period`);
      }
    }, GRACE_PERIOD_MS);
    console.log(
      `[rooms] Room ${code} is empty, will destroy in ${GRACE_PERIOD_MS / 1000}s`
    );
  }
}

export function getPeerByConn(conn: WebSocket): Peer | undefined {
  return peersByConn.get(conn);
}

export function getRoomByPeer(peer: Peer): Room | undefined {
  const code = roomByPeer.get(peer.id);
  return code ? rooms.get(code) : undefined;
}

export function getRoomCount(): number {
  return rooms.size;
}
