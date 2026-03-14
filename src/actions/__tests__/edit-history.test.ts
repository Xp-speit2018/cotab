import { describe, it, expect, beforeEach } from "vitest";
import {
  resetMockState,
} from "@/test/setup";
import {
  initDoc,
  destroyDoc,
  getScoreMap,
  transact,
  getUndoManager,
} from "@/core/sync";
import { executeAction } from "@/actions/registry";
import "@/actions/edit-history";

beforeEach(() => {
  resetMockState();
  destroyDoc();
  initDoc();
});

const ctx = { source: "test" as const };

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
