import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { createWebCollaborationAdapter, parseRoomInvitation } from "../collaboration";
import { createRoomProvider } from "../room-provider";
import { decodeCollaborationFrame, encodeCollaborationFrame, DOCUMENT_UPDATE_FRAME, STATE_VECTOR_FRAME } from "../cloudflare-protocol";

const code = "Abcdef234567";
const accessToken = "a".repeat(43);
const invitation = `${code}.${accessToken}`;
const providers: ReturnType<typeof createRoomProvider>[] = [];
const docs: Y.Doc[] = [];
const doc = () => { const value = new Y.Doc(); docs.push(value); return value; };

class Socket {
  static OPEN = 1;
  static CLOSED = 3;
  static instances: Socket[] = [];
  readyState = 0;
  bufferedAmount = 0;
  binaryType = "";
  sent: (string | Uint8Array)[] = [];
  onopen?: () => void;
  onmessage?: (event: { data: ArrayBuffer | string }) => void;
  onclose?: (event: { code: number }) => void;
  constructor(readonly url: string, readonly protocols: string[]) { Socket.instances.push(this); }
  open() { this.readyState = 1; this.onopen?.(); }
  send(value: string | Uint8Array) { this.sent.push(value); }
  close(code = 1000) {
    if (code !== 1000 && (code < 3000 || code > 4999)) throw new Error("Invalid browser close code");
    this.readyState = 3;
    this.onclose?.({ code });
  }
  control(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }); }
  frame(type: 0 | 2, payload: Uint8Array) {
    this.onmessage?.({ data: encodeCollaborationFrame(type, payload).buffer as ArrayBuffer });
  }
  updates() {
    return this.sent.filter((value): value is Uint8Array => typeof value !== "string" && value[0] === DOCUMENT_UPDATE_FRAME);
  }
}
function setup() {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  const document = doc();
  const presence = vi.fn();
  const provider = createRoomProvider({ doc: document, userName: "Ada", roomCode: code, accessToken, serviceUrl: "http://room.test", onPresenceMessage: presence });
  providers.push(provider);
  return { document, presence, provider, socket: Socket.instances.at(-1)! };
}
function sync(socket: Socket, server: Y.Doc) {
  socket.open();
  socket.frame(STATE_VECTOR_FRAME, Y.encodeStateVector(server));
  for (const packet of socket.updates()) Y.applyUpdate(server, decodeCollaborationFrame(packet.buffer as ArrayBuffer).payload);
  socket.frame(DOCUMENT_UPDATE_FRAME, Y.encodeStateAsUpdate(server));
  socket.control({ type: "sync-complete", stateVector: [...Y.encodeStateVector(server)] });
  socket.sent = [];
}
afterEach(() => {
  providers.splice(0).forEach((provider) => provider.destroy());
  docs.splice(0).forEach((document) => document.destroy());
  Socket.instances = [];
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Worker room invitations", () => {
  it("keeps capabilities out of room IDs, HTTP URLs, and IndexedDB keys", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code, accessToken }) });
    vi.stubGlobal("fetch", fetchMock);
    const keys: string[] = [];
    class Persistence {
      constructor(id: string) { keys.push(id); }
      on() {}
      destroy() {}
    }
    const adapter = createWebCollaborationAdapter({ serviceUrl: "https://room.test/", persistence: Persistence });
    expect(await adapter.createRoom!()).toBe(code);
    expect(adapter.getRoomInvitation!(code)).toBe(invitation);
    expect(adapter.resolveRoomCode!(invitation)).toBe(code);
    await adapter.roomExists!(code);
    adapter.createPersistence!(code, doc());
    expect(keys).toEqual([`cotab:https://room.test:${code}`]);
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(accessToken);
    expect(() => parseRoomInvitation(code)).toThrow("invitation");
    expect(() => parseRoomInvitation(`${code}.${accessToken}!`)).toThrow("invitation");
  });
});

