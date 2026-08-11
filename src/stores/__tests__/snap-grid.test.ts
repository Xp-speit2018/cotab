import { afterEach, describe, expect, it, vi } from "vitest";
import type * as alphaTab from "@coderline/alphatab";

vi.unmock("@/stores/snap-grid");
vi.unmock("@/stores/percussion-data");

import { getApi } from "@/stores/render-api";
import {
  buildSnapGrids,
  destroySnapGridOverlay,
  getNavigablePositions,
  getSnapGridForBar,
  getSnapGridsForBar,
  getSnapGrids,
} from "@/stores/snap-grid";

function createFakeApi(
  systemYs: number[],
  options: {
    showStandardNotation?: boolean;
    noteStrings?: number[];
    tabHeight?: number;
  } = {},
): alphaTab.AlphaTabApi {
  const track = {
    index: 0,
    isPercussion: false,
    percussionArticulations: [],
    staves: [] as unknown[],
  };
  const staff = {
    index: 0,
    track,
    showStandardNotation: options.showStandardNotation ?? false,
    showTablature: true,
    tuning: [64, 59, 55, 50, 45, 40],
  };
  track.staves.push(staff);

  const staffSystems = systemYs.map((y, systemIndex) => {
    const tabHeight = options.tabHeight ?? 50;
    const tabLineSpacing = tabHeight / (staff.tuning.length - 1);
    const bar = {
      index: systemIndex,
      staff,
    };
    const tabBounds = {
      bar,
      realBounds: {
        x: 40,
        y: y + (options.showStandardNotation ? 80 : 20),
        w: 720,
        h: tabHeight,
      },
      beats: options.noteStrings === undefined
        ? []
        : [{
            notes: options.noteStrings.map((string) => ({
              note: { string },
              noteHeadBounds: {
                x: 100,
                y: y + 14.5 + (staff.tuning.length - string) * tabLineSpacing,
                w: 10,
                h: 10,
              },
            })),
          }],
    };
    const renderedBars = options.showStandardNotation
      ? [
          {
            bar,
            realBounds: { x: 40, y: y + 20, w: 720, h: 40 },
            beats: [],
          },
          tabBounds,
        ]
      : [tabBounds];
    return {
      index: systemIndex,
      realBounds: { x: 40, y, w: 720, h: 120 },
      bars: [
        {
          realBounds: { x: 40, y, w: 720, h: 120 },
          bars: renderedBars,
        },
      ],
    };
  });

  return {
    score: { tracks: [track] },
    boundsLookup: { staffSystems },
    settings: {
      display: {
        resources: {
          engravingSettings: {
            tabLineSpacing: 10,
            oneStaffSpace: 10,
            staffLineThickness: 1,
          },
        },
      },
    },
  } as unknown as alphaTab.AlphaTabApi;
}

function createFakePercussionApi(
  noteYs: number[],
  standardNotationLineCount = 5,
): alphaTab.AlphaTabApi {
  const track = {
    index: 0,
    isPercussion: true,
    percussionArticulations: [{ id: 42 }, { id: 38 }],
    staves: [] as unknown[],
  };
  const staff = {
    index: 0,
    track,
    showStandardNotation: true,
    showTablature: false,
    standardNotationLineCount,
    tuning: [],
  };
  track.staves.push(staff);
  const bar = { index: 0, staff };
  const barBounds = {
    bar,
    realBounds: { x: 40, y: 120, w: 720, h: 40 },
    beats: noteYs.length === 0
      ? []
      : [{
          notes: noteYs.map((y, index) => ({
            note: {
              string: -1,
              percussionArticulation: index % 2,
            },
            noteHeadBounds: { x: 100, y: y - 5, w: 10, h: 10 },
          })),
        }],
  };
  return {
    score: { tracks: [track] },
    boundsLookup: {
      staffSystems: [{
        index: 0,
        realBounds: { x: 40, y: 100, w: 720, h: 120 },
        bars: [{
          index: 0,
          realBounds: { x: 40, y: 100, w: 720, h: 120 },
          bars: [barBounds],
        }],
      }],
    },
    settings: {
      display: {
        resources: {
          engravingSettings: {
            tabLineSpacing: 10,
            oneStaffSpace: 10,
            staffLineThickness: 1,
          },
        },
      },
    },
  } as unknown as alphaTab.AlphaTabApi;
}

afterEach(() => {
  destroySnapGridOverlay();
  vi.mocked(getApi).mockReturnValue(null);
});

