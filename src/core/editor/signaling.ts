/**
 * signaling.ts — Low-level WebRTC provider helpers.
 *
 * Types and factory functions for P2P collaboration.
 * No engine knowledge - called by EditorEngine methods.
 */

import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Persistence adapter interface for dependency injection.
 * Allows different persistence backends (IndexedDB for browser, LevelDB for CLI).
 */
export interface PersistenceAdapter {
  new(id: string, doc: Y.Doc): {
    on: (event: string, callback: () => void) => void;
    destroy: () => void;
  };
}

/**
 * Configuration for signaling connection.
 * Must be provided by the caller (e.g., from browser or CLI environment).
 */
export interface SignalingConfig {
  /** Base URL for signaling server (HTTP, will be converted to WS) */
  signalingUrl: string;
  /** Optional persistence adapter (null for in-memory only) */
  persistence?: PersistenceAdapter | null;
}

export interface PeerInfo {
  id: string;
  name: string;
}

// ─── Provider factory ─────────────────────────────────────────────────────────

/**
 * Create a WebRTC provider for a room.
 */
export function createProvider(
  roomCode: string,
  userName: string,
  doc: Y.Doc,
  config: SignalingConfig,
  onPresenceMessage?: (msg: Record<string, unknown>) => void,
): WebrtcProvider {
  const wsBase = config.signalingUrl.replace(/^http/, "ws");
  const signalingUrl = `${wsBase}?roomCode=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(userName)}`;

  const provider = new WebrtcProvider(`room:${roomCode}`, doc, {
    signaling: [signalingUrl],
  });

  if (onPresenceMessage) {
    for (const sigConn of provider.signalingConns) {
      sigConn.on("message", onPresenceMessage);
    }
  }

  return provider;
}

/**
 * Destroy a WebRTC provider.
 */
export function destroyProvider(provider: WebrtcProvider | null): void {
  if (provider) {
    provider.destroy();
  }
}

/**
 * Create a persistence instance.
 */
export function createPersistence(
  roomCode: string,
  doc: Y.Doc,
  adapter: PersistenceAdapter | null | undefined,
): { on: (event: string, callback: () => void) => void; destroy: () => void } | null {
  if (!adapter) return null;
  return new adapter(`cotab:${roomCode}`, doc);
}