describe("Worker browser provider", () => {
  it("repairs both directions including edits made during handshake and marks network origins", () => {
    const { document, provider, socket } = setup();
    const server = doc();
    document.getMap("score").set("local", 1);
    server.getMap("score").set("remote", 2);
    socket.open();
    socket.frame(STATE_VECTOR_FRAME, Y.encodeStateVector(server));
    Y.applyUpdate(server, socket.updates()[0].slice(1));
    document.getMap("score").set("during-handshake", 3);
    const origins: unknown[] = [];
    document.on("update", (_update, origin) => origins.push(origin));
    socket.frame(DOCUMENT_UPDATE_FRAME, Y.encodeStateAsUpdate(server));
    socket.control({ type: "sync-complete", stateVector: [...Y.encodeStateVector(server)] });
    Y.applyUpdate(server, socket.updates().at(-1)!.slice(1));
    expect(server.getMap("score").toJSON()).toEqual(document.getMap("score").toJSON());
    expect(server.getMap("score").get("during-handshake")).toBe(3);
    expect(origins.every((origin) => provider.ownsOrigin!(origin))).toBe(true);
    expect(socket.url).not.toContain(accessToken);
    expect(socket.protocols).toContain(`cotab-auth.${accessToken}`);
  });

  it("batches continuous edits with a fixed deadline and flushes on leave", () => {
    const { document, provider, socket } = setup();
    sync(socket, doc());
    for (let i = 0; i < 5; i++) {
      document.getMap("score").set(`key${i}`, i);
      vi.advanceTimersByTime(40);
    }
    expect(socket.updates()).toHaveLength(1);
    provider.destroy();
    expect(socket.updates()).toHaveLength(2);
    const receiver = doc();
    socket.updates().forEach((packet) => Y.applyUpdate(receiver, packet.slice(1)));
    expect(receiver.getMap("score").toJSON()).toEqual(document.getMap("score").toJSON());
    vi.advanceTimersByTime(60_000);
    expect(Socket.instances).toHaveLength(1);
  });

  it("recovers offline edits on reconnect without a growing update queue", () => {
    const { document, socket, presence } = setup();
    const server = doc();
    sync(socket, server);
    socket.close();
    document.getMap("score").set("offline", 42);
    server.getMap("score").set("other-peer", 7);
    vi.advanceTimersByTime(500);
    const next = Socket.instances.at(-1)!;
    expect(next).not.toBe(socket);
    sync(next, server);
    expect(document.getMap("score").toJSON()).toEqual({ offline: 42, "other-peer": 7 });
    expect(server.getMap("score").get("offline")).toBe(42);
    next.control({ type: "members", selfId: "me", peers: [
      { id: "me", name: "Ada", kind: "human", status: "synced" },
      { id: "peer", name: "Bob", kind: "human", status: "synced" },
    ] });
    expect(presence).toHaveBeenCalledWith({ type: "network-peers", peers: [{ id: "peer", name: "Bob", kind: "human", status: "synced" }] });
    next.close();
    expect(presence).toHaveBeenCalledWith({ type: "network-peers", peers: [] });
  });

  it("sends handshake control frames while a large initial score is buffered", () => {
    const { document, socket, presence } = setup();
    document.getMap("score").set("large", "x".repeat(2_000_000));
    vi.spyOn(socket, "send").mockImplementation((value) => {
      socket.sent.push(value);
      socket.bufferedAmount += typeof value === "string" ? value.length : value.byteLength;
    });
    const server = doc();
    sync(socket, server);
    expect(socket.readyState).toBe(Socket.OPEN);
    expect(server.getMap("score").get("large")).toHaveLength(2_000_000);
    expect(presence).toHaveBeenCalledWith({ type: "collaboration-ready" });
    expect(Socket.instances).toHaveLength(1);
  });

  it("recovers from backpressure through a fresh state-vector exchange", () => {
    const { document, socket } = setup();
    const server = doc();
    sync(socket, server);
    socket.bufferedAmount = 16 * 1024 * 1024;
    document.getMap("score").set("backpressure", true);
    vi.advanceTimersByTime(150);
    expect(socket.readyState).toBe(Socket.CLOSED);
    vi.advanceTimersByTime(500);
    sync(Socket.instances.at(-1)!, server);
    expect(server.getMap("score").get("backpressure")).toBe(true);
  });

  it("does not echo remote updates, and sends late IndexedDB recovery updates", () => {
    const { document, socket } = setup();
    const server = doc();
    sync(socket, server);
    server.getMap("score").set("remote", true);
    socket.frame(DOCUMENT_UPDATE_FRAME, Y.encodeStateAsUpdate(server));
    vi.advanceTimersByTime(200);
    expect(socket.updates()).toHaveLength(0);
    const persisted = doc();
    persisted.getMap("score").set("recovered", true);
    Y.applyUpdate(document, Y.encodeStateAsUpdate(persisted), "indexeddb");
    vi.advanceTimersByTime(150);
    expect(socket.updates()).toHaveLength(1);
    Y.applyUpdate(server, socket.updates()[0].slice(1));
    expect(server.getMap("score").get("recovered")).toBe(true);
  });

  it("closes malformed server messages without throwing a browser close-code error", () => {
    const { socket, presence } = setup();
    socket.open();
    expect(() => socket.onmessage?.({ data: "not-json" })).not.toThrow();
    expect(socket.readyState).toBe(Socket.CLOSED);
    expect(presence).toHaveBeenCalledWith({ type: "collaboration-error", error: "errorConnection" });
    vi.advanceTimersByTime(60_000);
    expect(Socket.instances).toHaveLength(1);
  });

  it("stops reconnecting on rejected oversized documents and preserves local state", () => {
    const { document, socket, presence } = setup();
    sync(socket, doc());
    document.getMap("score").set("large", "x".repeat(8_400_000));
    expect(presence).toHaveBeenCalledWith({ type: "collaboration-error", error: "errorCapacity" });
    vi.advanceTimersByTime(60_000);
    expect(Socket.instances).toHaveLength(1);
    expect(document.getMap("score").get("large")).toHaveLength(8_400_000);
  });
});


it("publishes ephemeral selection once and restores it on reconnect", () => {
  const { document, provider, socket } = setup();
  sync(socket, doc());
  const before = Y.encodeStateAsUpdate(document);
  const selection = { beatUuid: "stable-beat", string: 2, renderedStave: "tablature" as const };
  provider.setSelection!(selection);
  provider.setSelection!({ renderedStave: selection.renderedStave, string: selection.string, beatUuid: selection.beatUuid });
  expect(socket.sent).toHaveLength(1);
  expect(JSON.parse(socket.sent[0] as string)).toMatchObject({ type: "presence", selection });
  expect(Y.encodeStateAsUpdate(document)).toEqual(before);
  socket.close(4000);
  vi.advanceTimersByTime(500);
  const reconnected = Socket.instances.at(-1)!;
  reconnected.open();
  expect(JSON.parse(reconnected.sent[0] as string).selection).toEqual(selection);
  provider.setSelection!(null);
  expect(JSON.parse(reconnected.sent.at(-1) as string).selection).toBeNull();
});
