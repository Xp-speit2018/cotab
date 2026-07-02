import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import { resetMockState } from "@/test/setup";

// Create a real Y.Doc for this test (bypassing the engine mock)
let _realDoc: Y.Doc | null = null;
let _realScoreMap: Y.Map<unknown> | null = null;
let _realUndoManager: Y.UndoManager | null = null;

function initRealDoc(): void {
  _realDoc = new Y.Doc();
  _realScoreMap = _realDoc.getMap("score");
  _realScoreMap.set("title", "Untitled");
  _realScoreMap.set("tempo", 120);
  _realScoreMap.set("masterBars", new Y.Array());
  _realScoreMap.set("tracks", new Y.Array());
  _realUndoManager = new Y.UndoManager([_realScoreMap], {
    trackedOrigins: new Set([_realDoc.clientID]),
  });
}

function destroyRealDoc(): void {
  _realUndoManager?.destroy();
  _realDoc?.destroy();
  _realUndoManager = null;
  _realScoreMap = null;
  _realDoc = null;
}

beforeEach(() => {
  resetMockState();
  destroyRealDoc();
  initRealDoc();
});

describe("undo state", () => {
  it("undoStack is empty initially", () => {
    expect(_realUndoManager!.undoStack.length).toBe(0);
    expect(_realUndoManager!.redoStack.length).toBe(0);
  });

  it("undoStack has one item after tracked mutation", () => {
    _realDoc!.transact(() => {
      _realScoreMap!.set("title", "Test");
    }, _realDoc!.clientID);

    expect(_realUndoManager!.undoStack.length).toBe(1);
    expect(_realUndoManager!.redoStack.length).toBe(0);
  });

  it("redoStack has item after undo", () => {
    _realDoc!.transact(() => {
      _realScoreMap!.set("title", "Test");
    }, _realDoc!.clientID);

    _realUndoManager!.undo();

    expect(_realUndoManager!.undoStack.length).toBe(0);
    expect(_realUndoManager!.redoStack.length).toBe(1);
  });

  it("both stacks empty after clear", () => {
    _realDoc!.transact(() => {
      _realScoreMap!.set("title", "A");
    }, _realDoc!.clientID);
    _realUndoManager!.undo();
    _realDoc!.transact(() => {
      _realScoreMap!.set("title", "B");
    }, _realDoc!.clientID);

    expect(_realUndoManager!.undoStack.length).toBe(1);

    _realUndoManager!.clear();

    expect(_realUndoManager!.undoStack.length).toBe(0);
    expect(_realUndoManager!.redoStack.length).toBe(0);
  });
});
