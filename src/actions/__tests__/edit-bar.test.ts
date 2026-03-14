import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Y from "yjs";
import {
  resetMockState,
  selectBeat,
  seedOneTrackScore,
  placeNoteDirectly,
} from "@/test/setup";
import {
  initDoc,
  destroyDoc,
  getScoreMap,
  resolveYBar,
} from "@/core/sync";
import { executeAction } from "@/actions/registry";
import { setPendingSelection } from "@/stores/player-api";
import { isBarEmptyAllTracks } from "@/stores/player-helpers";
import "@/actions/edit-bar";

const defaultSel = {
  trackIndex: 0,
  staffIndex: 0,
  barIndex: 0,
  voiceIndex: 0,
  beatIndex: 0,
  string: 1 as number | null,
};
const ctx = { source: "test" as const };

beforeEach(() => {
  resetMockState();
  destroyDoc();
  initDoc();
  seedOneTrackScore(getScoreMap()!, 2);
  selectBeat(defaultSel);
  vi.mocked(isBarEmptyAllTracks).mockReturnValue(true);
});

function masterBarCount(): number {
  return (getScoreMap()!.get("masterBars") as Y.Array<unknown>).length;
}

function staffBarCount(trackIdx = 0, staffIdx = 0): number {
  const tracks = getScoreMap()!.get("tracks") as Y.Array<Y.Map<unknown>>;
  const staves = tracks.get(trackIdx).get("staves") as Y.Array<Y.Map<unknown>>;
  const bars = staves.get(staffIdx).get("bars") as Y.Array<Y.Map<unknown>>;
  return bars.length;
}

describe("edit.bar.insertAfter", () => {
  it("adds a masterBar and a bar to each staff", () => {
    expect(masterBarCount()).toBe(2);
    expect(staffBarCount()).toBe(2);

    executeAction("edit.bar.insertAfter", undefined, ctx);

    expect(masterBarCount()).toBe(3);
    expect(staffBarCount()).toBe(3);
  });

  it("inserts at the correct index (after current bar)", () => {
    const barBefore = resolveYBar(0, 0, 1)!;
    const uuidBefore = barBefore.get("uuid");

    executeAction("edit.bar.insertAfter", undefined, ctx);

    const barAtIdx1 = resolveYBar(0, 0, 1)!;
    expect(barAtIdx1.get("uuid")).not.toBe(uuidBefore);

    const barAtIdx2 = resolveYBar(0, 0, 2)!;
    expect(barAtIdx2.get("uuid")).toBe(uuidBefore);
  });

  it("new bar inherits time signature from reference bar", () => {
    const scoreMap = getScoreMap()!;
    const mbs = scoreMap.get("masterBars") as Y.Array<Y.Map<unknown>>;
    scoreMap.doc!.transact(() => {
      mbs.get(0).set("timeSignatureNumerator", 3);
      mbs.get(0).set("timeSignatureDenominator", 8);
    });

    executeAction("edit.bar.insertAfter", undefined, ctx);

    const newMb = mbs.get(1);
    expect(newMb.get("timeSignatureNumerator")).toBe(3);
    expect(newMb.get("timeSignatureDenominator")).toBe(8);
  });

  it("calls setPendingSelection", () => {
    executeAction("edit.bar.insertAfter", undefined, ctx);
    expect(setPendingSelection).toHaveBeenCalled();
  });

  it("does nothing without selection", () => {
    selectBeat(null);
    executeAction("edit.bar.insertAfter", undefined, ctx);
    expect(masterBarCount()).toBe(2);
  });
});

describe("edit.bar.insertBefore", () => {
  it("inserts a bar before the current bar", () => {
    const bar0uuid = resolveYBar(0, 0, 0)!.get("uuid");

    executeAction("edit.bar.insertBefore", undefined, ctx);

    expect(masterBarCount()).toBe(3);
    expect(staffBarCount()).toBe(3);

    const shiftedBar = resolveYBar(0, 0, 1)!;
    expect(shiftedBar.get("uuid")).toBe(bar0uuid);
  });

  it("adjusts pending selection to shifted index", () => {
    executeAction("edit.bar.insertBefore", undefined, ctx);
    expect(setPendingSelection).toHaveBeenCalledWith(
      expect.objectContaining({ barIndex: 1 }),
    );
  });
});

describe("edit.bar.delete", () => {
  it("removes bar when bar is empty", () => {
    selectBeat({ ...defaultSel, barIndex: 1 });
    executeAction("edit.bar.delete", undefined, ctx);
    expect(masterBarCount()).toBe(1);
    expect(staffBarCount()).toBe(1);
  });

  it("is blocked when only 1 bar remains", () => {
    selectBeat({ ...defaultSel, barIndex: 0 });
    executeAction("edit.bar.delete", undefined, ctx);
    expect(masterBarCount()).toBe(1);
    expect(staffBarCount()).toBe(1);

    const result = executeAction("edit.bar.delete", undefined, ctx);
    expect(result).toBe(false);
  });

  it("is blocked when bar is not empty", () => {
    vi.mocked(isBarEmptyAllTracks).mockReturnValue(false);
    const result = executeAction("edit.bar.delete", undefined, ctx);
    expect(result).toBe(false);
    expect(masterBarCount()).toBe(2);
  });

  it("calls setPendingSelection with clamped index", () => {
    selectBeat({ ...defaultSel, barIndex: 1 });
    executeAction("edit.bar.delete", undefined, ctx);
    expect(setPendingSelection).toHaveBeenCalledWith(
      expect.objectContaining({ barIndex: 0 }),
    );
  });
});
