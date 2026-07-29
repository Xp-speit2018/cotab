import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_SECTION_LAYOUT,
  loadSectionLayout,
} from "../layout";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("sidebar section layout migration", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
  });

  it("preserves an existing layout and adds newly introduced sections", () => {
    localStorage.setItem("cotab:sidebar-section-layout-v1", JSON.stringify({
      notes: ["effects", "bar", "note", "articulation"],
      meta: ["tracks", "song"],
      debug: ["fps", "editorState", "syncState", "alphaTabState", "log"],
    }));

    expect(loadSectionLayout()).toEqual({
      notes: ["effects", "masterBar", "bar", "note", "articulation"],
      meta: ["tracks", "song"],
      debug: ["fps", "editorState", "alphaTabState", "log"],
    });
  });

  it("filters stale and duplicate IDs without losing valid placement", () => {
    localStorage.setItem("cotab:sidebar-section-layout-v1", JSON.stringify({
      notes: ["bar", "bar", "removed-section"],
      meta: ["song"],
      debug: ["editorState"],
    }));

    const layout = loadSectionLayout();
    expect(layout.notes.slice(0, 2)).toEqual(["masterBar", "bar"]);
    expect(layout.notes).not.toContain("removed-section");
    expect(new Set(Object.values(layout).flat())).toEqual(
      new Set(Object.values(DEFAULT_SECTION_LAYOUT).flat()),
    );
  });
});
