import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  TrendingUp,
  Waves,
  CornerRightDown,
  CornerRightUp,
  MoveRight,
  Sparkles,
  AudioWaveform,
  Zap,
  ArrowUp,
  ArrowDown,
  ChevronsUp as AccentHeavy,
  ChevronsDown,
  Music,
  CircleDot,
  SunMedium,
  Hand,
  Pointer,
  Target,
  ToggleLeft,
  ToggleRight,
  RotateCcw,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { executeAction } from "@/core/actions";
import { usePlayerStore } from "@/stores/render-store";
import type { SelectedBeatInfo, SelectedNoteInfo } from "@/stores/render-types";
import {
  BendType,
  VibratoType,
  SlideInType,
  SlideOutType,
  HarmonicType,
  GraceType,
  PickStroke,
  BrushType,
  DynamicValue,
  CrescendoType,
  FadeType,
  WhammyType,
  GolpeType,
  WahPedal,
  NoteOrnament,
  Ottavia,
  Duration,
} from "@/core/schema";
import { SectionHeader, ToggleBtn, PropRow } from "./primitives";
import {
  durationLabel,
  dynamicLabel,
  dynamicTooltip,
  bendTypeLabel,
  harmonicTypeLabel,
  slideOutTypeLabel,
} from "./labels";

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
  const isAdvanced = usePlayerStore((s) => s.editorMode === "advanced");
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SectionHeader title={t("sidebar.effects.title")} helpText={t("sidebar.effects.help")} isOpen={isOpen} dragHandleProps={dragHandleProps} />
      <CollapsibleContent>
        <div className="space-y-1 py-1">
          {note && !note.isPercussion && (
            <>
              <div className="px-2">
                <div className="mb-0.5 text-[10px] font-medium text-muted-foreground px-1">
                  {t("sidebar.effects.noteEffects")}
                </div>
                <div className="flex flex-wrap gap-0.5">
                  <ToggleBtn
                    label={t("sidebar.effects.bend")}
                    pressed={note.bendType !== BendType.None}
                    onPressedChange={(pressed) =>
                      executeAction("edit.note.setBendType", pressed ? BendType.Bend : BendType.None, { t })
                    }
                    icon={<TrendingUp className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.vibratoSlight")}
                    pressed={note.vibrato === VibratoType.Slight}
                    onPressedChange={(pressed) =>
                      executeAction("edit.note.setVibrato", pressed ? VibratoType.Slight : VibratoType.None, { t })
                    }
                    icon={<Waves className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.vibratoWide")}
                    pressed={note.vibrato === VibratoType.Wide}
                    onPressedChange={(pressed) =>
                      executeAction("edit.note.setVibrato", pressed ? VibratoType.Wide : VibratoType.None, { t })
                    }
                    icon={
                      <Waves className="h-3.5 w-3.5" strokeWidth={3} />
                    }
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.slideInBelow")}
                    pressed={note.slideInType === SlideInType.IntoFromBelow}
                    onPressedChange={(pressed) =>
                      executeAction("edit.note.setSlideInType", pressed ? SlideInType.IntoFromBelow : SlideInType.None, { t })
                    }
                    icon={<CornerRightUp className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.slideInAbove")}
                    pressed={note.slideInType === SlideInType.IntoFromAbove}
                    onPressedChange={(pressed) =>
                      executeAction("edit.note.setSlideInType", pressed ? SlideInType.IntoFromAbove : SlideInType.None, { t })
                    }
                    icon={<CornerRightDown className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.slideOut")}
                    pressed={note.slideOutType !== SlideOutType.None}
                    onPressedChange={(pressed) =>
                      executeAction("edit.note.setSlideOut", pressed ? SlideOutType.Shift : SlideOutType.None, { t })
                    }
                    icon={<MoveRight className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.hammerPullOff")}
                    pressed={note.isHammerPullOrigin}
                    onPressedChange={(pressed) =>
                      executeAction("edit.note.setHammerPull", pressed, { t })
                    }
                    textIcon="H/P"
                  />
                  {isAdvanced && (
                    <>
                      <ToggleBtn
                        label={t("sidebar.effects.leftHandTap")}
                        pressed={note.isLeftHandTapped}
                      onPressedChange={(pressed) =>
                        executeAction("edit.note.setLeftHandTapped", pressed, { t })
                      }
                        textIcon="T+"
                      />
                      <ToggleBtn
                        label={t("sidebar.effects.trill")}
                        pressed={note.trillValue >= 0}
                        onPressedChange={(pressed) =>
                          executeAction("edit.note.setTrill", {
                            trillValue: pressed ? 0 : -1,
                            trillSpeed: pressed ? Duration.Sixteenth : Duration.Quarter,
                          }, { t })
                        }
                        textIcon="tr"
                      />
                      <ToggleBtn
                        label={t("sidebar.effects.harmonics")}
                        pressed={note.harmonicType !== HarmonicType.None}
                        onPressedChange={(pressed) =>
                          executeAction("edit.note.setHarmonicType", pressed ? HarmonicType.Natural : HarmonicType.None, { t })
                        }
                        icon={<Sparkles className="h-3.5 w-3.5" />}
                      />
                      <ToggleBtn
                        label={t("sidebar.effects.ornament")}
                        pressed={note.ornament !== NoteOrnament.None}
                        onPressedChange={(pressed) =>
                          executeAction("edit.note.setOrnament", pressed ? NoteOrnament.Turn : NoteOrnament.None, { t })
                        }
                        icon={<RotateCcw className="h-3.5 w-3.5" />}
                      />
                    </>
                  )}
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
                <PropRow
                  label={t("sidebar.effects.harmonic")}
                  value={harmonicTypeLabel(note.harmonicType, t)}
                  icon={<Sparkles className="h-3 w-3" />}
                />
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
            <div className="mb-0.5 text-[10px] font-medium text-muted-foreground px-1">
              {t("sidebar.effects.beatEffects")}
            </div>
            <div className="flex flex-wrap gap-0.5">
              <ToggleBtn
                label={t("sidebar.effects.beatVibrato")}
                pressed={beat.vibrato !== VibratoType.None}
                onPressedChange={(pressed) =>
                  executeAction("edit.beat.setVibrato", pressed ? VibratoType.Slight : VibratoType.None, { t })
                }
                icon={<Waves className="h-3.5 w-3.5" />}
              />
              <ToggleBtn
                label={t("sidebar.effects.graceNote")}
                pressed={beat.graceType !== GraceType.None}
                icon={<Music className="h-3.5 w-3.5" />}
              />
              <ToggleBtn
                label={t("sidebar.effects.pickStrokeUp")}
                pressed={beat.pickStroke === PickStroke.Up}
                onPressedChange={(pressed) =>
                  executeAction("edit.beat.setPickStroke", pressed ? PickStroke.Up : PickStroke.None, { t })
                }
                icon={<ArrowUp className="h-3.5 w-3.5" />}
              />
              <ToggleBtn
                label={t("sidebar.effects.pickStrokeDown")}
                pressed={beat.pickStroke === PickStroke.Down}
                onPressedChange={(pressed) =>
                  executeAction("edit.beat.setPickStroke", pressed ? PickStroke.Down : PickStroke.None, { t })
                }
                icon={<ArrowDown className="h-3.5 w-3.5" />}
              />
              {isAdvanced && (
                <>
                  <ToggleBtn
                    label={t("sidebar.effects.whammyBar")}
                    pressed={beat.whammyBarType !== WhammyType.None}
                    onPressedChange={(pressed) =>
                      executeAction("edit.beat.setWhammyBarType", pressed ? WhammyType.Hold : WhammyType.None, { t })
                    }
                    icon={<AudioWaveform className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.brushUp")}
                    pressed={
                      beat.brushType === BrushType.BrushUp ||
                      beat.brushType === BrushType.ArpeggioUp
                    }
                    onPressedChange={(pressed) =>
                      executeAction("edit.beat.setBrushType", pressed ? BrushType.BrushUp : BrushType.None, { t })
                    }
                    icon={<AccentHeavy className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.brushDown")}
                    pressed={
                      beat.brushType === BrushType.BrushDown ||
                      beat.brushType === BrushType.ArpeggioDown
                    }
                    onPressedChange={(pressed) =>
                      executeAction("edit.beat.setBrushType", pressed ? BrushType.BrushDown : BrushType.None, { t })
                    }
                    icon={<ChevronsDown className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.tremoloPicking")}
                    pressed={false}
                    icon={<Zap className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.fermata")}
                    pressed={beat.hasFermata}
                    textIcon="𝄐"
                  />
                </>
              )}
            </div>
          </div>

          <Separator className="my-0.5" />

          <div className="px-2">
            <div className="mb-0.5 text-[10px] font-medium text-muted-foreground px-1">
              {t("sidebar.effects.dynamics")}
            </div>
            <div className="flex flex-wrap gap-0.5">
              {(
                [
                  DynamicValue.PPP,
                  DynamicValue.PP,
                  DynamicValue.P,
                  DynamicValue.MP,
                  DynamicValue.MF,
                  DynamicValue.F,
                  DynamicValue.FF,
                  DynamicValue.FFF,
                ] as const
              ).map((d) => (
                <ToggleBtn
                  key={d}
                  label={dynamicTooltip(d, t)}
                  pressed={beat.dynamics === d}
                  onPressedChange={(pressed) => {
                    if (pressed) executeAction("edit.beat.setDynamics", d, { t });
                  }}
                  textIcon={dynamicLabel(d)}
                  className="text-[9px]"
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-0.5 px-2">
            <ToggleBtn
              label={t("sidebar.effects.crescendo")}
              pressed={beat.crescendo === CrescendoType.Crescendo}
              onPressedChange={(pressed) =>
                executeAction("edit.beat.setCrescendo", pressed ? CrescendoType.Crescendo : CrescendoType.None, { t })
              }
              textIcon="<"
            />
            <ToggleBtn
              label={t("sidebar.effects.decrescendo")}
              pressed={beat.crescendo === CrescendoType.Decrescendo}
              onPressedChange={(pressed) =>
                executeAction("edit.beat.setCrescendo", pressed ? CrescendoType.Decrescendo : CrescendoType.None, { t })
              }
              textIcon=">"
            />
          </div>

          {isAdvanced && (
            <>
              <Separator className="my-0.5" />

              <div className="px-2">
                <div className="mb-0.5 text-[10px] font-medium text-muted-foreground px-1">
                  {t("sidebar.effects.techniques")}
                </div>
                <div className="flex flex-wrap gap-0.5">
                  <ToggleBtn
                    label={t("sidebar.effects.tap")}
                    pressed={beat.tap}
                    onPressedChange={(pressed) =>
                      executeAction("edit.beat.setTap", pressed, { t })
                    }
                    icon={<Pointer className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.slap")}
                    pressed={beat.slap}
                    onPressedChange={(pressed) =>
                      executeAction("edit.beat.setSlap", pressed, { t })
                    }
                    icon={<Hand className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.pop")}
                    pressed={beat.pop}
                    onPressedChange={(pressed) =>
                      executeAction("edit.beat.setPop", pressed, { t })
                    }
                    icon={<CircleDot className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.fadeIn")}
                    pressed={beat.fade === FadeType.FadeIn}
                    onPressedChange={(pressed) =>
                      executeAction("edit.beat.setFade", pressed ? FadeType.FadeIn : FadeType.None, { t })
                    }
                    icon={<SunMedium className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.fadeOut")}
                    pressed={beat.fade === FadeType.FadeOut}
                    onPressedChange={(pressed) =>
                      executeAction("edit.beat.setFade", pressed ? FadeType.FadeOut : FadeType.None, { t })
                    }
                    textIcon="FO"
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.volumeSwell")}
                    pressed={beat.fade === FadeType.VolumeSwell}
                    onPressedChange={(pressed) =>
                      executeAction("edit.beat.setFade", pressed ? FadeType.VolumeSwell : FadeType.None, { t })
                    }
                    textIcon="VS"
                  />
                </div>
              </div>

              <Separator className="my-0.5" />

              <div className="px-2">
                <div className="mb-0.5 text-[10px] font-medium text-muted-foreground px-1">
                  {t("sidebar.effects.other")}
                </div>
                <div className="flex flex-wrap gap-0.5">
                  <ToggleBtn
                    label={t("sidebar.effects.golpeThumb")}
                    pressed={beat.golpe === GolpeType.Thumb}
                    onPressedChange={(pressed) =>
                      executeAction("edit.beat.setGolpe", pressed ? GolpeType.Thumb : GolpeType.None, { t })
                    }
                    icon={<Target className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.golpeFinger")}
                    pressed={beat.golpe === GolpeType.Finger}
                    onPressedChange={(pressed) =>
                      executeAction("edit.beat.setGolpe", pressed ? GolpeType.Finger : GolpeType.None, { t })
                    }
                    textIcon="GF"
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.wahOpen")}
                    pressed={beat.wahPedal === WahPedal.Open}
                    onPressedChange={(pressed) =>
                      executeAction("edit.beat.setWahPedal", pressed ? WahPedal.Open : WahPedal.None, { t })
                    }
                    icon={<ToggleLeft className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.wahClosed")}
                    pressed={beat.wahPedal === WahPedal.Closed}
                    onPressedChange={(pressed) =>
                      executeAction("edit.beat.setWahPedal", pressed ? WahPedal.Closed : WahPedal.None, { t })
                    }
                    icon={<ToggleRight className="h-3.5 w-3.5" />}
                  />
                </div>
              </div>

              {beat.ottava !== Ottavia.Regular && (
                <PropRow
                  label={t("sidebar.effects.ottava")}
                  value={
                    beat.ottava === Ottavia._8va
                      ? "8va"
                      : beat.ottava === Ottavia._8vb
                        ? "8vb"
                        : beat.ottava === Ottavia._15ma
                          ? "15ma"
                          : beat.ottava === Ottavia._15mb
                            ? "15mb"
                            : "Regular"
                  }
                />
              )}

              {beat.text && (
                <PropRow label={t("sidebar.effects.text")} value={beat.text} />
              )}
              {beat.chordId && (
                <PropRow label={t("sidebar.effects.chord")} value={beat.chordId} />
              )}
            </>
          )}
        </div>
        <Separator />
      </CollapsibleContent>
    </Collapsible>
  );
}
