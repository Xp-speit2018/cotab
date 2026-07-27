import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Y from "yjs";
import {
  resetMockState,
  testContext,
} from "@tests/unit/setup";
import {
  initDoc,
  destroyDoc,
  getScoreMap as syncGetScoreMap,
  seedOneTrackScore,
} from "@tests/unit/setup";
import { AutomationType } from "@/core/schema";

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

describe("document.score.setTempoMap", () => {
  const automation = (value: number, ratioPosition = 0) => ({
    isLinear: false,
    type: AutomationType.Tempo,
    value,
    ratioPosition,
    text: "",
    isVisible: true,
  });

  beforeEach(() => {
    destroyDoc();
    initDoc();
    seedOneTrackScore(syncGetScoreMap()!, 4);
  });

  it("atomically replaces tempo points across the score", () => {
    executeDocumentAction("document.score.setTempoMap", { entries: [
      { masterBarIndex: 0, automations: [automation(70)] },
      {
        masterBarIndex: 2,
        automations: [automation(90), automation(110, 0.5)],
      },
    ] }, ctx);

    const masterBars = syncGetScoreMap()!.get("masterBars") as Y.Array<
      Y.Map<unknown>
    >;
    expect(masterBars.map((masterBar) => {
      const automations = masterBar.get("tempoAutomations") as Y.Array<
        Y.Map<unknown>
      >;
      return automations.map((item) => [
        item.get("value"),
        item.get("ratioPosition"),
      ]);
    })).toEqual([
      [[70, 0]],
      [],
      [[90, 0], [110, 0.5]],
      [],
    ]);
  });

  it("rejects duplicate and out-of-range bars without changing Y.Doc", () => {
    const score = syncGetScoreMap()!;
    const before = score.toJSON();
    expect(() => executeDocumentAction("document.score.setTempoMap", {
      entries: [
        { masterBarIndex: 1, automations: [automation(80)] },
        { masterBarIndex: 1, automations: [automation(90)] },
      ],
    }, ctx)).toThrow(DocumentActionArgumentsError);
    expect(score.toJSON()).toEqual(before);

    expect(() => executeDocumentAction("document.score.setTempoMap", {
      entries: [{ masterBarIndex: 4, automations: [automation(100)] }],
    }, ctx)).toThrow(RangeError);
    expect(score.toJSON()).toEqual(before);
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
  function resetSystemLayoutScore(barCount = 12) {
    destroyDoc();
    initDoc();
    seedOneTrackScore(syncGetScoreMap()!, barCount);
  }

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

  it("reflows the whole score and resets explicit line breaks atomically", () => {
    resetSystemLayoutScore();
    executeDocumentAction(
      "document.score.setSystemsLayout",
      { value: [3, 5] },
      ctx,
    );
    const doc = syncGetScoreMap()!.doc!;
    let updates = 0;
    doc.on("update", () => updates++);

    expect(executeDocumentAction(
      "document.score.reflowSystems",
      { barsPerSystem: 4, startBarIndex: null },
      ctx,
    )).toBe(true);

    const score = syncGetScoreMap()!;
    expect(score.get("defaultSystemsLayout")).toBe(4);
    expect((score.get("systemsLayout") as Y.Array<number>).toArray()).toEqual([]);
    expect(updates).toBe(1);
  });

  it("reflows from the selected system while preserving earlier rows", () => {
    resetSystemLayoutScore();
    executeDocumentAction(
      "document.score.setDefaultSystemsLayout",
      { value: 4 },
      ctx,
    );

    expect(executeDocumentAction(
      "document.score.reflowSystems",
      { barsPerSystem: 3, startBarIndex: 6 },
      ctx,
    )).toBe(true);

    const score = syncGetScoreMap()!;
    expect(score.get("defaultSystemsLayout")).toBe(3);
    expect((score.get("systemsLayout") as Y.Array<number>).toArray()).toEqual([4]);
  });

  it("forces, moves, and prevents score line breaks", () => {
    resetSystemLayoutScore();
    executeDocumentAction(
      "document.score.setDefaultSystemsLayout",
      { value: 4 },
      ctx,
    );

    expect(executeDocumentAction(
      "document.score.forceSystemBreak",
      { barIndex: 2 },
      ctx,
    )).toBe(true);
    expect(
      (syncGetScoreMap()!.get("systemsLayout") as Y.Array<number>).toArray(),
    ).toEqual([3, 1]);

    expect(executeDocumentAction(
      "document.score.moveSystemBreak",
      { barIndex: 2, direction: "left" },
      ctx,
    )).toBe(true);
    expect(
      (syncGetScoreMap()!.get("systemsLayout") as Y.Array<number>).toArray(),
    ).toEqual([2, 2]);

    expect(executeDocumentAction(
      "document.score.preventSystemBreak",
      { barIndex: 1 },
      ctx,
    )).toBe(true);
    expect(
      (syncGetScoreMap()!.get("systemsLayout") as Y.Array<number>).toArray(),
    ).toEqual([]);
  });

  it("does not update Y.Doc when a requested break is already present", () => {
    resetSystemLayoutScore();
    executeDocumentAction(
      "document.score.setDefaultSystemsLayout",
      { value: 4 },
      ctx,
    );
    const doc = syncGetScoreMap()!.doc!;
    let updates = 0;
    doc.on("update", () => updates++);

    expect(executeDocumentAction(
      "document.score.forceSystemBreak",
      { barIndex: 3 },
      ctx,
    )).toBe(false);
    expect(updates).toBe(0);
  });
});
