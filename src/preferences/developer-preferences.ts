const DEBUG_TAB_ENABLED_KEY = "cotab:debug-tab-enabled";
const SNAP_GRID_VISIBLE_KEY = "cotab:snap-grid-visible";

function loadBooleanPreference(key: string, fallback: boolean): boolean {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === "true";
  } catch {
    return fallback;
  }
}

function saveBooleanPreference(key: string, value: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // The preference still applies for the current session.
  }
}

export function loadDebugTabEnabled(): boolean {
  return loadBooleanPreference(DEBUG_TAB_ENABLED_KEY, true);
}

export function saveDebugTabEnabled(enabled: boolean): void {
  saveBooleanPreference(DEBUG_TAB_ENABLED_KEY, enabled);
}

export function loadSnapGridVisible(): boolean {
  return loadBooleanPreference(SNAP_GRID_VISIBLE_KEY, false);
}

export function saveSnapGridVisible(visible: boolean): void {
  saveBooleanPreference(SNAP_GRID_VISIBLE_KEY, visible);
}
