import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ToggleLeft, ToggleRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { executeAppAction } from "@/app-actions";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/render-store";
import { PERC_SNAP_GROUPS } from "@/stores/render-internals";
import type { PercArticulationDef, PercSnapGroup } from "@/stores/render-types";
import { SectionHeader } from "./primitives";

export function ArticulationSection({
  dragHandleProps,
}: {
  dragHandleProps?: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const [selectedOnly, setSelectedOnly] = useState(false);

  const trackInfo = usePlayerStore((state) => state.selectedTrackInfo);
  const beat = usePlayerStore((state) => state.selectedBeatInfo);
  const selectedString = usePlayerStore((state) => state.selectedString);
  const isPercussion = trackInfo?.isPercussion ?? false;
  const activeGp7Ids = new Set(
    beat?.notes
      .filter((note) => note.isPercussion)
      .map((note) => note.percussionGp7Id) ?? [],
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
            <span className="text-[10px] italic text-muted-foreground">
              {t("sidebar.selector.noSelection")}
            </span>
          </div>
        ) : (
          <div className="space-y-1 px-2 pb-2">
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
                {selectedOnly ? (
                  <ToggleRight className="h-3 w-3" />
                ) : (
                  <ToggleLeft className="h-3 w-3" />
                )}
                {t("sidebar.selector.articulationSelectedOnly")}
              </button>
              {selectedString !== null && (
                <span className="text-[9px] font-mono text-muted-foreground/70">
                  {t("sidebar.selector.articulationStaffLine", {
                    line: selectedString,
                  })}
                </span>
              )}
            </div>

            <div className="space-y-1">
              {PERC_SNAP_GROUPS.map((group: PercSnapGroup) => {
                const isGroupSelected = group.staffLine === selectedString;
                const groupHidden = selectedOnly && !isGroupSelected;
                if (
                  groupHidden &&
                  !group.entries.some((entry: PercArticulationDef) =>
                    activeGp7Ids.has(entry.id),
                  )
                ) return null;

                return (
                  <div key={group.staffLine}>
                    <div
                      className={cn(
                        "mb-0.5 flex items-center gap-1",
                        isGroupSelected && "text-primary",
                      )}
                    >
                      <span
                        className={cn(
                          "shrink-0 font-mono text-[8px] leading-none",
                          isGroupSelected
                            ? "font-bold text-primary"
                            : "text-muted-foreground/60",
                        )}
                      >
                        {t("sidebar.selector.articulationStaffLine", {
                          line: group.staffLine,
                        })}
                      </span>
                      <div className="flex-1 border-b border-border/30" />
                    </div>
                    <div className="flex flex-wrap gap-0.5">
                      {group.entries.map((entry: PercArticulationDef) => {
                        const isActive = activeGp7Ids.has(entry.id);
                        const isDisabled = !beat || (groupHidden && !isActive);
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            disabled={isDisabled}
                            className={cn(
                              "rounded border px-1.5 py-0.5 text-[9px] leading-tight transition-colors",
                              isActive
                                ? "border-primary bg-primary/20 font-semibold text-primary"
                                : "border-border/60 text-muted-foreground hover:bg-accent/50",
                              isDisabled && !isActive &&
                                "cursor-not-allowed opacity-30",
                            )}
                            title={t("sidebar.articulation.entryTitle", {
                              element: entry.elementType,
                              technique: entry.technique,
                            })}
                            onClick={() =>
                              executeAppAction(
                                "edit.beat.togglePercussionArticulation",
                                entry.id,
                                { t },
                              )
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
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
