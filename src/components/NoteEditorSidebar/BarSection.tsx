import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Key, Music2 } from "lucide-react";
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
} from "./primitives";
import {
  KeySignatureEditor,
  keySignatureSummary,
} from "./editors/KeySignatureEditor";

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
  staffIndex,
  staffCount,
  dragHandleProps,
}: {
  bar: SelectedBarInfo;
  staffIndex: number;
  staffCount: number;
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
              executeAppAction("document.bar.setClef", { value }, { t })
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
              executeAppAction("document.bar.setClefOttava", { value }, { t })
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
              executeAppAction("document.bar.setSimileMark", { value }, { t })
            }
          />
          <PopoverPropRow
            label={t("sidebar.bar.key")}
            value={keySignatureSummary(bar.keySignature, bar.keySignatureType)}
            icon={<Key className="h-3.5 w-3.5" />}
            open={keyOpen}
            onOpenChange={setKeyOpen}
            description={t("sidebar.bar.keyHelp")}
          >
            <KeySignatureEditor
              signature={bar.keySignature}
              type={bar.keySignatureType}
              majorLabel={t("sidebar.bar.major")}
              minorLabel={t("sidebar.bar.minor")}
              onCommit={(keySignature, keySignatureType) => executeAppAction(
                "document.bar.setKey",
                { keySignature, keySignatureType },
                { t },
              )}
              onDone={() => setKeyOpen(false)}
            />
          </PopoverPropRow>
        </div>
        <Separator />
      </CollapsibleContent>
    </Collapsible>
  );
}
