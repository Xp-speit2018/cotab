import { describe, expect, it } from "vitest";

import { saveScoreFileKind, scoreFileKind } from "../score-file-types";

describe("scoreFileKind", () => {
  it.each([
    ["song.cotab", "cotab"],
    ["song.GP", "guitarPro"],
    ["song.gp3", "guitarPro"],
    ["song.gp4", "guitarPro"],
    ["song.gp5", "guitarPro"],
    ["song.gpx", "guitarPro"],
    ["song.pdf", null],
  ] as const)("classifies %s", (name, expected) => {
    expect(scoreFileKind(name)).toBe(expected);
  });
});

describe("saveScoreFileKind", () => {
  it.each([
    ["score.cotab", "cotab"],
    ["score.COTAB", "cotab"],
    ["score.gp", "guitarPro"],
    ["score.GP", "guitarPro"],
    ["score.gp5", null],
    ["score.gpx", null],
    ["score", null],
  ])("classifies %s as %s", (name, expected) => {
    expect(saveScoreFileKind(name)).toBe(expected);
  });
});
