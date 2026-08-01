import { describe, expect, it } from "vitest";

import { scoreFileKind } from "../score-file-types";

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
