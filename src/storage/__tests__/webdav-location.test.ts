import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  finishWebDavLocation,
  removeWebDavProfile,
  resetWebDavLocationForTests,
  selectWebDavLocation,
  useWebDavLocation,
} from "../webdav-location";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("WebDAV locations", () => {
  beforeEach(() => {
    resetWebDavLocationForTests();
    vi.stubGlobal("localStorage", new MemoryStorage());
  });

  it("persists named server profiles without passwords", async () => {
    const selection = selectWebDavLocation("save", "song.cotab");
    finishWebDavLocation({
      config: {
        id: "alice-cloud",
        name: "Alice cloud",
        baseUrl: "https://dav.example.test/files/alice/",
        username: "alice",
        password: "runtime-only",
      },
      path: "Scores/song.cotab",
    });
    await expect(selection).resolves.toMatchObject({
      config: { id: "alice-cloud" },
    });

    const persisted = localStorage.getItem("cotab:webdav-profiles-v1");
    expect(JSON.parse(persisted ?? "null")).toEqual([{
      id: "alice-cloud",
      name: "Alice cloud",
      baseUrl: "https://dav.example.test/files/alice/",
      username: "alice",
    }]);
    expect(persisted).not.toContain("runtime-only");

    resetWebDavLocationForTests();
    const reopened = selectWebDavLocation("open");
    expect(useWebDavLocation.getState().request?.initialConfig).toEqual({
      id: "alice-cloud",
      name: "Alice cloud",
      baseUrl: "https://dav.example.test/files/alice/",
      username: "alice",
      password: "",
    });
    finishWebDavLocation(null);
    await expect(reopened).resolves.toBeNull();
  });

  it("migrates the legacy single-server preference", async () => {
    localStorage.setItem("cotab:webdav-config-v1", JSON.stringify({
      baseUrl: "https://legacy.example.test/dav/",
      username: "legacy-user",
    }));

    const selection = selectWebDavLocation("open");
    expect(useWebDavLocation.getState().request?.initialConfig).toMatchObject({
      name: "legacy.example.test",
      baseUrl: "https://legacy.example.test/dav/",
      username: "legacy-user",
      password: "",
    });
    expect(localStorage.getItem("cotab:webdav-config-v1")).toBeNull();
    expect(localStorage.getItem("cotab:webdav-profiles-v1"))
      .toContain("legacy.example.test");
    finishWebDavLocation(null);
    await expect(selection).resolves.toBeNull();
  });

  it("removes a saved profile without breaking the active binding", async () => {
    const selection = selectWebDavLocation("save");
    finishWebDavLocation({
      config: {
        id: "remove-me",
        name: "Temporary",
        baseUrl: "https://dav.example.test/",
        username: "alice",
        password: "secret",
      },
      path: "song.cotab",
    });
    await selection;

    removeWebDavProfile("remove-me");
    expect(useWebDavLocation.getState().profiles).toEqual([]);
    expect(localStorage.getItem("cotab:webdav-profiles-v1")).toBe("[]");

    const reopened = selectWebDavLocation("open");
    expect(useWebDavLocation.getState().request?.initialConfig).toMatchObject({
      name: "",
      baseUrl: "",
      password: "",
    });
    finishWebDavLocation(null);
    await reopened;
  });
});
