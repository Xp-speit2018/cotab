import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AudioWaveform,
  ChevronsDown,
  ChevronsUp as BrushUp,
  CornerRightDown,
  CornerRightUp,
  Hand,
  MoveRight,
  Music,
  RotateCcw,
  Sparkles,
  SunMedium,
  TrendingUp,
  Waves,
  Zap,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { executeAppAction } from "@/app-actions";
import type { SelectedBeatInfo, SelectedNoteInfo } from "@/stores/render-types";
import {
  BendStyle,
  BendType,
  BrushType,
  Duration,
  DynamicValue,
  FadeType,
  GraceType,
  HarmonicType,
  NoteOrnament,
  Rasgueado,
  SlideInType,
  SlideOutType,
  TremoloPickingStyle,
  VibratoType,
  WhammyType,
} from "@/core/schema";
import {
  EditableNumberPropRow,
  EditablePropRow,
  PropRow,
  SectionHeader,
  SelectPropRow,
  ToggleBtn,
} from "./primitives";
import {
  bendTypeLabel,
  durationLabel,
  dynamicLabel,
  dynamicTooltip,
  harmonicTypeLabel,
  slideOutTypeLabel,
} from "./labels";

const RASGUEADO_OPTIONS = [
  { value: Rasgueado.None, label: "None" },
  { value: Rasgueado.Ii, label: "ii" },
  { value: Rasgueado.Mi, label: "mi" },
  { value: Rasgueado.MiiTriplet, label: "mii (3)" },
  { value: Rasgueado.MiiAnapaest, label: "mii" },
  { value: Rasgueado.PmpTriplet, label: "pmp (3)" },
  { value: Rasgueado.PmpAnapaest, label: "pmp" },
  { value: Rasgueado.PeiTriplet, label: "pei (3)" },
  { value: Rasgueado.PeiAnapaest, label: "pei" },
  { value: Rasgueado.PaiTriplet, label: "pai (3)" },
  { value: Rasgueado.PaiAnapaest, label: "pai" },
  { value: Rasgueado.AmiTriplet, label: "ami (3)" },
  { value: Rasgueado.AmiAnapaest, label: "ami" },
  { value: Rasgueado.Ppp, label: "ppp" },
  { value: Rasgueado.Amii, label: "amii" },
  { value: Rasgueado.Amip, label: "amip" },
  { value: Rasgueado.Eami, label: "eami" },
  { value: Rasgueado.Eamii, label: "eamii" },
  { value: Rasgueado.Peami, label: "peami" },
] as const;

