import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { initializeScore } from "@/core/schema";
import { createEditorStorageState } from "@/core/editor/storage";
import { FILE_IMPORT_ORIGIN } from "@/core/origins";
import { createDocumentFromCotab, encodeCotabDocument } from "../cotab-file";
import { DocumentStorageController } from "../document-storage-controller";
import { DocumentStorageProviderRegistry } from "../provider-registry";
import type {
  DocumentStorageProvider,
  DocumentStorageTarget,
  DocumentWriteResult,
  StoredDocument,
} from "../types";

interface MemoryObject {
  data: Uint8Array;
  revision: number;
}

class MemoryStorageProvider implements DocumentStorageProvider {
  readonly name: string;
  readonly objects = new Map<string, MemoryObject>();
  readonly writes: string[] = [];
  autoSaveSupported = true;
  nextOpen: string | null = null;
  nextSave: DocumentStorageTarget | null = null;

  constructor(readonly id = "memory") {
    this.name = id;
  }

  async pickOpen(): Promise<StoredDocument | null> {
    return this.nextOpen ? this.read(this.nextOpen) : null;
  }

  async pickSave(): Promise<DocumentStorageTarget | null> {
    return this.nextSave;
  }

  async read(locator: string): Promise<StoredDocument | null> {
    const object = this.objects.get(locator);
    return object
      ? {
          locator,
          displayName: locator,
          revision: String(object.revision),
          data: object.data.slice(),
        }
      : null;
  }

  async write(
    locator: string,
    data: Uint8Array,
    expectedRevision: string | null,
  ): Promise<DocumentWriteResult> {
    const current = this.objects.get(locator);
    const currentRevision = current ? String(current.revision) : null;
    if (currentRevision !== expectedRevision) {
      return {
        kind: "conflict",
        current: await this.read(locator),
      };
    }
    const revision = (current?.revision ?? 0) + 1;
    this.objects.set(locator, { data: data.slice(), revision });
    this.writes.push(locator);
    return { kind: "saved", revision: String(revision) };
  }

  target(locator: string): DocumentStorageTarget {
    const object = this.objects.get(locator);
    return {
      locator,
      displayName: locator,
      revision: object ? String(object.revision) : null,
    };
  }

  supportsAutoSave(): boolean {
    return this.autoSaveSupported;
  }
}

function createScore(title = "Score"): Y.Doc {
  const doc = new Y.Doc();
  const score = initializeScore(doc);
  score.set("title", title);
  return doc;
}

