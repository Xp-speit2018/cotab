import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import * as server from "../../../../server/worker/protocol";

import {
  AWARENESS_FRAME,
  cloudflareWebSocketProtocols,
  COTAB_YJS_PROTOCOL,
  decodeCollaborationFrame,
  DOCUMENT_UPDATE_FRAME,
  STATE_VECTOR_FRAME,
  encodeCollaborationFrame,
} from "../cloudflare-protocol";

describe("Cloudflare collaboration wire protocol", () => {
  it("exchanges real state vectors and missing updates with the server framing", () => {
    expect(COTAB_YJS_PROTOCOL).toBe(server.COTAB_PROTOCOL);
    expect(STATE_VECTOR_FRAME).toBe(server.STATE_VECTOR_FRAME);
    expect(AWARENESS_FRAME).toBe(server.AWARENESS_FRAME);
    const local = new Y.Doc();
    const remote = new Y.Doc();
    try {
      local.getMap("score").set("title", "Local edit");
      remote.getMap("score").set("artist", "Remote edit");
      const vector = decodeCollaborationFrame(server.frame(
        server.STATE_VECTOR_FRAME, Y.encodeStateVector(remote),
      ).buffer);
      const reply = encodeCollaborationFrame(
        DOCUMENT_UPDATE_FRAME, Y.encodeStateAsUpdate(local, vector.payload),
      );
      expect(reply[0]).toBe(server.DOCUMENT_UPDATE_FRAME);
      Y.applyUpdate(remote, reply.subarray(1));
      const missing = decodeCollaborationFrame(server.frame(
        server.DOCUMENT_UPDATE_FRAME,
        Y.encodeStateAsUpdate(remote, Y.encodeStateVector(local)),
      ).buffer);
      Y.applyUpdate(local, missing.payload);
      expect(local.getMap("score").toJSON()).toEqual({ title: "Local edit", artist: "Remote edit" });
      expect(remote.getMap("score").toJSON()).toEqual(local.getMap("score").toJSON());
      expect(server.MAX_SNAPSHOT_BYTES + 1).toBeLessThanOrEqual(server.MAX_FRAME_BYTES);
    } finally {
      local.destroy();
      remote.destroy();
    }
  });

  it("keeps the capability out of the WebSocket URL", () => {
    const token = "A".repeat(43);

    expect(cloudflareWebSocketProtocols(token)).toEqual([
      COTAB_YJS_PROTOCOL,
      `cotab-auth.${token}`,
    ]);
    expect(() => cloudflareWebSocketProtocols("short")).toThrow(
      "Invalid collaboration capability token.",
    );
  });

  it.each([DOCUMENT_UPDATE_FRAME, AWARENESS_FRAME, STATE_VECTOR_FRAME] as const)(
    "round-trips frame type %s",
    (type) => {
      const encoded = encodeCollaborationFrame(type, new Uint8Array([2, 4, 8]));

      expect(decodeCollaborationFrame(encoded.buffer)).toEqual({
        type,
        payload: new Uint8Array([2, 4, 8]),
      });
    },
  );

  it("rejects incomplete and unknown frames", () => {
    expect(() => decodeCollaborationFrame(new Uint8Array([0]).buffer)).toThrow();
    expect(() => decodeCollaborationFrame(new Uint8Array([9, 1]).buffer)).toThrow();
  });
});
