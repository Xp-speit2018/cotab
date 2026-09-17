import { expect, type APIRequestContext, type Page } from "@playwright/test";
import * as Y from "yjs";
import {
  cloudflareWebSocketProtocols,
  DOCUMENT_UPDATE_FRAME,
  encodeCollaborationFrame,
  STATE_VECTOR_FRAME,
  type CollaborationFrame,
} from "../../../src/adapters/web/cloudflare-protocol";

export const roomServiceUrl = "http://127.0.0.1:8787";

export interface TestRoom {
  code: string;
  accessToken: string;
  protocol: string;
  websocketPath: string;
}

type SocketState = {
  socket: WebSocket;
  messages: Array<number[] | string>;
  closeCode: number | null;
};
type RoomTestWindow = Window & { roomTestSockets: Record<string, SocketState> };

export async function createTestRoom(request: APIRequestContext): Promise<TestRoom> {
  const response = await request.post(`${roomServiceUrl}/api/rooms`);
  expect(response.status()).toBe(201);
  return response.json();
}

/** Real browser sockets; document assertions use real Y.Doc instances. */
export class BrowserRoomPeer {
  readonly doc = new Y.Doc();

  constructor(readonly page: Page, readonly id: string) {}

  async open(room: TestRoom): Promise<void> {
    await this.page.evaluate(async ({ id, url, protocols }) => {
      const target = window as unknown as RoomTestWindow;
      target.roomTestSockets ??= {};
      const socket = new WebSocket(url, protocols);
      socket.binaryType = "arraybuffer";
      const state: SocketState = { socket, messages: [], closeCode: null };
      target.roomTestSockets[id] = state;
      socket.addEventListener("message", ({ data }) => {
        state.messages.push(typeof data === "string" ? data : [...new Uint8Array(data)]);
      });
      socket.addEventListener("close", ({ code }) => { state.closeCode = code; });
      await new Promise<void>((resolve, reject) => {
        socket.addEventListener("open", () => resolve(), { once: true });
        socket.addEventListener("error", () => reject(new Error("Room connection rejected")), { once: true });
      });
    }, {
      id: this.id,
      url: `${roomServiceUrl.replace("http", "ws")}${room.websocketPath}`,
      protocols: cloudflareWebSocketProtocols(room.accessToken),
    });
  }

  async messages(): Promise<Array<number[] | string>> {
    return this.page.evaluate((id) => (
      window as unknown as RoomTestWindow
    ).roomTestSockets[id].messages, this.id);
  }

  async send(type: CollaborationFrame["type"], payload: Uint8Array): Promise<void> {
    await this.sendRaw(encodeCollaborationFrame(type, payload));
  }

  async sendRaw(frame: Uint8Array): Promise<void> {
    await this.page.evaluate(({ id, data }) => {
      (window as unknown as RoomTestWindow).roomTestSockets[id].socket.send(new Uint8Array(data));
    }, { id: this.id, data: [...frame] });
  }

  async sync(): Promise<void> {
    await expect.poll(async () => (await this.messages()).some(
      (message) => Array.isArray(message) && message[0] === STATE_VECTOR_FRAME,
    )).toBe(true);
    const vector = (await this.messages()).find(
      (message) => Array.isArray(message) && message[0] === STATE_VECTOR_FRAME,
    ) as number[];
    await this.send(DOCUMENT_UPDATE_FRAME, Y.encodeStateAsUpdate(this.doc, new Uint8Array(vector.slice(1))));
    await this.send(STATE_VECTOR_FRAME, Y.encodeStateVector(this.doc));
    await expect.poll(async () => (await this.messages()).some(
      (message) => Array.isArray(message) && message[0] === DOCUMENT_UPDATE_FRAME,
    )).toBe(true);
    await this.readDocument();
  }

  async readDocument(): Promise<Record<string, unknown>> {
    for (const message of await this.messages()) {
      if (Array.isArray(message) && message[0] === DOCUMENT_UPDATE_FRAME) {
        Y.applyUpdate(this.doc, new Uint8Array(message.slice(1)));
      }
    }
    return this.doc.getMap("score").toJSON();
  }

  async waitDurable(): Promise<void> {
    await expect.poll(async () => (await this.messages()).some(
      (message) => typeof message === "string" && JSON.parse(message).type === "durable",
    ), { timeout: 15_000 }).toBe(true);
  }

  async closeCode(): Promise<number | null> {
    return this.page.evaluate((id) => (
      window as unknown as RoomTestWindow
    ).roomTestSockets[id].closeCode, this.id);
  }

  async close(): Promise<void> {
    await this.page.evaluate((id) => {
      (window as unknown as RoomTestWindow).roomTestSockets[id].socket.close(1000, "test complete");
    }, this.id);
    this.doc.destroy();
  }
}
