import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BrowserLocalFileProvider,
  isBrowserLocalFileStorageAvailable,
} from "../browser-local-file-provider";

function fakeHandle(name = "song.cotab") {
  let bytes = new Uint8Array();
  let lastModified = 1;
  const handle = {
    kind: "file" as const,
    name,
    async getFile() {
      return new File([bytes], name, { lastModified });
    },
    async createWritable() {
      return {
        async write(data: Uint8Array) {
          bytes = data.slice();
        },
        async close() {
          lastModified += 1;
        },
      };
    },
    async isSameEntry(other: FileSystemHandle) {
      return other === handle;
    },
    replace(data: Uint8Array) {
      bytes = data.slice();
      lastModified += 1;
    },
  };
  return handle;
}

describe("BrowserLocalFileProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is available in browsers even when native file handles are absent", () => {
    expect(isBrowserLocalFileStorageAvailable()).toBe(false);
    vi.stubGlobal("document", {});
    expect(isBrowserLocalFileStorageAvailable()).toBe(true);
  });

  it("keeps a selected handle bound for subsequent reads and writes", async () => {
    const handle = fakeHandle();
    vi.stubGlobal("window", {
      showOpenFilePicker: vi.fn(async () => [handle]),
      showSaveFilePicker: vi.fn(async () => handle),
    });
    const provider = new BrowserLocalFileProvider();

    const target = await provider.pickSave("song.cotab");
    expect(target).toMatchObject({
      locator: "browser-file:1",
      displayName: "song.cotab",
      revision: "1:0",
    });
    await expect(provider.write(
      target!.locator,
      Uint8Array.of(1, 2, 3),
      target!.revision,
    )).resolves.toEqual({ kind: "saved", revision: "2:3" });
    await expect(provider.read(target!.locator)).resolves.toMatchObject({
      displayName: "song.cotab",
      revision: "2:3",
      data: Uint8Array.of(1, 2, 3),
    });
  });

  it("offers CoTab and Guitar Pro formats from one open picker", async () => {
    const handle = fakeHandle("song.gp");
    const showOpenFilePicker = vi.fn(async () => [handle]);
    vi.stubGlobal("window", {
      showOpenFilePicker,
      showSaveFilePicker: vi.fn(async () => handle),
    });

    const provider = new BrowserLocalFileProvider();
    await expect(provider.pickOpen()).resolves.toMatchObject({
      displayName: "song.gp",
    });

    const options = showOpenFilePicker.mock.calls[0][0];
    const extensions = Object.values(options.types?.[0]?.accept ?? {}).flat();
    expect(extensions).toEqual([
      ".cotab",
      ".gp",
      ".gp3",
      ".gp4",
      ".gp5",
      ".gpx",
    ]);
  });

  it("offers CoTab and GP7 formats from one save picker", async () => {
    const handle = fakeHandle("song.gp");
    const showSaveFilePicker = vi.fn(async () => handle);
    vi.stubGlobal("window", {
      showOpenFilePicker: vi.fn(async () => [handle]),
      showSaveFilePicker,
    });

    const provider = new BrowserLocalFileProvider();
    await expect(provider.pickSave("song.cotab")).resolves.toMatchObject({
      displayName: "song.gp",
    });

    const options = showSaveFilePicker.mock.calls[0][0];
    const extensions = Object.values(options.types?.[0]?.accept ?? {}).flat();
    expect(extensions).toEqual([".cotab", ".gp"]);
  });

  it("reports an external file change as a conflict", async () => {
    const handle = fakeHandle();
    vi.stubGlobal("window", {
      showOpenFilePicker: vi.fn(async () => [handle]),
      showSaveFilePicker: vi.fn(async () => handle),
    });
    const provider = new BrowserLocalFileProvider();
    const target = await provider.pickSave("song.cotab");
    handle.replace(Uint8Array.of(9));

    await expect(provider.write(
      target!.locator,
      Uint8Array.of(1),
      target!.revision,
    )).resolves.toMatchObject({
      kind: "conflict",
      current: { revision: "2:1", data: Uint8Array.of(9) },
    });
  });

  it("downloads explicit saves and disables auto-save without native handles", async () => {
    const click = vi.fn();
    vi.stubGlobal("document", {
      createElement: vi.fn(() => ({ href: "", download: "", click })),
    });
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:cotab"),
      revokeObjectURL: vi.fn(),
    });
    const provider = new BrowserLocalFileProvider();

    const target = await provider.pickSave("download.cotab");
    expect(target).toMatchObject({
      locator: "browser-download:1",
      displayName: "download.cotab",
      revision: null,
    });
    expect(provider.supportsAutoSave(target!.locator)).toBe(false);
    await expect(provider.write(
      target!.locator,
      Uint8Array.of(1, 2, 3),
      null,
    )).resolves.toMatchObject({ kind: "saved" });
    expect(click).toHaveBeenCalledOnce();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:cotab");
  });
});
