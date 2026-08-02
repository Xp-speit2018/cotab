import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadAutoSavePreference,
  saveAutoSavePreference,
} from "../storage-preferences";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("storage preferences", () => {
  beforeEach(() => vi.stubGlobal("localStorage", new MemoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("defaults auto-save on and persists an explicit choice", () => {
    expect(loadAutoSavePreference()).toBe(true);
    saveAutoSavePreference(false);
    expect(loadAutoSavePreference()).toBe(false);
    saveAutoSavePreference(true);
    expect(loadAutoSavePreference()).toBe(true);
  });
});
