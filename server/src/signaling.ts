import type { WebSocket } from "ws";
import type { PublishMessage, SubscribeMessage, UnsubscribeMessage } from "./types.js";
import { getPeerByConn } from "./rooms.js";

/**
 * y-webrtc compatible signaling handlers.
 *
 * These mirror the behavior of the built-in y-webrtc signaling server:
 * - subscribe: register the peer for topics and announce to existing subscribers
 * - unsubscribe: remove the peer from topics
 * - publish: relay a message to all other subscribers of the topic
 * - ping/pong: keepalive
 */

/** topic → Set of WebSocket connections subscribed to it */
const topicSubscribers = new Map<string, Set<WebSocket>>();

function send(conn: WebSocket, data: Record<string, unknown>): void {
  if (conn.readyState === conn.OPEN) {
    conn.send(JSON.stringify(data));
  }
}

export function handleSubscribe(
  conn: WebSocket,
  msg: SubscribeMessage
): void {
  const peer = getPeerByConn(conn);
  if (!peer) return;

  for (const topic of msg.topics) {
    // Track in global topic map
    let subs = topicSubscribers.get(topic);
    if (!subs) {
      subs = new Set();
      topicSubscribers.set(topic, subs);
    }
    subs.add(conn);

    // Track on the peer
    peer.subscribedTopics.add(topic);
  }
}

export function handleUnsubscribe(
  conn: WebSocket,
  msg: UnsubscribeMessage
): void {
  const peer = getPeerByConn(conn);
  if (!peer) return;

  for (const topic of msg.topics) {
    const subs = topicSubscribers.get(topic);
    if (subs) {
      subs.delete(conn);
      if (subs.size === 0) {
        topicSubscribers.delete(topic);
      }
    }
    peer.subscribedTopics.delete(topic);
  }
}

export function handlePublish(
  conn: WebSocket,
  msg: PublishMessage
): void {
  const subs = topicSubscribers.get(msg.topic);
  if (!subs) return;

  // Relay to all subscribers except the sender, include subscriber count
  const payload = { ...msg, clients: subs.size };

  for (const subscriber of subs) {
    if (subscriber !== conn) {
      send(subscriber, payload);
    }
  }
}

export function handlePing(conn: WebSocket): void {
  send(conn, { type: "pong" });
}

/**
 * Clean up all topic subscriptions for a disconnected peer.
 */
export function cleanupSubscriptions(conn: WebSocket): void {
  const peer = getPeerByConn(conn);
  if (!peer) return;

  for (const topic of peer.subscribedTopics) {
    const subs = topicSubscribers.get(topic);
    if (subs) {
      subs.delete(conn);
      if (subs.size === 0) {
        topicSubscribers.delete(topic);
      }
    }
  }
  peer.subscribedTopics.clear();
}
