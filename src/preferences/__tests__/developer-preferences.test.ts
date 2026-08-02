import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadDebugTabEnabled,
  loadSnapGridVisible,
  saveDebugTabEnabled,
  saveSnapGridVisible,
} from "../developer-preferences";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("developer preferences", () => {
  beforeEach(() => vi.stubGlobal("localStorage", new MemoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("defaults to the Debug tab without exposing the snap grid", () => {
    expect(loadDebugTabEnabled()).toBe(true);
    expect(loadSnapGridVisible()).toBe(false);
  });

  it("persists Debug tab and snap grid visibility independently", () => {
    saveDebugTabEnabled(false);
    saveSnapGridVisible(true);

    expect(loadDebugTabEnabled()).toBe(false);
    expect(loadSnapGridVisible()).toBe(true);
  });
});
