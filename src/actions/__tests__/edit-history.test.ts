import * as Y from "yjs";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  resetMockState,
  testContext,
  seedOneTrackScore,
} from "@/test/setup";
import { createMasterBar } from "@/core/schema";
import {
  initDoc,
  destroyDoc,
  getScoreMap,
  transact,
  getUndoManager,
  pushDefaultBarHelper,
} from "@/test/setup";

// Inline factory helpers to avoid module resolution issues in hoisted mock
const _createYMap = () => new Y.Map<unknown>();
const _createBar = (clef?: number) => {
  const bar = _createYMap();
  bar.set("clef", clef ?? 4);
  bar.set("voices", new Y.Array<Y.Map<unknown>>());
  bar.set("uuid", `bar-${Math.random().toString(36).slice(2)}`);
  return bar;
};
const _createVoice = () => {
  const voice = _createYMap();
  voice.set("beats", new Y.Array<Y.Map<unknown>>());
  return voice;
};
const _createBeat = (duration?: number) => {
  const beat = _createYMap();
  beat.set("duration", duration ?? 4);
  beat.set("isEmpty", true);
  beat.set("isRest", false);
  beat.set("notes", new Y.Array<Y.Map<unknown>>());
  return beat;
};

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
    EditorEngine: {
      pushDefaultBar: vi.fn((yBars: Y.Array<Y.Map<unknown>>, index?: number, clef?: number) => {
        const bar = _createBar(clef);
        if (index !== undefined) yBars.insert(index, [bar]); else yBars.push([bar]);
        const intBar = yBars.get(index ?? yBars.length - 1);
        const voices = intBar.get("voices") as Y.Array<Y.Map<unknown>>;
        voices.push([_createVoice()]);
        const intVoice = voices.get(0);
        (intVoice.get("beats") as Y.Array<Y.Map<unknown>>).push([_createBeat()]);
        return intBar;
      }),
    },
    importTrack: vi.fn(),
    FILE_IMPORT_ORIGIN: "file-import",
  };
});

import { EditorEngine } from "@/core/engine";
import { executeAction } from "@/actions/registry";
import "@/actions/edit-history";

beforeEach(() => {
  resetMockState();
  destroyDoc();
  initDoc();
});

const ctx = testContext();

describe("edit.undo", () => {
  it("undoes a Y.Doc mutation", () => {
    const scoreMap = getScoreMap()!;
    transact(() => {
      scoreMap.set("title", "Changed");
    });
    expect(scoreMap.get("title")).toBe("Changed");

    executeAction("edit.undo", undefined, ctx);
    expect(scoreMap.get("title")).toBe("Untitled");
  });

  it("does nothing when undo stack is empty", () => {
    const scoreMap = getScoreMap()!;
    expect(scoreMap.get("title")).toBe("Untitled");
    executeAction("edit.undo", undefined, ctx);
    expect(scoreMap.get("title")).toBe("Untitled");
  });
});

describe("edit.redo", () => {
  it("re-applies an undone change", () => {
    const scoreMap = getScoreMap()!;
    transact(() => {
      scoreMap.set("artist", "Mozart");
    });

    executeAction("edit.undo", undefined, ctx);
    expect(scoreMap.get("artist")).toBe("");

    executeAction("edit.redo", undefined, ctx);
    expect(scoreMap.get("artist")).toBe("Mozart");
  });

  it("does nothing when redo stack is empty", () => {
    const scoreMap = getScoreMap()!;
    transact(() => {
      scoreMap.set("title", "Test");
    });
    executeAction("edit.redo", undefined, ctx);
    expect(scoreMap.get("title")).toBe("Test");
  });
});

describe("undo/redo round-trip", () => {
  it("undo then redo restores the change", () => {
    const scoreMap = getScoreMap()!;
    const um = getUndoManager()!;

    transact(() => {
      scoreMap.set("title", "Round Trip");
    });

    um.undo();
    expect(scoreMap.get("title")).toBe("Untitled");

    um.redo();
    expect(scoreMap.get("title")).toBe("Round Trip");
  });
});

describe("atomic transactions", () => {
  it("undoes multiple property changes in one transact() as a single step", () => {
    const scoreMap = getScoreMap()!;
    transact(() => {
      scoreMap.set("title", "New Title");
      scoreMap.set("artist", "New Artist");
    });
    expect(scoreMap.get("title")).toBe("New Title");
    expect(scoreMap.get("artist")).toBe("New Artist");

    executeAction("edit.undo", undefined, ctx);
    expect(scoreMap.get("title")).toBe("Untitled");
    expect(scoreMap.get("artist")).toBe("");
  });
});

describe("sequential undos", () => {
  it("3 changes to different properties → undo 3x → redo 1x", () => {
    const scoreMap = getScoreMap()!;

    transact(() => scoreMap.set("title", "A"));
    transact(() => scoreMap.set("artist", "B"));
    transact(() => scoreMap.set("album", "C"));

    expect(scoreMap.get("title")).toBe("A");
    expect(scoreMap.get("artist")).toBe("B");
    expect(scoreMap.get("album")).toBe("C");

    executeAction("edit.undo", undefined, ctx);
    expect(scoreMap.get("album")).toBe("");

    executeAction("edit.undo", undefined, ctx);
    expect(scoreMap.get("artist")).toBe("");

    executeAction("edit.undo", undefined, ctx);
    expect(scoreMap.get("title")).toBe("Untitled");

    executeAction("edit.redo", undefined, ctx);
    expect(scoreMap.get("title")).toBe("A");
  });
});

describe("array mutations", () => {
  it("insert bar → undo → bar count reverts", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 1);

    const um = getUndoManager()!;
    um.clear();

    const yTracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;
    const yStaves = yTracks.get(0).get("staves") as Y.Array<Y.Map<unknown>>;
    const yBars = yStaves.get(0).get("bars") as Y.Array<Y.Map<unknown>>;
    const yMasterBars = scoreMap.get("masterBars") as Y.Array<Y.Map<unknown>>;

    expect(yBars.length).toBe(1);
    expect(yMasterBars.length).toBe(1);

    // Add a bar in a tracked transaction
    transact(() => {
      yMasterBars.push([createMasterBar(4, 4)]);
      EditorEngine.pushDefaultBar(yBars);
    });

    expect(yBars.length).toBe(2);
    expect(yMasterBars.length).toBe(2);

    executeAction("edit.undo", undefined, ctx);
    expect(yBars.length).toBe(1);
    expect(yMasterBars.length).toBe(1);
  });
});

describe("stack clearing", () => {
  it("um.clear() empties both stacks", () => {
    const scoreMap = getScoreMap()!;
    const um = getUndoManager()!;

    transact(() => scoreMap.set("title", "X"));
    um.undo();

    expect(um.undoStack.length).toBe(0);
    expect(um.redoStack.length).toBe(1);

    transact(() => scoreMap.set("title", "Y"));
    expect(um.undoStack.length).toBe(1);

    um.clear();
    expect(um.undoStack.length).toBe(0);
    expect(um.redoStack.length).toBe(0);
  });
});
