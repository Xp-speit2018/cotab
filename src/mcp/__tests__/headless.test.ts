/**
 * Headless engine smoke test
 *
 * Verifies the engine runs without any mocks in Node.js.
 * Unlike action tests which mock everything, this tests the real engine.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { TFunction } from "i18next";
import type { ActionExecutionContext } from "@/core/actions/types";
import { engine } from "@/core/engine";
import "@/core/actions"; // Register all actions
import { executeAction } from "@/core/actions/registry";
import { snapshotScore, createTrack, createStaff, createBar, createVoice, createBeat, createMasterBar } from "@/core/schema";
import * as Y from "yjs";

/** Create a minimal ActionExecutionContext for headless tests. */
function testContext(): ActionExecutionContext {
  return { t: ((key: string) => key) as unknown as TFunction };
}

describe("Headless Engine", () => {
  beforeEach(() => {
    // Reset engine state
    engine.destroyDoc();
  });

  it("should initialize a new document", () => {
    engine.initDoc();

    const doc = engine.getDoc();
    const scoreMap = engine.getScoreMap();
    const undoManager = engine.getUndoManager();

    expect(doc).toBeInstanceOf(Y.Doc);
    expect(scoreMap).toBeInstanceOf(Y.Map);
    expect(undoManager).toBeInstanceOf(Y.UndoManager);
  });

  it("should execute actions that mutate the Y.Doc", () => {
    engine.initDoc();

    const ctx = testContext();

    // Set the score title
    executeAction("edit.score.setTitle", "Test Score", ctx);

    const scoreMap = engine.getScoreMap();
    expect(scoreMap?.get("title")).toBe("Test Score");

    // Verify via snapshot
    const snapshot = snapshotScore(scoreMap!);
    expect(snapshot.title).toBe("Test Score");
  });

  it("should support undo/redo", () => {
    engine.initDoc();

    const ctx = testContext();
    const scoreMap = engine.getScoreMap();

    // Initial title is "Untitled"
    expect(scoreMap?.get("title")).toBe("Untitled");

    // Set title
    executeAction("edit.score.setTitle", "New Title", ctx);
    expect(scoreMap?.get("title")).toBe("New Title");

    // Undo reverts to "Untitled"
    const undoManager = engine.getUndoManager();
    undoManager?.undo();
    expect(scoreMap?.get("title")).toBe("Untitled");

    // Redo restores "New Title"
    undoManager?.redo();
    expect(scoreMap?.get("title")).toBe("New Title");
  });

  it("should set and retrieve selection", () => {
    engine.initDoc();

    const selection = {
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      barIndex: 0,
      beatIndex: 0,
      string: 1,
    };

    engine.localSetSelection(selection);

    expect(engine.selectedBeat).toEqual(selection);
    expect(engine.selectedBeatUuid).toBeDefined();
  });

  it("should list all registered actions", async () => {
    const { getAllActions } = await import("@/core/actions/registry");
    const actions = getAllActions();

    // Should have many actions registered
    expect(actions.length).toBeGreaterThan(10);

    // Check for expected action categories
    const ids = actions.map((a) => a.id);
    expect(ids).toContain("edit.score.setTitle");
    expect(ids).toContain("edit.score.setArtist");
    expect(ids.some((id) => id.startsWith("edit.track."))).toBe(true);
    expect(ids.some((id) => id.startsWith("edit.note."))).toBe(true);
  });

  it("should create a complete score through actions", () => {
    engine.initDoc();

    const ctx = testContext();
    const scoreMap = engine.getScoreMap()!;
    const doc = engine.getDoc()!;

    // Manually add a track and master bar (initDoc creates empty doc)
    doc.transact(() => {
      const yMasterBars = scoreMap.get("masterBars") as Y.Array<Y.Map<unknown>>;
      const yTracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;

      yTracks.push([createTrack("Test Guitar")]);
      const yTrack = yTracks.get(0);
      const yStaves = yTrack.get("staves") as Y.Array<Y.Map<unknown>>;
      yStaves.push([createStaff()]);
      const yStaff = yStaves.get(0);
      const yBars = yStaff.get("bars") as Y.Array<Y.Map<unknown>>;
      yBars.push([createBar()]);
      const yBar = yBars.get(0);
      const yVoices = yBar.get("voices") as Y.Array<Y.Map<unknown>>;
      yVoices.push([createVoice()]);
      const yVoice = yVoices.get(0);
      const yBeats = yVoice.get("beats") as Y.Array<Y.Map<unknown>>;
      yBeats.push([createBeat()]);

      yMasterBars.push([createMasterBar()]);
    }, doc.clientID);

    // Set metadata
    executeAction("edit.score.setTitle", "My Song", ctx);
    executeAction("edit.score.setArtist", "Test Artist", ctx);
    executeAction("edit.score.setTempo", 140, ctx);

    // Verify final snapshot
    const snapshot = snapshotScore(scoreMap);

    expect(snapshot.title).toBe("My Song");
    expect(snapshot.artist).toBe("Test Artist");
    expect(snapshot.tempo).toBe(140);

    // Should have track and master bar we created
    expect(snapshot.tracks.length).toBe(1);
    expect(snapshot.masterBars.length).toBe(1);
    expect(snapshot.tracks[0].name).toBe("Test Guitar");
  });
});
