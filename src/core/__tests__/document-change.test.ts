import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { EditorEngine } from "../engine";
import { createMasterBar } from "../schema";

describe("EditorEngine document change ranges", () => {
  let engine: EditorEngine;

  beforeEach(() => {
    engine = new EditorEngine();
    engine.initDoc();
    engine.localEditYDoc(() => {
      EditorEngine.createNewScore(engine.getScoreMap()!);
      const score = engine.getScoreMap()!;
      const masterBars = score.get("masterBars") as Y.Array<Y.Map<unknown>>;
      const tracks = score.get("tracks") as Y.Array<Y.Map<unknown>>;
      const staves = tracks.get(0).get("staves") as Y.Array<Y.Map<unknown>>;
      const bars = staves.get(0).get("bars") as Y.Array<Y.Map<unknown>>;

      for (let index = 1; index < 12; index++) {
        masterBars.push([createMasterBar()]);
        EditorEngine.pushDefaultBar(bars);
      }
    });
  });

  afterEach(() => {
    engine.destroyDoc();
  });

  it("reports the bar containing a nested beat edit", () => {
    const onLocalYDocEdit = vi.fn();
    engine.registerHooks({ onLocalYDocEdit });

    engine.localEditYDoc(() => {
      engine.resolveYBeat(0, 0, 8, 0, 0)?.set("duration", 2);
    });

    expect(onLocalYDocEdit).toHaveBeenCalledOnce();
    expect(onLocalYDocEdit).toHaveBeenCalledWith({
      firstChangedMasterBar: 8,
    });
  });

  it("uses the earliest bar touched by one transaction", () => {
    const onLocalYDocEdit = vi.fn();
    engine.registerHooks({ onLocalYDocEdit });

    engine.localEditYDoc(() => {
      engine.resolveYBeat(0, 0, 9, 0, 0)?.set("duration", 2);
      engine.resolveYBeat(0, 0, 3, 0, 0)?.set("duration", 4);
    });

    expect(onLocalYDocEdit).toHaveBeenCalledWith({
      firstChangedMasterBar: 3,
    });
  });

  it("reports the insertion index for synchronized bar arrays", () => {
    const onLocalYDocEdit = vi.fn();
    engine.registerHooks({ onLocalYDocEdit });

    engine.localEditYDoc(() => {
      const score = engine.getScoreMap()!;
      const masterBars = score.get("masterBars") as Y.Array<Y.Map<unknown>>;
      const tracks = score.get("tracks") as Y.Array<Y.Map<unknown>>;
      const staves = tracks.get(0).get("staves") as Y.Array<Y.Map<unknown>>;
      const bars = staves.get(0).get("bars") as Y.Array<Y.Map<unknown>>;
      masterBars.insert(6, [createMasterBar()]);
      EditorEngine.pushDefaultBar(bars, 6);
    });

    expect(onLocalYDocEdit).toHaveBeenCalledWith({
      firstChangedMasterBar: 6,
    });
  });

  it("requests a full render for score-level changes", () => {
    const onLocalYDocEdit = vi.fn();
    engine.registerHooks({ onLocalYDocEdit });

    engine.localEditYDoc(() => {
      engine.getScoreMap()?.set("title", "Changed title");
    });

    expect(onLocalYDocEdit).toHaveBeenCalledWith({
      firstChangedMasterBar: null,
    });
  });

  it("does not report a document edit when the transaction is empty", () => {
    const onLocalYDocEdit = vi.fn();
    engine.registerHooks({ onLocalYDocEdit });

    engine.localEditYDoc(() => undefined);

    expect(onLocalYDocEdit).not.toHaveBeenCalled();
  });
});
