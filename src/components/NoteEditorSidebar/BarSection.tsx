import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { executeAppAction } from "@/app-actions";
import type { SelectedBarInfo } from "@/stores/render-types";
import {
  Clef,
  Ottavia,
  SimileMark,
} from "@/core/schema";
import {
  PopoverPropRow,
  SectionHeader,
  SelectPropRow,
  ToggleBtn,
} from "./primitives";
import {
  KeySignatureEditor,
  keySignatureSummary,
} from "./editors/KeySignatureEditor";
import { MusicGlyph, musicGlyphs } from "./notation-icons";

const CLEF_OPTIONS = [
  {
    value: Clef.Neutral,
    labelKey: "sidebar.bar.clefNeutral",
    glyph: musicGlyphs.percussionClef,
  },
  {
    value: Clef.C3,
    labelKey: "sidebar.bar.clefAlto",
    glyph: musicGlyphs.cClef,
  },
  {
    value: Clef.C4,
    labelKey: "sidebar.bar.clefTenor",
    glyph: musicGlyphs.cClef,
  },
  {
    value: Clef.F4,
    labelKey: "sidebar.bar.clefBass",
    glyph: musicGlyphs.fClef,
  },
  {
    value: Clef.G2,
    labelKey: "sidebar.bar.clefTreble",
    glyph: musicGlyphs.gClef,
  },
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
  staffIndex,
  staffCount,
  showStandardNotation,
  dragHandleProps,
}: {
  bar: SelectedBarInfo;
  staffIndex: number;
  staffCount: number;
  showStandardNotation: boolean;
  dragHandleProps?: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const [keyOpen, setKeyOpen] = useState(false);
  const title = staffCount > 1
    ? `${t("sidebar.bar.title")} · ${t("sidebar.staff.label", { index: staffIndex + 1 })}`
    : t("sidebar.bar.title");

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SectionHeader
        title={title}
        helpText={t("sidebar.bar.help")}
        isOpen={isOpen}
        dragHandleProps={dragHandleProps}
      />
      <CollapsibleContent>
        <div className="space-y-0.5 py-1">
          <div className="flex flex-wrap items-center gap-0.5 px-2">
            {showStandardNotation && (
              <ToggleBtn
                label={t("sidebar.bar.clefOttava")}
                pressed={bar.clefOttava !== Ottavia.Regular}
                onPressedChange={(pressed) => executeAppAction(
                  "document.bar.setClefOttava",
                  { value: pressed ? Ottavia._8va : Ottavia.Regular },
                  { t },
                )}
                textIcon="8"
              />
            )}
            <ToggleBtn
              label={t("sidebar.bar.simileMark")}
              pressed={bar.simileMark !== SimileMark.None}
              onPressedChange={(pressed) => executeAppAction(
                "document.bar.setSimileMark",
                { value: pressed ? SimileMark.Simple : SimileMark.None },
                { t },
              )}
              textIcon="%"
            />
          </div>
          {showStandardNotation && (
            <SelectPropRow
              label={t("sidebar.bar.clef")}
              value={bar.clef}
              options={CLEF_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
                icon: (
                  <MusicGlyph
                    glyph={option.glyph}
                    className="w-5 text-[18px]"
                  />
                ),
              }))}
              onValueChange={(value) => executeAppAction(
                "document.bar.setClef",
                { value },
                { t },
              )}
            />
          )}
          {showStandardNotation && bar.clefOttava !== Ottavia.Regular && (
            <SelectPropRow
              label={t("sidebar.bar.clefOttava")}
              value={bar.clefOttava}
              options={OTTAVA_OPTIONS.map((option) =>
                option.value === Ottavia.Regular
                  ? { ...option, label: t("sidebar.bar.regular") }
                  : option,
              )}
              onValueChange={(value) =>
                executeAppAction("document.bar.setClefOttava", { value }, { t })
              }
            />
          )}
          {bar.simileMark !== SimileMark.None && (
            <SelectPropRow
              label={t("sidebar.bar.simileMark")}
              value={bar.simileMark}
              options={SIMILE_OPTIONS.map((option) =>
                option.value === SimileMark.None
                  ? { ...option, label: t("sidebar.bar.none") }
                  : option,
              )}
              onValueChange={(value) =>
                executeAppAction("document.bar.setSimileMark", { value }, { t })
              }
            />
          )}
          {showStandardNotation && (
            <PopoverPropRow
              label={t("sidebar.bar.key")}
              value={keySignatureSummary(bar.keySignature, bar.keySignatureType)}
              open={keyOpen}
              onOpenChange={setKeyOpen}
              description={t("sidebar.bar.keyHelp")}
            >
              <KeySignatureEditor
                signature={bar.keySignature}
                type={bar.keySignatureType}
                modeLabel={t("sidebar.bar.keyType")}
                tonicLabel={t("sidebar.bar.keyTonic")}
                majorLabel={t("sidebar.bar.major")}
                minorLabel={t("sidebar.bar.minor")}
                applyLabel={t("sidebar.common.apply")}
                onCommit={(keySignature, keySignatureType) => executeAppAction(
                  "document.bar.setKey",
                  { keySignature, keySignatureType },
                  { t },
                )}
                onDone={() => setKeyOpen(false)}
              />
            </PopoverPropRow>
          )}
        </div>
        <Separator />
      </CollapsibleContent>
    </Collapsible>
  );
}
