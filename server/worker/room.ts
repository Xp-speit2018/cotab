import * as Y from "yjs";

import {
  AWARENESS_FRAME,
  capabilityFromProtocols,
  COTAB_PROTOCOL,
  DOCUMENT_UPDATE_FRAME,
  frame,
  hasSupportedProtocol,
  hashCapability,
  MAX_CONNECTIONS_PER_ROOM,
  MAX_FRAME_BYTES,
  MAX_SNAPSHOT_BYTES,
  SNAPSHOT_CHUNK_BYTES,
  STATE_VECTOR_FRAME,
  timingSafeEqual,
} from "./protocol";

const PERSIST_IDLE_MS = 2_000;
const PERSIST_MAX_MS = 10_000;

interface RoomRow {
  [key: string]: SqlStorageValue;
  access_hash: string;
  created_at: number;
  updated_at: number;
  revision: number;
}

export class RoomDurableObject {
  private doc = new Y.Doc();
  private initialized = false;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private dirtySince: number | null = null;

  constructor(private readonly state: DurableObjectState) {
    this.state.blockConcurrencyWhile(async () => {
      this.state.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS room (
          singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
          access_hash TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          revision INTEGER NOT NULL DEFAULT 0
        )
      `);
      this.state.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS snapshot_chunks (
          position INTEGER PRIMARY KEY,
          payload BLOB NOT NULL
        )
      `);
      this.initialized = this.roomRow() !== null;
      const chunks = this.state.storage.sql.exec<{ position: number; payload: ArrayBuffer }>(
        "SELECT position, payload FROM snapshot_chunks ORDER BY position",
      ).toArray();
      // Read the initial foundation's single-value snapshot until the next write.
      const legacySnapshot = chunks.length === 0
        ? await this.state.storage.get<ArrayBuffer>("snapshot")
        : undefined;
      const size = chunks.reduce((sum, chunk) => sum + chunk.payload.byteLength, 0);
      const joined = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        joined.set(new Uint8Array(chunk.payload), offset);
        offset += chunk.payload.byteLength;
      }
      const snapshot = chunks.length > 0 ? joined : legacySnapshot;
      if (snapshot && snapshot.byteLength > 0) {
        Y.applyUpdate(this.doc, new Uint8Array(snapshot), "persistence");
      }
      this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/internal/init") {
      return this.initialize(request);
    }
    if (request.method === "GET" && url.pathname === "/internal/metadata") {
      const row = this.roomRow();
      return row
        ? Response.json({ exists: true, createdAt: row.created_at, updatedAt: row.updated_at })
        : Response.json({ exists: false }, { status: 404 });
    }
    if (request.method === "GET" && url.pathname === "/internal/connect") {
      return this.connect(request);
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  async webSocketMessage(socket: WebSocket, message: ArrayBuffer | string): Promise<void> {
    if (typeof message === "string") {
      if (message === "ping") { socket.send("pong"); return; }
      if (message.length > 2048) { socket.close(1009, "Control frame too large"); return; }
      try {
        const control = JSON.parse(message);
        if (control.type === "presence" && typeof control.name === "string") {
          const identity = socket.deserializeAttachment() as { id: string };
          socket.serializeAttachment({ id: identity.id, name: control.name.slice(0, 100), synced: control.synced === true });
          this.broadcastMembers();
        }
      } catch {
        socket.close(1007, "Invalid control message");
      }
      return;
    }

    if (message.byteLength < 2 || message.byteLength > MAX_FRAME_BYTES) {
      socket.close(1009, "Invalid frame size");
      return;
    }

    const packet = new Uint8Array(message);
    const type = packet[0];
    const payload = packet.subarray(1);

    if (type === DOCUMENT_UPDATE_FRAME) {
      // Validate on a temporary document so invalid or oversized updates never
      // change the live room or get broadcast as accepted state.
      const candidate = new Y.Doc();
      try {
        Y.applyUpdate(candidate, Y.encodeStateAsUpdate(this.doc));
        Y.applyUpdate(candidate, payload);
        if (Y.encodeStateAsUpdate(candidate).byteLength > MAX_SNAPSHOT_BYTES) {
          candidate.destroy();
          socket.close(1009, "Room snapshot limit exceeded");
          return;
        }
      } catch {
        candidate.destroy();
        socket.close(1007, "Invalid Yjs update");
        return;
      }
      this.doc.destroy();
      this.doc = candidate;
      this.broadcast(packet, socket);
      this.schedulePersistence();
      return;
    }

    if (type === STATE_VECTOR_FRAME) {
      try {
        socket.send(frame(DOCUMENT_UPDATE_FRAME, Y.encodeStateAsUpdate(this.doc, payload)));
        socket.send(JSON.stringify({ type: "sync-complete", stateVector: [...Y.encodeStateVector(this.doc)] }));
      } catch {
        socket.close(1007, "Invalid Yjs state vector");
      }
      return;
    }

    if (type === AWARENESS_FRAME) {
      this.broadcast(packet, socket);
      return;
    }

    socket.close(1003, "Unknown frame type");
  }

  webSocketClose(socket: WebSocket, code: number, reason: string): void {
    socket.close(code, reason);
    this.broadcastMembers(socket);
  }

  webSocketError(socket: WebSocket): void {
    socket.close(1011, "WebSocket error");
    this.broadcastMembers(socket);
  }

  private async initialize(request: Request): Promise<Response> {
    if (this.initialized) return Response.json({ created: false }, { status: 409 });

    const body = await request.json<{ accessHash?: unknown; createdAt?: unknown }>();
    if (typeof body.accessHash !== "string" || typeof body.createdAt !== "number") {
      return Response.json({ error: "Invalid room initialization" }, { status: 400 });
    }

    this.state.storage.sql.exec(
      `INSERT INTO room (singleton, access_hash, created_at, updated_at, revision)
       VALUES (1, ?, ?, ?, 0)`,
      body.accessHash,
      body.createdAt,
      body.createdAt,
    );
    this.initialized = true;
    return Response.json({ created: true }, { status: 201 });
  }

  private async connect(request: Request): Promise<Response> {
    if (!this.initialized) return Response.json({ error: "Room not found" }, { status: 404 });
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return Response.json({ error: "WebSocket upgrade required" }, { status: 426 });
    }

    const protocolHeader = request.headers.get("Sec-WebSocket-Protocol");
    const token = capabilityFromProtocols(protocolHeader);
    if (!token || !hasSupportedProtocol(protocolHeader)) {
      return Response.json({ error: "Missing collaboration protocol or capability" }, { status: 401 });
    }

    const row = this.roomRow();
    const candidateHash = await hashCapability(token);
    if (!row || !timingSafeEqual(candidateHash, row.access_hash)) {
      return Response.json({ error: "Invalid room capability" }, { status: 403 });
    }
    if (this.state.getWebSockets().length >= MAX_CONNECTIONS_PER_ROOM) {
      return Response.json({ error: "Room connection limit reached" }, { status: 429 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server);
    // Socket attachments survive hibernation only for live connections; they
    // are never included in the durable room document or snapshot tables.
    server.serializeAttachment({ id: crypto.randomUUID() });

    // Each side sends its vector and replies to the other's vector with a
    // document update. Reconnect repairs missing state in both directions.
    server.send(frame(STATE_VECTOR_FRAME, Y.encodeStateVector(this.doc)));

    return new Response(null, {
      status: 101,
      headers: { "Sec-WebSocket-Protocol": COTAB_PROTOCOL },
      webSocket: client,
    });
  }

  private broadcastMembers(departed?: WebSocket): void {
    const sockets = this.state.getWebSockets().filter((socket) => socket !== departed && socket.readyState === WebSocket.OPEN);
    const peers = sockets.flatMap((socket) => {
      const identity = socket.deserializeAttachment() as { id: string; name?: string; synced?: boolean };
      return typeof identity.name === "string"
        ? [{ id: identity.id, name: identity.name, kind: "human", status: identity.synced ? "synced" : "connecting" }]
        : [];
    });
    for (const socket of sockets) {
      try {
        socket.send(JSON.stringify({ type: "members", selfId: socket.deserializeAttachment().id, peers }));
      } catch { /* Closing sockets are removed by their close callback. */ }
    }
  }

  private roomRow(): RoomRow | null {
    const rows = this.state.storage.sql.exec<RoomRow>(
      "SELECT access_hash, created_at, updated_at, revision FROM room WHERE singleton = 1",
    ).toArray();
    return rows[0] ?? null;
  }

  private broadcast(message: Uint8Array, sender: WebSocket): void {
    for (const socket of this.state.getWebSockets()) {
      if (socket === sender) continue;
      try {
        socket.send(message);
      } catch {
        socket.close(1011, "Broadcast failed");
      }
    }
  }

  private schedulePersistence(): void {
    const now = Date.now();
    this.dirtySince ??= now;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    const elapsed = now - this.dirtySince;
    const delay = Math.max(0, Math.min(PERSIST_IDLE_MS, PERSIST_MAX_MS - elapsed));
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.state.waitUntil(this.persist());
    }, delay);
  }

