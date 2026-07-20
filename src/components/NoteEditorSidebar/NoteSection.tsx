import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CircleDot,
  Link2,
  Pause,
  Parentheses,
  ChevronUp as AccentNormal,
  ChevronsUp as AccentHeavy,
  Disc,
  BellRing,
  Hand,
  X,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { executeAppAction } from "@/app-actions";
import type { SelectedBeatInfo, SelectedNoteInfo } from "@/stores/render-types";
import {
  AccentuationType,
  Duration,
  DynamicValue,
  Fingers,
  GraceType,
  NoteAccidentalMode,
} from "@/core/schema";
import {
  EditableNumberPropRow,
  PopoverPropRow,
  PropRow,
  SectionHeader,
  SelectPropRow,
  ToggleBtn,
} from "./primitives";
import {
  durationLabel,
  durationTooltip,
  dynamicLabel,
} from "./labels";
import { PitchEditor, pitchSummary } from "./editors/PitchEditor";
import { TupletEditor, tupletSummary } from "./editors/TupletEditor";

const DURATION_VALUES: Duration[] = [
  Duration.Whole,
  Duration.Half,
  Duration.Quarter,
  Duration.Eighth,
  Duration.Sixteenth,
  Duration.ThirtySecond,
  Duration.SixtyFourth,
];

const DYNAMIC_VALUES = [
  DynamicValue.PPP,
  DynamicValue.PP,
  DynamicValue.P,
  DynamicValue.MP,
  DynamicValue.MF,
  DynamicValue.F,
  DynamicValue.FF,
  DynamicValue.FFF,
] as const;

