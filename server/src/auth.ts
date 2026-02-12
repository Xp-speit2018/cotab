import type { WebSocket } from "ws";
import type { AuthMessage } from "./types.js";
import { joinRoom, roomExists } from "./rooms.js";

const MAX_NAME_LENGTH = 32;

function send(conn: WebSocket, data: Record<string, unknown>): void {
  if (conn.readyState === conn.OPEN) {
    conn.send(JSON.stringify(data));
  }
}

/**
 * Handle the custom `auth` message.
 *
 * Validates the room code, joins the peer to the room, and responds
 * with either `auth-ok` or `auth-error`.
 */
export function handleAuth(conn: WebSocket, msg: AuthMessage): boolean {
  const { name, roomCode } = msg;

  // Validate display name
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    send(conn, { type: "auth-error", reason: "Display name is required" });
    return false;
  }

  if (name.length > MAX_NAME_LENGTH) {
    send(conn, {
      type: "auth-error",
      reason: `Display name must be ${MAX_NAME_LENGTH} characters or fewer`,
    });
    return false;
  }

  // Validate room code
  if (!roomCode || typeof roomCode !== "string") {
    send(conn, { type: "auth-error", reason: "Room code is required" });
    return false;
  }

  if (!roomExists(roomCode)) {
    send(conn, { type: "auth-error", reason: "Room not found" });
    return false;
  }

  // Join the room
  const result = joinRoom(roomCode, name.trim(), conn);
  if (!result) {
    send(conn, { type: "auth-error", reason: "Failed to join room" });
    return false;
  }

  const { room } = result;

  // Build peer list (excluding the joining peer)
  const peers = Array.from(room.peers.values())
    .filter((p) => p.conn !== conn)
    .map((p) => ({ id: p.id, name: p.name }));

  send(conn, {
    type: "auth-ok",
    roomTopic: room.topic,
    peers,
  });

  console.log(
    `[auth] ${name} joined room ${roomCode} (${room.peers.size} peers)`
  );

  return true;
}
