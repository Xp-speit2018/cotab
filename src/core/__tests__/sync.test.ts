import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Y from "yjs";
import {
  initDoc,
  destroyDoc,
  getDoc,
  getScoreMap,
  getUndoManager,
  resolveYTrack,
  resolveYStaff,
  resolveYBar,
  resolveYVoice,
  resolveYBeat,
  resolveYNote,
  resolveYMasterBar,
  transact,
} from "@/core/sync";
import {
  seedOneTrackScore,
  placeNoteDirectly,
  resetMockState,
} from "@/test/setup";

function resetDoc() {
  destroyDoc();
  initDoc();
}

beforeEach(() => {
  resetMockState();
  resetDoc();
});

describe("initDoc / destroyDoc lifecycle", () => {
  it("initDoc creates doc, scoreMap, undoManager", () => {
    expect(getDoc()).toBeInstanceOf(Y.Doc);
    expect(getScoreMap()).toBeInstanceOf(Y.Map);
    expect(getUndoManager()).toBeInstanceOf(Y.UndoManager);
  });

  it("getScoreMap returns a map with initialized keys", () => {
    const scoreMap = getScoreMap()!;
    expect(scoreMap.get("title")).toBe("Untitled");
    expect(scoreMap.get("tempo")).toBe(120);
    expect(scoreMap.get("masterBars")).toBeInstanceOf(Y.Array);
    expect(scoreMap.get("tracks")).toBeInstanceOf(Y.Array);
  });

  it("initDoc is idempotent (second call is no-op)", () => {
    const doc1 = getDoc();
    initDoc();
    expect(getDoc()).toBe(doc1);
  });

  it("destroyDoc cleans up all state", () => {
    destroyDoc();
    expect(getDoc()).toBeNull();
    expect(getScoreMap()).toBeNull();
    expect(getUndoManager()).toBeNull();
  });

  it("can re-initialize after destroy", () => {
    destroyDoc();
    initDoc();
    const doc = getDoc();
    expect(doc).toBeInstanceOf(Y.Doc);
    expect(getScoreMap()!.get("title")).toBe("Untitled");
  });
});

describe("resolveY* navigators", () => {
  beforeEach(() => {
    seedOneTrackScore(getScoreMap()!, 2);
  });

  it("resolveYTrack returns track at index 0", () => {
    const track = resolveYTrack(0);
    expect(track).not.toBeNull();
    expect(track!.get("name")).toBe("Test Guitar");
  });

  it("resolveYStaff returns staff", () => {
    const staff = resolveYStaff(0, 0);
    expect(staff).not.toBeNull();
    expect(staff!.get("showTablature")).toBe(true);
  });

  it("resolveYBar returns bar at given index", () => {
    const bar0 = resolveYBar(0, 0, 0);
    const bar1 = resolveYBar(0, 0, 1);
    expect(bar0).not.toBeNull();
    expect(bar1).not.toBeNull();
    expect(bar0!.get("uuid")).not.toBe(bar1!.get("uuid"));
  });

  it("resolveYVoice returns voice", () => {
    const voice = resolveYVoice(0, 0, 0, 0);
    expect(voice).not.toBeNull();
    const beats = voice!.get("beats") as Y.Array<unknown>;
    expect(beats.length).toBeGreaterThanOrEqual(1);
  });

  it("resolveYBeat returns beat", () => {
    const beat = resolveYBeat(0, 0, 0, 0, 0);
    expect(beat).not.toBeNull();
    expect(beat!.get("uuid")).toBeTypeOf("string");
  });

  it("resolveYNote returns note when present", () => {
    placeNoteDirectly(getScoreMap()!, 0, 0, 0, 5, 3);
    const note = resolveYNote(0, 0, 0, 0, 0, 0);
    expect(note).not.toBeNull();
    expect(note!.get("fret")).toBe(5);
    expect(note!.get("string")).toBe(3);
  });

  it("resolveYMasterBar returns master bar", () => {
    const mb = resolveYMasterBar(0);
    expect(mb).not.toBeNull();
    expect(mb!.get("timeSignatureNumerator")).toBe(4);
  });
});

describe("resolveY* out-of-bounds returns null", () => {
  beforeEach(() => {
    seedOneTrackScore(getScoreMap()!, 1);
  });

  it("resolveYTrack(-1) returns null", () => {
    expect(resolveYTrack(-1)).toBeNull();
  });

  it("resolveYTrack(99) returns null", () => {
    expect(resolveYTrack(99)).toBeNull();
  });

  it("resolveYStaff with bad staff index returns null", () => {
    expect(resolveYStaff(0, 5)).toBeNull();
  });

  it("resolveYBar with bad bar index returns null", () => {
    expect(resolveYBar(0, 0, 99)).toBeNull();
  });

  it("resolveYVoice with bad voice index returns null", () => {
    expect(resolveYVoice(0, 0, 0, 99)).toBeNull();
  });

  it("resolveYBeat with bad beat index returns null", () => {
    expect(resolveYBeat(0, 0, 0, 0, 99)).toBeNull();
  });

  it("resolveYNote with bad note index returns null", () => {
    expect(resolveYNote(0, 0, 0, 0, 0, 99)).toBeNull();
  });
});

describe("transact", () => {
  it("wraps mutations in a Y.Doc transaction", () => {
    const scoreMap = getScoreMap()!;
    transact(() => {
      scoreMap.set("title", "Test Title");
    });
    expect(scoreMap.get("title")).toBe("Test Title");
  });

  it("batches multiple mutations atomically", () => {
    const scoreMap = getScoreMap()!;
    transact(() => {
      scoreMap.set("title", "Batch");
      scoreMap.set("artist", "Batch Artist");
      scoreMap.set("tempo", 200);
    });
    expect(scoreMap.get("title")).toBe("Batch");
    expect(scoreMap.get("artist")).toBe("Batch Artist");
    expect(scoreMap.get("tempo")).toBe(200);
  });
});

describe("UndoManager", () => {
  it("mutation inside transact is undoable", () => {
    const scoreMap = getScoreMap()!;
    const um = getUndoManager()!;

    transact(() => {
      scoreMap.set("title", "Changed");
    });
    expect(scoreMap.get("title")).toBe("Changed");

    um.undo();
    expect(scoreMap.get("title")).toBe("Untitled");
  });

  it("redo after undo re-applies the change", () => {
    const scoreMap = getScoreMap()!;
    const um = getUndoManager()!;

    transact(() => {
      scoreMap.set("artist", "Mozart");
    });
    um.undo();
    expect(scoreMap.get("artist")).toBe("");

    um.redo();
    expect(scoreMap.get("artist")).toBe("Mozart");
  });

  it("rapid sequential transactions are merged by captureTimeout", () => {
    const scoreMap = getScoreMap()!;
    const um = getUndoManager()!;

    transact(() => { scoreMap.set("title", "Step1"); });
    transact(() => { scoreMap.set("title", "Step2"); });
    transact(() => { scoreMap.set("title", "Step3"); });

    // Y.UndoManager has a default captureTimeout of 500ms,
    // so rapid synchronous mutations merge into one undo step
    um.undo();
    expect(scoreMap.get("title")).toBe("Untitled");

    um.redo();
    expect(scoreMap.get("title")).toBe("Step3");
  });
});
