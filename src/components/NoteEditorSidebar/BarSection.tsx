import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Clock,
  Key,
  Repeat,
  Bookmark,
  Infinity,
  Gauge,
  Triangle,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import type { SelectedBarInfo } from "@/stores/player-types";
import { SectionHeader, ToggleBtn, PropRow } from "./primitives";
import { keySignatureLabel, tripletFeelLabel } from "./labels";

export function BarSection({ bar, dragHandleProps }: { bar: SelectedBarInfo; dragHandleProps?: Record<string, unknown> }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SectionHeader title={t("sidebar.bar.title")} helpText={t("sidebar.bar.help")} isOpen={isOpen} dragHandleProps={dragHandleProps} />
      <CollapsibleContent>
        <div className="space-y-0.5 py-1">
          <PropRow
            label={t("sidebar.bar.timeSig")}
            value={`${bar.timeSignatureNumerator}/${bar.timeSignatureDenominator}`}
            icon={<Clock className="h-3.5 w-3.5" />}
          />
          <PropRow
            label={t("sidebar.bar.key")}
            value={keySignatureLabel(bar.keySignature, bar.keySignatureType)}
            icon={<Key className="h-3.5 w-3.5" />}
          />
          {bar.tempo !== null && (
            <PropRow
              label={t("sidebar.bar.tempo")}
              value={t("sidebar.bar.bpm", { value: bar.tempo })}
              icon={<Gauge className="h-3.5 w-3.5" />}
            />
          )}
          <PropRow
            label={t("sidebar.bar.tripletFeel")}
            value={tripletFeelLabel(bar.tripletFeel, t)}
            icon={<Triangle className="h-3.5 w-3.5" />}
          />

          <div className="flex flex-wrap gap-0.5 px-2 pt-1">
            <ToggleBtn
              label={t("sidebar.bar.repeatStart")}
              pressed={bar.isRepeatStart}
              icon={<Repeat className="h-3.5 w-3.5" />}
            />
            {bar.repeatCount > 0 && (
              <div className="flex items-center px-1 text-[10px] text-muted-foreground">
                {t("sidebar.bar.repeatCount", { count: bar.repeatCount })}
              </div>
            )}
            <ToggleBtn
              label={t("sidebar.bar.freeTime")}
              pressed={bar.isFreeTime}
              icon={<Infinity className="h-3.5 w-3.5" />}
            />
            <ToggleBtn
              label={t("sidebar.bar.doubleBar")}
              pressed={bar.isDoubleBar}
              textIcon="||"
            />
          </div>

          {bar.hasSection && (
            <PropRow
              label={t("sidebar.bar.section")}
              value={bar.sectionText || bar.sectionMarker}
              icon={<Bookmark className="h-3.5 w-3.5" />}
            />
          )}
          {bar.alternateEndings > 0 && (
            <PropRow
              label={t("sidebar.bar.altEndings")}
              value={String(bar.alternateEndings)}
            />
          )}
        </div>
        <Separator />
      </CollapsibleContent>
    </Collapsible>
  );
}
