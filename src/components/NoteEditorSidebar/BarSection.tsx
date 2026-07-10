import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bookmark,
  Clock,
  Gauge,
  Infinity,
  Key,
  Music2,
  Repeat,
  Triangle,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { executeAppAction } from "@/app-actions";
import type { SelectedBarInfo } from "@/stores/render-types";
import {
  Clef,
  KeySignatureType,
  Ottavia,
  SimileMark,
  TripletFeel,
} from "@/core/schema";
import {
  EditableNumberPropRow,
  EditablePropRow,
  SectionHeader,
  SelectPropRow,
  ToggleBtn,
} from "./primitives";
import { tripletFeelLabel } from "./labels";

const CLEF_OPTIONS = [
  { value: Clef.Neutral, label: "Neutral" },
  { value: Clef.C3, label: "C3" },
  { value: Clef.C4, label: "C4" },
  { value: Clef.F4, label: "F4" },
  { value: Clef.G2, label: "G2" },
] as const;

const OTTAVA_OPTIONS = [
  { value: Ottavia._15ma, label: "15ma" },
  { value: Ottavia._8va, label: "8va" },
  { value: Ottavia.Regular, label: "Regular" },
  { value: Ottavia._8vb, label: "8vb" },
  { value: Ottavia._15mb, label: "15mb" },
] as const;

const SIMILE_OPTIONS = [
  { value: SimileMark.None, label: "None" },
  { value: SimileMark.Simple, label: "%" },
  { value: SimileMark.FirstOfDouble, label: "%% (1)" },
  { value: SimileMark.SecondOfDouble, label: "%% (2)" },
] as const;