export function NoteSection({
  beat,
  note,
  dragHandleProps,
}: {
  beat: SelectedBeatInfo;
  note: SelectedNoteInfo | null;
  dragHandleProps?: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const [pitchOpen, setPitchOpen] = useState(false);
  const [tupletOpen, setTupletOpen] = useState(false);
  const durationDisabled = beat.graceType !== GraceType.None;
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SectionHeader title={t("sidebar.note.title")} helpText={t("sidebar.note.help")} isOpen={isOpen} dragHandleProps={dragHandleProps} />
      <CollapsibleContent>
        <div className="space-y-1 py-1">
          {/* Duration row — disabled when grace note (finish() overrides duration) */}
          <div className="px-2">
            <div className="mb-0.5 text-[10px] font-medium text-muted-foreground px-1">
              {t("sidebar.note.duration")}
            </div>
            <div className="flex flex-wrap gap-0.5">
              {DURATION_VALUES.map((d) => (
                <ToggleBtn
                  key={d}
                  label={durationTooltip(d, t)}
                  pressed={beat.duration === d}
                  onPressedChange={
                    durationDisabled
                      ? undefined
                      : (pressed) => {
                          if (pressed) executeAppAction("document.beat.setDuration", { value: d }, { t });
                        }
                  }
                  textIcon={durationLabel(d)}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-0.5 px-2">
            <ToggleBtn
              label={t("sidebar.note.slashed")}
              pressed={beat.slashed}
              onPressedChange={(value) => executeAppAction(
                "document.beat.setSlashed",
                { value },
                { t },
              )}
              textIcon="/"
            />
            <ToggleBtn
              label={t("sidebar.note.dotted")}
              pressed={beat.dots >= 1}
              onPressedChange={(pressed) =>
                executeAppAction("document.beat.setDots", { value: pressed ? Math.max(1, beat.dots) : 0 }, { t })
              }
              icon={<CircleDot className="h-3.5 w-3.5" />}
            />
            <ToggleBtn
              label={t("sidebar.note.doubleDot")}
              pressed={beat.dots >= 2}
              onPressedChange={(pressed) =>
                executeAppAction("document.beat.setDots", { value: pressed ? 2 : 1 }, { t })
              }
              textIcon=".."
            />
            <ToggleBtn
              label={t("sidebar.note.rest")}
              pressed={beat.isRest}
              onPressedChange={(pressed) =>
                executeAppAction("document.beat.setRest", { value: pressed }, { t })
              }
              icon={<Pause className="h-3.5 w-3.5" />}
            />
          </div>

          <PopoverPropRow
            label={t("sidebar.note.tuplet")}
            value={tupletSummary(
              beat.tupletNumerator,
              beat.tupletDenominator,
              t("sidebar.common.none"),
            )}
            open={tupletOpen}
            onOpenChange={setTupletOpen}
            description={t("sidebar.note.tupletHelp")}
          >
            <TupletEditor
              numerator={beat.tupletNumerator}
              denominator={beat.tupletDenominator}
              noneLabel={t("sidebar.common.none")}
              numeratorLabel={t("sidebar.note.tupletNumerator")}
              denominatorLabel={t("sidebar.note.tupletDenominator")}
              applyLabel={t("sidebar.common.apply")}
              onCommit={(numerator, denominator) => executeAppAction(
                "document.beat.setTuplet",
                { numerator, denominator },
                { t },
              )}
              onDone={() => setTupletOpen(false)}
            />
          </PopoverPropRow>

          <Separator className="my-0.5" />

          {note ? (
            <>
              {note.isPercussion && (
                <PropRow
                  label={t("sidebar.note.articulation")}
                  value={note.percussionArticulationName}
                  icon={<Disc className="h-3.5 w-3.5" />}
                />
              )}

              {!note.isPercussion && note.fret >= 0 && note.string > 0 && (
                <div className="grid grid-cols-2 gap-x-1">
                  <EditableNumberPropRow
                    label={t("sidebar.note.fret")}
                    value={note.fret}
                    min={0}
                    max={36}
                    onCommit={(value) =>
                      executeAppAction("document.note.setFret", { value }, { t })
                    }
                  />
                  <EditableNumberPropRow
                    label={t("sidebar.note.string")}
                    value={note.string}
                    min={1}
                    max={Math.max(1, note.stringCount)}
                    onCommit={(value) =>
                      executeAppAction("document.note.setString", { value }, { t })
                    }
                  />
                </div>
              )}

              {!note.isPercussion && note.fret < 0 && (
                <PopoverPropRow
                  label={t("sidebar.note.pitch")}
                  value={pitchSummary(note.octave, note.tone)}
                  open={pitchOpen}
                  onOpenChange={setPitchOpen}
                  description={t("sidebar.note.pitchHelp")}
                >
                  <PitchEditor
                    octave={note.octave}
                    tone={note.tone}
                    pitchClassLabel={t("sidebar.note.pitchClass")}
                    octaveLabel={t("sidebar.note.octave")}
                    applyLabel={t("sidebar.common.apply")}
                    onCommit={(octave, tone) => executeAppAction(
                      "document.note.setPitch",
                      { octave, tone },
                      { t },
                    )}
                    onDone={() => setPitchOpen(false)}
                  />
                </PopoverPropRow>
              )}

              <div className="px-2">
                <div className="mb-0.5 text-[10px] font-medium text-muted-foreground px-1">
                  {t("sidebar.note.noteProperties")}
                </div>
                <div className="flex flex-wrap gap-0.5">
                  {!note.isPercussion && (
                    <ToggleBtn
                      label={t("sidebar.note.tie")}
                      pressed={note.isTieDestination}
                      onPressedChange={(pressed) =>
                        executeAppAction("document.note.setIsTieDestination", { value: pressed }, { t })
                      }
                      icon={<Link2 className="h-3.5 w-3.5" />}
                    />
                  )}
                  <ToggleBtn
                    label={t("sidebar.note.ghostNote")}
                    pressed={note.isGhost}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setIsGhost", { value: pressed }, { t })
                    }
                    icon={<Parentheses className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.note.deadNote")}
                    pressed={note.isDead}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setIsDead", { value: pressed }, { t })
                    }
                    icon={<X className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.note.accent")}
                    pressed={note.accentuated === AccentuationType.Normal}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setAccentuated", { value: pressed ? AccentuationType.Normal : AccentuationType.None }, { t })
                    }
                    icon={<AccentNormal className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.note.heavyAccent")}
                    pressed={note.accentuated === AccentuationType.Heavy}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setAccentuated", { value: pressed ? AccentuationType.Heavy : AccentuationType.None }, { t })
                    }
                    icon={<AccentHeavy className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.note.tenuto")}
                    pressed={note.accentuated === AccentuationType.Tenuto}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setAccentuated", { value: pressed ? AccentuationType.Tenuto : AccentuationType.None }, { t })
                    }
                    textIcon="-"
                  />
                  <ToggleBtn
                    label={t("sidebar.note.staccato")}
                    pressed={note.isStaccato}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setIsStaccato", { value: pressed }, { t })
                    }
                    icon={<Disc className="h-3 w-3" />}
                  />
                  {!note.isPercussion && (
                    <>
                      <ToggleBtn
                        label={t("sidebar.note.letRing")}
                        pressed={note.isLetRing}
                        onPressedChange={(pressed) =>
                          executeAppAction("document.note.setIsLetRing", { value: pressed }, { t })
                        }
                        icon={<BellRing className="h-3.5 w-3.5" />}
                      />
                      <ToggleBtn
                        label={t("sidebar.note.palmMute")}
                        pressed={note.isPalmMute}
                        onPressedChange={(pressed) =>
                          executeAppAction("document.note.setIsPalmMute", { value: pressed }, { t })
                        }
                        icon={<Hand className="h-3.5 w-3.5" />}
                      />
                    </>
                  )}
                </div>
              </div>

              <SelectPropRow
                label={t("sidebar.note.noteDynamics")}
                value={note.dynamics}
                options={DYNAMIC_VALUES.map((value) => ({
                  value,
                  label: dynamicLabel(value),
                }))}
                onValueChange={(value) => executeAppAction(
                  "document.note.setDynamics",
                  { value },
                  { t },
                )}
              />

              {!note.isPercussion && (
                <>
                  {([
                    ["leftHandFinger", note.leftHandFinger],
                    ["rightHandFinger", note.rightHandFinger],
                  ] as const).map(([hand, value]) => (
                    <SelectPropRow
                      key={hand}
                      label={t(`sidebar.note.${hand}`)}
                      value={value}
                      options={([
                        Fingers.Unknown,
                        Fingers.NoOrDead,
                        Fingers.Thumb,
                        Fingers.IndexFinger,
                        Fingers.MiddleFinger,
                        Fingers.AnnularFinger,
                        Fingers.LittleFinger,
                      ] as const).map((finger) => ({
                        value: finger,
                        label: t(`sidebar.note.fingers.${finger}`),
                      }))}
                      onValueChange={(finger) => executeAppAction(
                        hand === "leftHandFinger"
                          ? "document.note.setLeftHandFinger"
                          : "document.note.setRightHandFinger",
                        { value: finger },
                        { t },
                      )}
                    />
                  ))}
                  <SelectPropRow
                    label={t("sidebar.note.accidentalMode")}
                    value={note.accidentalMode}
                    options={([
                      NoteAccidentalMode.Default,
                      NoteAccidentalMode.ForceNone,
                      NoteAccidentalMode.ForceNatural,
                      NoteAccidentalMode.ForceSharp,
                      NoteAccidentalMode.ForceDoubleSharp,
                      NoteAccidentalMode.ForceFlat,
                      NoteAccidentalMode.ForceDoubleFlat,
                    ] as const).map((mode) => ({
                      value: mode,
                      label: t(`sidebar.note.accidentals.${mode}`),
                    }))}
                    onValueChange={(value) => executeAppAction(
                      "document.note.setAccidentalMode",
                      { value },
                      { t },
                    )}
                  />
                </>
              )}

            </>
          ) : (
            <div className="px-3 py-2 text-[11px] italic text-muted-foreground">
              {t("sidebar.note.noNoteSelected")}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-0.5 px-2">
            <ToggleBtn
              label={t("sidebar.note.deadSlapped")}
              pressed={beat.deadSlapped}
              onPressedChange={(pressed) =>
                executeAppAction("document.beat.setDeadSlapped", { value: pressed }, { t })
              }
              textIcon="DS"
            />
            <ToggleBtn
              label={t("sidebar.note.legatoOrigin")}
              pressed={beat.isLegatoOrigin}
              onPressedChange={(value) => executeAppAction(
                "document.beat.setIsLegatoOrigin",
                { value },
                { t },
              )}
              icon={<Link2 className="h-3.5 w-3.5" />}
            />
          </div>
        </div>
        <Separator />
      </CollapsibleContent>
    </Collapsible>
  );
}
