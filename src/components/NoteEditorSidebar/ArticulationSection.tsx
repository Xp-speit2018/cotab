import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ToggleLeft, ToggleRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { executeAction } from "@/actions";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/player-store";
import {
  ESSENTIAL_ARTICULATION_GROUPS,
  GP7_DEF_BY_ID,
  PERC_SNAP_GROUPS,
} from "@/stores/player-internals";
import { getCategoryLabelKey } from "@/components/DrumIcons";
import type { PercArticulationDef, PercSnapGroup } from "@/stores/player-types";
import { SectionHeader } from "./primitives";

export function ArticulationSection({
  dragHandleProps,
}: {
  dragHandleProps?: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const [selectedOnly, setSelectedOnly] = useState(false);

  const trackInfo = usePlayerStore((s) => s.selectedTrackInfo);
  const beat = usePlayerStore((s) => s.selectedBeatInfo);
  const selectedString = usePlayerStore((s) => s.selectedString);
  const isAdvanced = usePlayerStore((s) => s.editorMode === "advanced");

  const isPercussion = trackInfo?.isPercussion ?? false;

  const activeGp7Ids = new Set(
    beat?.notes
      .filter((n) => n.isPercussion)
      .map((n) => n.percussionGp7Id) ?? [],
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SectionHeader
        title={t("sidebar.articulation.title")}
        helpText={t("sidebar.articulation.help")}
        isOpen={isOpen}
        dragHandleProps={dragHandleProps}
      />
      <CollapsibleContent>
        {!isPercussion ? (
          <div className="px-3 py-3">
            <span className="text-[10px] text-muted-foreground italic">
              {t("sidebar.selector.noSelection")}
            </span>
          </div>
        ) : isAdvanced ? (
          <div className="px-2 pb-2 space-y-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
                  selectedOnly
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent/50",
                )}
                onClick={() => setSelectedOnly(!selectedOnly)}
              >
                {selectedOnly
                  ? <ToggleRight className="h-3 w-3" />
                  : <ToggleLeft className="h-3 w-3" />}
                {t("sidebar.selector.articulationSelectedOnly")}
              </button>
              {selectedString !== null && (
                <span className="text-[9px] font-mono text-muted-foreground/70">
                  {t("sidebar.selector.articulationStaffLine", { line: selectedString })}
                </span>
              )}
            </div>
            <div className="space-y-1">
              {PERC_SNAP_GROUPS.map((group: PercSnapGroup) => {
                const isGroupSelected = group.staffLine === selectedString;
                const groupHidden = selectedOnly && !isGroupSelected;
                if (groupHidden) {
                  const hasActiveInGroup = group.entries.some((e: PercArticulationDef) => activeGp7Ids.has(e.id));
                  if (!hasActiveInGroup) return null;
                }
                return (
                  <div key={group.staffLine}>
                    <div className={cn(
                      "flex items-center gap-1 mb-0.5",
                      isGroupSelected && "text-primary",
                    )}>
                      <span className={cn(
                        "shrink-0 text-[8px] font-mono leading-none",
                        isGroupSelected
                          ? "text-primary font-bold"
                          : "text-muted-foreground/60",
                      )}>
                        {t("sidebar.selector.articulationStaffLine", { line: group.staffLine })}
                      </span>
                      <div className="flex-1 border-b border-border/30" />
                    </div>
                    <div className="flex flex-wrap gap-0.5">
                      {group.entries.map((entry: PercArticulationDef) => {
                        const isActive = activeGp7Ids.has(entry.id);
                        const isDisabled =
                          !beat || (groupHidden && !isActive);
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            disabled={isDisabled}
                            className={cn(
                              "rounded border px-1.5 py-0.5 text-[9px] leading-tight transition-colors",
                              isActive
                                ? "border-primary bg-primary/20 text-primary font-semibold"
                                : "border-border/60 text-muted-foreground hover:bg-accent/50",
                              isDisabled && !isActive && "opacity-30 cursor-not-allowed",
                            )}
                            title={`ID ${entry.id} — staffLine ${entry.staffLine}`}
                            onClick={() =>
                              executeAction("edit.beat.togglePercussionArticulation", entry.id, { t })
                            }
                          >
                            {entry.elementType} ({entry.technique})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="px-2 pb-2 space-y-2">
            {ESSENTIAL_ARTICULATION_GROUPS.map(({ category, ids }) => {
              const entries = ids
                .map((id) => GP7_DEF_BY_ID.get(id))
                .filter((d): d is NonNullable<typeof d> => d !== undefined);
              if (entries.length === 0) return null;
              return (
                <div key={category}>
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="shrink-0 text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t(getCategoryLabelKey(category))}
                    </span>
                    <div className="flex-1 border-b border-border/30" />
                  </div>
                  <div className="flex flex-wrap gap-0.5">
                    {entries.map((entry) => {
                      const isActive = activeGp7Ids.has(entry.id);
                      const isDisabled = !beat;
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          disabled={isDisabled}
                          className={cn(
                            "rounded border px-1.5 py-0.5 text-[9px] leading-tight transition-colors",
                            isActive
                              ? "border-primary bg-primary/20 text-primary font-semibold"
                              : "border-border/60 text-muted-foreground hover:bg-accent/50",
                            isDisabled && !isActive && "opacity-30 cursor-not-allowed",
                          )}
                          title={t("sidebar.articulation.entryTitle", {
                            element: entry.elementType,
                            technique: entry.technique,
                          })}
                          onClick={() =>
                            executeAction("edit.beat.togglePercussionArticulation", entry.id, { t })
                          }
                        >
                          {entry.elementType} ({entry.technique})
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
