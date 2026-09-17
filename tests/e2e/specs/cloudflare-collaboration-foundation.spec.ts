import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as Y from "yjs";
import {
  BrowserRoomPeer,
  createTestRoom,
  roomServiceUrl,
} from "../helpers/cloudflare-room";
import {
  AWARENESS_FRAME,
  DOCUMENT_UPDATE_FRAME,
  STATE_VECTOR_FRAME,
} from "../../../src/adapters/web/cloudflare-protocol";

const run = promisify(execFile);

test.beforeEach(async ({ page }) => { await page.goto("/__ui-harness"); });

test("Cloudflare rooms reject unauthorized capabilities and origins", async ({ page, request }) => {
  const rejected = await request.post(`${roomServiceUrl}/api/rooms`, {
    headers: { Origin: "https://untrusted.example" },
  });
  expect(rejected.status()).toBe(403);
  const room = await createTestRoom(request);
  expect(room.code).toMatch(/^[A-Za-z0-9]{12}$/);
  expect(room.protocol).toBe("cotab-yjs-v1");
  const peer = new BrowserRoomPeer(page, "invalid");
  await expect(peer.open({ ...room, accessToken: "B".repeat(43) })).rejects.toThrow("Room connection rejected");
  const metadata = await request.get(`${roomServiceUrl}/api/rooms/${room.code}`);
  expect(await metadata.json()).toMatchObject({ exists: true });
});

test("state-vector exchange merges concurrent edits and isolates rooms", async ({ page, request }) => {
  const room = await createTestRoom(request);
  const alice = new BrowserRoomPeer(page, "alice");
  const bob = new BrowserRoomPeer(page, "bob");
  alice.doc.getMap("score").set("title", "Band rehearsal");
  bob.doc.getMap("score").set("artist", "CoTab");
  await alice.open(room);
  await bob.open(room);
  await Promise.all([alice.sync(), bob.sync()]);
  for (const peer of [alice, bob]) {
    await expect.poll(() => peer.readDocument()).toEqual({ title: "Band rehearsal", artist: "CoTab" });
  }
  // A fully synchronized vector returns no new structs, not a full snapshot.
  const before = (await alice.messages()).length;
  await alice.send(STATE_VECTOR_FRAME, Y.encodeStateVector(alice.doc));
  await expect.poll(async () => (await alice.messages()).slice(before)).toContainEqual([0, 0, 0]);

  const isolated = new BrowserRoomPeer(page, "isolated");
  await isolated.open(await createTestRoom(request));
  await isolated.sync();
  expect(await isolated.readDocument()).toEqual({});
  await Promise.all([alice.close(), bob.close(), isolated.close()]);
});

test("chunked document survives runtime restart without persisting awareness", async ({ page, request }) => {
  const room = await createTestRoom(request);
  const peer = new BrowserRoomPeer(page, "writer");
  const payload = "score-data-".repeat(25_000);
  peer.doc.getMap("score").set("title", "Durable score");
  peer.doc.getMap("score").set("payload", payload);
  expect(Y.encodeStateAsUpdate(peer.doc).byteLength).toBeGreaterThan(128 * 1024);
  await peer.open(room);
  await peer.sync();
  await peer.send(AWARENESS_FRAME, new TextEncoder().encode("ephemeral-name"));
  await peer.waitDurable();
  await peer.close();

  // Restart the actual Workers runtime against the same Docker storage volume.
  await run("docker", ["compose", "restart", "collaboration"], { timeout: 45_000 });
  await expect.poll(async () => {
    try { return (await request.get(roomServiceUrl)).ok(); } catch { return false; }
  }, { timeout: 30_000 }).toBe(true);

  const recovered = new BrowserRoomPeer(page, "reader");
  await recovered.open(room);
  await recovered.sync();
  expect(await recovered.readDocument()).toEqual({ title: "Durable score", payload });
  expect((await recovered.messages()).some((message) => (
    Array.isArray(message) && message[0] === AWARENESS_FRAME
  ))).toBe(false);
  await recovered.close();
});

test("reconnect repairs server state from an offline document", async ({ page, request }) => {
  const room = await createTestRoom(request);
  const initial = new BrowserRoomPeer(page, "initial");
  await initial.open(room);
  await initial.sync();
  await initial.close();
  const offline = new BrowserRoomPeer(page, "offline");
  offline.doc.getMap("score").set("offlineEdit", "Recovered from local Y.Doc");
  await offline.open(room);
  await offline.sync();
  const observer = new BrowserRoomPeer(page, "observer");
  await observer.open(room);
  await observer.sync();
  expect(await observer.readDocument()).toEqual({ offlineEdit: "Recovered from local Y.Doc" });
  await Promise.all([offline.close(), observer.close()]);
});

test("invalid and over-capacity updates cannot poison accepted room state", async ({ page, request }) => {
  const room = await createTestRoom(request);
  const writer = new BrowserRoomPeer(page, "writer");
  writer.doc.getMap("score").set("title", "Keep me");
  await writer.open(room);
  await writer.sync();
  await writer.waitDurable();
  const observer = new BrowserRoomPeer(page, "observer");
  await observer.open(room);
  await observer.sync();

  const invalid = new BrowserRoomPeer(page, "invalid-update");
  await invalid.open(room);
  await invalid.send(DOCUMENT_UPDATE_FRAME, new Uint8Array([255]));
  await expect.poll(() => invalid.closeCode()).toBe(1007);

  const baseline = Y.encodeStateVector(writer.doc);
  writer.doc.getMap("score").set("payload", "x".repeat(1_010_000));
  await writer.send(DOCUMENT_UPDATE_FRAME, Y.encodeStateAsUpdate(writer.doc, baseline));
  await expect.poll(() => writer.closeCode()).toBe(1009);
  const fresh = new BrowserRoomPeer(page, "fresh");
  await fresh.open(room);
  await fresh.sync();
  expect(await fresh.readDocument()).toEqual({ title: "Keep me" });
  expect(await observer.readDocument()).toEqual({ title: "Keep me" });
  await Promise.all([observer.close(), fresh.close()]);
});

test("continuous editing persists before the maximum dirty interval elapses", async ({ page, request }) => {
  const peer = new BrowserRoomPeer(page, "continuous");
  await peer.open(await createTestRoom(request));
  await peer.sync();
  const started = Date.now();
  let edits = 0;
  let durable = false;
  while (Date.now() - started < 13_000) {
    const vector = Y.encodeStateVector(peer.doc);
    peer.doc.getMap("score").set("beat", edits++);
    await peer.send(DOCUMENT_UPDATE_FRAME, Y.encodeStateAsUpdate(peer.doc, vector));
    durable = (await peer.messages()).some((message) => (
      typeof message === "string" && JSON.parse(message).type === "durable"
    ));
    if (durable) break;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  expect(edits).toBeGreaterThan(20);
  expect(durable).toBe(true);
  await peer.close();
});
