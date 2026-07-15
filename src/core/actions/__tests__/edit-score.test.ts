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
  seedOneTrackScore,
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

import {
  DocumentActionArgumentsError,
  executeDocumentAction,
} from "@/core/actions/registry";
import "@/core/actions/edit-score";

beforeEach(() => {
  resetMockState();
  destroyDoc();
  initDoc();
  seedOneTrackScore(syncGetScoreMap()!, 1);
});

const ctx = testContext();

describe("document.score.setTitle", () => {
  it("updates title in Y.Doc", () => {
    executeDocumentAction("document.score.setTitle", { value: "My Song" }, ctx);
    expect(syncGetScoreMap()!.get("title")).toBe("My Song");
  });

  it("overwrites previous title", () => {
    executeDocumentAction("document.score.setTitle", { value: "First" }, ctx);
    executeDocumentAction("document.score.setTitle", { value: "Second" }, ctx);
    expect(syncGetScoreMap()!.get("title")).toBe("Second");
  });
});

describe("document.score.setArtist", () => {
  it("updates artist in Y.Doc", () => {
    executeDocumentAction("document.score.setArtist", { value: "Bach" }, ctx);
    expect(syncGetScoreMap()!.get("artist")).toBe("Bach");
  });
});

describe("document.score.setTempo", () => {
  it("updates tempo in Y.Doc", () => {
    executeDocumentAction("document.score.setTempo", { tempo: 140 }, ctx);
    const masterBars = syncGetScoreMap()!.get("masterBars") as Y.Array<
      Y.Map<unknown>
    >;
    const automations = masterBars
      .get(0)
      .get("tempoAutomations") as Y.Array<Y.Map<unknown>>;
    expect(automations.get(0).get("value")).toBe(140);
    expect(syncGetScoreMap()!.has("tempo")).toBe(false);
  });

  it("rejects tempo <= 0", () => {
    executeDocumentAction("document.score.setTempo", { tempo: 120 }, ctx);
    expect(() =>
      executeDocumentAction("document.score.setTempo", { tempo: 0 }, ctx),
    ).toThrow(DocumentActionArgumentsError);
    const masterBars = syncGetScoreMap()!.get("masterBars") as Y.Array<
      Y.Map<unknown>
    >;
    const automations = masterBars
      .get(0)
      .get("tempoAutomations") as Y.Array<Y.Map<unknown>>;
    expect(automations.get(0).get("value")).toBe(120);
  });

  it("rejects negative tempo", () => {
    executeDocumentAction("document.score.setTempo", { tempo: 100 }, ctx);
    expect(() =>
      executeDocumentAction("document.score.setTempo", { tempo: -10 }, ctx),
    ).toThrow(DocumentActionArgumentsError);
    const masterBars = syncGetScoreMap()!.get("masterBars") as Y.Array<
      Y.Map<unknown>
    >;
    const automations = masterBars
      .get(0)
      .get("tempoAutomations") as Y.Array<Y.Map<unknown>>;
    expect(automations.get(0).get("value")).toBe(100);
  });
});

describe("document.score.setTempoLabel", () => {
  it("writes the initial tempo automation text", () => {
    executeDocumentAction("document.score.setTempoLabel", { label: "Allegro" }, ctx);
    const masterBars = syncGetScoreMap()!.get("masterBars") as Y.Array<
      Y.Map<unknown>
    >;
    const automations = masterBars
      .get(0)
      .get("tempoAutomations") as Y.Array<Y.Map<unknown>>;
    expect(automations.get(0).get("text")).toBe("Allegro");
    expect(syncGetScoreMap()!.has("tempoLabel")).toBe(false);
  });
});

describe("document.score.setMetadata", () => {
  it("sets album field", () => {
    executeDocumentAction("document.score.setMetadata", { field: "album", value: "Greatest Hits" }, ctx);
    expect(syncGetScoreMap()!.get("album")).toBe("Greatest Hits");
  });

  it("sets copyright field", () => {
    executeDocumentAction("document.score.setMetadata", { field: "copyright", value: "2024" }, ctx);
    expect(syncGetScoreMap()!.get("copyright")).toBe("2024");
  });

  it("sets subTitle field", () => {
    executeDocumentAction("document.score.setMetadata", { field: "subTitle", value: "Opus 1" }, ctx);
    expect(syncGetScoreMap()!.get("subTitle")).toBe("Opus 1");
  });
});

describe("score system layout actions", () => {
  it("updates the default and explicit system layout", () => {
    executeDocumentAction(
      "document.score.setDefaultSystemsLayout",
      { value: 4 },
      ctx,
    );
    executeDocumentAction(
      "document.score.setSystemsLayout",
      { value: [4, 3, 2] },
      ctx,
    );

    const score = syncGetScoreMap()!;
    expect(score.get("defaultSystemsLayout")).toBe(4);
    expect(
      (score.get("systemsLayout") as Y.Array<number>).toArray(),
    ).toEqual([4, 3, 2]);
  });

  it("can clear the explicit system layout", () => {
    executeDocumentAction(
      "document.score.setSystemsLayout",
      { value: [2, 2] },
      ctx,
    );
    executeDocumentAction(
      "document.score.setSystemsLayout",
      { value: [] },
      ctx,
    );

    expect(
      (
        syncGetScoreMap()!.get("systemsLayout") as Y.Array<number>
      ).toArray(),
    ).toEqual([]);
  });

  it("rejects non-positive entries before updating Y.Doc", () => {
    const doc = syncGetScoreMap()!.doc!;
    let updates = 0;
    doc.on("update", () => updates++);

    expect(() =>
      executeDocumentAction(
        "document.score.setSystemsLayout",
        { value: [4, 0, 2] },
        ctx,
      ),
    ).toThrow(DocumentActionArgumentsError);

    expect(updates).toBe(0);
    expect(
      (
        syncGetScoreMap()!.get("systemsLayout") as Y.Array<number>
      ).toArray(),
    ).toEqual([]);
  });
});
