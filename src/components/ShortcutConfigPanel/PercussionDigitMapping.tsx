import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useShortcutStore } from "@/shortcuts";
import { GP7_DEF_BY_ID, ESSENTIAL_ARTICULATION_GROUPS } from "@/stores/percussion-data";
import { cn } from "@/lib/utils";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0] as const;

function ArticulationLabel({ gp7Id }: { gp7Id: number }) {
  const def = GP7_DEF_BY_ID.get(gp7Id);
  if (!def) return <span className="text-muted-foreground italic">?</span>;
  return (
    <span className="truncate">
      {def.elementType}
      {def.technique !== "hit" && (
        <span className="text-muted-foreground ml-1">({def.technique})</span>
      )}
    </span>
  );
}

function DigitRow({ digit }: { digit: number }) {
  const { t } = useTranslation();
  const percMap = useShortcutStore((s) => s.percussionDigitMap);
  const setMapping = useShortcutStore((s) => s.setPercussionDigitMapping);
  const currentGp7Id = percMap[digit];
  const [pickerOpen, setPickerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pickerOpen]);

  return (
    <div ref={containerRef} className="flex items-center gap-2 py-1.5 px-1 rounded-md hover:bg-accent/30 group relative">
      <kbd className="inline-flex items-center justify-center rounded border bg-muted w-7 h-6 font-mono text-xs text-muted-foreground shrink-0">
        {digit}
      </kbd>
      <div className="flex-1 min-w-0">
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs",
            "transition-colors hover:bg-accent hover:text-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            pickerOpen && "ring-2 ring-ring",
          )}
          onClick={() => setPickerOpen((v) => !v)}
        >
          <ArticulationLabel gp7Id={currentGp7Id} />
          <span className="text-muted-foreground/50 text-[10px] ml-1">
            (GP7: {currentGp7Id})
          </span>
        </button>

        {pickerOpen && (
          <div className="absolute left-8 top-full mt-1 w-60 rounded-md border bg-popover text-popover-foreground shadow-md z-10">
            <div className="overflow-y-auto max-h-56 p-1">
              {ESSENTIAL_ARTICULATION_GROUPS.map((group) => (
                <div key={group.category}>
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sticky top-0 bg-popover">
                    {t(`shortcuts.percussionMapping.category.${group.category}`)}
                  </div>
                  {group.ids.map((id) => {
                    const def = GP7_DEF_BY_ID.get(id);
                    if (!def) return null;
                    return (
                      <button
                        key={id}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs",
                          "hover:bg-accent/50",
                          currentGp7Id === id && "bg-primary/10 text-primary",
                        )}
                        onClick={() => {
                          setMapping(digit, id);
                          setPickerOpen(false);
                        }}
                      >
                        <span className="flex-1 truncate">
                          {def.elementType}
                          {def.technique !== "hit" && (
                            <span className="text-muted-foreground ml-1">
                              ({def.technique})
                            </span>
                          )}
                        </span>
                        <span className="text-muted-foreground/50 text-[10px]">{id}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function PercussionDigitMapping() {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const resetMap = useShortcutStore((s) => s.resetPercussionDigitMap);

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-2 py-2 text-sm font-semibold hover:text-foreground/80"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        {t("shortcuts.percussionMapping.title")}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="ml-auto opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                resetMap();
              }}
            >
              <RotateCcw />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("shortcuts.resetAll")}</TooltipContent>
        </Tooltip>
      </button>
      {expanded && (
        <div className="pl-2">
          <p className="text-xs text-muted-foreground mb-2">
            {t("shortcuts.percussionMapping.description")}
          </p>
          {DIGITS.map((digit) => (
            <DigitRow key={digit} digit={digit} />
          ))}
        </div>
      )}
    </div>
  );
}
