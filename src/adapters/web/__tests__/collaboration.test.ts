import { describe, expect, it } from "vitest";

import { parseIceServers } from "../collaboration";

describe("web collaboration ICE configuration", () => {
  it("accepts browser RTCIceServer JSON", () => {
    expect(parseIceServers(JSON.stringify([
      { urls: "stun:stun.example.test:3478" },
      {
        urls: ["turn:turn.example.test:3478?transport=udp"],
        username: "cotab",
        credential: "secret",
      },
    ]))).toEqual([
      { urls: "stun:stun.example.test:3478" },
      {
        urls: ["turn:turn.example.test:3478?transport=udp"],
        username: "cotab",
        credential: "secret",
      },
    ]);
  });

  it("rejects malformed or untyped server entries", () => {
    expect(() => parseIceServers("not-json")).toThrow("valid JSON");
    expect(() => parseIceServers(JSON.stringify({ urls: "stun:test" }))).toThrow("JSON array");
    expect(() => parseIceServers(JSON.stringify([{ urls: [] }]))).toThrow("string urls");
    expect(() => parseIceServers(JSON.stringify([{ urls: "turn:test", credential: 42 }]))).toThrow(
      "credential",
    );
  });
});
