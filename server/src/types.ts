import type { WebSocket } from "ws";

// ─── Peer & Room ───────────────────────────────────────────────────────────────

export interface Peer {
  id: string;
  name: string;
  conn: WebSocket;
  subscribedTopics: Set<string>;
  alive: boolean; // heartbeat flag
}

export interface Room {
  code: string;
  topic: string; // "room:{code}" — used as y-webrtc topic
  peers: Map<string, Peer>;
  createdAt: number;
  destroyTimer: ReturnType<typeof setTimeout> | null;
}

// ─── Client → Server Messages ──────────────────────────────────────────────────

export interface AuthMessage {
  type: "auth";
  name: string;
  roomCode: string;
}

export interface SubscribeMessage {
  type: "subscribe";
  topics: string[];
}

export interface UnsubscribeMessage {
  type: "unsubscribe";
  topics: string[];
}

export interface PublishMessage {
  type: "publish";
  topic: string;
  [key: string]: unknown;
}

export interface PingMessage {
  type: "ping";
}

export type ClientMessage =
  | AuthMessage
  | SubscribeMessage
  | UnsubscribeMessage
  | PublishMessage
  | PingMessage;

// ─── Server → Client Messages ──────────────────────────────────────────────────

export interface AuthOkMessage {
  type: "auth-ok";
  roomTopic: string;
  peers: Array<{ id: string; name: string }>;
}

export interface AuthErrorMessage {
  type: "auth-error";
  reason: string;
}

export interface PeerJoinedMessage {
  type: "peer-joined";
  peerId: string;
  name: string;
}

export interface PeerLeftMessage {
  type: "peer-left";
  peerId: string;
  name: string;
}

export interface PongMessage {
  type: "pong";
}

export type ServerMessage =
  | AuthOkMessage
  | AuthErrorMessage
  | PeerJoinedMessage
  | PeerLeftMessage
  | PongMessage;