export function EffectsSection({
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

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SectionHeader
        title={t("sidebar.effects.title")}
        helpText={t("sidebar.effects.help")}
        isOpen={isOpen}
        dragHandleProps={dragHandleProps}
      />
      <CollapsibleContent>
        <div className="space-y-1 py-1">
          {note && !note.isPercussion && (
            <>
              <div className="px-2">
                <div className="mb-0.5 px-1 text-[10px] font-medium text-muted-foreground">
                  {t("sidebar.effects.noteEffects")}
                </div>
                <div className="flex flex-wrap gap-0.5">
                  <ToggleBtn
                    label={t("sidebar.effects.bend")}
                    pressed={note.bendType !== BendType.None}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setBend", pressed
                        ? {
                            bendType: BendType.Bend,
                            bendStyle: BendStyle.Default,
                            isContinuedBend: false,
                            bendPoints: [
                              { offset: 0, value: 0 },
                              { offset: 60, value: 4 },
                            ],
                          }
                        : {
                            bendType: BendType.None,
                            bendStyle: BendStyle.Default,
                            isContinuedBend: false,
                            bendPoints: null,
                          }, { t })
                    }
                    icon={<TrendingUp className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.vibratoSlight")}
                    pressed={note.vibrato === VibratoType.Slight}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setVibrato", pressed ? VibratoType.Slight : VibratoType.None, { t })
                    }
                    icon={<Waves className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.vibratoWide")}
                    pressed={note.vibrato === VibratoType.Wide}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setVibrato", pressed ? VibratoType.Wide : VibratoType.None, { t })
                    }
                    icon={<Waves className="h-3.5 w-3.5" strokeWidth={3} />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.slideInBelow")}
                    pressed={note.slideInType === SlideInType.IntoFromBelow}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setSlideInType", pressed ? SlideInType.IntoFromBelow : SlideInType.None, { t })
                    }
                    icon={<CornerRightUp className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.slideInAbove")}
                    pressed={note.slideInType === SlideInType.IntoFromAbove}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setSlideInType", pressed ? SlideInType.IntoFromAbove : SlideInType.None, { t })
                    }
                    icon={<CornerRightDown className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.slideOut")}
                    pressed={note.slideOutType !== SlideOutType.None}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setSlideOutType", pressed ? SlideOutType.Shift : SlideOutType.None, { t })
                    }
                    icon={<MoveRight className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.hammerPullOff")}
                    pressed={note.isHammerPullOrigin}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setIsHammerPullOrigin", pressed, { t })
                    }
                    textIcon="H/P"
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.leftHandTap")}
                    pressed={note.isLeftHandTapped}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setIsLeftHandTapped", pressed, { t })
                    }
                    textIcon="T+"
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.trill")}
                    pressed={note.trillValue >= 0}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setTrill", {
                        trillValue: pressed ? Math.max(0, note.fret + 2) : -1,
                        trillSpeed: Duration.Sixteenth,
                      }, { t })
                    }
                    textIcon="tr"
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.harmonics")}
                    pressed={note.harmonicType !== HarmonicType.None}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setHarmonicType", pressed ? HarmonicType.Natural : HarmonicType.None, { t })
                    }
                    icon={<Sparkles className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.ornament")}
                    pressed={note.ornament !== NoteOrnament.None}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setOrnament", pressed ? NoteOrnament.Turn : NoteOrnament.None, { t })
                    }
                    icon={<RotateCcw className="h-3.5 w-3.5" />}
                  />
                </div>
              </div>

              {note.bendType !== BendType.None && (
                <PropRow
                  label={t("sidebar.effects.bendType")}
                  value={bendTypeLabel(note.bendType, t)}
                  icon={<TrendingUp className="h-3 w-3" />}
                />
              )}
              {note.harmonicType !== HarmonicType.None && (
                <>
                  <PropRow
                    label={t("sidebar.effects.harmonic")}
                    value={harmonicTypeLabel(note.harmonicType, t)}
                    icon={<Sparkles className="h-3 w-3" />}
                  />
                  <EditableNumberPropRow
                    label={t("sidebar.effects.harmonicValue")}
                    value={note.harmonicValue}
                    min={0}
                    max={24}
                    onCommit={(value) =>
                      executeAppAction("document.note.setHarmonicValue", value, { t })
                    }
                  />
                </>
              )}
              {note.slideOutType !== SlideOutType.None && (
                <PropRow
                  label={t("sidebar.effects.slideOut")}
                  value={slideOutTypeLabel(note.slideOutType, t)}
                  icon={<MoveRight className="h-3 w-3" />}
                />
              )}
              {note.trillValue >= 0 && (
                <PropRow
                  label={t("sidebar.effects.trill")}
                  value={t("sidebar.effects.trillDetail", {
                    fret: note.trillValue,
                    speed: durationLabel(note.trillSpeed),
                  })}
                />
              )}

              <Separator className="my-0.5" />
            </>
          )}

          <div className="px-2">
            <div className="mb-0.5 px-1 text-[10px] font-medium text-muted-foreground">
              {t("sidebar.effects.beatEffects")}
            </div>
            <div className="flex flex-wrap gap-0.5">
              <ToggleBtn
                label={t("sidebar.effects.beatVibrato")}
                pressed={beat.vibrato !== VibratoType.None}
                onPressedChange={(pressed) =>
                  executeAppAction("document.beat.setVibrato", pressed ? VibratoType.Slight : VibratoType.None, { t })
                }
                icon={<Waves className="h-3.5 w-3.5" />}
              />
              <ToggleBtn
                label={t("sidebar.effects.graceNote")}
                pressed={beat.graceType !== GraceType.None}
                onPressedChange={(pressed) =>
                  executeAppAction("document.beat.setGraceType", pressed ? GraceType.BeforeBeat : GraceType.None, { t })
                }
                icon={<Music className="h-3.5 w-3.5" />}
              />
              <ToggleBtn
                label={t("sidebar.effects.whammyBar")}
                pressed={beat.whammyBarType !== WhammyType.None}
                onPressedChange={(pressed) =>
                  executeAppAction("document.beat.setWhammyBar", pressed
                    ? {
                        whammyBarType: WhammyType.Dive,
                        whammyStyle: BendStyle.Default,
                        isContinuedWhammy: false,
                        whammyBarPoints: [
                          { offset: 0, value: 0 },
                          { offset: 60, value: -4 },
                        ],
                      }
                    : {
                        whammyBarType: WhammyType.None,
                        whammyStyle: BendStyle.Default,
                        isContinuedWhammy: false,
                        whammyBarPoints: null,
                      }, { t })
                }
                icon={<AudioWaveform className="h-3.5 w-3.5" />}
              />
              <ToggleBtn
                label={t("sidebar.effects.brushUp")}
                pressed={beat.brushType === BrushType.BrushUp}
                onPressedChange={(pressed) =>
                  executeAppAction("document.beat.setBrush", pressed
                    ? { brushType: BrushType.BrushUp, brushDuration: 120 }
                    : { brushType: BrushType.None, brushDuration: 0 }, { t })
                }
                icon={<BrushUp className="h-3.5 w-3.5" />}
              />
              <ToggleBtn
                label={t("sidebar.effects.brushDown")}
                pressed={beat.brushType === BrushType.BrushDown}
                onPressedChange={(pressed) =>
                  executeAppAction("document.beat.setBrush", pressed
                    ? { brushType: BrushType.BrushDown, brushDuration: 120 }
                    : { brushType: BrushType.None, brushDuration: 0 }, { t })
                }
                icon={<ChevronsDown className="h-3.5 w-3.5" />}
              />
              <ToggleBtn
                label={t("sidebar.effects.tremoloPicking")}
                pressed={beat.tremoloPicking !== null}
                onPressedChange={(pressed) =>
                  executeAppAction("document.beat.setTremoloPicking", pressed
                    ? { marks: 3, style: TremoloPickingStyle.Default }
                    : null, { t })
                }
                icon={<Zap className="h-3.5 w-3.5" />}
              />
            </div>
          </div>

          <SelectPropRow
            label={t("sidebar.effects.rasgueado")}
            value={beat.rasgueado}
            options={RASGUEADO_OPTIONS.map((option) =>
              option.value === Rasgueado.None
                ? { ...option, label: t("sidebar.effects.none") }
                : option,
            )}
            icon={<Hand className="h-3.5 w-3.5" />}
            onValueChange={(value) =>
              executeAppAction("document.beat.setRasgueado", value, { t })
            }
          />

          <Separator className="my-0.5" />

          <div className="px-2">
            <div className="mb-0.5 px-1 text-[10px] font-medium text-muted-foreground">
              {t("sidebar.effects.dynamics")}
            </div>
            <div className="flex flex-wrap gap-0.5">
              {([
                DynamicValue.PPP,
                DynamicValue.PP,
                DynamicValue.P,
                DynamicValue.MP,
                DynamicValue.MF,
                DynamicValue.F,
                DynamicValue.FF,
                DynamicValue.FFF,
              ] as const).map((dynamic) => (
                <ToggleBtn
                  key={dynamic}
                  label={dynamicTooltip(dynamic, t)}
                  pressed={beat.dynamics === dynamic}
                  onPressedChange={(pressed) => {
                    if (pressed) {
                      executeAppAction("document.beat.setDynamics", dynamic, { t });
                    }
                  }}
                  textIcon={dynamicLabel(dynamic)}
                  className="text-[9px]"
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-0.5 px-2">
            <ToggleBtn
              label={t("sidebar.effects.fadeIn")}
              pressed={beat.fade === FadeType.FadeIn}
              onPressedChange={(pressed) =>
                executeAppAction("document.beat.setFade", pressed ? FadeType.FadeIn : FadeType.None, { t })
              }
              icon={<SunMedium className="h-3.5 w-3.5" />}
            />
            <ToggleBtn
              label={t("sidebar.effects.fadeOut")}
              pressed={beat.fade === FadeType.FadeOut}
              onPressedChange={(pressed) =>
                executeAppAction("document.beat.setFade", pressed ? FadeType.FadeOut : FadeType.None, { t })
              }
              textIcon="FO"
            />
            <ToggleBtn
              label={t("sidebar.effects.volumeSwell")}
              pressed={beat.fade === FadeType.VolumeSwell}
              onPressedChange={(pressed) =>
                executeAppAction("document.beat.setFade", pressed ? FadeType.VolumeSwell : FadeType.None, { t })
              }
              textIcon="VS"
            />
          </div>

          <Separator className="my-0.5" />

          <EditablePropRow
            label={t("sidebar.effects.text")}
            value={beat.text ?? ""}
            placeholder={t("sidebar.effects.textPlaceholder")}
            onCommit={(value) =>
              executeAppAction("document.beat.setText", value || null, { t })
            }
          />
          <EditablePropRow
            label={t("sidebar.effects.chord")}
            value={beat.chordId ?? ""}
            placeholder={t("sidebar.effects.chordPlaceholder")}
            onCommit={(value) =>
              executeAppAction("document.beat.setChordId", value || null, { t })
            }
          />
        </div>
        <Separator />
      </CollapsibleContent>
    </Collapsible>
  );
}
