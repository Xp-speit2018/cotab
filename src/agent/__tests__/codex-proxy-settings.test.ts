import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  activeCodexProxyUrl,
  DEFAULT_CODEX_PROXY_SETTINGS,
  loadCodexProxySettings,
  normalizeCodexProxyUrl,
  saveCodexProxySettings,
} from "../codex-proxy-settings";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("Codex proxy settings", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
  });

  it("accepts HTTP proxies and rejects unsupported schemes", () => {
    expect(normalizeCodexProxyUrl(" http://localhost:9098 "))
      .toBe("http://localhost:9098");
    expect(normalizeCodexProxyUrl("https://proxy.example:8443"))
      .toBe("https://proxy.example:8443");
    expect(() => normalizeCodexProxyUrl("socks5://localhost:9099")).toThrow();
    expect(() => normalizeCodexProxyUrl("localhost:9098")).toThrow();
  });

  it("persists an application-level custom proxy", () => {
    expect(loadCodexProxySettings()).toEqual(DEFAULT_CODEX_PROXY_SETTINGS);
    saveCodexProxySettings({ enabled: true, url: "http://localhost:9098" });
    const settings = loadCodexProxySettings();
    expect(settings).toEqual({ enabled: true, url: "http://localhost:9098" });
    expect(activeCodexProxyUrl(settings)).toBe("http://localhost:9098");
  });
});