export function BarSection({
  bar,
  dragHandleProps,
}: {
  bar: SelectedBarInfo;
  dragHandleProps?: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);

  const setSectionPart = (field: "text" | "marker", value: string) => {
    const section = {
      text: field === "text" ? value : bar.sectionText,
      marker: field === "marker" ? value : bar.sectionMarker,
    };
    executeAppAction(
      "edit.masterBar.setSection",
      section.text || section.marker ? section : null,
      { t },
    );
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SectionHeader
        title={t("sidebar.bar.title")}
        helpText={t("sidebar.bar.help")}
        isOpen={isOpen}
        dragHandleProps={dragHandleProps}
      />
      <CollapsibleContent>
        <div className="space-y-0.5 py-1">
          <div className="grid grid-cols-2 gap-x-1">
            <EditableNumberPropRow
              label={t("sidebar.bar.numerator")}
              value={bar.timeSignatureNumerator}
              icon={<Clock className="h-3.5 w-3.5" />}
              min={1}
              max={32}
              onCommit={(value) =>
                executeAppAction("edit.masterBar.setTimeSignatureNumerator", value, { t })
              }
            />
            <EditableNumberPropRow
              label={t("sidebar.bar.denominator")}
              value={bar.timeSignatureDenominator}
              min={1}
              max={64}
              onCommit={(value) =>
                executeAppAction("edit.masterBar.setTimeSignatureDenominator", value, { t })
              }
            />
          </div>

          <SelectPropRow
            label={t("sidebar.bar.clef")}
            value={bar.clef}
            options={CLEF_OPTIONS.map((option) =>
              option.value === Clef.Neutral
                ? { ...option, label: t("sidebar.bar.neutral") }
                : option,
            )}
            icon={<Music2 className="h-3.5 w-3.5" />}
            onValueChange={(value) =>
              executeAppAction("edit.bar.setClef", value, { t })
            }
          />
          <SelectPropRow
            label={t("sidebar.bar.clefOttava")}
            value={bar.clefOttava}
            options={OTTAVA_OPTIONS.map((option) =>
              option.value === Ottavia.Regular
                ? { ...option, label: t("sidebar.bar.regular") }
                : option,
            )}
            onValueChange={(value) =>
              executeAppAction("edit.bar.setClefOttava", value, { t })
            }
          />
          <SelectPropRow
            label={t("sidebar.bar.simileMark")}
            value={bar.simileMark}
            options={SIMILE_OPTIONS.map((option) =>
              option.value === SimileMark.None
                ? { ...option, label: t("sidebar.bar.none") }
                : option,
            )}
            onValueChange={(value) =>
              executeAppAction("edit.bar.setSimileMark", value, { t })
            }
          />

          <div className="grid grid-cols-2 gap-x-1">
            <EditableNumberPropRow
              label={t("sidebar.bar.key")}
              value={bar.keySignature}
              icon={<Key className="h-3.5 w-3.5" />}
              min={-7}
              max={7}
              onCommit={(value) =>
                executeAppAction("edit.bar.setKeySignature", value, { t })
              }
            />
            <SelectPropRow
              label={t("sidebar.bar.keyType")}
              value={bar.keySignatureType}
              options={[
                { value: KeySignatureType.Major, label: t("sidebar.bar.major") },
                { value: KeySignatureType.Minor, label: t("sidebar.bar.minor") },
              ]}
              onValueChange={(value) =>
                executeAppAction("edit.bar.setKeySignatureType", value, { t })
              }
            />
          </div>

          <div className="flex flex-wrap items-center gap-0.5 px-2 pt-0.5">
            <ToggleBtn
              label={t("sidebar.bar.tempoMarker")}
              pressed={bar.tempo !== null}
              onPressedChange={(pressed) =>
                executeAppAction("edit.masterBar.setTempo", pressed ? 120 : null, { t })
              }
              icon={<Gauge className="h-3.5 w-3.5" />}
            />
            <ToggleBtn
              label={t("sidebar.bar.repeatStart")}
              pressed={bar.isRepeatStart}
              onPressedChange={(pressed) =>
                executeAppAction("edit.masterBar.setIsRepeatStart", pressed, { t })
              }
              icon={<Repeat className="h-3.5 w-3.5" />}
            />
            <ToggleBtn
              label={t("sidebar.bar.freeTime")}
              pressed={bar.isFreeTime}
              onPressedChange={(pressed) =>
                executeAppAction("edit.masterBar.setIsFreeTime", pressed, { t })
              }
              icon={<Infinity className="h-3.5 w-3.5" />}
            />
          </div>

          {bar.tempo !== null && (
            <EditableNumberPropRow
              label={t("sidebar.bar.tempo")}
              value={bar.tempo}
              suffix="BPM"
              min={20}
              max={400}
              onCommit={(value) =>
                executeAppAction("edit.masterBar.setTempo", value, { t })
              }
            />
          )}

          <SelectPropRow
            label={t("sidebar.bar.tripletFeel")}
            value={bar.tripletFeel}
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
            onValueChange={(value) =>
              executeAppAction("edit.masterBar.setTripletFeel", value, { t })
            }
          />

          <div className="grid grid-cols-2 gap-x-1">
            <EditableNumberPropRow
              label={t("sidebar.bar.repeatCountLabel")}
              value={bar.repeatCount}
              min={0}
              max={32}
              onCommit={(value) =>
                executeAppAction("edit.masterBar.setRepeatCount", value, { t })
              }
            />
            <EditableNumberPropRow
              label={t("sidebar.bar.altEndings")}
              value={bar.alternateEndings}
              min={0}
              max={255}
              onCommit={(value) =>
                executeAppAction("edit.masterBar.setAlternateEndings", value, { t })
              }
            />
          </div>

          <Separator className="my-0.5" />

          <EditablePropRow
            label={t("sidebar.bar.section")}
            value={bar.sectionText}
            placeholder={t("sidebar.bar.sectionPlaceholder")}
            icon={<Bookmark className="h-3.5 w-3.5" />}
            onCommit={(value) => setSectionPart("text", value)}
          />
          <EditablePropRow
            label={t("sidebar.bar.sectionMarker")}
            value={bar.sectionMarker}
            placeholder={t("sidebar.bar.sectionMarkerPlaceholder")}
            onCommit={(value) => setSectionPart("marker", value)}
          />
        </div>
        <Separator />
      </CollapsibleContent>
    </Collapsible>
  );
}
