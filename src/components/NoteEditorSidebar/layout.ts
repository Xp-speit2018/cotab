export const DEFAULT_SIDEBAR_WIDTH = 280;
export const MIN_SIDEBAR_WIDTH = 200;
export const MAX_SIDEBAR_WIDTH = 480;
export const SIDEBAR_WIDTH_KEY = "cotab:sidebar-width";
const STORAGE_KEY = "cotab:sidebar-tab-layout-v2";

export function loadSidebarWidth(): number {
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (raw) {
      const v = Number(raw);
      if (v >= MIN_SIDEBAR_WIDTH && v <= MAX_SIDEBAR_WIDTH) return v;
    }
  } catch {
    // ignore
  }
  return DEFAULT_SIDEBAR_WIDTH;
}

export function saveSidebarWidth(w: number) {
  localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
}

export const TAB_COUNT = 3;

export type SectionId = "song" | "tracks" | "selector" | "articulation" | "log" | "fps" | "bar" | "note" | "effects";
export const ALL_SECTION_IDS: SectionId[] = ["song", "tracks", "selector", "articulation", "log", "fps", "bar", "note", "effects"];

export type TabLayout = SectionId[][];
export const DEFAULT_LAYOUT: TabLayout = [
  ["bar", "note", "effects", "articulation"],
  ["song", "tracks"],
  ["selector", "log", "fps"],
];

export function loadTabLayout(): TabLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as string[][];
    if (!Array.isArray(parsed) || parsed.length !== TAB_COUNT) return DEFAULT_LAYOUT;
    const allIds = parsed.flat();
    if (
      allIds.length === ALL_SECTION_IDS.length &&
      ALL_SECTION_IDS.every((id) => allIds.includes(id))
    ) {
      return parsed as TabLayout;
    }
  } catch {
    // ignore
  }
  return DEFAULT_LAYOUT;
}

export function saveTabLayout(layout: TabLayout) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

export function findTabIndex(layout: TabLayout, sectionId: string): number {
  for (let i = 0; i < layout.length; i++) {
    if (layout[i].includes(sectionId as SectionId)) return i;
  }
  return -1;
}
