const AUTO_SAVE_KEY = "cotab:auto-save-enabled";

export function loadAutoSavePreference(): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    const value = localStorage.getItem(AUTO_SAVE_KEY);
    return value === null ? true : value === "true";
  } catch {
    return true;
  }
}

export function saveAutoSavePreference(enabled: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(AUTO_SAVE_KEY, String(enabled));
  } catch {
    // The preference still applies for the current session.
  }
}
