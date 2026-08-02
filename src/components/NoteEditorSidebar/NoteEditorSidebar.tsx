import { lazy, Suspense, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { usePlayerStore } from "@/stores/render-store";
import type { SelectedNoteInfo } from "@/stores/render-types";
import { cn } from "@/lib/utils";
import { FpsSection } from "@/components/FpsMonitor";
import type {
  EditorTabId,
  SectionId,
  SectionTabId,
  SidebarSide,
} from "./layout";
import { useSidebarLayoutStore } from "./sidebar-store";
import { SortableSection } from "./primitives";
import { TabDroppable } from "./TabDroppable";
import { SongSection } from "./SongSection";
import { TracksSection } from "./TracksSection";
import { ArticulationSection } from "./ArticulationSection";
import { MasterBarSection } from "./MasterBarSection";
import { BarSection } from "./BarSection";
import { NoteSection } from "./NoteSection";
import { EffectsSection } from "./EffectsSection";
import { LogSection } from "./LogSection";
import { EditorStateSection } from "./EditorStateSection";
import { AlphaTabStateSection } from "./AlphaTabStateSection";

const AgentTab = lazy(() =>
  import("@/components/AgentTab").then((module) => ({
    default: module.AgentTab,
  })),
);

function SortableTabButton({
  tabId,
  side,
  active,
  onClick,
}: {
  tabId: EditorTabId;
  side: SidebarSide;
  active: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `editor-tab:${tabId}`,
    data: { type: "tab", tabId, side },
  });
  const {
    role: _sortableRole,
    "aria-pressed": _sortablePressed,
    ...sortableAttributes
  } = attributes;

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn(
        "min-w-0 flex-1 cursor-grab px-1 py-2 text-center text-[10px] font-medium uppercase tracking-wider transition-colors active:cursor-grabbing",
        active
          ? "border-b-2 border-primary text-primary"
          : "text-muted-foreground hover:text-foreground",
        isDragging && "z-50 opacity-70",
      )}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      onClick={onClick}
      {...sortableAttributes}
      {...listeners}
      aria-pressed={active}
    >
      <span className="block truncate">{t(`sidebar.tabNames.${tabId}`)}</span>
    </button>
  );
}

