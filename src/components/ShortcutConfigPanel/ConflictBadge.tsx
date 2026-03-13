import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getSoftOverride } from "@/shortcuts/disallow-list";
import { useShortcutStore } from "@/shortcuts";
import type { KeyCombo } from "@/shortcuts";

interface Props {
  combo: KeyCombo;
  bindingId: string;
}

export function ConflictBadge({ combo, bindingId }: Props) {
  const { t } = useTranslation();
  const findDuplicates = useShortcutStore((s) => s.findDuplicates);

  const duplicates = findDuplicates(combo, bindingId);
  const softOverride = getSoftOverride(combo);

  if (duplicates.length === 0 && !softOverride) return null;

  return (
    <div className="flex items-center gap-1">
      {duplicates.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className="text-[10px] leading-tight">
              {t("shortcuts.conflict.duplicate")}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {t("shortcuts.conflict.duplicateDetail", {
              actions: duplicates.map((d) => t(`${d.i18nKey}.name`)).join(", "),
            })}
          </TooltipContent>
        </Tooltip>
      )}
      {softOverride && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-[10px] leading-tight text-amber-500 border-amber-500/50">
              {t("shortcuts.conflict.browserOverride")}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>{t(softOverride)}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
