import { describe, expect, it } from "vitest";
import {
  forceSystemBreak,
  moveSystemBreak,
  preventSystemBreak,
  reflowSystems,
  resolveEffectiveSystems,
  type SystemLayoutState,
} from "../system-layout";

const automaticFour: SystemLayoutState = {
  defaultSystemsLayout: 4,
  systemsLayout: [],
};

describe("system layout transformations", () => {
  it("resolves the explicit prefix and default tail", () => {
    expect(
      resolveEffectiveSystems(14, {
        defaultSystemsLayout: 4,
        systemsLayout: [3, 5],
      }).map((system) => ({
        start: system.startBarIndex,
        end: system.endBarIndex,
        count: system.barCount,
        explicit: system.explicit,
      })),
    ).toEqual([
      { start: 0, end: 2, count: 3, explicit: true },
      { start: 3, end: 7, count: 5, explicit: true },
      { start: 8, end: 11, count: 4, explicit: false },
      { start: 12, end: 13, count: 2, explicit: false },
    ]);
  });

  it("reflows the whole score or only from the selected system", () => {
    expect(reflowSystems(12, automaticFour, 3, null)).toEqual({
      defaultSystemsLayout: 3,
      systemsLayout: [],
    });
    expect(reflowSystems(12, automaticFour, 3, 6)).toEqual({
      defaultSystemsLayout: 3,
      systemsLayout: [4],
    });
  });

  it("forces and prevents a break as inverse split and merge operations", () => {
    const forced = forceSystemBreak(10, automaticFour, 2);
    expect(forced).toEqual({
      defaultSystemsLayout: 4,
      systemsLayout: [3, 1],
    });
    expect(preventSystemBreak(10, forced!, 2)).toEqual(automaticFour);
  });

  it("does not persist an already effective automatic break", () => {
    expect(forceSystemBreak(10, automaticFour, 3)).toBeNull();
  });

  it("merges an automatic boundary and keeps the default tail", () => {
    expect(preventSystemBreak(12, automaticFour, 3)).toEqual({
      defaultSystemsLayout: 4,
      systemsLayout: [8],
    });
  });

  it("moves a boundary one bar in either direction", () => {
    const movedRight = moveSystemBreak(12, automaticFour, 3, "right");
    expect(movedRight).toEqual({
      defaultSystemsLayout: 4,
      systemsLayout: [5, 3],
    });
    expect(moveSystemBreak(12, movedRight!, 4, "left")).toEqual({
      defaultSystemsLayout: 4,
      systemsLayout: [],
    });
  });

  it("can fix the final partial row", () => {
    expect(forceSystemBreak(10, automaticFour, 9)).toEqual({
      defaultSystemsLayout: 4,
      systemsLayout: [4, 4, 2],
    });
  });

  it("rejects bars outside the score without producing a mutation", () => {
    expect(forceSystemBreak(10, automaticFour, 10)).toBeNull();
    expect(preventSystemBreak(10, automaticFour, -1)).toBeNull();
    expect(moveSystemBreak(10, automaticFour, 4, "left")).toBeNull();
  });
});
