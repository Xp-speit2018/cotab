import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Y from "yjs";
import {
  resetMockState,
  selectBeat,
  setMockApiScore,
  seedOneTrackScore,
  buildMockAlphaTabScore,
} from "@/test/setup";
import { createTrack, createStaff } from "@/core/schema";
import {
  initDoc,
  destroyDoc,
  getScoreMap,
  resolveYTrack,
  transact,
} from "@/core/sync";
import { pushDefaultBar } from "@/core/store";
import { executeAction } from "@/actions/registry";
import "@/actions/edit-track";

const defaultSel = {
  trackIndex: 0,
  staffIndex: 0,
  barIndex: 0,
  voiceIndex: 0,
  beatIndex: 0,
  string: 1 as number | null,
};
const ctx = { source: "test" as const };

function trackCount(): number {
  return (getScoreMap()!.get("tracks") as Y.Array<unknown>).length;
}

function setupMockScore(trackNames: string[] = ["Guitar"]) {
  setMockApiScore(buildMockAlphaTabScore({
    tracks: trackNames.map(() => ({
      staves: [{ showTablature: true, bars: [{ voices: [{ beats: [{ notes: [], isEmpty: true }] }] }] }],
    })),
  }));
}

beforeEach(() => {
  resetMockState();
  destroyDoc();
  initDoc();
  seedOneTrackScore(getScoreMap()!, 1);
  selectBeat(defaultSel);
});

describe("edit.track.setName", () => {
  it("updates track name in Y.Doc", () => {
    executeAction("edit.track.setName", { trackIndex: 0, name: "Lead Guitar" }, ctx);
    expect(resolveYTrack(0)!.get("name")).toBe("Lead Guitar");
  });

  it("does nothing for invalid index", () => {
    executeAction("edit.track.setName", { trackIndex: 99, name: "Nope" }, ctx);
    expect(resolveYTrack(0)!.get("name")).toBe("Test Guitar");
  });
});

describe("edit.track.setShortName", () => {
  it("updates shortName in Y.Doc", () => {
    executeAction("edit.track.setShortName", { trackIndex: 0, shortName: "Gtr" }, ctx);
    expect(resolveYTrack(0)!.get("shortName")).toBe("Gtr");
  });
});

describe("edit.track.setProgram", () => {
  it("updates playbackProgram in Y.Doc", () => {
    executeAction("edit.track.setProgram", { trackIndex: 0, program: 30 }, ctx);
    expect(resolveYTrack(0)!.get("playbackProgram")).toBe(30);
  });
});

describe("edit.track.delete", () => {
  beforeEach(() => {
    const scoreMap = getScoreMap()!;
    scoreMap.doc!.transact(() => {
      const yTracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;
      yTracks.push([createTrack("Bass")]);
      const intTrack = yTracks.get(yTracks.length - 1);
      const staves = intTrack.get("staves") as Y.Array<Y.Map<unknown>>;
      staves.push([createStaff()]);
      const intStaff = staves.get(0);
      const bars = intStaff.get("bars") as Y.Array<Y.Map<unknown>>;
      pushDefaultBar(bars);
    });

    setupMockScore(["Guitar", "Bass"]);
  });

  it("removes track from Y.Array", () => {
    expect(trackCount()).toBe(2);
    executeAction("edit.track.delete", 1, ctx);
    expect(trackCount()).toBe(1);
    expect(resolveYTrack(0)!.get("name")).toBe("Test Guitar");
  });

  it("is blocked when only 1 track remains", () => {
    setupMockScore(["Guitar"]);
    const result = executeAction("edit.track.delete", 0, ctx);
    expect(result).toBe(false);
    expect(trackCount()).toBe(2);
  });

  it("clears selection when deleting selected track", async () => {
    const { usePlayerStore } = await import("@/stores/player-store");
    selectBeat({ ...defaultSel, trackIndex: 1 });
    executeAction("edit.track.delete", 1, ctx);
    expect(vi.mocked(usePlayerStore.setState)).toHaveBeenCalledWith(
      expect.objectContaining({ selectedBeat: null }),
    );
  });
});

describe("edit.track.add", () => {
  it("pushes a new Y.Map track via direct transact", () => {
    const scoreMap = getScoreMap()!;
    const tracksBefore = trackCount();

    transact(() => {
      const yTracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;
      yTracks.push([createTrack("Piano")]);
      const intTrack = yTracks.get(yTracks.length - 1);
      const staves = intTrack.get("staves") as Y.Array<Y.Map<unknown>>;
      staves.push([createStaff()]);
      const intStaff = staves.get(0);
      const bars = intStaff.get("bars") as Y.Array<Y.Map<unknown>>;
      pushDefaultBar(bars);
    });

    expect(trackCount()).toBe(tracksBefore + 1);
    expect(resolveYTrack(tracksBefore)!.get("name")).toBe("Piano");
  });
});
