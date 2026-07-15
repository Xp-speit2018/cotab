import { afterEach, describe, expect, it, vi } from "vitest";
import type * as alphaTab from "@coderline/alphatab";

vi.unmock("@/stores/snap-grid");

import { getApi } from "@/stores/render-api";
import {
  buildSnapGrids,
  destroySnapGridOverlay,
  getNavigablePositions,
  getSnapGridForBar,
  getSnapGrids,
} from "@/stores/snap-grid";

function createFakeApi(systemYs: number[]): alphaTab.AlphaTabApi {
  const track = {
    index: 0,
    isPercussion: false,
    percussionArticulations: [],
    staves: [] as unknown[],
  };
  const staff = {
    index: 0,
    track,
    showTablature: true,
    tuning: [64, 59, 55, 50, 45, 40],
  };
  track.staves.push(staff);

  const staffSystems = systemYs.map((y, systemIndex) => {
    const bar = {
      index: systemIndex,
      staff,
    };
    return {
      index: systemIndex,
      realBounds: { x: 40, y, w: 720, h: 120 },
      bars: [
        {
          realBounds: { x: 40, y, w: 720, h: 120 },
          bars: [
            {
              bar,
              realBounds: { x: 40, y: y + 20, w: 720, h: 60 },
              beats: [],
            },
          ],
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

afterEach(() => {
  destroySnapGridOverlay();
  vi.mocked(getApi).mockReturnValue(null);
});

describe("system-scoped snap grids", () => {
  it("keeps rendered geometry per system and navigation per staff", () => {
    vi.mocked(getApi).mockReturnValue(createFakeApi([100, 400]));

    buildSnapGrids();

    expect([...getSnapGrids().keys()]).toEqual(["0:0:0", "1:0:0"]);
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

    expect([...getSnapGrids().keys()]).toEqual(["0:0:0"]);
    expect(getSnapGridForBar(0, 0, 0)?.positions[0].y).toBe(269.5);
    expect(getSnapGridForBar(0, 0, 1)).toBeNull();
    expect(getNavigablePositions(0, 0)).toEqual([6, 5, 4, 3, 2, 1]);
  });
});
