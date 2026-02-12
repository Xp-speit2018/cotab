import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { createRoom, getRoom, removePeer, getPeerByConn, getRoomCount } from "./rooms.js";
import { handleSubscribe, handleUnsubscribe, handlePublish, handlePing, cleanupSubscriptions } from "./signaling.js";
import { handleAuth } from "./auth.js";
import type { ClientMessage } from "./types.js";

const PORT = parseInt(process.env.PORT ?? "4444", 10);
const HEARTBEAT_INTERVAL_MS = 30_000;

// ─── HTTP Server ───────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET / — Health check
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", rooms: getRoomCount() }));
    return;
  }

  // POST /api/rooms — Create a room
  if (req.method === "POST" && url.pathname === "/api/rooms") {
    const room = createRoom();
    console.log(`[http] Room created: ${room.code}`);
    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ code: room.code }));
    return;
  }

  // GET /api/rooms/:code — Room info
  if (req.method === "GET" && url.pathname.startsWith("/api/rooms/")) {
    const code = url.pathname.split("/api/rooms/")[1];
    if (!code) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Room code is required" }));
      return;
    }
    const room = getRoom(code);
    if (!room) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Room not found" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        code: room.code,
        topic: room.topic,
        peerCount: room.peers.size,
        peers: Array.from(room.peers.values()).map((p) => ({
          id: p.id,
          name: p.name,
        })),
        createdAt: room.createdAt,
      })
    );
    return;
  }

  // 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

// ─── WebSocket Server ──────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server });

/** Track whether a connection has authenticated */
const authenticated = new WeakSet<WebSocket>();

wss.on("connection", (conn: WebSocket, req: http.IncomingMessage) => {
  let isAlive = true;

  // --- Query-param auth (for y-webrtc compatibility) ---
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const qRoomCode = url.searchParams.get("roomCode");
  const qName = url.searchParams.get("name");
  if (qRoomCode && qName) {
    const ok = handleAuth(conn, { type: "auth", name: qName, roomCode: qRoomCode });
    if (ok) authenticated.add(conn);
  }

  conn.on("pong", () => {
    isAlive = true;
    // Also update peer alive flag
    const peer = getPeerByConn(conn);
    if (peer) peer.alive = true;
  });

  conn.on("message", (raw: Buffer | string) => {
    let msg: ClientMessage;
    try {
      const data = typeof raw === "string" ? raw : raw.toString("utf-8");
      msg = JSON.parse(data) as ClientMessage;
    } catch {
      return; // Ignore malformed messages
    }

    if (!msg || typeof msg.type !== "string") return;

    // Auth must be the first message
    if (msg.type === "auth") {
      if (authenticated.has(conn)) return; // Already authenticated
      const ok = handleAuth(conn, msg);
      if (ok) authenticated.add(conn);
      return;
    }

    // All other messages require authentication
    if (!authenticated.has(conn)) {
      conn.send(
        JSON.stringify({
          type: "auth-error",
          reason: "Must authenticate first (send auth message)",
        })
      );
      return;
    }

    switch (msg.type) {
      case "subscribe":
        handleSubscribe(conn, msg);
        break;
      case "unsubscribe":
        handleUnsubscribe(conn, msg);
        break;
      case "publish":
        handlePublish(conn, msg);
        break;
      case "ping":
        handlePing(conn);
        break;
      default:
        // Unknown message type — ignore
        break;
    }
  });

  conn.on("close", () => {
    cleanupSubscriptions(conn);
    removePeer(conn);
  });

  conn.on("error", (err) => {
    console.error("[ws] Connection error:", err.message);
    cleanupSubscriptions(conn);
    removePeer(conn);
  });

  // Per-connection heartbeat check via ws-level ping
  const heartbeat = setInterval(() => {
    if (!isAlive) {
      console.log("[ws] Terminating unresponsive connection");
      clearInterval(heartbeat);
      conn.terminate();
      return;
    }
    isAlive = false;
    conn.ping();
  }, HEARTBEAT_INTERVAL_MS);

  conn.on("close", () => clearInterval(heartbeat));
});

// ─── Start ─────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[server] Signaling server listening on :${PORT}`);
});
