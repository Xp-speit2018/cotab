import * as Y from "yjs";
import type { CollaborationAdapter, CollaborationProvider, PeerInfo } from "@/core/engine";
import { createSyncState, type PeerSelection } from "@/core/editor/collaboration";
import {
  cloudflareWebSocketProtocols, decodeCollaborationFrame, encodeCollaborationFrame,
  DOCUMENT_UPDATE_FRAME, STATE_VECTOR_FRAME,
} from "./cloudflare-protocol";

const BATCH_MS = 150;
const MAX_BATCH_BYTES = 1_000_000;
const MAX_FRAME_BYTES = 8 * 1024 * 1024;
const MAX_BUFFER_BYTES = 2 * MAX_FRAME_BYTES;
const HEARTBEAT_MS = 5_000;

export function createRoomProvider({
  doc, userName, roomCode, onPresenceMessage, serviceUrl, accessToken,
}: Parameters<CollaborationAdapter["createProvider"]>[0] & {
  serviceUrl: string;
  accessToken: string;
}): CollaborationProvider {
  const origin = {};
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  let socket: WebSocket | null = null;
  let destroyed = false;
  let stopped = false;
  let synced = false;
  let retry = 0;
  let hasSynced = false;
  let pending: Uint8Array[] = [];
  let pendingBytes = 0;
  let batchTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let lastReceived = Date.now();
  let pingAt: number | null = null;
  let peers: PeerInfo[] = [];
  let selection: PeerSelection | null = null;
  let profile = createSyncState().transport;

  const emitProfile = () => {
    profile = {
      ...profile,
      webSocketConnected: socket?.readyState === WebSocket.OPEN,
      serverSynced: synced,
      connectedPeerCount: peers.length,
      syncedPeerCount: synced ? peers.filter((peer) => peer.status === "synced").length : 0,
      lastSampleAt: Date.now(),
    };
    onPresenceMessage({ type: "transport-profile", profile });
  };
  const error = (key: string) => onPresenceMessage({ type: "collaboration-error", error: key });
  const send = (data: string | Uint8Array): boolean => {
    if (socket?.readyState !== WebSocket.OPEN) return false;
    const bytes = typeof data === "string" ? new TextEncoder().encode(data).byteLength : data.byteLength;
    if (bytes > MAX_FRAME_BYTES) {
      stopped = true;
      error("errorCapacity");
      socket.close(4009, "Document too large");
      return false;
    }
    if (socket.bufferedAmount + bytes > MAX_BUFFER_BYTES) {
      // Recover from the document on reconnect instead of growing a send queue.
      socket.close(4000, "Backpressure");
      return false;
    }
    try {
      socket.send(data as Uint8Array<ArrayBuffer> | string);
      profile = { ...profile, bytesSent: profile.bytesSent + bytes, messagesSent: profile.messagesSent + 1 };
      return true;
    } catch {
      socket.close();
      return false;
    }
  };
  const sendFrame = (type: typeof DOCUMENT_UPDATE_FRAME | typeof STATE_VECTOR_FRAME, payload: Uint8Array) =>
    send(encodeCollaborationFrame(type, payload));
  const clearPending = () => {
    clearTimeout(batchTimer);
    batchTimer = undefined;
    pending = [];
    pendingBytes = 0;
  };
  const flush = () => {
    clearTimeout(batchTimer);
    batchTimer = undefined;
    if (!pending.length || !synced) return;
    sendFrame(DOCUMENT_UPDATE_FRAME, Y.mergeUpdates(pending));
    clearPending();
    emitProfile();
  };
  const onUpdate = (update: Uint8Array, updateOrigin: unknown) => {
    if (updateOrigin === origin || destroyed || !synced) return;
    pending.push(update);
    pendingBytes += update.byteLength;
    if (pendingBytes >= MAX_BATCH_BYTES) flush();
    // Fixed window: continuous edits cannot postpone a batch indefinitely.
    else batchTimer ??= setTimeout(flush, BATCH_MS);
  };
  const presence = () => send(JSON.stringify({ type: "presence", name: userName.slice(0, 100), synced, selection }));
  const connect = () => {
    if (destroyed || stopped) return;
    const current = new WebSocket(
      `${serviceUrl.replace(/^http/, "ws")}/api/rooms/${encodeURIComponent(roomCode)}/sync`,
      cloudflareWebSocketProtocols(accessToken),
    );
    socket = current;
    current.binaryType = "arraybuffer";
    current.onopen = () => {
      if (socket !== current || destroyed) return;
      lastReceived = Date.now();
      presence();
      emitProfile();
    };
    current.onmessage = ({ data }: MessageEvent) => {
      if (socket !== current || destroyed || stopped) return;
      lastReceived = Date.now();
      profile = {
        ...profile,
        bytesReceived: profile.bytesReceived + (typeof data === "string" ? new TextEncoder().encode(data).byteLength : data.byteLength),
        messagesReceived: profile.messagesReceived + 1,
      };
      try {
        if (typeof data === "string") {
          if (data === "pong") {
            profile = { ...profile, roundTripTimeMs: pingAt === null ? null : Date.now() - pingAt };
            pingAt = null;
          } else {
            const message = JSON.parse(data);
            if (message.type === "members" && Array.isArray(message.peers)) {
              peers = message.peers.filter((peer: PeerInfo) => peer.id !== message.selfId);
              onPresenceMessage({ type: "network-peers", peers });
            } else if (message.type === "sync-complete") {
              synced = true;
              hasSynced = true;
              retry = 0;
              onPresenceMessage({ type: "collaboration-ready" });
              // Include edits made between our vector request and its response.
              sendFrame(DOCUMENT_UPDATE_FRAME, Y.encodeStateAsUpdate(doc, new Uint8Array(message.stateVector)));
              presence();
              listeners.get("synced")?.forEach((callback) => callback(true));
            } else if (message.type === "persistence-error") {
              error("errorPersistence");
            } else if (message.type === "durable") {
              onPresenceMessage({ type: "collaboration-ready" });
            }
          }
        } else {
          const frame = decodeCollaborationFrame(data);
          if (frame.type === STATE_VECTOR_FRAME) {
            sendFrame(DOCUMENT_UPDATE_FRAME, Y.encodeStateAsUpdate(doc, frame.payload));
            sendFrame(STATE_VECTOR_FRAME, Y.encodeStateVector(doc));
          } else if (frame.type === DOCUMENT_UPDATE_FRAME) {
            Y.applyUpdate(doc, frame.payload, origin);
          }
        }
      } catch {
        stopped = true;
        error("errorConnection");
        current.close(4007, "Invalid server message");
      }
      emitProfile();
    };
    current.onerror = () => { /* onclose owns retry and terminal error reporting. */ };
    current.onclose = ({ code }: CloseEvent) => {
      if (socket !== current || destroyed) return;
      synced = false;
      clearPending();
      peers = [];
      onPresenceMessage({ type: "network-peers", peers });
      emitProfile();
      if ([1003, 1007, 1008, 1009].includes(code)) {
        stopped = true;
        error(code === 1009 ? "errorCapacity" : "errorConnection");
      }
      if (stopped) return;
      // Failed HTTP upgrades have no close status in browsers. Bound attempts
      // so an invalid capability doesn't retry forever; offline rooms keep retrying.
      if (++retry >= 8 && !hasSynced && globalThis.navigator?.onLine !== false) {
        stopped = true;
        error("errorConnection");
        return;
      }
      reconnectTimer = setTimeout(connect, Math.min(500 * 2 ** Math.min(retry - 1, 4), 8_000));
    };
  };
  const heartbeat = setInterval(() => {
    if (socket?.readyState !== WebSocket.OPEN) return;
    if (Date.now() - lastReceived > HEARTBEAT_MS * 3) {
      socket.close(4000, "Heartbeat timeout");
      return;
    }
    pingAt = Date.now();
    send("ping");
    emitProfile();
  }, HEARTBEAT_MS);
  const onHidden = () => { if (globalThis.document?.visibilityState === "hidden") flush(); };
  const onOnline = () => {
    if (!destroyed && !stopped && socket?.readyState === WebSocket.CLOSED) {
      clearTimeout(reconnectTimer);
      connect();
    }
  };
  doc.on("update", onUpdate);
  globalThis.document?.addEventListener("visibilitychange", onHidden);
  globalThis.addEventListener?.("pagehide", flush);
  globalThis.addEventListener?.("online", onOnline);
  connect();
  return {
    setSelection(next) {
      if (destroyed || (selection?.beatUuid === next?.beatUuid
        && selection?.string === next?.string
        && selection?.renderedStave === next?.renderedStave)) return;
      selection = next ? { ...next } : null;
      presence();
    },
    on(event, callback) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(callback);
    },
    ownsOrigin: (candidate) => candidate === origin,
    flush,
    destroy() {
      if (destroyed) return;
      flush();
      destroyed = true;
      clearPending();
      clearTimeout(reconnectTimer);
      clearInterval(heartbeat);
      doc.off("update", onUpdate);
      globalThis.document?.removeEventListener("visibilitychange", onHidden);
      globalThis.removeEventListener?.("pagehide", flush);
      globalThis.removeEventListener?.("online", onOnline);
      socket?.close(1000, "Leaving room");
      listeners.clear();
    },
  };
}
