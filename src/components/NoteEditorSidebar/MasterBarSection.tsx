import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bookmark,
  Clock,
  Gauge,
  Infinity,
  Repeat,
  Triangle,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { executeAppAction } from "@/app-actions";
import type { SelectedMasterBarInfo } from "@/stores/render-types";
import { TripletFeel } from "@/core/schema";
import {
  EditableNumberPropRow,
  EditablePropRow,
  SectionHeader,
  SelectPropRow,
  ToggleBtn,
} from "./primitives";
import { tripletFeelLabel } from "./labels";

export function MasterBarSection({
  masterBar,
  dragHandleProps,
}: {
  masterBar: SelectedMasterBarInfo;
  dragHandleProps?: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);

  const setSectionPart = (field: "text" | "marker", value: string) => {
    const section = {
      text: field === "text" ? value : masterBar.sectionText,
      marker: field === "marker" ? value : masterBar.sectionMarker,
    };
    executeAppAction(
      "document.masterBar.setSection",
      { section: section.text || section.marker ? section : null },
      { t },
    );
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SectionHeader
        title={t("sidebar.masterBar.title")}
        helpText={t("sidebar.masterBar.help")}
        isOpen={isOpen}
        dragHandleProps={dragHandleProps}
      />
      <CollapsibleContent>
        <div className="space-y-0.5 py-1">
          <div className="grid grid-cols-2 gap-x-1">
            <EditableNumberPropRow
              label={t("sidebar.masterBar.numerator")}
              value={masterBar.timeSignatureNumerator}
              icon={<Clock className="h-3.5 w-3.5" />}
              min={1}
              max={32}
              onCommit={(value) => executeAppAction(
                "document.masterBar.setTimeSignatureNumerator",
                { value },
                { t },
              )}
            />
            <EditableNumberPropRow
              label={t("sidebar.masterBar.denominator")}
              value={masterBar.timeSignatureDenominator}
              min={1}
              max={64}
              onCommit={(value) => executeAppAction(
                "document.masterBar.setTimeSignatureDenominator",
                { value },
                { t },
              )}
            />
          </div>

          <div className="flex flex-wrap items-center gap-0.5 px-2 pt-0.5">
            <ToggleBtn
              label={t("sidebar.masterBar.tempoMarker")}
              pressed={masterBar.tempo !== null}
              onPressedChange={(pressed) => executeAppAction(
                "document.masterBar.setTempo",
                { tempo: pressed ? 120 : null },
                { t },
              )}
              icon={<Gauge className="h-3.5 w-3.5" />}
            />
            <ToggleBtn
              label={t("sidebar.masterBar.repeatStart")}
              pressed={masterBar.isRepeatStart}
              onPressedChange={(pressed) => executeAppAction(
                "document.masterBar.setIsRepeatStart",
                { value: pressed },
                { t },
              )}
              icon={<Repeat className="h-3.5 w-3.5" />}
            />
            <ToggleBtn
              label={t("sidebar.masterBar.freeTime")}
              pressed={masterBar.isFreeTime}
              onPressedChange={(pressed) => executeAppAction(
                "document.masterBar.setIsFreeTime",
                { value: pressed },
                { t },
              )}
              icon={<Infinity className="h-3.5 w-3.5" />}
            />
          </div>

          {masterBar.tempo !== null && (
            <EditableNumberPropRow
              label={t("sidebar.masterBar.tempo")}
              value={masterBar.tempo}
              suffix="BPM"
              min={20}
              max={400}
              onCommit={(value) => executeAppAction(
                "document.masterBar.setTempo",
                { tempo: value },
                { t },
              )}
            />
          )}

          <SelectPropRow
            label={t("sidebar.masterBar.tripletFeel")}
            value={masterBar.tripletFeel}
            options={([
              TripletFeel.NoTripletFeel,
              TripletFeel.Triplet8th,
              TripletFeel.Triplet16th,
              TripletFeel.Dotted8th,
              TripletFeel.Dotted16th,
              TripletFeel.Scottish8th,
              TripletFeel.Scottish16th,
            ] as const).map((value) => ({
              value,
              label: tripletFeelLabel(value, t),
            }))}
            icon={<Triangle className="h-3.5 w-3.5" />}
            onValueChange={(value) => executeAppAction(
              "document.masterBar.setTripletFeel",
              { value },
              { t },
            )}
          />

          <div className="grid grid-cols-2 gap-x-1">
            <EditableNumberPropRow
              label={t("sidebar.masterBar.repeatCountLabel")}
              value={masterBar.repeatCount}
              min={0}
              max={32}
              onCommit={(value) => executeAppAction(
                "document.masterBar.setRepeatCount",
                { value },
                { t },
              )}
            />
            <EditableNumberPropRow
              label={t("sidebar.masterBar.altEndings")}
              value={masterBar.alternateEndings}
              min={0}
              max={255}
              onCommit={(value) => executeAppAction(
                "document.masterBar.setAlternateEndings",
                { value },
                { t },
              )}
            />
          </div>

          <Separator className="my-0.5" />

          <EditablePropRow
            label={t("sidebar.masterBar.section")}
            value={masterBar.sectionText}
            placeholder={t("sidebar.masterBar.sectionPlaceholder")}
            icon={<Bookmark className="h-3.5 w-3.5" />}
            onCommit={(value) => setSectionPart("text", value)}
          />
          <EditablePropRow
            label={t("sidebar.masterBar.sectionMarker")}
            value={masterBar.sectionMarker}
            placeholder={t("sidebar.masterBar.sectionMarkerPlaceholder")}
            onCommit={(value) => setSectionPart("marker", value)}
          />
        </div>
        <Separator />
      </CollapsibleContent>
    </Collapsible>
  );
}
