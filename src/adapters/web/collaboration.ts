import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebrtcProvider } from "y-webrtc";

import type {
  CollaborationAdapter,
  CollaborationPersistence,
  CollaborationProvider,
  CollaborationTransportProfile,
  PeerInfo,
} from "@/core/engine";

const PROFILE_INTERVAL_MS = 1_000;

interface AwarenessIdentity {
  id?: unknown;
  name?: unknown;
  kind?: unknown;
}

interface DataChannelCounters {
  bytesSent: number;
  bytesReceived: number;
  messagesSent: number;
  messagesReceived: number;
}

const emptyDataChannelCounters = (): DataChannelCounters => ({
  bytesSent: 0,
  bytesReceived: 0,
  messagesSent: 0,
  messagesReceived: 0,
});

export interface PersistenceAdapter {
  new(id: string, doc: Y.Doc): CollaborationPersistence;
}

export interface WebCollaborationConfig {
  signalingUrl: string;
  persistence?: PersistenceAdapter | null;
  iceServers?: RTCIceServer[];
}

export function parseIceServers(value: string | undefined): RTCIceServer[] {
  if (!value) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("VITE_WEBRTC_ICE_SERVERS must be valid JSON.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("VITE_WEBRTC_ICE_SERVERS must be a JSON array.");
  }

  return parsed.map((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error(`ICE server at index ${index} must be an object.`);
    }
    const candidate = entry as Record<string, unknown>;
    const urls = candidate.urls;
    const validUrls = typeof urls === "string"
      || (Array.isArray(urls) && urls.length > 0 && urls.every((url) => typeof url === "string"));
    if (!validUrls) {
      throw new Error(`ICE server at index ${index} must define string urls.`);
    }
    if (candidate.username !== undefined && typeof candidate.username !== "string") {
      throw new Error(`ICE server username at index ${index} must be a string.`);
    }
    if (candidate.credential !== undefined && typeof candidate.credential !== "string") {
      throw new Error(`ICE server credential at index ${index} must be a string.`);
    }

    return {
      urls: urls as string | string[],
      ...(candidate.username === undefined ? {} : { username: candidate.username as string }),
      ...(candidate.credential === undefined ? {} : { credential: candidate.credential as string }),
    };
  });
}

