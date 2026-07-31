import { describe, expect, it, vi } from "vitest";

import { WebDavStorageProvider } from "../webdav-provider";
import type {
  WebDavConnectionConfig,
  WebDavLocation,
} from "../webdav-location";

const config: WebDavConnectionConfig = {
  baseUrl: "https://dav.example.test/files/alice/",
  username: "alice",
  password: "secret",
};

function location(path: string): WebDavLocation {
  return { config, path };
}

describe("WebDavStorageProvider", () => {
  it("creates a new document with If-None-Match and keeps the returned ETag", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, {
        status: 201,
        headers: { ETag: '"revision-1"' },
      }));
    const provider = new WebDavStorageProvider({
      fetch: request,
      pickLocation: async () => location("Scores/song.cotab"),
      getConfig: () => config,
    });

    const target = await provider.pickSave("song.cotab");
    expect(target).toEqual({
      locator: "https://dav.example.test/files/alice/Scores/song.cotab",
      displayName: "song.cotab",
      revision: null,
    });

    expect(await provider.write(
      target!.locator,
      Uint8Array.from([1, 2, 3]),
      target!.revision,
    )).toEqual({
      kind: "saved",
      revision: '"revision-1"',
    });

    const headHeaders = new Headers(request.mock.calls[0][1]?.headers);
    const putHeaders = new Headers(request.mock.calls[1][1]?.headers);
    expect(request.mock.calls[0][1]?.method).toBe("HEAD");
    expect(request.mock.calls[1][1]?.method).toBe("PUT");
    expect(putHeaders.get("if-none-match")).toBe("*");
    expect(putHeaders.get("if-match")).toBeNull();
    expect(headHeaders.get("authorization")).toMatch(/^Basic /);
  });

  it("turns a failed If-Match update into a conflict with current content", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 412 }))
      .mockResolvedValueOnce(new Response(Uint8Array.from([9, 8, 7]), {
        status: 200,
        headers: { ETag: '"revision-2"' },
      }));
    const provider = new WebDavStorageProvider({
      fetch: request,
      getConfig: () => config,
    });
    const locator =
      "https://dav.example.test/files/alice/Scores/song.cotab";

    expect(await provider.write(
      locator,
      Uint8Array.from([1, 2, 3]),
      '"revision-1"',
    )).toEqual({
      kind: "conflict",
      current: {
        locator,
        displayName: "song.cotab",
        revision: '"revision-2"',
        data: Uint8Array.from([9, 8, 7]),
      },
    });

    const putHeaders = new Headers(request.mock.calls[0][1]?.headers);
    expect(putHeaders.get("if-match")).toBe('"revision-1"');
    expect(request.mock.calls[1][1]?.method).toBe("GET");
  });

  it("rejects responses without an ETag instead of weakening conflict detection", async () => {
    const provider = new WebDavStorageProvider({
      fetch: async () => new Response(Uint8Array.from([1]), { status: 200 }),
      pickLocation: async () => location("song.cotab"),
      getConfig: () => config,
    });

    await expect(provider.pickOpen()).rejects.toThrow(
      "WebDAV server did not expose an ETag",
    );
  });

  it("does not send current credentials to a binding outside its server root", async () => {
    const request = vi.fn();
    const provider = new WebDavStorageProvider({
      fetch: request,
      getConfig: () => config,
    });

    await expect(provider.read(
      "https://other.example.test/files/alice/song.cotab",
    )).rejects.toThrow("does not belong to the configured server");
    expect(request).not.toHaveBeenCalled();
  });

  it("does not send credentials to a picked path outside the configured root", async () => {
    const request = vi.fn();
    const provider = new WebDavStorageProvider({
      fetch: request,
      pickLocation: async () => location("https://other.example.test/song.cotab"),
      getConfig: () => config,
    });

    await expect(provider.pickSave("song.cotab")).rejects.toThrow(
      "must stay within the configured server root",
    );
    expect(request).not.toHaveBeenCalled();
  });
});
