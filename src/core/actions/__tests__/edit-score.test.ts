import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Y from "yjs";
import {
  resetMockState,
  testContext,
} from "@/test/setup";
import {
  initDoc,
  destroyDoc,
  getScoreMap as syncGetScoreMap,
} from "@/test/setup";

vi.mock("@/core/engine", () => {
  const refs = () => (globalThis as Record<string, unknown>).__testEngineRefs as { doc: Y.Doc | null; scoreMap: Y.Map<unknown> | null; undoManager: unknown } | undefined;
  return {
    engine: {
      getScoreMap: vi.fn(() => refs()?.scoreMap ?? null),
      getUndoManager: vi.fn(() => refs()?.undoManager ?? null),
      localEditYDoc: vi.fn((fn: () => void) => {
        const d = refs()?.doc; if (d) d.transact(fn, d.clientID);
      }),
    },
    importTrack: vi.fn(),
    FILE_IMPORT_ORIGIN: "file-import",
  };
});

import { executeAction } from "@/core/actions/registry";
import "@/core/actions/edit-score";

beforeEach(() => {
  resetMockState();
  destroyDoc();
  initDoc();
});

const ctx = testContext();

describe("edit.score.setTitle", () => {
  it("updates title in Y.Doc", () => {
    executeAction("edit.score.setTitle", "My Song", ctx);
    expect(syncGetScoreMap()!.get("title")).toBe("My Song");
  });

  it("overwrites previous title", () => {
    executeAction("edit.score.setTitle", "First", ctx);
    executeAction("edit.score.setTitle", "Second", ctx);
    expect(syncGetScoreMap()!.get("title")).toBe("Second");
  });
});

describe("edit.score.setArtist", () => {
  it("updates artist in Y.Doc", () => {
    executeAction("edit.score.setArtist", "Bach", ctx);
    expect(syncGetScoreMap()!.get("artist")).toBe("Bach");
  });
});

describe("edit.score.setTempo", () => {
  it("updates tempo in Y.Doc", () => {
    executeAction("edit.score.setTempo", 140, ctx);
    expect(syncGetScoreMap()!.get("tempo")).toBe(140);
  });

  it("rejects tempo <= 0", () => {
    executeAction("edit.score.setTempo", 120, ctx);
    executeAction("edit.score.setTempo", 0, ctx);
    expect(syncGetScoreMap()!.get("tempo")).toBe(120);
  });

  it("rejects negative tempo", () => {
    executeAction("edit.score.setTempo", 100, ctx);
    executeAction("edit.score.setTempo", -10, ctx);
    expect(syncGetScoreMap()!.get("tempo")).toBe(100);
  });
});

describe("edit.score.setMetadata", () => {
  it("sets album field", () => {
    executeAction("edit.score.setMetadata", { field: "album", value: "Greatest Hits" }, ctx);
    expect(syncGetScoreMap()!.get("album")).toBe("Greatest Hits");
  });

  it("sets copyright field", () => {
    executeAction("edit.score.setMetadata", { field: "copyright", value: "2024" }, ctx);
    expect(syncGetScoreMap()!.get("copyright")).toBe("2024");
  });

  it("sets subTitle field", () => {
    executeAction("edit.score.setMetadata", { field: "subTitle", value: "Opus 1" }, ctx);
    expect(syncGetScoreMap()!.get("subTitle")).toBe("Opus 1");
  });
});
