import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { usePlayerStore } from "@/stores/player-store";
import type { SelectedNoteInfo } from "@/stores/player-types";
import { cn } from "@/lib/utils";
import { FpsSection } from "@/components/FpsMonitor";
import {
  MIN_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  TAB_COUNT,
  loadSidebarWidth,
  saveSidebarWidth,
  loadTabLayout,
  saveTabLayout,
  findTabIndex,
  type SectionId,
  type TabLayout,
} from "./layout";
import { SortableSection } from "./primitives";
import { TabDroppable } from "./TabDroppable";
import { SongSection } from "./SongSection";
import { TracksSection } from "./TracksSection";
import { SelectorSection } from "./SelectorSection";
import { ArticulationSection } from "./ArticulationSection";
import { BarSection } from "./BarSection";
import { NoteSection } from "./NoteSection";
import { EffectsSection } from "./EffectsSection";
import { LogSection } from "./LogSection";

export function NoteEditorSidebar() {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const widthAtDragStart = useRef(sidebarWidth);
  const [activeTab, setActiveTab] = useState(0);
  const [tabLayout, setTabLayout] = useState<TabLayout>(loadTabLayout);
  const selectedBeatInfo = usePlayerStore((s) => s.selectedBeatInfo);
  const selectedBarInfo = usePlayerStore((s) => s.selectedBarInfo);
  const selectedNoteIndex = usePlayerStore((s) => s.selectedNoteIndex);

  const activeNote: SelectedNoteInfo | null =
    selectedBeatInfo &&
    selectedNoteIndex >= 0 &&
    selectedNoteIndex < selectedBeatInfo.notes.length
      ? selectedBeatInfo.notes[selectedNoteIndex]
      : null;

  const hasBeat = !!(selectedBeatInfo && selectedBarInfo);

  const handleSidebarResize = useCallback((deltaX: number) => {
    const newWidth = Math.min(
      MAX_SIDEBAR_WIDTH,
      Math.max(MIN_SIDEBAR_WIDTH, widthAtDragStart.current + deltaX),
    );
    setSidebarWidth(newWidth);
  }, []);

  const handleSidebarResizeEnd = useCallback(() => {
    saveSidebarWidth(sidebarWidth);
    widthAtDragStart.current = sidebarWidth;
  }, [sidebarWidth]);

  const handleSidebarResizeStart = useCallback(() => {
    widthAtDragStart.current = sidebarWidth;
  }, [sidebarWidth]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      const fromTab = findTabIndex(tabLayout, activeId);
      let toTab: number;
      if (overId.startsWith("tab-")) {
        toTab = parseInt(overId.split("-")[1], 10);
      } else {
        toTab = findTabIndex(tabLayout, overId);
      }

      if (fromTab === -1 || toTab === -1 || fromTab === toTab) return;

      setTabLayout((prev) => {
        const next = prev.map((tab) => [...tab]);
        const idx = next[fromTab].indexOf(activeId as SectionId);
        if (idx === -1) return prev;
        next[fromTab].splice(idx, 1);

        if (overId.startsWith("tab-")) {
          next[toTab].push(activeId as SectionId);
        } else {
          const overIdx = next[toTab].indexOf(overId as SectionId);
          if (overIdx === -1) {
            next[toTab].push(activeId as SectionId);
          } else {
            next[toTab].splice(overIdx, 0, activeId as SectionId);
          }
        }

        saveTabLayout(next);
        return next;
      });
    },
    [tabLayout],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      if (overId.startsWith("tab-")) return;

      const activeTabIdx = findTabIndex(tabLayout, activeId);
      const overTabIdx = findTabIndex(tabLayout, overId);

      if (activeTabIdx === -1 || activeTabIdx !== overTabIdx) return;
      if (activeId === overId) return;

      setTabLayout((prev) => {
        const next = prev.map((tab) => [...tab]);
        const oldIndex = next[activeTabIdx].indexOf(activeId as SectionId);
        const newIndex = next[activeTabIdx].indexOf(overId as SectionId);
        next[activeTabIdx] = arrayMove(next[activeTabIdx], oldIndex, newIndex);
        saveTabLayout(next);
        return next;
      });
    },
    [tabLayout],
  );

  const renderSection = useCallback(
    (id: SectionId, dragHandleProps: Record<string, unknown>) => {
      switch (id) {
        case "song":
          return <SongSection dragHandleProps={dragHandleProps} />;
        case "tracks":
          return <TracksSection dragHandleProps={dragHandleProps} />;
        case "selector":
          return (
            <SelectorSection
              beat={selectedBeatInfo}
              note={activeNote}
              noteIndex={selectedNoteIndex}
              dragHandleProps={dragHandleProps}
            />
          );
        case "articulation":
          return <ArticulationSection dragHandleProps={dragHandleProps} />;
        case "log":
          return <LogSection dragHandleProps={dragHandleProps} />;
        case "fps":
          return <FpsSection dragHandleProps={dragHandleProps} />;
        case "bar":
          return hasBeat ? (
            <BarSection bar={selectedBarInfo!} dragHandleProps={dragHandleProps} />
          ) : null;
        case "note":
          return hasBeat ? (
            <NoteSection beat={selectedBeatInfo!} note={activeNote} dragHandleProps={dragHandleProps} />
          ) : null;
        case "effects":
          return hasBeat ? (
            <EffectsSection beat={selectedBeatInfo!} note={activeNote} dragHandleProps={dragHandleProps} />
          ) : null;
        default:
          return null;
      }
    },
    [selectedBeatInfo, selectedBarInfo, selectedNoteIndex, activeNote, hasBeat],
  );

  if (collapsed) {
    return (
      <div className="flex flex-col items-center border-r bg-card py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
              onClick={() => setCollapsed(false)}
              aria-label={t("sidebar.expandSidebar")}
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{t("sidebar.expandSidebar")}</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  const currentTabSections = tabLayout[activeTab] ?? [];

  return (
    <div className="flex min-h-0 flex-shrink-0" style={{ width: sidebarWidth }}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-card">
        <div className="flex shrink-0 items-center border-b">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => setCollapsed(true)}
                aria-label={t("sidebar.collapseSidebar")}
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{t("sidebar.collapseSidebar")}</TooltipContent>
          </Tooltip>
          {Array.from({ length: TAB_COUNT }, (_, i) => (
            <button
              key={i}
              type="button"
              className={cn(
                "flex-1 py-2 text-center text-[10px] font-medium uppercase tracking-wider transition-colors",
                activeTab === i
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setActiveTab(i)}
            >
              {t(`sidebar.tabNames.${i}`)}
            </button>
          ))}
        </div>

        <ScrollArea className="flex-1 overflow-hidden">
          <div className="pb-4 pr-3">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={currentTabSections}
                strategy={verticalListSortingStrategy}
              >
                <TabDroppable tabId={`tab-${activeTab}`}>
                  {currentTabSections.length > 0 ? (
                    currentTabSections.map((id) => (
                      <SortableSection key={id} id={id}>
                        {(dragHandleProps) => renderSection(id, dragHandleProps)}
                      </SortableSection>
                    ))
                  ) : (
                    <div className="flex items-center justify-center p-6">
                      <p className="text-center text-[10px] text-muted-foreground">
                        {t("sidebar.dropHereHint")}
                      </p>
                    </div>
                  )}
                </TabDroppable>
              </SortableContext>
            </DndContext>

            {!hasBeat &&
              currentTabSections.some((id) => id === "bar" || id === "note" || id === "effects") && (
                <div className="flex items-center justify-center p-4">
                  <p className="text-center text-xs text-muted-foreground">
                    {t("sidebar.emptyState")}
                  </p>
                </div>
              )}
          </div>
        </ScrollArea>
      </div>

      <ResizeHandle
        side="right"
        onResizeStart={handleSidebarResizeStart}
        onResize={handleSidebarResize}
        onResizeEnd={handleSidebarResizeEnd}
      />
    </div>
  );
}
