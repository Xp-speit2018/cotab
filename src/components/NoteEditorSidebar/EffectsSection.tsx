import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Spline } from "lucide-react";
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
  CrescendoType,
  Duration,
  DynamicValue,
  FadeType,
  GraceType,
  GolpeType,
  HarmonicType,
  NoteOrnament,
  Ottavia,
  PickStroke,
  Rasgueado,
  SlideInType,
  SlideOutType,
  TremoloPickingStyle,
  VibratoType,
  WahPedal,
  WhammyType,
} from "@/core/schema";
import {
  DialogPropRow,
  EditablePropRow,
  PopoverPropRow,
  SectionHeader,
  SelectPropRow,
  ToggleBtn,
} from "./primitives";
import { ChordPickerEditor } from "./editors/ChordEditors";
import {
  LongTextEditor,
  longTextSummary,
} from "./editors/LongTextEditor";
import {
  BeatAutomationsEditor,
  beatAutomationsSummary,
} from "./editors/BeatAutomationsEditor";
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
  dynamicTooltip,
  harmonicTypeLabel,
  graceTypeLabel,
  ornamentLabel,
  slideInTypeLabel,
  slideOutTypeLabel,
  vibratoLabel,
} from "./labels";
import {
  MusicGlyph,
  SlideTechniqueIcon,
  musicGlyphs,
} from "./notation-icons";

const VIBRATO_VALUES = [
  VibratoType.None,
  VibratoType.Slight,
  VibratoType.Wide,
] as const;

const SLIDE_IN_VALUES = [
  SlideInType.None,
  SlideInType.IntoFromBelow,
  SlideInType.IntoFromAbove,
] as const;

const SLIDE_OUT_VALUES = [
  SlideOutType.None,
  SlideOutType.Shift,
  SlideOutType.Legato,
  SlideOutType.OutUp,
  SlideOutType.OutDown,
  SlideOutType.PickSlideDown,
  SlideOutType.PickSlideUp,
] as const;

const ORNAMENT_VALUES = [
  NoteOrnament.None,
  NoteOrnament.InvertedTurn,
  NoteOrnament.Turn,
  NoteOrnament.UpperMordent,
  NoteOrnament.LowerMordent,
] as const;

const DYNAMIC_GLYPHS: Record<number, string> = {
  [DynamicValue.PPP]: musicGlyphs.dynamicPpp,
  [DynamicValue.PP]: musicGlyphs.dynamicPp,
  [DynamicValue.P]: musicGlyphs.dynamicP,
  [DynamicValue.MP]: musicGlyphs.dynamicMp,
  [DynamicValue.MF]: musicGlyphs.dynamicMf,
  [DynamicValue.F]: musicGlyphs.dynamicF,
  [DynamicValue.FF]: musicGlyphs.dynamicFf,
  [DynamicValue.FFF]: musicGlyphs.dynamicFff,
};

