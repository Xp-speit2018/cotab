import { describe, it, expect, beforeEach } from "vitest";
import { resetMockState } from "@/test/setup";
import {
  initDoc,
  destroyDoc,
  getScoreMap,
  transact,
  getUndoManager,
} from "@/core/sync";
import { useUndoStore, syncUndoState } from "@/stores/undo-store";

beforeEach(() => {
  resetMockState();
  destroyDoc();
  initDoc();
});

describe("useUndoStore", () => {
  it("canUndo is false initially", () => {
    const { canUndo, canRedo } = useUndoStore.getState();
    expect(canUndo).toBe(false);
    expect(canRedo).toBe(false);
  });

  it("canUndo becomes true after a tracked mutation", () => {
    const scoreMap = getScoreMap()!;
    transact(() => scoreMap.set("title", "Test"));

    // initDoc attaches listeners that call syncUndoState automatically,
    // but call it explicitly to be deterministic in tests
    syncUndoState();

    expect(useUndoStore.getState().canUndo).toBe(true);
    expect(useUndoStore.getState().canRedo).toBe(false);
  });

  it("canRedo becomes true after undo", () => {
    const scoreMap = getScoreMap()!;
    const um = getUndoManager()!;

    transact(() => scoreMap.set("title", "Test"));
    um.undo();
    syncUndoState();

    expect(useUndoStore.getState().canUndo).toBe(false);
    expect(useUndoStore.getState().canRedo).toBe(true);
  });

  it("both reset after clear()", () => {
    const scoreMap = getScoreMap()!;
    const um = getUndoManager()!;

    transact(() => scoreMap.set("title", "A"));
    um.undo();
    transact(() => scoreMap.set("title", "B"));
    syncUndoState();

    // Before clear: should have items in both stacks
    expect(useUndoStore.getState().canUndo).toBe(true);

    um.clear();
    syncUndoState();

    expect(useUndoStore.getState().canUndo).toBe(false);
    expect(useUndoStore.getState().canRedo).toBe(false);
  });
});