function createController(
  provider: MemoryStorageProvider | readonly MemoryStorageProvider[],
  initialDocument: Y.Doc,
): {
  controller: DocumentStorageController;
  getDocument: () => Y.Doc;
  getStorageState: () => ReturnType<typeof createEditorStorageState>;
} {
  let document = initialDocument;
  const providerList = Array.isArray(provider) ? provider : [provider];
  const providers = new DocumentStorageProviderRegistry(providerList);
  let storage = createEditorStorageState(providers.ids());
  const controller = new DocumentStorageController({
    providers,
    getDocument: () => document,
    replaceDocument: (next) => {
      document = next;
    },
    getStorageState: () => storage,
    setStorageState: (next) => {
      storage = next;
    },
    autoSaveDelayMs: 100,
    minimumSaveIntervalMs: 0,
  });
  return {
    controller,
    getDocument: () => document,
    getStorageState: () => storage,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-27T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DocumentStorageController", () => {
  it("routes Save As and later saves through the binding provider", async () => {
    const local = new MemoryStorageProvider("local");
    const cloud = new MemoryStorageProvider("cloud");
    const session = createController([local, cloud], createScore());
    cloud.nextSave = cloud.target("cloud-score.cotab");

    expect(await session.controller.saveAs("cloud")).toBe(true);
    expect(session.getStorageState().binding).toMatchObject({
      providerId: "cloud",
      locator: "cloud-score.cotab",
    });
    expect(cloud.writes).toEqual(["cloud-score.cotab"]);
    expect(local.writes).toEqual([]);

    session.getDocument().getMap("score").set("artist", "Cloud edit");
    expect(await session.controller.save()).toBe(true);
    expect(cloud.writes).toEqual([
      "cloud-score.cotab",
      "cloud-score.cotab",
    ]);
    expect(local.writes).toEqual([]);

    local.nextSave = local.target("local-copy.cotab");
    expect(await session.controller.saveAs("local")).toBe(true);
    expect(session.getStorageState().binding).toMatchObject({
      providerId: "local",
      locator: "local-copy.cotab",
    });
    expect(local.writes).toEqual(["local-copy.cotab"]);
  });

  it("requires an explicit provider when an unbound document has several", async () => {
    const local = new MemoryStorageProvider("local");
    const cloud = new MemoryStorageProvider("cloud");
    const session = createController([local, cloud], createScore());

    expect(await session.controller.save()).toBe(false);
    expect(session.getStorageState()).toMatchObject({
      status: "error",
      binding: null,
      error: "Choose a storage provider.",
    });
    expect(local.writes).toEqual([]);
    expect(cloud.writes).toEqual([]);
  });

  it("treats a file import as a new unbound clean baseline", async () => {
    const provider = new MemoryStorageProvider();
    const session = createController(provider, createScore());
    provider.nextSave = provider.target("old-binding.cotab");
    await session.controller.saveAs();
    provider.writes.length = 0;

    session.getDocument().transact(() => {
      session.getDocument().getMap("score").set("artist", "Imported");
    }, FILE_IMPORT_ORIGIN);

    expect(session.getStorageState()).toMatchObject({
      status: "unbound",
      binding: null,
      lastSavedAt: null,
    });
    expect(provider.writes).toEqual([]);
  });

  it("debounces updates and saves remote room edits to its own binding", async () => {
    const provider = new MemoryStorageProvider();
    const left = createController(provider, createScore());
    const rightDocument = createDocumentFromCotab(
      encodeCotabDocument(left.getDocument()),
    );
    const right = createController(provider, rightDocument);

    provider.nextSave = provider.target("left.cotab");
    expect(await left.controller.saveAs()).toBe(true);
    provider.nextSave = provider.target("right.cotab");
    expect(await right.controller.saveAs()).toBe(true);
    provider.writes.length = 0;

    const leftUpdate = new Promise<Uint8Array>((resolve) => {
      left.getDocument().once("update", resolve);
    });
    left.getDocument().getMap("score").set("artist", "Peer A");
    Y.applyUpdate(right.getDocument(), await leftUpdate);

    expect(left.getStorageState().status).toBe("dirty");
    expect(right.getStorageState().status).toBe("dirty");
    await vi.advanceTimersByTimeAsync(99);
    expect(provider.writes).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);

    expect(provider.writes.sort()).toEqual(["left.cotab", "right.cotab"]);
    for (const locator of provider.writes) {
      const stored = await provider.read(locator);
      const restored = createDocumentFromCotab(stored!.data);
      expect(restored.getMap("score").get("artist")).toBe("Peer A");
    }
  });

  it("marks an unbound room participant dirty without writing", async () => {
    const provider = new MemoryStorageProvider();
    const { getDocument, getStorageState } = createController(
      provider,
      createScore(),
    );

    getDocument().getMap("score").set("artist", "No cloud binding");
    await vi.runAllTimersAsync();

    expect(getStorageState().status).toBe("dirty");
    expect(provider.writes).toEqual([]);
  });

  it("detects a shared-file revision conflict and merges both Yjs branches", async () => {
    const provider = new MemoryStorageProvider();
    const original = createScore("Original");
    provider.nextSave = provider.target("shared.cotab");
    const seed = createController(provider, original);
    await seed.controller.saveAs();

    const stored = await provider.read("shared.cotab");
    const left = createController(provider, createScore());
    const right = createController(provider, createScore());
    await left.controller.openStoredDocument(provider.id, stored!);
    await right.controller.openStoredDocument(provider.id, stored!);

    left.getDocument().getMap("score").set("artist", "Left");
    right.getDocument().getMap("score").set("album", "Right");
    expect(await left.controller.save()).toBe(true);
    expect(await right.controller.save()).toBe(false);
    expect(right.getStorageState().status).toBe("conflict");

    expect(await right.controller.mergeConflict()).toBe(true);
    const merged = createDocumentFromCotab(
      (await provider.read("shared.cotab"))!.data,
    );
    expect(merged.getMap("score").get("artist")).toBe("Left");
    expect(merged.getMap("score").get("album")).toBe("Right");
    expect(right.getStorageState().status).toBe("saved");
  });

  it("keeps edits made while a save is in flight dirty", async () => {
    const provider = new MemoryStorageProvider();
    const session = createController(provider, createScore());
    provider.nextSave = provider.target("score.cotab");
    await session.controller.saveAs();

    let finishWrite: (() => void) | null = null;
    const originalWrite = provider.write.bind(provider);
    provider.write = async (...args) => {
      await new Promise<void>((resolve) => {
        finishWrite = resolve;
      });
      return originalWrite(...args);
    };
    session.getDocument().getMap("score").set("artist", "Before save");
    const saving = session.controller.save();
    await vi.advanceTimersByTimeAsync(0);
    session.getDocument().getMap("score").set("album", "During save");
    finishWrite!();
    await saving;

    expect(session.getStorageState().status).toBe("dirty");
  });

  it("does not rewrite an unchanged saved document", async () => {
    const provider = new MemoryStorageProvider();
    const session = createController(provider, createScore());
    provider.nextSave = provider.target("score.cotab");
    await session.controller.saveAs();
    provider.writes.length = 0;

    expect(await session.controller.save()).toBe(true);
    expect(provider.writes).toEqual([]);
  });

  it("keeps a bound document dirty while auto-save is disabled", async () => {
    const provider = new MemoryStorageProvider();
    const session = createController(provider, createScore());
    provider.nextSave = provider.target("score.cotab");
    await session.controller.saveAs();
    provider.writes.length = 0;

    session.controller.setAutoSaveEnabled(false);
    session.getDocument().getMap("score").set("artist", "Manual save");
    await vi.runAllTimersAsync();

    expect(session.getStorageState().status).toBe("dirty");
    expect(provider.writes).toEqual([]);
    expect(await session.controller.save()).toBe(true);
    expect(provider.writes).toEqual(["score.cotab"]);
  });

  it("does not auto-save a provider that requires an explicit download", async () => {
    const provider = new MemoryStorageProvider();
    provider.autoSaveSupported = false;
    const session = createController(provider, createScore());
    provider.nextSave = provider.target("download.cotab");
    await session.controller.saveAs();
    provider.writes.length = 0;

    session.getDocument().getMap("score").set("artist", "Manual download");
    await vi.runAllTimersAsync();

    expect(session.getStorageState().status).toBe("dirty");
    expect(provider.writes).toEqual([]);
    expect(await session.controller.save()).toBe(true);
    expect(provider.writes).toEqual(["download.cotab"]);
  });

  it("reports picker failures without replacing the current document", async () => {
    const provider = new MemoryStorageProvider();
    const session = createController(provider, createScore());
    provider.pickOpen = async () => {
      throw new Error("Picker unavailable");
    };

    expect(await session.controller.open()).toBe(false);
    expect(session.getStorageState()).toMatchObject({
      status: "error",
      error: "Picker unavailable",
    });
    expect(session.getDocument().getMap("score").get("title")).toBe("Score");
  });
});
