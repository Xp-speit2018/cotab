import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Window } from "happy-dom";

import {
  listWebDavDirectory,
  WebDavStorageProvider,
} from "../webdav-provider";
import type { WebDavConnectionConfig } from "../webdav-location";

const baseUrl = process.env.COTAB_WEBDAV_INTEGRATION_URL;
const username = process.env.COTAB_WEBDAV_INTEGRATION_USERNAME ?? "cotab";
const password = process.env.COTAB_WEBDAV_INTEGRATION_PASSWORD ?? "cotab-dev";
const path = `cotab-integration-${Date.now()}.cotab`;

const config: WebDavConnectionConfig = {
  id: "container-test",
  name: "Container test",
  baseUrl: baseUrl ?? "http://127.0.0.1:6065/",
  username,
  password,
};

function authorization(): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

describe.skipIf(!baseUrl)("WebDAV container integration", () => {
  const provider = new WebDavStorageProvider({
    getConfig: () => config,
    pickLocation: async () => ({ config, path }),
  });
  const locator = new URL(path, config.baseUrl).href;

  beforeAll(() => {
    vi.stubGlobal("DOMParser", new Window().DOMParser);
  });

  afterAll(async () => {
    await fetch(locator, {
      method: "DELETE",
      headers: { Authorization: authorization() },
    });
    vi.unstubAllGlobals();
  });

  it("allows local browser preview origins", async () => {
    const origin = "http://localhost:4173";
    const response = await fetch(locator, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers":
          "authorization,content-type,depth,if-none-match",
      },
    });

    expect(response.ok).toBe(true);
    expect(response.headers.get("access-control-allow-origin")).toBe(origin);
    expect(response.headers.get("access-control-allow-methods")).toContain("PUT");
    expect(response.headers.get("access-control-allow-headers"))
      .toContain("If-None-Match");
    expect(response.headers.get("access-control-allow-headers"))
      .toContain("Depth");
  });

  it("creates, reads, updates, and detects a stale ETag", async () => {
    const target = await provider.pickSave(path);
    expect(target).toMatchObject({ locator, revision: null });

    const initial = Uint8Array.from([1, 2, 3]);
    const created = await provider.write(locator, initial, null);
    expect(created.kind).toBe("saved");
    if (created.kind !== "saved") throw new Error("Expected initial save");
    expect(created.revision).toBeTruthy();

    const entries = await listWebDavDirectory(config);
    expect(entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "file", path }),
    ]));

    const stored = await provider.read(locator);
    expect(stored?.data).toEqual(initial);
    expect(stored?.revision).toBe(created.revision);

    // This server's file ETag includes size and coarse modification time.
    // Change the size so a rapid external write always advances the revision.
    const external = Uint8Array.from([9, 8, 7, 6]);
    const externalWrite = await fetch(locator, {
      method: "PUT",
      headers: {
        Authorization: authorization(),
        "Content-Type": "application/octet-stream",
        "If-Match": created.revision,
      },
      body: external,
    });
    expect(externalWrite.ok).toBe(true);

    const conflict = await provider.write(
      locator,
      Uint8Array.from([4, 5, 6]),
      created.revision,
    );
    expect(conflict).toMatchObject({
      kind: "conflict",
      current: { data: external },
    });
  });
});
