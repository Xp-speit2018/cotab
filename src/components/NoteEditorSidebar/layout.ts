import { loadDebugTabEnabled } from "@/preferences/developer-preferences";

export const DEFAULT_SIDEBAR_WIDTH = 280;
export const DEFAULT_AGENT_SIDEBAR_WIDTH = 400;
export const COLLAPSED_SIDEBAR_WIDTH = 36;
export const MIN_SIDEBAR_WIDTH = 200;
export const MAX_SIDEBAR_WIDTH = 520;

const WIDTH_KEYS = {
  left: "cotab:left-sidebar-width",
  right: "cotab:right-sidebar-width",
} as const;
const COLLAPSED_KEYS = {
  left: "cotab:left-sidebar-collapsed",
  right: "cotab:right-sidebar-collapsed",
} as const;
const TAB_PLACEMENT_KEY = "cotab:sidebar-tab-placement-v2";
const LEGACY_TAB_PLACEMENT_KEY = "cotab:sidebar-tab-placement-v1";
const SECTION_LAYOUT_KEY = "cotab:sidebar-section-layout-v1";
const LEGACY_SECTION_LAYOUT_KEY = "cotab:sidebar-tab-layout-v5";

export type SidebarSide = "left" | "right";
export type EditorTabId = "notes" | "meta" | "debug" | "agent";
export type SectionTabId = Exclude<EditorTabId, "agent">;

export type SectionId =
  | "song"
  | "tracks"
  | "articulation"
  | "log"
  | "fps"
  | "editorState"
  | "alphaTabState"
  | "masterBar"
  | "bar"
  | "note"
  | "effects";

export const ALL_SECTION_IDS: SectionId[] = [
  "song",
  "tracks",
  "articulation",
  "log",
  "fps",
  "editorState",
  "alphaTabState",
  "masterBar",
  "bar",
  "note",
  "effects",
];

export interface SidebarTabPlacement {
  left: EditorTabId[];
  right: EditorTabId[];
}

export type SectionLayout = Record<SectionTabId, SectionId[]>;

export const DEFAULT_SECTION_LAYOUT: SectionLayout = {
  notes: ["masterBar", "bar", "note", "effects", "articulation"],
  meta: ["song", "tracks"],
  debug: ["editorState", "alphaTabState", "log", "fps"],
};

function readNumber(key: string): number | null {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function loadSidebarWidth(side: SidebarSide): number {
  const value = readNumber(WIDTH_KEYS[side]);
  if (value !== null && value >= MIN_SIDEBAR_WIDTH && value <= MAX_SIDEBAR_WIDTH) {
    return value;
  }
  return side === "right" ? DEFAULT_AGENT_SIDEBAR_WIDTH : DEFAULT_SIDEBAR_WIDTH;
}

export function saveSidebarWidth(side: SidebarSide, width: number): void {
  try {
    localStorage.setItem(WIDTH_KEYS[side], String(width));
  } catch {
    // Resizing still applies for the current session.
  }
}

export function loadSidebarCollapsed(side: SidebarSide): boolean {
  try {
    const value = localStorage.getItem(COLLAPSED_KEYS[side]);
    if (value !== null) return value === "true";
  } catch {
    // Use defaults.
  }
  return false;
}

export function saveSidebarCollapsed(side: SidebarSide, collapsed: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_KEYS[side], String(collapsed));
  } catch {
    // Collapsing still applies for the current session.
  }
}

export function availableEditorTabs(
  desktop: boolean,
  debugTabEnabled = loadDebugTabEnabled(),
): EditorTabId[] {
  return [
    "notes",
    "meta",
    ...(debugTabEnabled ? ["debug" as const] : []),
    ...(desktop ? ["agent" as const] : []),
  ];
}

export function defaultTabPlacement(
  desktop: boolean,
  debugTabEnabled = loadDebugTabEnabled(),
): SidebarTabPlacement {
  return {
    left: debugTabEnabled ? ["notes", "debug"] : ["notes"],
    right: desktop ? ["meta", "agent"] : ["meta"],
  };
}

