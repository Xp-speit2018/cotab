import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  CornerDownLeft,
  Minus,
  PencilRuler,
  Plus,
  SlidersHorizontal,
  UnfoldHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { executeAppAction } from "@/app-actions";
import {
  forceActiveSystemBreak,
  getActiveSystemLayoutSnapshot,
  moveActiveSystemBreak,
  preventActiveSystemBreak,
  reflowActiveSystems,
} from "@/app-actions/active-system-layout";
import { cn } from "@/lib/utils";
import { getMainElement } from "@/stores/render-api";
import { usePlayerStore } from "@/stores/render-store";

type ReflowScope = "score" | "current";

export function ScoreLayoutToolbarControls({
  variant = "toolbar",
}: {
  variant?: "toolbar" | "menu";
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [barsPerSystem, setBarsPerSystem] = useState(4);
  const [scope, setScope] = useState<ReflowScope>("score");
  const scoreLayout = usePlayerStore((state) => state.scoreLayout);
  const layoutDesignMode = usePlayerStore((state) => state.layoutDesignMode);
  const selectorBarIndex = usePlayerStore((state) => state.selector.barIndex);
  const systemLayoutRows = usePlayerStore((state) => state.systemLayoutRows);
  const visibleTrackIndices = usePlayerStore(
    (state) => state.visibleTrackIndices,
  );
  const snapshot = getActiveSystemLayoutSnapshot();
  const isParchment = scoreLayout === "parchment";
  const hasSelection = selectorBarIndex !== null;
  const hasBreakAfterSelection = selectorBarIndex !== null
    && selectorBarIndex < (snapshot?.totalBars ?? 0) - 1
    && systemLayoutRows.some(
      (row) => row.endBarIndex === selectorBarIndex,
    );

  useEffect(() => {
    if (!open) return;
    const current = getActiveSystemLayoutSnapshot();
    if (current) setBarsPerSystem(current.defaultSystemsLayout);
  }, [open, systemLayoutRows, visibleTrackIndices]);

  const targetLabel = snapshot?.target.kind === "track"
    ? t("toolbar.layout.trackTarget", { name: snapshot.target.trackName })
    : t("toolbar.layout.scoreTarget");

  const applyReflow = () => {
    const normalized = Math.max(1, Math.min(32, Math.round(barsPerSystem)));
    setBarsPerSystem(normalized);
    reflowActiveSystems(
      {
        barsPerSystem: normalized,
        startBarIndex: scope === "current" ? selectorBarIndex : null,
      },
      { t },
    );
    setOpen(false);
  };

  const toggleSelectedBreak = () => {
    if (selectorBarIndex === null) return;
    if (hasBreakAfterSelection) {
      preventActiveSystemBreak(selectorBarIndex, { t });
    } else {
      forceActiveSystemBreak(selectorBarIndex, { t });
    }
    setOpen(false);
  };

  const menuVariant = variant === "menu";

  return (
    <div className={menuVariant ? "space-y-0.5" : "flex items-center gap-0.5"}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              variant={layoutDesignMode ? "secondary" : "ghost"}
              size={menuVariant ? "sm" : "icon"}
              role={menuVariant ? "menuitemcheckbox" : undefined}
              aria-checked={menuVariant ? layoutDesignMode : undefined}
              className={cn(
                menuVariant
                  ? "h-8 w-full justify-start gap-2 font-normal"
                  : "h-8 w-8",
                layoutDesignMode
                  && "bg-amber-500/15 text-amber-800 hover:bg-amber-500/20 dark:text-amber-300",
              )}
              disabled={!isParchment}
              aria-label={t("toolbar.layout.designMode")}
              aria-pressed={layoutDesignMode}
              onClick={() =>
                executeAppAction(
                  "view.setLayoutDesignMode",
                  { enabled: !layoutDesignMode },
                  { t },
                )
              }
            >
              <PencilRuler className="h-4 w-4" />
              {menuVariant && <span>{t("toolbar.layout.designMode")}</span>}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {isParchment
            ? t("toolbar.layout.designMode")
            : t("toolbar.layout.parchmentOnly")}
        </TooltipContent>
      </Tooltip>

      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size={menuVariant ? "sm" : "icon"}
                role={menuVariant ? "menuitem" : undefined}
                className={cn(
                  "h-8",
                  menuVariant
                    ? "w-full justify-start gap-2 font-normal"
                    : "w-8",
                )}
                disabled={!isParchment}
                aria-label={t("toolbar.layout.settings")}
              >
                <SlidersHorizontal className="h-4 w-4" />
                {menuVariant && <span>{t("toolbar.layout.settings")}</span>}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>{t("toolbar.layout.settings")}</TooltipContent>
        </Tooltip>

        <PopoverContent align="end" className="w-72 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">
              {t("toolbar.layout.title")}
            </span>
            <span className="max-w-36 truncate text-[11px] text-muted-foreground">
              {targetLabel}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <label
              htmlFor="bars-per-system"
              className="text-xs text-muted-foreground"
            >
              {t("toolbar.layout.barsPerRow")}
            </label>
            <input
              id="bars-per-system"
              type="number"
              min={1}
              max={32}
              step={1}
              value={barsPerSystem}
              onChange={(event) => setBarsPerSystem(Number(event.target.value))}
              className="h-8 w-16 rounded-md border bg-transparent px-2 text-right text-sm tabular-nums"
            />
          </div>

          <div
            role="group"
            aria-label={t("toolbar.layout.applyScope")}
            className="mt-2 grid grid-cols-2 rounded-md border p-0.5"
          >
            <Button
              type="button"
              variant={scope === "score" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              aria-pressed={scope === "score"}
              onClick={() => setScope("score")}
            >
              {t("toolbar.layout.entireScore")}
            </Button>
            <Button
              type="button"
              variant={scope === "current" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              disabled={!hasSelection}
              aria-pressed={scope === "current"}
              onClick={() => setScope("current")}
            >
              {t("toolbar.layout.fromCurrentRow")}
            </Button>
          </div>

          <Button
            type="button"
            size="sm"
            className="mt-2 h-8 w-full"
            disabled={!snapshot || (scope === "current" && !hasSelection)}
            onClick={applyReflow}
          >
            {t("toolbar.layout.apply")}
          </Button>

          <Separator className="my-3" />

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full justify-start gap-2"
            disabled={!hasSelection}
            onClick={toggleSelectedBreak}
          >
            {hasBreakAfterSelection ? (
              <UnfoldHorizontal className="h-3.5 w-3.5" />
            ) : (
              <CornerDownLeft className="h-3.5 w-3.5" />
            )}
            {hasBreakAfterSelection
              ? t("toolbar.layout.preventBreak", {
                  bar: (selectorBarIndex ?? 0) + 1,
                })
              : t("toolbar.layout.forceBreak", {
                  bar: (selectorBarIndex ?? 0) + 1,
                })}
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function ScoreLayoutDesignOverlay() {
  const { t } = useTranslation();
  const scoreLayout = usePlayerStore((state) => state.scoreLayout);
  const layoutDesignMode = usePlayerStore((state) => state.layoutDesignMode);
  const rows = usePlayerStore((state) => state.systemLayoutRows);
  const host = getMainElement()?.querySelector(".at-cursors");

  if (
    scoreLayout !== "parchment"
    || !layoutDesignMode
    || !host
    || rows.length < 2
  ) {
    return null;
  }

  return createPortal(
    <div className="at-system-layout-controls" data-cotab-layout-control>
      {rows.slice(0, -1).map((row) => {
        const count = row.endBarIndex - row.startBarIndex + 1;
        return (
          <div
            key={`${row.startBarIndex}:${row.endBarIndex}`}
            className="at-system-layout-row-control"
            data-cotab-layout-control
            data-system-index={row.index}
            data-start-bar-index={row.startBarIndex}
            data-end-bar-index={row.endBarIndex}
            style={{
              left: `${row.bounds.x + row.bounds.w - 76}px`,
              top: `${row.bounds.y + row.bounds.h}px`,
            }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="at-system-layout-row-button"
                  disabled={count <= 1}
                  aria-label={t("toolbar.layout.moveBarToNext", {
                    row: row.index + 1,
                  })}
                  onClick={() =>
                    moveActiveSystemBreak(row.endBarIndex, "left", { t })
                  }
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {t("toolbar.layout.moveBarToNext", { row: row.index + 1 })}
              </TooltipContent>
            </Tooltip>
            <span className="at-system-layout-row-count">{count}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="at-system-layout-row-button"
                  aria-label={t("toolbar.layout.moveBarFromNext", {
                    row: row.index + 1,
                  })}
                  onClick={() =>
                    moveActiveSystemBreak(row.endBarIndex, "right", { t })
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {t("toolbar.layout.moveBarFromNext", { row: row.index + 1 })}
              </TooltipContent>
            </Tooltip>
          </div>
        );
      })}
    </div>,
    host,
  );
}