function SidebarCollapseButton({
  side,
  collapsed,
  onClick,
}: {
  side: SidebarSide;
  collapsed: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const Icon = collapsed
    ? side === "left" ? PanelLeftOpen : PanelRightOpen
    : side === "left" ? PanelLeftClose : PanelRightClose;
  const label = collapsed ? t("sidebar.expandSidebar") : t("sidebar.collapseSidebar");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={label}
          onClick={onClick}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side === "left" ? "right" : "left"}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function EditorSidebar({ side }: { side: SidebarSide }) {
  const { t } = useTranslation();
  const placement = useSidebarLayoutStore((state) => state.placement);
  const sections = useSidebarLayoutStore((state) => state.sections);
  const activeTab = useSidebarLayoutStore((state) => state.activeTab[side]);
  const collapsed = useSidebarLayoutStore((state) => state.collapsed[side]);
  const width = useSidebarLayoutStore((state) => state.width[side]);
  const setActiveTab = useSidebarLayoutStore((state) => state.setActiveTab);
  const setCollapsed = useSidebarLayoutStore((state) => state.setCollapsed);
  const setWidth = useSidebarLayoutStore((state) => state.setWidth);
  const saveWidth = useSidebarLayoutStore((state) => state.saveWidth);
  const widthAtDragStart = useRef(width);
  const selectedBeatInfo = usePlayerStore((state) => state.selectedBeatInfo);
  const selectedTrackInfo = usePlayerStore((state) => state.selectedTrackInfo);
  const selectedStaffInfo = usePlayerStore((state) => state.selectedStaffInfo);
  const selectedBarInfo = usePlayerStore((state) => state.selectedBarInfo);
  const selectedMasterBarInfo = usePlayerStore((state) => state.selectedMasterBarInfo);
  const selectedNoteIndex = usePlayerStore((state) => state.selectedNoteIndex);
  const tabs = placement[side];
  const { isOver, setNodeRef } = useDroppable({
    id: `sidebar:${side}`,
    data: { type: "sidebar", side },
  });

  const activeNote: SelectedNoteInfo | null =
    selectedBeatInfo &&
    selectedNoteIndex >= 0 &&
    selectedNoteIndex < selectedBeatInfo.notes.length
      ? selectedBeatInfo.notes[selectedNoteIndex]
      : null;
  const hasBeat = !!(selectedBeatInfo && selectedBarInfo);

  const handleResize = useCallback((deltaX: number) => {
    const directionalDelta = side === "left" ? deltaX : -deltaX;
    setWidth(side, widthAtDragStart.current + directionalDelta);
  }, [setWidth, side]);

  const renderSection = useCallback(
    (id: SectionId, dragHandleProps: Record<string, unknown>) => {
      switch (id) {
        case "song":
          return <SongSection dragHandleProps={dragHandleProps} />;
        case "tracks":
          return <TracksSection dragHandleProps={dragHandleProps} />;
        case "articulation":
          return <ArticulationSection dragHandleProps={dragHandleProps} />;
        case "log":
          return <LogSection dragHandleProps={dragHandleProps} />;
        case "fps":
          return <FpsSection dragHandleProps={dragHandleProps} />;
        case "editorState":
          return <EditorStateSection dragHandleProps={dragHandleProps} />;
        case "alphaTabState":
          return <AlphaTabStateSection dragHandleProps={dragHandleProps} />;
        case "masterBar":
          return selectedMasterBarInfo ? (
            <MasterBarSection
              masterBar={selectedMasterBarInfo}
              dragHandleProps={dragHandleProps}
            />
          ) : null;
        case "bar":
          return hasBeat && selectedTrackInfo && selectedStaffInfo ? (
            <BarSection
              bar={selectedBarInfo!}
              staffIndex={selectedStaffInfo.index}
              staffCount={selectedTrackInfo.staffCount}
              showStandardNotation={selectedStaffInfo.showStandardNotation}
              dragHandleProps={dragHandleProps}
            />
          ) : null;
        case "note":
          return hasBeat ? (
            <NoteSection
              beat={selectedBeatInfo!}
              note={activeNote}
              showStandardNotation={selectedStaffInfo?.showStandardNotation ?? false}
              dragHandleProps={dragHandleProps}
            />
          ) : null;
        case "effects":
          return hasBeat ? (
            <EffectsSection
              beat={selectedBeatInfo!}
              note={activeNote}
              dragHandleProps={dragHandleProps}
            />
          ) : null;
      }
    },
    [
      activeNote,
      hasBeat,
      selectedBarInfo,
      selectedBeatInfo,
      selectedMasterBarInfo,
      selectedStaffInfo,
      selectedTrackInfo,
    ],
  );

  if (collapsed || tabs.length === 0) {
    return (
      <div
        ref={setNodeRef}
        data-sidebar-side={side}
        className={cn(
          "flex min-w-0 flex-col items-center bg-card py-1",
          side === "left" ? "border-r" : "border-l",
          isOver && "bg-accent",
        )}
      >
        {collapsed && (
          <SidebarCollapseButton
            side={side}
            collapsed
            onClick={() => setCollapsed(side, false)}
          />
        )}
      </div>
    );
  }

  const sectionTab = activeTab && activeTab !== "agent"
    ? activeTab as SectionTabId
    : null;
  const currentSections = sectionTab ? sections[sectionTab] : [];
  const panel = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-card">
      <div className="flex shrink-0 items-center border-b">
        {side === "left" && (
          <SidebarCollapseButton
            side={side}
            collapsed={false}
            onClick={() => setCollapsed(side, true)}
          />
        )}
        <SortableContext
          items={tabs.map((tabId) => `editor-tab:${tabId}`)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex min-w-0 flex-1">
            {tabs.map((tabId) => (
              <SortableTabButton
                key={tabId}
                tabId={tabId}
                side={side}
                active={activeTab === tabId}
                onClick={() => setActiveTab(side, tabId)}
              />
            ))}
          </div>
        </SortableContext>
        {side === "right" && (
          <SidebarCollapseButton
            side={side}
            collapsed={false}
            onClick={() => setCollapsed(side, true)}
          />
        )}
      </div>

      {activeTab === "agent" ? (
        <Suspense
          fallback={(
            <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
              {t("agent.codexStatus.connecting")}
            </div>
          )}
        >
          <AgentTab />
        </Suspense>
      ) : sectionTab ? (
        <>
          <ScrollArea className="min-h-0 flex-1 overflow-hidden">
            <div className="pb-4 pr-3">
              <SortableContext
                items={currentSections.map((id) => `section:${id}`)}
                strategy={verticalListSortingStrategy}
              >
                <TabDroppable tabId={sectionTab} side={side}>
                  {currentSections.length > 0 ? (
                    currentSections.map((id) => (
                      <SortableSection key={id} id={id}>
                        {(dragHandleProps) => renderSection(id, dragHandleProps)}
                      </SortableSection>
                    ))
                  ) : (
                    <div className="flex items-center justify-center p-6 text-center text-[10px] text-muted-foreground">
                      {t("sidebar.dropHereHint")}
                    </div>
                  )}
                </TabDroppable>
              </SortableContext>
              {!hasBeat && currentSections.some(
                (id) => id === "masterBar"
                  || id === "bar"
                  || id === "note"
                  || id === "effects",
              ) && (
                <div className="flex items-center justify-center p-4 text-center text-xs text-muted-foreground">
                  {t("sidebar.emptyState")}
                </div>
              )}
            </div>
          </ScrollArea>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-[10px] text-muted-foreground">
          {t("sidebar.dropTabHereHint")}
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={setNodeRef}
      data-sidebar-side={side}
      className={cn(
        "flex min-h-0 min-w-0",
        isOver && "ring-1 ring-inset ring-primary/30",
      )}
      style={{ width: "100%" }}
    >
      {side === "right" && (
        <ResizeHandle
          side="left"
          onResizeStart={() => {
            widthAtDragStart.current = width;
          }}
          onResize={handleResize}
          onResizeEnd={() => saveWidth(side)}
        />
      )}
      {panel}
      {side === "left" && (
        <ResizeHandle
          side="right"
          onResizeStart={() => {
            widthAtDragStart.current = width;
          }}
          onResize={handleResize}
          onResizeEnd={() => saveWidth(side)}
        />
      )}
    </div>
  );
}
