import { useCallback } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { EditorSidebar } from "@/components/NoteEditorSidebar";
import { ScoreViewport } from "@/components/ScoreViewport";
import { DocumentTabBar } from "@/components/DocumentTabBar";
import { EmptyWorkspace } from "@/components/EmptyWorkspace";
import type {
  EditorTabId,
  SectionId,
  SectionTabId,
  SidebarSide,
} from "@/components/NoteEditorSidebar/layout";
import { COLLAPSED_SIDEBAR_WIDTH } from "@/components/NoteEditorSidebar/layout";
import { useSidebarLayoutStore } from "@/components/NoteEditorSidebar/sidebar-store";
import { useDocumentWorkspaceStore } from "@/workspace/document-workspace";

interface DragData {
  readonly type?: "tab" | "section" | "sidebar" | "tab-content";
  readonly tabId?: EditorTabId;
  readonly sectionId?: SectionId;
  readonly side?: SidebarSide;
}

function sectionTabFromOver(data: DragData): SectionTabId | null {
  if (data.type !== "tab" && data.type !== "tab-content") return null;
  const tabId = data.tabId;
  return tabId && tabId !== "agent" ? tabId : null;
}

function sidebarSideFromOver(data: DragData): SidebarSide | null {
  if (data.side) return data.side;
  if (data.type !== "section" || !data.sectionId) return null;
  const state = useSidebarLayoutStore.getState();
  const tab = (Object.entries(state.sections).find(([, ids]) =>
    ids.includes(data.sectionId!),
  )?.[0] as SectionTabId | undefined) ?? null;
  if (!tab) return null;
  if (state.placement.left.includes(tab)) return "left";
  if (state.placement.right.includes(tab)) return "right";
  return null;
}

export function EditorWorkspace() {
  const moveTab = useSidebarLayoutStore((state) => state.moveTab);
  const moveSection = useSidebarLayoutStore((state) => state.moveSection);
  const placement = useSidebarLayoutStore((state) => state.placement);
  const collapsed = useSidebarLayoutStore((state) => state.collapsed);
  const width = useSidebarLayoutStore((state) => state.width);
  const hasDocuments = useDocumentWorkspaceStore((state) => state.tabs.length > 0);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const active = event.active.data.current as DragData | undefined;
    const over = event.over?.data.current as DragData | undefined;
    if (!active || !over) return;

    if (active.type === "tab" && active.tabId) {
      if (over.type === "tab" && over.tabId === active.tabId) return;
      const destination = sidebarSideFromOver(over);
      if (!destination) return;
      moveTab(
        active.tabId,
        destination,
        over.type === "tab" ? over.tabId : undefined,
      );
      return;
    }

    if (active.type === "section" && active.sectionId) {
      if (over.type === "section" && over.sectionId === active.sectionId) return;
      let destination = sectionTabFromOver(over);
      if (!destination && over.type === "section" && over.sectionId) {
        const sections = useSidebarLayoutStore.getState().sections;
        destination = (Object.entries(sections).find(([, ids]) =>
          ids.includes(over.sectionId!),
        )?.[0] as SectionTabId | undefined) ?? null;
      }
      if (!destination) return;
      moveSection(
        active.sectionId,
        destination,
        over.type === "section" ? over.sectionId : undefined,
      );
    }
  }, [moveSection, moveTab]);

  const sidebarWidth = (side: SidebarSide) =>
    !hasDocuments
      ? 0
      : collapsed[side] || placement[side].length === 0
      ? COLLAPSED_SIDEBAR_WIDTH
      : width[side];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div
        className="relative grid min-h-0 flex-1 overflow-hidden"
        style={{
          gridTemplateColumns: `${sidebarWidth("left")}px minmax(0, 1fr) ${sidebarWidth("right")}px`,
          gridTemplateRows: "2rem minmax(0, 1fr)",
        }}
      >
        {hasDocuments && (
          <div className="row-span-2 flex min-h-0 min-w-0">
            <EditorSidebar side="left" />
          </div>
        )}
        <div className="col-start-2 row-start-1 min-w-0">
          <DocumentTabBar />
        </div>
        <div className="col-start-2 row-start-2 flex min-h-0 min-w-0">
          {hasDocuments ? <ScoreViewport /> : <EmptyWorkspace />}
        </div>
        {hasDocuments && (
          <div className="col-start-3 row-span-2 row-start-1 flex min-h-0 min-w-0">
            <EditorSidebar side="right" />
          </div>
        )}
      </div>
    </DndContext>
  );
}
