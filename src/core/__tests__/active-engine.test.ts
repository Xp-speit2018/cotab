import {
  EditorEngine,
  engine,
  setActiveEngine,
  subscribeActiveEngine,
} from "@/core/engine";

describe("active document engine", () => {
  it("switches the live engine binding without sharing Y.Doc state", () => {
    const original = engine;
    const first = new EditorEngine();
    const second = new EditorEngine();
    first.initDoc();
    second.initDoc();
    first.getScoreMap()?.set("title", "First");
    second.getScoreMap()?.set("title", "Second");

    const transitions: Array<[EditorEngine, EditorEngine]> = [];
    const unsubscribe = subscribeActiveEngine((current, previous) => {
      transitions.push([current, previous]);
    });

    try {
      setActiveEngine(first);
      expect(engine).toBe(first);
      expect(engine.getScoreMap()?.get("title")).toBe("First");

      setActiveEngine(second);
      expect(engine).toBe(second);
      expect(engine.getScoreMap()?.get("title")).toBe("Second");
      expect(first.getDoc()).not.toBe(second.getDoc());
      expect(transitions).toEqual([
        [first, original],
        [second, first],
      ]);
    } finally {
      unsubscribe();
      setActiveEngine(original);
      first.destroyDoc();
      second.destroyDoc();
    }
  });
});
