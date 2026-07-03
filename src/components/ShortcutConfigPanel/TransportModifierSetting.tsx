import { useTranslation } from "react-i18next";
import { MousePointer2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DEFAULT_TRANSPORT_MODIFIER,
  formatShortcut,
  transportModifierToKeyCombo,
  useShortcutStore,
} from "@/shortcuts";
import type { TransportModifier } from "@/shortcuts";

const OPTIONS: readonly TransportModifier[] = ["alt", "shift", "mod"];

export function TransportModifierSetting() {
  const { t } = useTranslation();
  const modifier = useShortcutStore((state) => state.transportModifier);
  const setModifier = useShortcutStore((state) => state.setTransportModifier);
  const resetModifier = useShortcutStore((state) => state.resetTransportModifier);
  const isModified = modifier !== DEFAULT_TRANSPORT_MODIFIER;

  return (
    <div className="border-b border-border/50 px-1 py-2">
      <div className="flex min-h-8 items-center gap-2">
        <MousePointer2 className="size-4 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {t("shortcuts.transportModifier.title")}
        </span>
        <ToggleGroup
          type="single"
          value={modifier}
          onValueChange={(value) => {
            if (value) setModifier(value as TransportModifier);
          }}
          variant="outline"
          size="sm"
          className="shrink-0"
        >
          {OPTIONS.map((option) => (
            <ToggleGroupItem
              key={option}
              value={option}
              aria-label={t(`shortcuts.transportModifier.option.${option}`)}
              className="h-7 min-w-12 px-2 text-xs"
            >
              {formatShortcut(transportModifierToKeyCombo(option))}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {isModified && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={resetModifier}
                aria-label={t("shortcuts.resetOne")}
              >
                <RotateCcw />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("shortcuts.resetOne")}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