const OTTAVA_OPTIONS = [
  { value: Ottavia.Regular, label: "Regular" },
  { value: Ottavia._8va, label: "8va" },
  { value: Ottavia._8vb, label: "8vb" },
  { value: Ottavia._15ma, label: "15ma" },
  { value: Ottavia._15mb, label: "15mb" },
] as const;

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
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [automationsOpen, setAutomationsOpen] = useState(false);
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
  const automationLabels = {
    none: t("sidebar.common.none"),
    count: (count: number) => t("sidebar.effects.automationCount", { count }),
    type: t("sidebar.effects.automationType"),
    value: t("sidebar.effects.automationValue"),
    volume: t("sidebar.effects.automationVolume"),
    balance: t("sidebar.effects.automationBalance"),
    instrument: t("sidebar.effects.automationInstrument"),
    bank: t("sidebar.effects.automationBank"),
    add: t("sidebar.effects.automationAdd"),
    remove: t("sidebar.effects.automationRemove"),
    apply: t("sidebar.common.apply"),
    duplicateType: t("sidebar.effects.automationDuplicateType"),
  };

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
                    icon={<Spline className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.vibrato")}
                    pressed={note.vibrato !== VibratoType.None}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setVibrato", { value: pressed ? VibratoType.Slight : VibratoType.None }, { t })
                    }
                    icon={<MusicGlyph glyph={musicGlyphs.vibrato} className="text-[14px]" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.slideIn")}
                    pressed={note.slideInType !== SlideInType.None}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setSlideInType", { value: pressed ? SlideInType.IntoFromBelow : SlideInType.None }, { t })
                    }
                    icon={<SlideTechniqueIcon direction="in" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.slideOut")}
                    pressed={note.slideOutType !== SlideOutType.None}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setSlideOutType", { value: pressed ? SlideOutType.Shift : SlideOutType.None }, { t })
                    }
                    icon={<SlideTechniqueIcon direction="out" />}
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
                    icon={<MusicGlyph glyph={musicGlyphs.leftHandTap} />}
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
                    icon={<MusicGlyph glyph={musicGlyphs.trill} />}
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
                    icon={<MusicGlyph glyph={musicGlyphs.harmonic} />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.ornament")}
                    pressed={note.ornament !== NoteOrnament.None}
                    onPressedChange={(pressed) =>
                      executeAppAction("document.note.setOrnament", { value: pressed ? NoteOrnament.Turn : NoteOrnament.None }, { t })
                    }
                    icon={<MusicGlyph glyph={musicGlyphs.ornamentTurn} />}
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
                  icon={<Spline className="h-3 w-3" />}
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
              {note.vibrato !== VibratoType.None && (
                <SelectPropRow
                  label={t("sidebar.effects.vibrato")}
                  value={note.vibrato}
                  options={VIBRATO_VALUES.map((value) => ({
                    value,
                    label: vibratoLabel(value, t),
                  }))}
                  icon={<MusicGlyph glyph={musicGlyphs.vibrato} className="text-[13px]" />}
                  onValueChange={(value) => executeAppAction(
                    "document.note.setVibrato",
                    { value },
                    { t },
                  )}
                />
              )}
              {note.slideInType !== SlideInType.None && (
                <SelectPropRow
                  label={t("sidebar.effects.slideIn")}
                  value={note.slideInType}
                  options={SLIDE_IN_VALUES.map((value) => ({
                    value,
                    label: slideInTypeLabel(value, t),
                  }))}
                  icon={<SlideTechniqueIcon direction="in" />}
                  onValueChange={(value) => executeAppAction(
                    "document.note.setSlideInType",
                    { value },
                    { t },
                  )}
                />
              )}
              {note.harmonicType !== HarmonicType.None && (
                <PopoverPropRow
                  label={t("sidebar.effects.harmonic")}
                  value={`${harmonicTypeLabel(note.harmonicType, t)} · ${note.harmonicValue}`}
                  icon={<MusicGlyph glyph={musicGlyphs.harmonic} />}
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
                <SelectPropRow
                  label={t("sidebar.effects.slideOut")}
                  value={note.slideOutType}
                  options={SLIDE_OUT_VALUES.map((value) => ({
                    value,
                    label: slideOutTypeLabel(value, t),
                  }))}
                  icon={<SlideTechniqueIcon direction="out" />}
                  onValueChange={(value) => executeAppAction(
                    "document.note.setSlideOutType",
                    { value },
                    { t },
                  )}
                />
              )}
              {note.ornament !== NoteOrnament.None && (
                <SelectPropRow
                  label={t("sidebar.effects.ornament")}
                  value={note.ornament}
                  options={ORNAMENT_VALUES.map((value) => ({
                    value,
                    label: ornamentLabel(value, t),
                  }))}
                  icon={<MusicGlyph glyph={musicGlyphs.ornamentTurn} />}
                  onValueChange={(value) => executeAppAction(
                    "document.note.setOrnament",
                    { value },
                    { t },
                  )}
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
                icon={<MusicGlyph glyph={musicGlyphs.vibrato} className="text-[14px]" />}
              />
              <ToggleBtn
                label={t("sidebar.effects.pickStrokeUp")}
                pressed={beat.pickStroke === PickStroke.Up}
                onPressedChange={(pressed) => executeAppAction(
                  "document.beat.setPickStroke",
                  { value: pressed ? PickStroke.Up : PickStroke.None },
                  { t },
                )}
                icon={<MusicGlyph glyph={musicGlyphs.pickStrokeUp} />}
              />
              <ToggleBtn
                label={t("sidebar.effects.pickStrokeDown")}
                pressed={beat.pickStroke === PickStroke.Down}
                onPressedChange={(pressed) => executeAppAction(
                  "document.beat.setPickStroke",
                  { value: pressed ? PickStroke.Down : PickStroke.None },
                  { t },
                )}
                icon={<MusicGlyph glyph={musicGlyphs.pickStrokeDown} />}
              />
              <ToggleBtn
                label={t("sidebar.effects.graceNote")}
                pressed={beat.graceType !== GraceType.None}
                onPressedChange={(pressed) =>
                  executeAppAction("document.beat.setGraceType", { value: pressed ? GraceType.BeforeBeat : GraceType.None }, { t })
                }
                icon={<MusicGlyph glyph={musicGlyphs.graceNote} />}
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
                icon={<MusicGlyph glyph={musicGlyphs.whammyDip} />}
              />
              <ToggleBtn
                label={t("sidebar.effects.brushUp")}
                pressed={beat.brushType === BrushType.BrushUp}
                onPressedChange={(pressed) =>
                  executeAppAction("document.beat.setBrush", pressed
                    ? { brushType: BrushType.BrushUp, brushDuration: 120 }
                    : { brushType: BrushType.None, brushDuration: 0 }, { t })
                }
                icon={<MusicGlyph glyph={musicGlyphs.brushUp} />}
              />
              <ToggleBtn
                label={t("sidebar.effects.brushDown")}
                pressed={beat.brushType === BrushType.BrushDown}
                onPressedChange={(pressed) =>
                  executeAppAction("document.beat.setBrush", pressed
                    ? { brushType: BrushType.BrushDown, brushDuration: 120 }
                    : { brushType: BrushType.None, brushDuration: 0 }, { t })
                }
                icon={<MusicGlyph glyph={musicGlyphs.brushDown} />}
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
                icon={<MusicGlyph glyph={musicGlyphs.tremoloPicking} />}
              />
            </div>
          </div>

          {beat.graceType !== GraceType.None && (
            <PopoverPropRow
              label={t("sidebar.effects.graceNote")}
              value={graceTypeLabel(beat.graceType, t)}
              icon={<MusicGlyph glyph={musicGlyphs.graceNote} />}
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
              icon={<MusicGlyph glyph={musicGlyphs.whammyDip} />}
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

          {beat.vibrato !== VibratoType.None && (
            <SelectPropRow
              label={t("sidebar.effects.beatVibrato")}
              value={beat.vibrato}
              options={VIBRATO_VALUES.map((value) => ({
                value,
                label: vibratoLabel(value, t),
              }))}
              icon={<MusicGlyph glyph={musicGlyphs.vibrato} className="text-[13px]" />}
              onValueChange={(value) => executeAppAction(
                "document.beat.setVibrato",
                { value },
                { t },
              )}
            />
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
              icon={<MusicGlyph glyph={musicGlyphs.tremoloPicking} />}
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

          {beat.rasgueado !== Rasgueado.None && (
            <SelectPropRow
              label={t("sidebar.effects.rasgueado")}
              value={beat.rasgueado}
              options={RASGUEADO_OPTIONS.map((option) =>
                option.value === Rasgueado.None
                  ? { ...option, label: t("sidebar.effects.none") }
                  : option,
              )}
              icon={<span className="text-[10px] font-semibold">R</span>}
              onValueChange={(value) =>
                executeAppAction("document.beat.setRasgueado", { value }, { t })
              }
            />
          )}

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
                  icon={<MusicGlyph glyph={DYNAMIC_GLYPHS[dynamic]} className="text-[17px]" />}
                  className="text-[9px]"
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-0.5 px-2">
            <ToggleBtn
              label={t("sidebar.effects.crescendo")}
              pressed={beat.crescendo === CrescendoType.Crescendo}
              onPressedChange={(pressed) => executeAppAction(
                "document.beat.setCrescendo",
                {
                  value: pressed
                    ? CrescendoType.Crescendo
                    : CrescendoType.None,
                },
                { t },
              )}
              icon={<MusicGlyph glyph={musicGlyphs.crescendo} className="text-[22px]" />}
            />
            <ToggleBtn
              label={t("sidebar.effects.decrescendo")}
              pressed={beat.crescendo === CrescendoType.Decrescendo}
              onPressedChange={(pressed) => executeAppAction(
                "document.beat.setCrescendo",
                {
                  value: pressed
                    ? CrescendoType.Decrescendo
                    : CrescendoType.None,
                },
                { t },
              )}
              icon={<MusicGlyph glyph={musicGlyphs.decrescendo} className="text-[22px]" />}
            />
          </div>

          <div className="px-2">
            <div className="mb-0.5 px-1 text-[10px] font-medium text-muted-foreground">
              {t("sidebar.effects.techniques")}
            </div>
            <div className="flex flex-wrap gap-0.5">
              <ToggleBtn
                label={t("sidebar.effects.tap")}
                pressed={beat.tap}
                onPressedChange={(value) => executeAppAction(
                  "document.beat.setTap",
                  { value },
                  { t },
                )}
                textIcon="T"
              />
              <ToggleBtn
                label={t("sidebar.effects.slap")}
                pressed={beat.slap}
                onPressedChange={(value) => executeAppAction(
                  "document.beat.setSlap",
                  { value },
                  { t },
                )}
                textIcon="S"
              />
              <ToggleBtn
                label={t("sidebar.effects.pop")}
                pressed={beat.pop}
                onPressedChange={(value) => executeAppAction(
                  "document.beat.setPop",
                  { value },
                  { t },
                )}
                textIcon="P"
              />
              <ToggleBtn
                label={t("sidebar.effects.rasgueado")}
                pressed={beat.rasgueado !== Rasgueado.None}
                onPressedChange={(pressed) => executeAppAction(
                  "document.beat.setRasgueado",
                  { value: pressed ? Rasgueado.Ii : Rasgueado.None },
                  { t },
                )}
                textIcon="R"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-0.5 px-2">
            <ToggleBtn
              label={t("sidebar.effects.fadeIn")}
              pressed={beat.fade === FadeType.FadeIn}
              onPressedChange={(pressed) =>
                executeAppAction("document.beat.setFade", { value: pressed ? FadeType.FadeIn : FadeType.None }, { t })
              }
              icon={<MusicGlyph glyph={musicGlyphs.fadeIn} />}
            />
            <ToggleBtn
              label={t("sidebar.effects.fadeOut")}
              pressed={beat.fade === FadeType.FadeOut}
              onPressedChange={(pressed) =>
                executeAppAction("document.beat.setFade", { value: pressed ? FadeType.FadeOut : FadeType.None }, { t })
              }
              icon={<MusicGlyph glyph={musicGlyphs.fadeOut} />}
            />
            <ToggleBtn
              label={t("sidebar.effects.volumeSwell")}
              pressed={beat.fade === FadeType.VolumeSwell}
              onPressedChange={(pressed) =>
                executeAppAction("document.beat.setFade", { value: pressed ? FadeType.VolumeSwell : FadeType.None }, { t })
              }
              icon={<MusicGlyph glyph={musicGlyphs.volumeSwell} />}
            />
            <ToggleBtn
              label={t("sidebar.effects.golpeThumb")}
              pressed={beat.golpe === GolpeType.Thumb}
              onPressedChange={(pressed) => executeAppAction(
                "document.beat.setGolpe",
                { value: pressed ? GolpeType.Thumb : GolpeType.None },
                { t },
              )}
              textIcon="G/T"
            />
            <ToggleBtn
              label={t("sidebar.effects.golpeFinger")}
              pressed={beat.golpe === GolpeType.Finger}
              onPressedChange={(pressed) => executeAppAction(
                "document.beat.setGolpe",
                { value: pressed ? GolpeType.Finger : GolpeType.None },
                { t },
              )}
              textIcon="G/F"
            />
            <ToggleBtn
              label={t("sidebar.effects.wahOpen")}
              pressed={beat.wahPedal === WahPedal.Open}
              onPressedChange={(pressed) => executeAppAction(
                "document.beat.setWahPedal",
                { value: pressed ? WahPedal.Open : WahPedal.None },
                { t },
              )}
              icon={<MusicGlyph glyph={musicGlyphs.wahOpen} />}
            />
            <ToggleBtn
              label={t("sidebar.effects.wahClosed")}
              pressed={beat.wahPedal === WahPedal.Closed}
              onPressedChange={(pressed) => executeAppAction(
                "document.beat.setWahPedal",
                { value: pressed ? WahPedal.Closed : WahPedal.None },
                { t },
              )}
              icon={<MusicGlyph glyph={musicGlyphs.wahClosed} />}
            />
            <ToggleBtn
              label={t("sidebar.effects.ottava")}
              pressed={beat.ottava !== Ottavia.Regular}
              onPressedChange={(pressed) => executeAppAction(
                "document.beat.setOttava",
                { value: pressed ? Ottavia._8va : Ottavia.Regular },
                { t },
              )}
              textIcon="8va"
            />
          </div>

          {beat.ottava !== Ottavia.Regular && (
            <SelectPropRow
              label={t("sidebar.effects.ottava")}
              value={beat.ottava}
              options={OTTAVA_OPTIONS}
              onValueChange={(value) => executeAppAction(
                "document.beat.setOttava",
                { value },
                { t },
              )}
            />
          )}

          <Separator className="my-0.5" />

          <EditablePropRow
            label={t("sidebar.effects.text")}
            value={beat.text ?? ""}
            placeholder={t("sidebar.effects.textPlaceholder")}
            onCommit={(value) =>
              executeAppAction("document.beat.setText", { value: value || null }, { t })
            }
          />
          <DialogPropRow
            label={t("sidebar.effects.automations")}
            value={beatAutomationsSummary(beat.automations, automationLabels)}
            title={t("sidebar.effects.automations")}
            description={t("sidebar.effects.automationsHelp")}
            open={automationsOpen}
            onOpenChange={setAutomationsOpen}
            contentClassName="sm:max-w-xl"
          >
            <BeatAutomationsEditor
              automations={beat.automations}
              labels={automationLabels}
              onCommit={(automations) => executeAppAction(
                "document.beat.setAutomations",
                { automations },
                { t },
              )}
              onDone={() => setAutomationsOpen(false)}
            />
          </DialogPropRow>
          <DialogPropRow
            label={t("sidebar.effects.lyrics")}
            value={longTextSummary(
              beat.lyrics?.join("\n") ?? "",
              t("sidebar.common.none"),
            )}
            title={t("sidebar.effects.lyrics")}
            description={t("sidebar.effects.lyricsHelp")}
            open={lyricsOpen}
            onOpenChange={setLyricsOpen}
            contentClassName="sm:max-w-xl"
          >
            <LongTextEditor
              value={beat.lyrics?.join("\n") ?? ""}
              label={t("sidebar.effects.lyrics")}
              placeholder={t("sidebar.effects.lyricsPlaceholder")}
              applyLabel={t("sidebar.common.apply")}
              onCommit={(value) => executeAppAction(
                "document.beat.setLyrics",
                { lyrics: value === "" ? null : value.split("\n") },
                { t },
              )}
              onDone={() => setLyricsOpen(false)}
            />
          </DialogPropRow>
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
              label={t("sidebar.effects.chord")}
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
