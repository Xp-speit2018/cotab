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
  PopoverPropRow,
  SectionHeader,
  SelectPropRow,
  ToggleBtn,
} from "./primitives";
import { tripletFeelLabel } from "./labels";
import {
  AlternateEndingsEditor,
  alternateEndingsSummary,
} from "./editors/AlternateEndingsEditor";
import {
  SectionEditor,
  TimeSignatureEditor,
} from "./editors/MasterBarEditors";

export function MasterBarSection({
  masterBar,
  dragHandleProps,
}: {
  masterBar: SelectedMasterBarInfo;
  dragHandleProps?: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const [timeSignatureOpen, setTimeSignatureOpen] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(false);
  const sectionSummary = masterBar.sectionText && masterBar.sectionMarker
    ? `${masterBar.sectionMarker} · ${masterBar.sectionText}`
    : masterBar.sectionText || masterBar.sectionMarker || t("sidebar.common.none");

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
          <PopoverPropRow
            label={t("sidebar.masterBar.timeSignature")}
            value={`${masterBar.timeSignatureNumerator}/${masterBar.timeSignatureDenominator}`}
            icon={<Clock className="h-3.5 w-3.5" />}
            open={timeSignatureOpen}
            onOpenChange={setTimeSignatureOpen}
            description={t("sidebar.masterBar.timeSignatureHelp")}
          >
            <TimeSignatureEditor
              numerator={masterBar.timeSignatureNumerator}
              denominator={masterBar.timeSignatureDenominator}
              numeratorLabel={t("sidebar.masterBar.numerator")}
              denominatorLabel={t("sidebar.masterBar.denominator")}
              applyLabel={t("sidebar.common.apply")}
              onCommit={(numerator, denominator) => executeAppAction(
                "document.masterBar.setTimeSignature",
                { numerator, denominator },
                { t },
              )}
              onDone={() => setTimeSignatureOpen(false)}
            />
          </PopoverPropRow>

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
          <PopoverPropRow
            label={t("sidebar.masterBar.altEndings")}
            value={alternateEndingsSummary(
              masterBar.alternateEndings,
              t("sidebar.common.none"),
            )}
            description={t("sidebar.masterBar.altEndingsHelp")}
          >
            <AlternateEndingsEditor
              value={masterBar.alternateEndings}
              clearLabel={t("sidebar.common.clear")}
              onChange={(value) => executeAppAction(
                "document.masterBar.setAlternateEndings",
                { value },
                { t },
              )}
            />
          </PopoverPropRow>

          <Separator className="my-0.5" />

          <PopoverPropRow
            label={t("sidebar.masterBar.section")}
            value={sectionSummary}
            icon={<Bookmark className="h-3.5 w-3.5" />}
            open={sectionOpen}
            onOpenChange={setSectionOpen}
            description={t("sidebar.masterBar.sectionHelp")}
          >
            <SectionEditor
              text={masterBar.sectionText}
              marker={masterBar.sectionMarker}
              textLabel={t("sidebar.masterBar.sectionName")}
              markerLabel={t("sidebar.masterBar.sectionMarker")}
              textPlaceholder={t("sidebar.masterBar.sectionPlaceholder")}
              markerPlaceholder={t("sidebar.masterBar.sectionMarkerPlaceholder")}
              applyLabel={t("sidebar.common.apply")}
              clearLabel={t("sidebar.common.clear")}
              onCommit={(section) => executeAppAction(
                "document.masterBar.setSection",
                { section },
                { t },
              )}
              onDone={() => setSectionOpen(false)}
            />
          </PopoverPropRow>
        </div>
        <Separator />
      </CollapsibleContent>
    </Collapsible>
  );
}
