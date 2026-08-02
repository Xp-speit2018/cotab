import { create } from "zustand";
import { isTauriRuntime } from "@/agent/target";
import {
  loadDebugTabEnabled,
  saveDebugTabEnabled,
} from "@/preferences/developer-preferences";
import {
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  findSectionTab,
  loadSectionLayout,
  loadSidebarCollapsed,
  loadSidebarWidth,
  loadTabPlacement,
  saveSectionLayout,
  saveSidebarCollapsed,
  saveSidebarWidth,
  saveTabPlacement,
  type EditorTabId,
  type SectionId,
  type SectionLayout,
  type SectionTabId,
  type SidebarSide,
  type SidebarTabPlacement,
} from "./layout";

interface SidebarLayoutState {
  placement: SidebarTabPlacement;
  sections: SectionLayout;
  activeTab: Record<SidebarSide, EditorTabId | null>;
  collapsed: Record<SidebarSide, boolean>;
  width: Record<SidebarSide, number>;
  debugTabEnabled: boolean;
  setActiveTab: (side: SidebarSide, tabId: EditorTabId) => void;
  setCollapsed: (side: SidebarSide, collapsed: boolean) => void;
  setWidth: (side: SidebarSide, width: number) => void;
  saveWidth: (side: SidebarSide) => void;
  moveTab: (
    tabId: EditorTabId,
    destination: SidebarSide,
    beforeTabId?: EditorTabId,
  ) => void;
  moveSection: (
    sectionId: SectionId,
    destination: SectionTabId,
    beforeSectionId?: SectionId,
  ) => void;
  setDebugTabEnabled: (enabled: boolean) => void;
}

const desktop = isTauriRuntime();
const initialDebugTabEnabled = loadDebugTabEnabled();
const initialPlacement = loadTabPlacement(desktop, initialDebugTabEnabled);

export const useSidebarLayoutStore = create<SidebarLayoutState>((set, get) => ({
  placement: initialPlacement,
  sections: loadSectionLayout(),
  activeTab: {
    left: initialPlacement.left[0] ?? null,
    right: initialPlacement.right[0] ?? null,
  },
  collapsed: {
    left: loadSidebarCollapsed("left"),
    right: loadSidebarCollapsed("right"),
  },
  width: {
    left: loadSidebarWidth("left"),
    right: loadSidebarWidth("right"),
  },
  debugTabEnabled: initialDebugTabEnabled,

  setActiveTab: (side, tabId) => set((state) => ({
    activeTab: { ...state.activeTab, [side]: tabId },
  })),

  setCollapsed: (side, collapsed) => {
    saveSidebarCollapsed(side, collapsed);
    set((state) => ({
      collapsed: { ...state.collapsed, [side]: collapsed },
    }));
  },

  setWidth: (side, width) => set((state) => ({
    width: {
      ...state.width,
      [side]: Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width)),
    },
  })),

  saveWidth: (side) => saveSidebarWidth(side, get().width[side]),

  moveTab: (tabId, destination, beforeTabId) => set((state) => {
    const source = state.placement.left.includes(tabId)
      ? "left"
      : state.placement.right.includes(tabId)
        ? "right"
        : null;
    if (!source) return state;

    const placement: SidebarTabPlacement = {
      left: state.placement.left.filter((id) => id !== tabId),
      right: state.placement.right.filter((id) => id !== tabId),
    };
    const target = placement[destination];
    if (source === destination && beforeTabId) {
      const destinationIndex = state.placement[destination].indexOf(beforeTabId);
      if (destinationIndex === -1) target.push(tabId);
      else target.splice(destinationIndex, 0, tabId);
    } else {
      const beforeIndex = beforeTabId ? target.indexOf(beforeTabId) : -1;
      if (beforeIndex === -1) target.push(tabId);
      else target.splice(beforeIndex, 0, tabId);
    }

    const activeTab = {
      ...state.activeTab,
      ...(source !== destination && state.activeTab[source] === tabId
        ? { [source]: placement[source][0] ?? null }
        : {}),
      [destination]: tabId,
    };
    saveTabPlacement(placement);
    saveSidebarCollapsed(destination, false);
    return {
      placement,
      activeTab,
      collapsed: { ...state.collapsed, [destination]: false },
    };
  }),

  moveSection: (sectionId, destination, beforeSectionId) => set((state) => {
    const source = findSectionTab(state.sections, sectionId);
    if (!source) return state;
    const sections: SectionLayout = {
      notes: state.sections.notes.filter((id) => id !== sectionId),
      meta: state.sections.meta.filter((id) => id !== sectionId),
      debug: state.sections.debug.filter((id) => id !== sectionId),
    };
    const target = sections[destination];
    if (source === destination && beforeSectionId) {
      const destinationIndex = state.sections[destination].indexOf(beforeSectionId);
      if (destinationIndex === -1) target.push(sectionId);
      else target.splice(destinationIndex, 0, sectionId);
    } else {
      const beforeIndex = beforeSectionId ? target.indexOf(beforeSectionId) : -1;
      if (beforeIndex === -1) target.push(sectionId);
      else target.splice(beforeIndex, 0, sectionId);
    }
    saveSectionLayout(sections);

    const side = state.placement.left.includes(destination) ? "left" : "right";
    saveSidebarCollapsed(side, false);
    return {
      sections,
      activeTab: { ...state.activeTab, [side]: destination },
      collapsed: { ...state.collapsed, [side]: false },
    };
  }),

  setDebugTabEnabled: (enabled) => set((state) => {
    if (state.debugTabEnabled === enabled) return state;
    const placement: SidebarTabPlacement = {
      left: state.placement.left.filter((id) => id !== "debug"),
      right: state.placement.right.filter((id) => id !== "debug"),
    };
    if (enabled) {
      const notesIndex = placement.left.indexOf("notes");
      placement.left.splice(notesIndex + 1, 0, "debug");
    }
    const activeTab = { ...state.activeTab };
    for (const side of ["left", "right"] as const) {
      if (!placement[side].includes(activeTab[side] as EditorTabId)) {
        activeTab[side] = placement[side][0] ?? null;
      }
    }
    saveDebugTabEnabled(enabled);
    saveTabPlacement(placement);
    return { debugTabEnabled: enabled, placement, activeTab };
  }),
}));
