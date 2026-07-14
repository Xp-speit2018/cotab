export interface CodexProxySettings {
  readonly enabled: boolean;
  readonly url: string;
}

const STORAGE_KEY = "cotab:codex-proxy-v1";

export const DEFAULT_CODEX_PROXY_SETTINGS: CodexProxySettings = {
  enabled: false,
  url: "",
};

export function normalizeCodexProxyUrl(value: string): string {
  const normalized = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("Enter a valid HTTP or HTTPS proxy URL.");
  }
  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    || !parsed.hostname
  ) {
    throw new Error("Enter a valid HTTP or HTTPS proxy URL.");
  }
  return normalized;
}

export function normalizeCodexProxySettings(
  settings: CodexProxySettings,
): CodexProxySettings {
  if (!settings.enabled) {
    return { enabled: false, url: settings.url.trim() };
  }
  return { enabled: true, url: normalizeCodexProxyUrl(settings.url) };
}

export function activeCodexProxyUrl(
  settings: CodexProxySettings,
): string | null {
  return settings.enabled ? normalizeCodexProxyUrl(settings.url) : null;
}

export function loadCodexProxySettings(): CodexProxySettings {
  if (typeof localStorage === "undefined") return DEFAULT_CODEX_PROXY_SETTINGS;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_CODEX_PROXY_SETTINGS;
  try {
    const value = JSON.parse(raw) as { enabled?: unknown; url?: unknown };
    if (typeof value.enabled !== "boolean" || typeof value.url !== "string") {
      return DEFAULT_CODEX_PROXY_SETTINGS;
    }
    return normalizeCodexProxySettings({
      enabled: value.enabled,
      url: value.url,
    });
  } catch {
    return DEFAULT_CODEX_PROXY_SETTINGS;
  }
}

export function saveCodexProxySettings(settings: CodexProxySettings): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
