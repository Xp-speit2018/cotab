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
  Fingerprint,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { executeAction } from "@/core/actions";
import { usePlayerStore } from "@/stores/render-store";
import type { SelectedBeatInfo, SelectedNoteInfo } from "@/stores/render-types";
import { AccentuationType, GraceType, Duration } from "@/core/schema";
import { SectionHeader, ToggleBtn, PropRow } from "./primitives";
import { durationLabel, durationTooltip } from "./labels";

const DURATION_VALUES: Duration[] = [
  Duration.Whole,
  Duration.Half,
  Duration.Quarter,
  Duration.Eighth,
  Duration.Sixteenth,
  Duration.ThirtySecond,
  Duration.SixtyFourth,
];

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
  const isAdvanced = usePlayerStore((s) => s.editorMode === "advanced");
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
                          if (pressed) executeAction("edit.beat.setDuration", d, { t });
                        }
                  }
                  textIcon={durationLabel(d)}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-0.5 px-2">
            <ToggleBtn
              label={t("sidebar.note.dotted")}
              pressed={beat.dots >= 1}
              onPressedChange={(pressed) =>
                executeAction("edit.beat.setDots", pressed ? Math.max(1, beat.dots) : 0, { t })
              }
              icon={<CircleDot className="h-3.5 w-3.5" />}
            />
            {isAdvanced && (
              <ToggleBtn
                label={t("sidebar.note.doubleDot")}
                pressed={beat.dots >= 2}
                onPressedChange={(pressed) =>
                  executeAction("edit.beat.setDots", pressed ? 2 : 1, { t })
                }
                textIcon=".."
              />
            )}
            <ToggleBtn
              label={t("sidebar.note.rest")}
              pressed={beat.isRest}
              icon={<Pause className="h-3.5 w-3.5" />}
            />
            {beat.tupletNumerator > 0 && (
              <div className="flex items-center px-1.5 text-[10px] font-medium text-muted-foreground">
                {beat.tupletNumerator}:{beat.tupletDenominator}
              </div>
            )}
          </div>

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

              <div className="px-2">
                <div className="mb-0.5 text-[10px] font-medium text-muted-foreground px-1">
                  {t("sidebar.note.noteProperties")}
                </div>
                <div className="flex flex-wrap gap-0.5">
                  {isAdvanced && !note.isPercussion && (
                    <>
                      <ToggleBtn
                        label={t("sidebar.note.tie")}
                        pressed={note.isTieDestination}
                        onPressedChange={(pressed) =>
                          executeAction("edit.note.setTie", pressed, { t })
                        }
                        icon={<Link2 className="h-3.5 w-3.5" />}
                      />
                      <ToggleBtn
                        label={t("sidebar.note.ghostNote")}
                        pressed={note.isGhost}
                        onPressedChange={(pressed) =>
                          executeAction("edit.note.setGhost", pressed, { t })
                        }
                        icon={<Parentheses className="h-3.5 w-3.5" />}
                      />
                      <ToggleBtn
                        label={t("sidebar.note.deadNote")}
                        pressed={note.isDead}
                        onPressedChange={(pressed) =>
                          executeAction("edit.note.setDead", pressed, { t })
                        }
                        icon={<X className="h-3.5 w-3.5" />}
                      />
                    </>
                  )}
                  <ToggleBtn
                    label={t("sidebar.note.accent")}
                    pressed={note.accentuated === AccentuationType.Normal}
                    onPressedChange={(pressed) =>
                      executeAction("edit.note.setAccent", pressed ? AccentuationType.Normal : AccentuationType.None, { t })
                    }
                    icon={<AccentNormal className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.note.heavyAccent")}
                    pressed={note.accentuated === AccentuationType.Heavy}
                    onPressedChange={(pressed) =>
                      executeAction("edit.note.setAccent", pressed ? AccentuationType.Heavy : AccentuationType.None, { t })
                    }
                    icon={<AccentHeavy className="h-3.5 w-3.5" />}
                  />
                  {isAdvanced && (
                    <ToggleBtn
                      label={t("sidebar.note.tenuto")}
                      pressed={note.accentuated === AccentuationType.Tenuto}
                      onPressedChange={(pressed) =>
                        executeAction("edit.note.setAccent", pressed ? AccentuationType.Tenuto : AccentuationType.None, { t })
                      }
                      textIcon="—"
                    />
                  )}
                  <ToggleBtn
                    label={t("sidebar.note.staccato")}
                    pressed={note.isStaccato}
                    onPressedChange={(pressed) =>
                      executeAction("edit.note.setStaccato", pressed, { t })
                    }
                    icon={<Disc className="h-3 w-3" />}
                  />
                  {isAdvanced && !note.isPercussion && (
                    <>
                      <ToggleBtn
                        label={t("sidebar.note.letRing")}
                        pressed={note.isLetRing}
                        onPressedChange={(pressed) =>
                          executeAction("edit.note.setLetRing", pressed, { t })
                        }
                        icon={<BellRing className="h-3.5 w-3.5" />}
                      />
                      <ToggleBtn
                        label={t("sidebar.note.palmMute")}
                        pressed={note.isPalmMute}
                        onPressedChange={(pressed) =>
                          executeAction("edit.note.setPalmMute", pressed, { t })
                        }
                        icon={<Hand className="h-3.5 w-3.5" />}
                      />
                    </>
                  )}
                </div>
              </div>

              {isAdvanced && !note.isPercussion &&
                (note.leftHandFinger >= 0 || note.rightHandFinger >= 0) && (
                <div className="flex items-center gap-2 px-3">
                  <Fingerprint className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">
                    L:{note.leftHandFinger} R:{note.rightHandFinger}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="px-3 py-2 text-[11px] italic text-muted-foreground">
              {t("sidebar.note.noNoteSelected")}
            </div>
          )}

          {isAdvanced && (
            <div className="flex flex-wrap items-center gap-0.5 px-2">
              <ToggleBtn
                label={t("sidebar.note.slashed")}
                pressed={beat.slashed}
                onPressedChange={(pressed) =>
                  executeAction("edit.beat.setSlashed", pressed, { t })
                }
                textIcon="/"
              />
              <ToggleBtn
                label={t("sidebar.note.deadSlapped")}
                pressed={beat.deadSlapped}
                onPressedChange={(pressed) =>
                  executeAction("edit.beat.setDeadSlapped", pressed, { t })
                }
                textIcon="DS"
              />
              <ToggleBtn
                label={t("sidebar.note.legatoOrigin")}
                pressed={beat.isLegatoOrigin}
                onPressedChange={(pressed) =>
                  executeAction("edit.beat.setLegatoOrigin", pressed, { t })
                }
                textIcon="L"
              />
            </div>
          )}
        </div>
        <Separator />
      </CollapsibleContent>
    </Collapsible>
  );
}
