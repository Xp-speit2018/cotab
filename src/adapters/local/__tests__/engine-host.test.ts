import { beforeEach, describe, expect, it } from "vitest";

import { localEngineHost } from "@/adapters/local/engine-host";
import { engine, type SelectedBeat } from "@/core/engine";

describe("local engine host adapter", () => {
  beforeEach(() => {
    engine.destroyDoc();
  });

  it("creates a default score through the shared engine", () => {
    localEngineHost.createDefaultScore();

    const snapshot = localEngineHost.snapshot() as { title: string; tracks: unknown[]; masterBars: unknown[] };
    expect(snapshot.title).toBe("Untitled");
    expect(snapshot.tracks).toHaveLength(1);
    expect(snapshot.masterBars).toHaveLength(1);
  });

  it("executes shared actions and supports undo/redo", () => {
    localEngineHost.createDefaultScore();
    localEngineHost.executeDocumentAction("document.score.setTitle", { value: "Adapter Song" });

    expect((localEngineHost.snapshot() as { title: string }).title).toBe("Adapter Song");

    expect(localEngineHost.undo()).toBe(true);
    expect((localEngineHost.snapshot() as { title: string }).title).toBe("Untitled");

    expect(localEngineHost.redo()).toBe(true);
    expect((localEngineHost.snapshot() as { title: string }).title).toBe("Adapter Song");
  });

  it("sets and reads local selection", () => {
    localEngineHost.createDefaultScore();
    const selection: SelectedBeat = {
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      barIndex: 0,
      beatIndex: 0,
      string: 1,
    };

    expect(localEngineHost.setSelection(selection)).toMatchObject(selection);
    expect(localEngineHost.getSelection()).toMatchObject(selection);
  });

  it("lists registered shared action ids", () => {
    expect(localEngineHost.listActionIds()).toContain("document.score.setTitle");
    expect(localEngineHost.listActionIds()).toContain("document.track.add");
  });
});