describe("system-scoped snap grids", () => {
  it("keeps rendered geometry per system and navigation per staff", () => {
    vi.mocked(getApi).mockReturnValue(createFakeApi([100, 400]));

    buildSnapGrids();

    expect([...getSnapGrids().keys()]).toEqual([
      "0:0:0:tablature",
      "1:0:0:tablature",
    ]);
    const firstSystem = getSnapGridForBar(0, 0, 0);
    const secondSystem = getSnapGridForBar(0, 0, 1);
    expect(firstSystem?.systemIndex).toBe(0);
    expect(secondSystem?.systemIndex).toBe(1);
    expect(firstSystem?.positions[0].y).toBe(119.5);
    expect(secondSystem?.positions[0].y).toBe(419.5);
    expect(getNavigablePositions(0, 0)).toEqual([6, 5, 4, 3, 2, 1]);
  });

  it("replaces bar and navigation indexes on rebuild", () => {
    vi.mocked(getApi).mockReturnValue(createFakeApi([100, 400]));
    buildSnapGrids();

    vi.mocked(getApi).mockReturnValue(createFakeApi([250]));
    buildSnapGrids();

    expect([...getSnapGrids().keys()]).toEqual(["0:0:0:tablature"]);
    expect(getSnapGridForBar(0, 0, 0)?.positions[0].y).toBe(269.5);
    expect(getSnapGridForBar(0, 0, 1)).toBeNull();
    expect(getNavigablePositions(0, 0)).toEqual([6, 5, 4, 3, 2, 1]);
  });

  it("keeps standard notation and tablature as separate rendered staves", () => {
    vi.mocked(getApi).mockReturnValue(createFakeApi([100], {
      showStandardNotation: true,
    }));

    buildSnapGrids();

    expect([...getSnapGrids().keys()]).toEqual([
      "0:0:0:standard",
      "0:0:0:tablature",
    ]);
    const standard = getSnapGridForBar(0, 0, 0, "standard");
    const tablature = getSnapGridForBar(0, 0, 0, "tablature");
    expect(getSnapGridsForBar(0, 0, 0)).toEqual([standard, tablature]);
    expect(standard?.renderedStave).toBe("standard");
    expect(standard?.positions).toHaveLength(21);
    expect(tablature?.renderedStave).toBe("tablature");
    expect(tablature?.positions).toHaveLength(6);
    expect(standard?.positions[0]).toEqual({ string: 1, y: 89.5 });
    expect(tablature?.positions[0]).toEqual({ string: 6, y: 179.5 });
    expect(getNavigablePositions(0, 0, "standard")).toEqual(
      Array.from({ length: 21 }, (_value, index) => index + 1),
    );
    expect(getNavigablePositions(0, 0, "tablature")).toEqual([
      6, 5, 4, 3, 2, 1,
    ]);
  });

  it("keeps tablature positions independent from rendered note density", () => {
    vi.mocked(getApi).mockReturnValue(createFakeApi([100]));
    buildSnapGrids();
    const emptyPositions = getSnapGridForBar(0, 0, 0)?.positions;

    vi.mocked(getApi).mockReturnValue(createFakeApi([100], {
      noteStrings: [6],
    }));
    buildSnapGrids();
    const singleStringPositions = getSnapGridForBar(0, 0, 0)?.positions;

    vi.mocked(getApi).mockReturnValue(createFakeApi([100], {
      noteStrings: [1, 3, 6],
    }));
    buildSnapGrids();
    const multipleStringPositions = getSnapGridForBar(0, 0, 0)?.positions;

    expect(emptyPositions).toEqual([
      { string: 6, y: 119.5 },
      { string: 5, y: 129.5 },
      { string: 4, y: 139.5 },
      { string: 3, y: 149.5 },
      { string: 2, y: 159.5 },
      { string: 1, y: 169.5 },
    ]);
    expect(singleStringPositions).toEqual(emptyPositions);
    expect(multipleStringPositions).toEqual(emptyPositions);
  });

  it("uses rendered tablature height instead of global line spacing", () => {
    vi.mocked(getApi).mockReturnValue(createFakeApi([100], {
      tabHeight: 75,
      noteStrings: [6],
    }));

    buildSnapGrids();

    expect(getSnapGridForBar(0, 0, 0)?.positions).toEqual([
      { string: 6, y: 119.5 },
      { string: 5, y: 134.5 },
      { string: 4, y: 149.5 },
      { string: 3, y: 164.5 },
      { string: 2, y: 179.5 },
      { string: 1, y: 194.5 },
    ]);
  });

  it("keeps percussion positions and mappings independent from rendered notes", () => {
    vi.mocked(getApi).mockReturnValue(createFakePercussionApi([]));
    buildSnapGrids();
    const emptyGrid = getSnapGridForBar(0, 0, 0);

    vi.mocked(getApi).mockReturnValue(createFakePercussionApi([50, 190]));
    buildSnapGrids();
    const populatedGrid = getSnapGridForBar(0, 0, 0);

    expect(emptyGrid?.positions).toHaveLength(36);
    expect(emptyGrid?.positions[0]).toEqual({ string: -12, y: 59.5 });
    expect(emptyGrid?.positions.at(-1)).toEqual({ string: 23, y: 234.5 });
    expect(populatedGrid?.positions).toEqual(emptyGrid?.positions);
    expect(emptyGrid?.percussionMap).toEqual(new Map([
      [-1, 0],
      [3, 1],
    ]));
    expect(populatedGrid?.percussionMap).toEqual(emptyGrid?.percussionMap);
    expect(getNavigablePositions(0, 0, "standard")).toEqual(
      Array.from({ length: 36 }, (_value, index) => index - 12),
    );
  });

  it("centers a reduced-line percussion stave within its rendered height", () => {
    vi.mocked(getApi).mockReturnValue(createFakePercussionApi([], 1));

    buildSnapGrids();

    const grid = getSnapGridForBar(0, 0, 0);
    expect(grid?.positions.find((position) => position.string === 0)).toEqual({
      string: 0,
      y: 139.5,
    });
    expect(grid?.positions.find((position) => position.string === 3)).toEqual({
      string: 3,
      y: 154.5,
    });
  });
});