  private sendControl(message: Record<string, unknown>): void {
    const encoded = JSON.stringify(message);
    for (const socket of this.state.getWebSockets()) {
      try {
        socket.send(encoded);
      } catch {
        // A departed recipient must not interrupt persistence or other clients.
      }
    }
  }

  private async persist(): Promise<void> {
    const snapshot = Y.encodeStateAsUpdate(this.doc);
    const now = Date.now();
    try {
      const revision = this.state.storage.transactionSync(() => {
        this.state.storage.sql.exec("DELETE FROM snapshot_chunks");
        for (let offset = 0; offset < snapshot.byteLength; offset += SNAPSHOT_CHUNK_BYTES) {
          this.state.storage.sql.exec(
            "INSERT INTO snapshot_chunks (position, payload) VALUES (?, ?)",
            offset / SNAPSHOT_CHUNK_BYTES,
            snapshot.slice(offset, offset + SNAPSHOT_CHUNK_BYTES).buffer,
          );
        }
        this.state.storage.sql.exec(
          "UPDATE room SET updated_at = ?, revision = revision + 1 WHERE singleton = 1",
          now,
        );
        return this.roomRow()!.revision;
      });
      // Clear only the state included in this synchronous transaction. Edits
      // arriving during sync() create their own dirty interval and timer.
      this.dirtySince = null;
      await this.state.storage.sync();
      this.sendControl({ type: "durable", revision, at: now });
      await this.state.storage.delete("snapshot");
    } catch {
      this.sendControl({ type: "persistence-error", reason: "storage-unavailable" });
      // Retry with a bounded delay; a failed write must not silently stay dirty.
      if (!this.persistTimer) {
        this.dirtySince = null;
        this.schedulePersistence();
      }
    }
  }
}