function signalingEndpoint(
  config: WebCollaborationConfig,
  roomCode: string,
  userName: string,
  peerId: string,
): string {
  const wsBase = config.signalingUrl.replace(/^http/, "ws");
  return `${wsBase}?roomCode=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(userName)}&peerId=${encodeURIComponent(peerId)}`;
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
      let localPeerId: string = globalThis.crypto.randomUUID();
      const provider = new WebrtcProvider(`room:${roomCode}`, doc, {
        signaling: [signalingEndpoint(config, roomCode, userName, localPeerId)],
        ...(config.iceServers && config.iceServers.length > 0
          ? { peerOpts: { config: { iceServers: config.iceServers } } }
          : {}),
      });

      const serverPeers = new Map<string, PeerInfo>();
      const departedPeerIds = new Set<string>();
      const connectionCounters = new Map<object, DataChannelCounters>();
      const archivedCounters = emptyDataChannelCounters();
      let destroyed = false;
      let sampleInFlight = false;
      let transportProfile: CollaborationTransportProfile = {
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
      };

      const providerEvents = provider as unknown as {
        on(event: string, callback: (event: unknown) => void): void;
        off(event: string, callback: (event: unknown) => void): void;
      };

      const currentNetworkPeers = (): PeerInfo[] => {
        const peers = new Map(serverPeers);
        for (const [clientId, state] of provider.awareness.getStates()) {
          if (clientId === doc.clientID) continue;
          const identity = state.cotab as AwarenessIdentity | undefined;
          const identityId = typeof identity?.id === "string" ? identity.id : null;
          if (identityId && departedPeerIds.has(identityId)) continue;
          const id = identityId ?? `yjs:${clientId}`;
          peers.set(id, {
            id,
            name: typeof identity?.name === "string" ? identity.name : `Peer ${clientId}`,
            kind: identity?.kind === "agent" ? "agent" : "human",
            status: "synced",
          });
        }
        return [...peers.values()];
      };

      const emitNetworkPeers = () => {
        onPresenceMessage({ type: "network-peers", peers: currentNetworkPeers() });
      };

      const currentConnections = () => (
        provider.room ? [...provider.room.webrtcConns.values()] : []
      );

      const emitTransportProfile = () => {
        const connections = currentConnections();
        const broadcastChannelPeerCount = provider.room?.bcConns.size ?? 0;
        const connectedPeerCount =
          connections.filter((connection) => connection.connected).length
          + broadcastChannelPeerCount;
        const awarenessSyncedPeerCount = currentNetworkPeers()
          .filter((peer) => peer.status === "synced").length;
        transportProfile = {
          ...transportProfile,
          signalingConnected: provider.signalingConns.some((connection) => connection.connected),
          webRtcPeerCount: connections.length,
          broadcastChannelPeerCount,
          connectedPeerCount,
          syncedPeerCount: Math.min(connectedPeerCount, awarenessSyncedPeerCount),
        };
        onPresenceMessage({ type: "transport-profile", profile: transportProfile });
      };

      const sampleTransportStats = async () => {
        if (destroyed || sampleInFlight) return;
        sampleInFlight = true;
        try {
          const connections = currentConnections();
          const active = new Set<object>(connections);
          for (const [connection, counters] of connectionCounters) {
            if (active.has(connection)) continue;
            archivedCounters.bytesSent += counters.bytesSent;
            archivedCounters.bytesReceived += counters.bytesReceived;
            archivedCounters.messagesSent += counters.messagesSent;
            archivedCounters.messagesReceived += counters.messagesReceived;
            connectionCounters.delete(connection);
          }

          const roundTripTimes: number[] = [];
          await Promise.all(connections.map(async (connection) => {
            const peerConnection = connection.peer?._pc as RTCPeerConnection | undefined;
            if (!peerConnection) return;
            try {
              const report = await peerConnection.getStats();
              const counters = emptyDataChannelCounters();
              const selectedCandidatePairIds = new Set<string>();
              report.forEach((raw) => {
                const stat = raw as unknown as Record<string, unknown>;
                if (
                  stat.type === "transport"
                  && typeof stat.selectedCandidatePairId === "string"
                ) {
                  selectedCandidatePairIds.add(stat.selectedCandidatePairId);
                }
              });
              report.forEach((raw) => {
                const stat = raw as unknown as Record<string, unknown>;
                if (stat.type === "data-channel") {
                  counters.bytesSent += typeof stat.bytesSent === "number" ? stat.bytesSent : 0;
                  counters.bytesReceived += typeof stat.bytesReceived === "number" ? stat.bytesReceived : 0;
                  counters.messagesSent += typeof stat.messagesSent === "number" ? stat.messagesSent : 0;
                  counters.messagesReceived += typeof stat.messagesReceived === "number" ? stat.messagesReceived : 0;
                }
                const selectedCandidatePair = selectedCandidatePairIds.size > 0
                  ? typeof stat.id === "string" && selectedCandidatePairIds.has(stat.id)
                  : stat.nominated === true;
                if (
                  stat.type === "candidate-pair"
                  && stat.state === "succeeded"
                  && selectedCandidatePair
                  && typeof stat.currentRoundTripTime === "number"
                ) {
                  roundTripTimes.push(stat.currentRoundTripTime * 1_000);
                }
              });
              connectionCounters.set(connection, counters);
            } catch {
              // A connection may close between enumeration and getStats().
            }
          }));

          const activeCounters = [...connectionCounters.values()];
          const total = activeCounters.reduce((result, counters) => ({
            bytesSent: result.bytesSent + counters.bytesSent,
            bytesReceived: result.bytesReceived + counters.bytesReceived,
            messagesSent: result.messagesSent + counters.messagesSent,
            messagesReceived: result.messagesReceived + counters.messagesReceived,
          }), { ...archivedCounters });
          transportProfile = {
            ...transportProfile,
            ...total,
            roundTripTimeMs: roundTripTimes.length > 0
              ? roundTripTimes.reduce((sum, value) => sum + value, 0) / roundTripTimes.length
              : null,
            lastSampleAt: Date.now(),
          };
          if (!destroyed) emitTransportProfile();
        } catch {
          // The next interval retries unexpected stats collection failures.
        } finally {
          sampleInFlight = false;
        }
      };

      const handleAwarenessChange = () => {
        emitNetworkPeers();
        emitTransportProfile();
      };
      const handleProviderStateChange = () => {
        emitTransportProfile();
        void sampleTransportStats();
      };
      const handleSignalingMessage = (event: unknown) => {
        if (typeof event !== "object" || event === null) return;
        const message = event as Record<string, unknown>;
        if (message.type === "auth-ok") {
          localPeerId = typeof message.peerId === "string" ? message.peerId : localPeerId;
          serverPeers.clear();
          departedPeerIds.clear();
          if (Array.isArray(message.peers)) {
            for (const rawPeer of message.peers) {
              if (typeof rawPeer !== "object" || rawPeer === null) continue;
              const peer = rawPeer as Record<string, unknown>;
              if (typeof peer.id !== "string") continue;
              serverPeers.set(peer.id, {
                id: peer.id,
                name: typeof peer.name === "string" ? peer.name : peer.id,
                kind: "human",
                status: "connecting",
              });
            }
          }
          provider.awareness.setLocalStateField("cotab", {
            id: localPeerId,
            name: userName,
            kind: "human",
          });
          emitNetworkPeers();
          emitTransportProfile();
          return;
        }
        if (message.type === "peer-joined" && typeof message.peerId === "string") {
          departedPeerIds.delete(message.peerId);
          serverPeers.set(message.peerId, {
            id: message.peerId,
            name: typeof message.name === "string" ? message.name : message.peerId,
            kind: "human",
            status: "connecting",
          });
          emitNetworkPeers();
          return;
        }
        if (message.type === "peer-left" && typeof message.peerId === "string") {
          departedPeerIds.add(message.peerId);
          serverPeers.delete(message.peerId);
          emitNetworkPeers();
          return;
        }
        if (message.type === "auth-error") {
          onPresenceMessage({ type: "collaboration-error", error: "errorConnection" });
        }
      };

      provider.awareness.setLocalStateField("cotab", {
        id: localPeerId,
        name: userName,
        kind: "human",
      });
      provider.awareness.on("change", handleAwarenessChange);
      providerEvents.on("peers", handleProviderStateChange);
      providerEvents.on("synced", handleProviderStateChange);
      providerEvents.on("status", handleProviderStateChange);

      for (const sigConn of provider.signalingConns) {
        sigConn.on("message", handleSignalingMessage);
        sigConn.on("connect", handleProviderStateChange);
        sigConn.on("disconnect", handleProviderStateChange);
      }

      emitNetworkPeers();
      emitTransportProfile();
      const profileTimer = globalThis.setInterval(() => {
        void sampleTransportStats();
      }, PROFILE_INTERVAL_MS);

      return {
        on(event, callback) {
          providerEvents.on(event, callback);
        },
        ownsOrigin(origin) {
          return provider.room === origin;
        },
        destroy() {
          if (destroyed) return;
          destroyed = true;
          globalThis.clearInterval(profileTimer);
          provider.awareness.off("change", handleAwarenessChange);
          providerEvents.off("peers", handleProviderStateChange);
          providerEvents.off("synced", handleProviderStateChange);
          providerEvents.off("status", handleProviderStateChange);
          for (const sigConn of provider.signalingConns) {
            try {
              if (sigConn.connected) sigConn.send({ type: "leave" });
            } catch {
              // The socket may close between the connected check and send().
            }
            sigConn.off("message", handleSignalingMessage);
            sigConn.off("connect", handleProviderStateChange);
            sigConn.off("disconnect", handleProviderStateChange);
          }
          provider.disconnect();
          provider.destroy();
        },
      };
    },

    createPersistence(roomCode: string, doc: Y.Doc): CollaborationPersistence | null {
      const Adapter = config.persistence === undefined ? IndexeddbPersistence : config.persistence;
      if (!Adapter) return null;
      const persistence = new Adapter(`cotab:${roomCode}`, doc) as CollaborationPersistence;
      return {
        on(event, callback) {
          persistence.on(event, callback);
        },
        ownsOrigin(origin) {
          return persistence.ownsOrigin?.(origin) ?? origin === persistence;
        },
        destroy() {
          persistence.destroy();
        },
      };
    },
  };
}