export function loadTabPlacement(
  desktop: boolean,
  debugTabEnabled = loadDebugTabEnabled(),
): SidebarTabPlacement {
  const available = availableEditorTabs(desktop, debugTabEnabled);
  const allAvailable = availableEditorTabs(desktop, true);
  try {
    const current = localStorage.getItem(TAB_PLACEMENT_KEY);
    const legacy = current === null
      ? localStorage.getItem(LEGACY_TAB_PLACEMENT_KEY)
      : null;
    const parsed = JSON.parse(current ?? legacy ?? "null") as
      | Partial<SidebarTabPlacement>
      | null;
    if (parsed && Array.isArray(parsed.left) && Array.isArray(parsed.right)) {
      const legacyDefault = desktop
        ? { left: ["notes", "meta", "debug"], right: ["agent"] }
        : { left: ["notes", "meta", "debug"], right: [] };
      if (
        legacy !== null
        && JSON.stringify(parsed) === JSON.stringify(legacyDefault)
      ) {
        return defaultTabPlacement(desktop, debugTabEnabled);
      }
      const ordered = [...parsed.left, ...parsed.right].filter(
        (id): id is EditorTabId => allAvailable.includes(id as EditorTabId),
      );
      if (
        new Set(ordered).size === ordered.length &&
        available.every((id) => id === "debug" || ordered.includes(id))
      ) {
        const placement: SidebarTabPlacement = {
          left: parsed.left.filter((id): id is EditorTabId => available.includes(id as EditorTabId)),
          right: parsed.right.filter((id): id is EditorTabId => available.includes(id as EditorTabId)),
        };
        if (debugTabEnabled && !ordered.includes("debug")) {
          const notesIndex = placement.left.indexOf("notes");
          placement.left.splice(notesIndex + 1, 0, "debug");
        }
        if (legacy !== null) saveTabPlacement(placement);
        return placement;
      }
    }
  } catch {
    // Use defaults.
  }
  return defaultTabPlacement(desktop, debugTabEnabled);
}

export function saveTabPlacement(placement: SidebarTabPlacement): void {
  try {
    localStorage.setItem(TAB_PLACEMENT_KEY, JSON.stringify(placement));
  } catch {
    // Placement still applies for the current session.
  }
}

function sectionLayoutFromArrays(value: unknown): SectionLayout | null {
  if (
    !Array.isArray(value)
    || value.length !== 3
    || !value.every((entry) => Array.isArray(entry))
  ) return null;

  const seen = new Set<SectionId>();
  const normalized = (value as unknown[][]).map((entries) => entries.filter(
    (entry): entry is SectionId => {
      if (typeof entry !== "string" || !ALL_SECTION_IDS.includes(entry as SectionId)) return false;
      const id = entry as SectionId;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    },
  ));
  const layout: SectionLayout = {
    notes: normalized[0],
    meta: normalized[1],
    debug: normalized[2],
  };

  if (!seen.has("masterBar")) {
    const barIndex = layout.notes.indexOf("bar");
    layout.notes.splice(barIndex >= 0 ? barIndex : 0, 0, "masterBar");
    seen.add("masterBar");
  }

  for (const tabId of ["notes", "meta", "debug"] as const) {
    for (const id of DEFAULT_SECTION_LAYOUT[tabId]) {
      if (seen.has(id)) continue;
      layout[tabId].push(id);
      seen.add(id);
    }
  }
  return layout;
}

export function loadSectionLayout(): SectionLayout {
  try {
    const current = localStorage.getItem(SECTION_LAYOUT_KEY);
    if (current) {
      const parsed = JSON.parse(current) as Partial<SectionLayout>;
      const arrays = [parsed.notes, parsed.meta, parsed.debug];
      const layout = sectionLayoutFromArrays(arrays);
      if (layout) return layout;
    }
    const legacy = localStorage.getItem(LEGACY_SECTION_LAYOUT_KEY);
    if (legacy) {
      const layout = sectionLayoutFromArrays(JSON.parse(legacy));
      if (layout) return layout;
    }
  } catch {
    // Use defaults.
  }
  return DEFAULT_SECTION_LAYOUT;
}

export function saveSectionLayout(layout: SectionLayout): void {
  try {
    localStorage.setItem(SECTION_LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // Layout still applies for the current session.
  }
}

export function findSectionTab(
  layout: SectionLayout,
  sectionId: SectionId,
): SectionTabId | null {
  for (const tabId of ["notes", "meta", "debug"] as const) {
    if (layout[tabId].includes(sectionId)) return tabId;
  }
  return null;
}
