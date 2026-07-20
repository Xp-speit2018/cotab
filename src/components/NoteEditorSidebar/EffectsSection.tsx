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
import { usePlayerStore } from "@/stores/render-store";
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
  EditablePropRow,
  PopoverPropRow,
  PropRow,
  SectionHeader,
  SelectPropRow,
  ToggleBtn,
} from "./primitives";
import { ChordPickerEditor } from "./editors/ChordEditors";
import {
  BrushEditor,
  GraceEditor,
  HarmonicEditor,
  TremoloPickingEditor,
  TrillEditor,
} from "./editors/ParameterizedEffectEditors";
import {
  PitchCurveEditor,
  pitchCurveSummary,
} from "./editors/PitchCurveEditor";
import {
  brushTypeLabel,
  durationLabel,
  dynamicLabel,
  dynamicTooltip,
  harmonicTypeLabel,
  graceTypeLabel,
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
  const [chordOpen, setChordOpen] = useState(false);
  const [trillOpen, setTrillOpen] = useState(false);
  const [harmonicOpen, setHarmonicOpen] = useState(false);
  const [graceOpen, setGraceOpen] = useState(false);
  const [brushOpen, setBrushOpen] = useState(false);
  const [tremoloOpen, setTremoloOpen] = useState(false);
  const [bendOpen, setBendOpen] = useState(false);
  const [whammyOpen, setWhammyOpen] = useState(false);
  const selectedStaff = usePlayerStore((state) => state.selectedStaffInfo);
  const selectedChord = selectedStaff?.chords.find(
    (definition) => definition.id === beat.chordId,
  ) ?? null;
  const chordSummary = beat.chordId === null
    ? t("sidebar.common.none")
    : selectedChord?.name || t("sidebar.effects.missingChord");

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
                      executeAppAction("document.note.setVibrato", { value: pressed ? VibratoType.Slight : VibratoType.None }, { t })
                    }
                    icon={<Waves className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.vibratoWide")}
                    pressed={note.vibrato === VibratoType.Wide}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setVibrato", { value: pressed ? VibratoType.Wide : VibratoType.None }, { t })
                    }
                    icon={<Waves className="h-3.5 w-3.5" strokeWidth={3} />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.slideInBelow")}
                    pressed={note.slideInType === SlideInType.IntoFromBelow}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setSlideInType", { value: pressed ? SlideInType.IntoFromBelow : SlideInType.None }, { t })
                    }
                    icon={<CornerRightUp className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.slideInAbove")}
                    pressed={note.slideInType === SlideInType.IntoFromAbove}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setSlideInType", { value: pressed ? SlideInType.IntoFromAbove : SlideInType.None }, { t })
                    }
                    icon={<CornerRightDown className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.slideOut")}
                    pressed={note.slideOutType !== SlideOutType.None}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setSlideOutType", { value: pressed ? SlideOutType.Shift : SlideOutType.None }, { t })
                    }
                    icon={<MoveRight className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.hammerPullOff")}
                    pressed={note.isHammerPullOrigin}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setIsHammerPullOrigin", { value: pressed }, { t })
                    }
                    textIcon="H/P"
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.leftHandTap")}
                    pressed={note.isLeftHandTapped}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setIsLeftHandTapped", { value: pressed }, { t })
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
                      executeAppAction("document.note.setHarmonic", {
                        harmonicType: pressed ? HarmonicType.Natural : HarmonicType.None,
                        harmonicValue: note.harmonicValue,
                      }, { t })
                    }
                    icon={<Sparkles className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.ornament")}
                    pressed={note.ornament !== NoteOrnament.None}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setOrnament", { value: pressed ? NoteOrnament.Turn : NoteOrnament.None }, { t })
                    }
                    icon={<RotateCcw className="h-3.5 w-3.5" />}
                  />
                </div>
              </div>

              {note.bendType !== BendType.None && (
                <PopoverPropRow
                  label={t("sidebar.effects.bend")}
                  value={pitchCurveSummary(
                    "bend",
                    note.bendType,
                    note.bendPoints,
                    t,
                  )}
                  icon={<TrendingUp className="h-3 w-3" />}
                  open={bendOpen}
                  onOpenChange={setBendOpen}
                  description={t("sidebar.effects.bendHelp")}
                  contentClassName="w-80"
                >
                  <PitchCurveEditor
                    kind="bend"
                    type={note.bendType}
                    style={note.bendStyle}
                    isContinued={note.isContinuedBend}
                    points={note.bendPoints}
                    onCommit={(curve) => executeAppAction(
                      "document.note.setBend",
                      {
                        bendType: curve.type,
                        bendStyle: curve.style,
                        isContinuedBend: curve.isContinued,
                        bendPoints: curve.points,
                      },
                      { t },
                    )}
                    onDone={() => setBendOpen(false)}
                  />
                </PopoverPropRow>
              )}
              {note.harmonicType !== HarmonicType.None && (
                <PopoverPropRow
                  label={t("sidebar.effects.harmonic")}
                  value={`${harmonicTypeLabel(note.harmonicType, t)} · ${note.harmonicValue}`}
                  icon={<Sparkles className="h-3 w-3" />}
                  open={harmonicOpen}
                  onOpenChange={setHarmonicOpen}
                  description={t("sidebar.effects.harmonicHelp")}
                >
                  <HarmonicEditor
                    type={note.harmonicType}
                    value={note.harmonicValue}
                    typeLabel={t("sidebar.effects.harmonicType")}
                    valueLabel={t("sidebar.effects.harmonicValue")}
                    applyLabel={t("sidebar.common.apply")}
                    options={([
                      HarmonicType.Natural,
                      HarmonicType.Artificial,
                      HarmonicType.Pinch,
                      HarmonicType.Tap,
                      HarmonicType.Semi,
                      HarmonicType.Feedback,
                    ] as const).map((value) => ({
                      value,
                      label: harmonicTypeLabel(value, t),
                    }))}
                    onCommit={(harmonicType, harmonicValue) =>
                      executeAppAction("document.note.setHarmonic", {
                        harmonicType,
                        harmonicValue,
                      }, { t })
                    }
                    onDone={() => setHarmonicOpen(false)}
                  />
                </PopoverPropRow>
              )}
              {note.slideOutType !== SlideOutType.None && (
                <PropRow
                  label={t("sidebar.effects.slideOut")}
                  value={slideOutTypeLabel(note.slideOutType, t)}
                  icon={<MoveRight className="h-3 w-3" />}
                />
              )}
              {note.trillValue >= 0 && (
                <PopoverPropRow
                  label={t("sidebar.effects.trill")}
                  value={t("sidebar.effects.trillDetail", {
                    fret: note.trillValue,
                    speed: durationLabel(note.trillSpeed),
                  })}
                  open={trillOpen}
                  onOpenChange={setTrillOpen}
                  description={t("sidebar.effects.trillHelp")}
                >
                  <TrillEditor
                    value={note.trillValue}
                    speed={note.trillSpeed}
                    fretLabel={t("sidebar.effects.trillFret")}
                    speedLabel={t("sidebar.effects.trillSpeed")}
                    applyLabel={t("sidebar.common.apply")}
                    durationLabels={{
                      [Duration.Eighth]: t("sidebar.note.durationEighth"),
                      [Duration.Sixteenth]: t("sidebar.note.durationSixteenth"),
                      [Duration.ThirtySecond]: t("sidebar.note.durationThirtySecond"),
                    }}
                    onCommit={(trillValue, trillSpeed) =>
                      executeAppAction("document.note.setTrill", {
                        trillValue,
                        trillSpeed,
                      }, { t })
                    }
                    onDone={() => setTrillOpen(false)}
                  />
                </PopoverPropRow>
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
                  executeAppAction("document.beat.setVibrato", { value: pressed ? VibratoType.Slight : VibratoType.None }, { t })
                }
                icon={<Waves className="h-3.5 w-3.5" />}
              />
              <ToggleBtn
                label={t("sidebar.effects.graceNote")}
                pressed={beat.graceType !== GraceType.None}
                onPressedChange={(pressed) =>
                  executeAppAction("document.beat.setGraceType", { value: pressed ? GraceType.BeforeBeat : GraceType.None }, { t })
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
                  executeAppAction("document.beat.setTremoloPicking", {
                    effect: pressed
                      ? { marks: 3, style: TremoloPickingStyle.Default }
                      : null,
                  }, { t })
                }
                icon={<Zap className="h-3.5 w-3.5" />}
              />
            </div>
          </div>

          {beat.graceType !== GraceType.None && (
            <PopoverPropRow
              label={t("sidebar.effects.graceNote")}
              value={graceTypeLabel(beat.graceType, t)}
              icon={<Music className="h-3 w-3" />}
              open={graceOpen}
              onOpenChange={setGraceOpen}
              description={t("sidebar.effects.graceHelp")}
            >
              <GraceEditor
                value={beat.graceType}
                options={[
                  { value: GraceType.None, label: t("sidebar.common.none") },
                  { value: GraceType.BeforeBeat, label: t("sidebar.effects.graceBeforeBeat") },
                  { value: GraceType.OnBeat, label: t("sidebar.effects.graceOnBeat") },
                  { value: GraceType.BendGrace, label: t("sidebar.effects.graceBend") },
                ]}
                onCommit={(value) =>
                  executeAppAction("document.beat.setGraceType", { value }, { t })
                }
                onDone={() => setGraceOpen(false)}
              />
            </PopoverPropRow>
          )}

          {beat.whammyBarType !== WhammyType.None && (
            <PopoverPropRow
              label={t("sidebar.effects.whammyBar")}
              value={pitchCurveSummary(
                "whammy",
                beat.whammyBarType,
                beat.whammyBarPoints,
                t,
              )}
              icon={<AudioWaveform className="h-3 w-3" />}
              open={whammyOpen}
              onOpenChange={setWhammyOpen}
              description={t("sidebar.effects.whammyHelp")}
              contentClassName="w-80"
            >
              <PitchCurveEditor
                kind="whammy"
                type={beat.whammyBarType}
                style={beat.whammyStyle}
                isContinued={beat.isContinuedWhammy}
                points={beat.whammyBarPoints}
                onCommit={(curve) => executeAppAction(
                  "document.beat.setWhammyBar",
                  {
                    whammyBarType: curve.type,
                    whammyStyle: curve.style,
                    isContinuedWhammy: curve.isContinued,
                    whammyBarPoints: curve.points,
                  },
                  { t },
                )}
                onDone={() => setWhammyOpen(false)}
              />
            </PopoverPropRow>
          )}

          {beat.brushType !== BrushType.None && (
            <PopoverPropRow
              label={t("sidebar.effects.brush")}
              value={`${brushTypeLabel(beat.brushType, t)} · ${beat.brushDuration}`}
              open={brushOpen}
              onOpenChange={setBrushOpen}
              description={t("sidebar.effects.brushHelp")}
            >
              <BrushEditor
                type={beat.brushType}
                duration={beat.brushDuration}
                typeLabel={t("sidebar.effects.brushType")}
                durationLabel={t("sidebar.effects.brushDuration")}
                applyLabel={t("sidebar.common.apply")}
                options={[
                  { value: BrushType.BrushUp, label: t("sidebar.effects.brushUp") },
                  { value: BrushType.BrushDown, label: t("sidebar.effects.brushDown") },
                  { value: BrushType.ArpeggioUp, label: t("sidebar.effects.arpeggioUp") },
                  { value: BrushType.ArpeggioDown, label: t("sidebar.effects.arpeggioDown") },
                ]}
                onCommit={(brushType, brushDuration) =>
                  executeAppAction("document.beat.setBrush", {
                    brushType,
                    brushDuration,
                  }, { t })
                }
                onDone={() => setBrushOpen(false)}
              />
            </PopoverPropRow>
          )}

          {beat.tremoloPicking !== null && (
            <PopoverPropRow
              label={t("sidebar.effects.tremoloPicking")}
              value={`${beat.tremoloPicking.marks} · ${
                beat.tremoloPicking.style === TremoloPickingStyle.BuzzRoll
                  ? t("sidebar.effects.tremoloBuzzRoll")
                  : t("sidebar.effects.tremoloDefault")
              }`}
              icon={<Zap className="h-3 w-3" />}
              open={tremoloOpen}
              onOpenChange={setTremoloOpen}
              description={t("sidebar.effects.tremoloHelp")}
            >
              <TremoloPickingEditor
                marks={beat.tremoloPicking.marks}
                style={beat.tremoloPicking.style}
                marksLabel={t("sidebar.effects.tremoloMarks")}
                styleLabel={t("sidebar.effects.tremoloStyle")}
                applyLabel={t("sidebar.common.apply")}
                styleOptions={[
                  { value: TremoloPickingStyle.Default, label: t("sidebar.effects.tremoloDefault") },
                  { value: TremoloPickingStyle.BuzzRoll, label: t("sidebar.effects.tremoloBuzzRoll") },
                ]}
                onCommit={(marks, style) =>
                  executeAppAction("document.beat.setTremoloPicking", {
                    effect: { marks, style },
                  }, { t })
                }
                onDone={() => setTremoloOpen(false)}
              />
            </PopoverPropRow>
          )}

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
              executeAppAction("document.beat.setRasgueado", { value }, { t })
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
                      executeAppAction("document.beat.setDynamics", { value: dynamic }, { t });
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
                executeAppAction("document.beat.setFade", { value: pressed ? FadeType.FadeIn : FadeType.None }, { t })
              }
              icon={<SunMedium className="h-3.5 w-3.5" />}
            />
            <ToggleBtn
              label={t("sidebar.effects.fadeOut")}
              pressed={beat.fade === FadeType.FadeOut}
              onPressedChange={(pressed) =>
                executeAppAction("document.beat.setFade", { value: pressed ? FadeType.FadeOut : FadeType.None }, { t })
              }
              textIcon="FO"
            />
            <ToggleBtn
              label={t("sidebar.effects.volumeSwell")}
              pressed={beat.fade === FadeType.VolumeSwell}
              onPressedChange={(pressed) =>
                executeAppAction("document.beat.setFade", { value: pressed ? FadeType.VolumeSwell : FadeType.None }, { t })
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
              executeAppAction("document.beat.setText", { value: value || null }, { t })
            }
          />
          <PopoverPropRow
            label={t("sidebar.effects.chord")}
            value={chordSummary}
            open={chordOpen}
            onOpenChange={setChordOpen}
            description={t("sidebar.effects.chordHelp")}
          >
            <ChordPickerEditor
              definitions={selectedStaff?.chords ?? []}
              selectedId={beat.chordId}
              noneLabel={t("sidebar.common.none")}
              missingLabel={t("sidebar.effects.missingChord")}
              onSelect={(value) => executeAppAction(
                "document.beat.setChordId",
                { value },
                { t },
              )}
              onDone={() => setChordOpen(false)}
            />
          </PopoverPropRow>
        </div>
        <Separator />
      </CollapsibleContent>
    </Collapsible>
  );
}
