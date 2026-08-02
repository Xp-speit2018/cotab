import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadDebugTabEnabled,
  saveDebugTabEnabled,
} from "@/preferences/developer-preferences";

import {
  DEFAULT_SECTION_LAYOUT,
  defaultTabPlacement,
  loadSectionLayout,
  loadTabPlacement,
} from "../layout";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("sidebar section layout migration", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
  });

  afterEach(() => vi.unstubAllGlobals());

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

  it("places Notes and Debug left and Meta and Agent right by default", () => {
    expect(defaultTabPlacement(true)).toEqual({
      left: ["notes", "debug"],
      right: ["meta", "agent"],
    });
    expect(defaultTabPlacement(false)).toEqual({
      left: ["notes", "debug"],
      right: ["meta"],
    });
  });

  it("migrates the previous default placement to the new sidebar split", () => {
    localStorage.setItem("cotab:sidebar-tab-placement-v1", JSON.stringify({
      left: ["notes", "meta", "debug"],
      right: ["agent"],
    }));

    expect(loadTabPlacement(true, true)).toEqual({
      left: ["notes", "debug"],
      right: ["meta", "agent"],
    });
  });

  it("persists Debug tab visibility without losing other tab placement", () => {
    localStorage.setItem("cotab:sidebar-tab-placement-v2", JSON.stringify({
      left: ["notes"],
      right: ["meta", "agent"],
    }));
    saveDebugTabEnabled(false);

    expect(loadDebugTabEnabled()).toBe(false);
    expect(loadTabPlacement(true, false)).toEqual({
      left: ["notes"],
      right: ["meta", "agent"],
    });

    saveDebugTabEnabled(true);
    expect(loadTabPlacement(true, true)).toEqual({
      left: ["notes", "debug"],
      right: ["meta", "agent"],
    });
  });
});
