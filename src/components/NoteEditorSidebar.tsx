/**
 * NoteEditorSidebar.tsx — Left sidebar replicating Guitar Pro's edition palette.
 *
 * Three collapsible sections:
 *   1. Bar    — MasterBar-level properties (time sig, key sig, repeats, etc.)
 *   2. Note   — Duration, dots, ties, ghost, accent, staccato, let ring, palm mute, etc.
 *   3. Effects — Bend, vibrato, slide, hammer-on, trill, harmonics, dynamics, etc.
 *
 * Reads from player-store's selectedBeatInfo / selectedBarInfo (AlphaTab model).
 * Currently read-only display of the selected beat's properties.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronUp,
  // Bar section
  Clock,
  Key,
  Repeat,
  Bookmark,
  Infinity,
  Gauge,
  // Note section
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
  // Effects section
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
  ChevronsDown,
  Music,
  SunMedium,
  Pointer,
  Target,
  ToggleLeft,
  ToggleRight,
  RotateCcw,
  PanelLeftClose,
  PanelLeftOpen,
  Triangle,
  HelpCircle,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/player-store";
import type {
  SelectedBeatInfo,
  SelectedBarInfo,
  SelectedNoteInfo,
} from "@/stores/player-store";
import {
  AccentuationType,
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
  TripletFeel,
  KeySignatureType,
  NoteOrnament,
  Ottavia,
  Duration,
} from "@/core/schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compact label for a duration value.
 * These are standard music notation abbreviations and are NOT translated.
 */
function durationLabel(d: Duration): string {
  switch (d) {
    case Duration.QuadrupleWhole:
      return "4W";
    case Duration.DoubleWhole:
      return "2W";
    case Duration.Whole:
      return "W";
    case Duration.Half:
      return "H";
    case Duration.Quarter:
      return "Q";
    case Duration.Eighth:
      return "8";
    case Duration.Sixteenth:
      return "16";
    case Duration.ThirtySecond:
      return "32";
    case Duration.SixtyFourth:
      return "64";
    case Duration.OneHundredTwentyEighth:
      return "128";
    case Duration.TwoHundredFiftySixth:
      return "256";
    default:
      return String(d);
  }
}

/**
 * Dynamic marking short labels — standard music notation, NOT translated.
 */
function dynamicLabel(d: DynamicValue): string {
  const labels: Record<number, string> = {
    [DynamicValue.PPP]: "ppp",
    [DynamicValue.PP]: "pp",
    [DynamicValue.P]: "p",
    [DynamicValue.MP]: "mp",
    [DynamicValue.MF]: "mf",
    [DynamicValue.F]: "f",
    [DynamicValue.FF]: "ff",
    [DynamicValue.FFF]: "fff",
  };
  return labels[d] ?? "f";
}

/** Full descriptive name for a dynamic value — translated. */
function dynamicTooltip(d: DynamicValue, t: (key: string) => string): string {
  const map: Record<number, string> = {
    [DynamicValue.PPP]: t("sidebar.effects.dynamicPPP"),
    [DynamicValue.PP]: t("sidebar.effects.dynamicPP"),
    [DynamicValue.P]: t("sidebar.effects.dynamicP"),
    [DynamicValue.MP]: t("sidebar.effects.dynamicMP"),
    [DynamicValue.MF]: t("sidebar.effects.dynamicMF"),
    [DynamicValue.F]: t("sidebar.effects.dynamicF"),
    [DynamicValue.FF]: t("sidebar.effects.dynamicFF"),
    [DynamicValue.FFF]: t("sidebar.effects.dynamicFFF"),
  };
  return map[d] ?? dynamicLabel(d);
}

/** Full descriptive name for a duration value — translated. */
function durationTooltip(d: Duration, t: (key: string) => string): string {
  const map: Record<number, string> = {
    [Duration.Whole]: t("sidebar.note.durationWhole"),
    [Duration.Half]: t("sidebar.note.durationHalf"),
    [Duration.Quarter]: t("sidebar.note.durationQuarter"),
    [Duration.Eighth]: t("sidebar.note.durationEighth"),
    [Duration.Sixteenth]: t("sidebar.note.durationSixteenth"),
    [Duration.ThirtySecond]: t("sidebar.note.durationThirtySecond"),
    [Duration.SixtyFourth]: t("sidebar.note.durationSixtyFourth"),
  };
  return map[d] ?? durationLabel(d);
}

/**
 * Key signature labels — standard music notation, NOT translated.
 */
function keySignatureLabel(key: number, type: KeySignatureType): string {
  const majorKeys = [
    "Cb", "Gb", "Db", "Ab", "Eb", "Bb", "F",
    "C",
    "G", "D", "A", "E", "B", "F#", "C#",
  ];
  const minorKeys = [
    "Ab", "Eb", "Bb", "F", "C", "G", "D",
    "A",
    "E", "B", "F#", "C#", "G#", "D#", "A#",
  ];
  const idx = key + 7;
  if (idx < 0 || idx >= 15) return "C";
  const name = type === KeySignatureType.Minor ? minorKeys[idx] : majorKeys[idx];
  return `${name}${type === KeySignatureType.Minor ? "m" : ""}`;
}

function bendTypeLabel(bt: BendType, t: (key: string) => string): string {
  const map: Record<number, string> = {
    [BendType.None]: t("sidebar.bendTypes.none"),
    [BendType.Custom]: t("sidebar.bendTypes.custom"),
    [BendType.Bend]: t("sidebar.bendTypes.bend"),
    [BendType.Release]: t("sidebar.bendTypes.release"),
    [BendType.BendRelease]: t("sidebar.bendTypes.bendRelease"),
    [BendType.Hold]: t("sidebar.bendTypes.hold"),
    [BendType.Prebend]: t("sidebar.bendTypes.prebend"),
    [BendType.PrebendBend]: t("sidebar.bendTypes.prebendBend"),
    [BendType.PrebendRelease]: t("sidebar.bendTypes.prebendRelease"),
  };
  return map[bt] ?? String(bt);
}

function harmonicTypeLabel(ht: HarmonicType, t: (key: string) => string): string {
  const map: Record<number, string> = {
    [HarmonicType.None]: t("sidebar.harmonicTypes.none"),
    [HarmonicType.Natural]: t("sidebar.harmonicTypes.natural"),
    [HarmonicType.Artificial]: t("sidebar.harmonicTypes.artificial"),
    [HarmonicType.Pinch]: t("sidebar.harmonicTypes.pinch"),
    [HarmonicType.Tap]: t("sidebar.harmonicTypes.tap"),
    [HarmonicType.Semi]: t("sidebar.harmonicTypes.semi"),
    [HarmonicType.Feedback]: t("sidebar.harmonicTypes.feedback"),
  };
  return map[ht] ?? String(ht);
}

function slideOutTypeLabel(st: SlideOutType, t: (key: string) => string): string {
  const map: Record<number, string> = {
    [SlideOutType.None]: t("sidebar.slideOutTypes.none"),
    [SlideOutType.Shift]: t("sidebar.slideOutTypes.shift"),
    [SlideOutType.Legato]: t("sidebar.slideOutTypes.legato"),
    [SlideOutType.OutUp]: t("sidebar.slideOutTypes.outUp"),
    [SlideOutType.OutDown]: t("sidebar.slideOutTypes.outDown"),
    [SlideOutType.PickSlideDown]: t("sidebar.slideOutTypes.pickSlideDown"),
    [SlideOutType.PickSlideUp]: t("sidebar.slideOutTypes.pickSlideUp"),
  };
  return map[st] ?? String(st);
}

function tripletFeelLabel(tf: TripletFeel, t: (key: string) => string): string {
  const map: Record<number, string> = {
    [TripletFeel.NoTripletFeel]: t("sidebar.tripletFeels.none"),
    [TripletFeel.Triplet8th]: t("sidebar.tripletFeels.triplet8th"),
    [TripletFeel.Triplet16th]: t("sidebar.tripletFeels.triplet16th"),
    [TripletFeel.Dotted8th]: t("sidebar.tripletFeels.dotted8th"),
    [TripletFeel.Dotted16th]: t("sidebar.tripletFeels.dotted16th"),
    [TripletFeel.Scottish8th]: t("sidebar.tripletFeels.scottish8th"),
    [TripletFeel.Scottish16th]: t("sidebar.tripletFeels.scottish16th"),
  };
  return map[tf] ?? t("sidebar.tripletFeels.none");
}

// ─── Reusable Sub-components ─────────────────────────────────────────────────

function SectionHeader({
  title,
  helpText,
  isOpen,
}: {
  title: string;
  helpText: string;
  isOpen: boolean;
}) {
  return (
    <div className="flex w-full items-center">
      <CollapsibleTrigger className="flex flex-1 items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent/50">
        <span className="flex items-center gap-1">
          {title}
        </span>
        {isOpen ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </CollapsibleTrigger>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 hover:text-muted-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px]">
          {helpText}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

/** A single toggle button with icon + tooltip. */
function ToggleBtn({
  label,
  pressed,
  icon,
  textIcon,
  className,
}: {
  label: string;
  pressed: boolean;
  icon?: React.ReactNode;
  textIcon?: string;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          size="sm"
          pressed={pressed}
          className={cn("h-7 w-7 p-0", className)}
          aria-label={label}
        >
          {icon ?? (
            <span className="text-[10px] font-bold leading-none">
              {textIcon}
            </span>
          )}
        </Toggle>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/** A read-only property row: label + value. */
function PropRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-0.5">
      {icon && (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
          {icon}
        </span>
      )}
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="ml-auto text-[11px] font-medium tabular-nums">{value}</span>
    </div>
  );
}

// ─── Bar Section ─────────────────────────────────────────────────────────────

function BarSection({ bar }: { bar: SelectedBarInfo }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SectionHeader title={t("sidebar.bar.title")} helpText={t("sidebar.bar.help")} isOpen={isOpen} />
      <CollapsibleContent>
        <div className="space-y-0.5 py-1">
          <PropRow
            label={t("sidebar.bar.timeSig")}
            value={`${bar.timeSignatureNumerator}/${bar.timeSignatureDenominator}`}
            icon={<Clock className="h-3.5 w-3.5" />}
          />
          <PropRow
            label={t("sidebar.bar.key")}
            value={keySignatureLabel(bar.keySignature, bar.keySignatureType)}
            icon={<Key className="h-3.5 w-3.5" />}
          />
          {bar.tempo !== null && (
            <PropRow
              label={t("sidebar.bar.tempo")}
              value={t("sidebar.bar.bpm", { value: bar.tempo })}
              icon={<Gauge className="h-3.5 w-3.5" />}
            />
          )}
          <PropRow
            label={t("sidebar.bar.tripletFeel")}
            value={tripletFeelLabel(bar.tripletFeel, t)}
            icon={<Triangle className="h-3.5 w-3.5" />}
          />

          {/* Toggle row for bar flags */}
          <div className="flex flex-wrap gap-0.5 px-2 pt-1">
            <ToggleBtn
              label={t("sidebar.bar.repeatStart")}
              pressed={bar.isRepeatStart}
              icon={<Repeat className="h-3.5 w-3.5" />}
            />
            {bar.repeatCount > 0 && (
              <div className="flex items-center px-1 text-[10px] text-muted-foreground">
                {t("sidebar.bar.repeatCount", { count: bar.repeatCount })}
              </div>
            )}
            <ToggleBtn
              label={t("sidebar.bar.freeTime")}
              pressed={bar.isFreeTime}
              icon={<Infinity className="h-3.5 w-3.5" />}
            />
            <ToggleBtn
              label={t("sidebar.bar.doubleBar")}
              pressed={bar.isDoubleBar}
              textIcon="||"
            />
          </div>

          {bar.hasSection && (
            <PropRow
              label={t("sidebar.bar.section")}
              value={bar.sectionText || bar.sectionMarker}
              icon={<Bookmark className="h-3.5 w-3.5" />}
            />
          )}
          {bar.alternateEndings > 0 && (
            <PropRow
              label={t("sidebar.bar.altEndings")}
              value={String(bar.alternateEndings)}
            />
          )}
        </div>
        <Separator />
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Note Section ────────────────────────────────────────────────────────────

/** Duration button row — show which duration is active. */
const DURATION_VALUES: Duration[] = [
  Duration.Whole,
  Duration.Half,
  Duration.Quarter,
  Duration.Eighth,
  Duration.Sixteenth,
  Duration.ThirtySecond,
  Duration.SixtyFourth,
];

function NoteSection({
  beat,
  note,
}: {
  beat: SelectedBeatInfo;
  note: SelectedNoteInfo | null;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SectionHeader title={t("sidebar.note.title")} helpText={t("sidebar.note.help")} isOpen={isOpen} />
      <CollapsibleContent>
        <div className="space-y-1 py-1">
          {/* Duration row */}
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
                  textIcon={durationLabel(d)}
                />
              ))}
            </div>
          </div>

          {/* Dots + Tuplet */}
          <div className="flex flex-wrap items-center gap-0.5 px-2">
            <ToggleBtn
              label={t("sidebar.note.dotted")}
              pressed={beat.dots >= 1}
              icon={<CircleDot className="h-3.5 w-3.5" />}
            />
            <ToggleBtn
              label={t("sidebar.note.doubleDot")}
              pressed={beat.dots >= 2}
              textIcon=".."
            />
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

          {/* Note flags — only shown if a note is selected */}
          {note ? (
            <>
              <div className="px-2">
                <div className="mb-0.5 text-[10px] font-medium text-muted-foreground px-1">
                  {t("sidebar.note.noteProperties")}
                </div>
                <div className="flex flex-wrap gap-0.5">
                  <ToggleBtn
                    label={t("sidebar.note.tie")}
                    pressed={note.isTieDestination}
                    icon={<Link2 className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.note.ghostNote")}
                    pressed={note.isGhost}
                    icon={<Parentheses className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.note.deadNote")}
                    pressed={note.isDead}
                    icon={<X className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.note.accent")}
                    pressed={note.accentuated === AccentuationType.Normal}
                    icon={<AccentNormal className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.note.heavyAccent")}
                    pressed={note.accentuated === AccentuationType.Heavy}
                    icon={<AccentHeavy className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.note.staccato")}
                    pressed={note.isStaccato}
                    icon={<Disc className="h-3 w-3" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.note.letRing")}
                    pressed={note.isLetRing}
                    icon={<BellRing className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.note.palmMute")}
                    pressed={note.isPalmMute}
                    icon={<Hand className="h-3.5 w-3.5" />}
                  />
                </div>
              </div>

              {/* Fingering row */}
              {(note.leftHandFinger >= 0 || note.rightHandFinger >= 0) && (
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

          {/* Slashed beat */}
          <div className="flex flex-wrap gap-0.5 px-2">
            <ToggleBtn
              label={t("sidebar.note.slashed")}
              pressed={beat.slashed}
              textIcon="/"
            />
          </div>
        </div>
        <Separator />
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Effects Section ─────────────────────────────────────────────────────────

function EffectsSection({
  beat,
  note,
}: {
  beat: SelectedBeatInfo;
  note: SelectedNoteInfo | null;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SectionHeader title={t("sidebar.effects.title")} helpText={t("sidebar.effects.help")} isOpen={isOpen} />
      <CollapsibleContent>
        <div className="space-y-1 py-1">
          {/* ── Note-level Effects ─────────────────────────────────── */}
          {note && (
            <>
              <div className="px-2">
                <div className="mb-0.5 text-[10px] font-medium text-muted-foreground px-1">
                  {t("sidebar.effects.noteEffects")}
                </div>
                <div className="flex flex-wrap gap-0.5">
                  <ToggleBtn
                    label={t("sidebar.effects.bend")}
                    pressed={note.bendType !== BendType.None}
                    icon={<TrendingUp className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.vibratoSlight")}
                    pressed={note.vibrato === VibratoType.Slight}
                    icon={<Waves className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.vibratoWide")}
                    pressed={note.vibrato === VibratoType.Wide}
                    icon={
                      <Waves className="h-3.5 w-3.5" strokeWidth={3} />
                    }
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.slideInBelow")}
                    pressed={note.slideInType === SlideInType.IntoFromBelow}
                    icon={<CornerRightUp className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.slideInAbove")}
                    pressed={note.slideInType === SlideInType.IntoFromAbove}
                    icon={<CornerRightDown className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.slideOut")}
                    pressed={note.slideOutType !== SlideOutType.None}
                    icon={<MoveRight className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.hammerPullOff")}
                    pressed={note.isHammerPullOrigin}
                    textIcon="H/P"
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.leftHandTap")}
                    pressed={note.isLeftHandTapped}
                    textIcon="T+"
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.trill")}
                    pressed={note.trillValue >= 0}
                    textIcon="tr"
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.harmonics")}
                    pressed={note.harmonicType !== HarmonicType.None}
                    icon={<Sparkles className="h-3.5 w-3.5" />}
                  />
                  <ToggleBtn
                    label={t("sidebar.effects.ornament")}
                    pressed={note.ornament !== NoteOrnament.None}
                    icon={<RotateCcw className="h-3.5 w-3.5" />}
                  />
                </div>
              </div>

              {/* Inline detail rows for active effects */}
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

          {/* ── Beat-level Effects ─────────────────────────────────── */}
          <div className="px-2">
            <div className="mb-0.5 text-[10px] font-medium text-muted-foreground px-1">
              {t("sidebar.effects.beatEffects")}
            </div>
            <div className="flex flex-wrap gap-0.5">
              <ToggleBtn
                label={t("sidebar.effects.whammyBar")}
                pressed={beat.whammyBarType !== WhammyType.None}
                icon={<AudioWaveform className="h-3.5 w-3.5" />}
              />
              <ToggleBtn
                label={t("sidebar.effects.beatVibrato")}
                pressed={beat.vibrato !== VibratoType.None}
                icon={<Waves className="h-3.5 w-3.5" />}
              />
              <ToggleBtn
                label={t("sidebar.effects.pickStrokeUp")}
                pressed={beat.pickStroke === PickStroke.Up}
                icon={<ArrowUp className="h-3.5 w-3.5" />}
              />
              <ToggleBtn
                label={t("sidebar.effects.pickStrokeDown")}
                pressed={beat.pickStroke === PickStroke.Down}
                icon={<ArrowDown className="h-3.5 w-3.5" />}
              />
              <ToggleBtn
                label={t("sidebar.effects.brushUp")}
                pressed={
                  beat.brushType === BrushType.BrushUp ||
                  beat.brushType === BrushType.ArpeggioUp
                }
                icon={<AccentHeavy className="h-3.5 w-3.5" />}
              />
              <ToggleBtn
                label={t("sidebar.effects.brushDown")}
                pressed={
                  beat.brushType === BrushType.BrushDown ||
                  beat.brushType === BrushType.ArpeggioDown
                }
                icon={<ChevronsDown className="h-3.5 w-3.5" />}
              />
              <ToggleBtn
                label={t("sidebar.effects.graceNote")}
                pressed={beat.graceType !== GraceType.None}
                icon={<Music className="h-3.5 w-3.5" />}
              />
              <ToggleBtn
                label={t("sidebar.effects.tremoloPicking")}
                pressed={false /* derived from beat model */}
                icon={<Zap className="h-3.5 w-3.5" />}
              />
              <ToggleBtn
                label={t("sidebar.effects.fermata")}
                pressed={beat.hasFermata}
                textIcon="𝄐"
              />
            </div>
          </div>

          <Separator className="my-0.5" />

          {/* ── Dynamics ───────────────────────────────────────────── */}
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
                  textIcon={dynamicLabel(d)}
                  className="text-[9px]"
                />
              ))}
            </div>
          </div>

          {/* Crescendo */}
          <div className="flex flex-wrap gap-0.5 px-2">
            <ToggleBtn
              label={t("sidebar.effects.crescendo")}
              pressed={beat.crescendo === CrescendoType.Crescendo}
              textIcon="<"
            />
            <ToggleBtn
              label={t("sidebar.effects.decrescendo")}
              pressed={beat.crescendo === CrescendoType.Decrescendo}
              textIcon=">"
            />
          </div>

          <Separator className="my-0.5" />

          {/* ── Techniques ─────────────────────────────────────────── */}
          <div className="px-2">
            <div className="mb-0.5 text-[10px] font-medium text-muted-foreground px-1">
              {t("sidebar.effects.techniques")}
            </div>
            <div className="flex flex-wrap gap-0.5">
              <ToggleBtn
                label={t("sidebar.effects.tap")}
                pressed={beat.tap}
                icon={<Pointer className="h-3.5 w-3.5" />}
              />
              <ToggleBtn
                label={t("sidebar.effects.slap")}
                pressed={beat.slap}
                icon={<Hand className="h-3.5 w-3.5" />}
              />
              <ToggleBtn
                label={t("sidebar.effects.pop")}
                pressed={beat.pop}
                icon={<CircleDot className="h-3.5 w-3.5" />}
              />
              <ToggleBtn
                label={t("sidebar.effects.fadeIn")}
                pressed={beat.fade === FadeType.FadeIn}
                icon={<SunMedium className="h-3.5 w-3.5" />}
              />
              <ToggleBtn
                label={t("sidebar.effects.fadeOut")}
                pressed={beat.fade === FadeType.FadeOut}
                textIcon="FO"
              />
              <ToggleBtn
                label={t("sidebar.effects.volumeSwell")}
                pressed={beat.fade === FadeType.VolumeSwell}
                textIcon="VS"
              />
            </div>
          </div>

          <Separator className="my-0.5" />

          {/* ── Misc ───────────────────────────────────────────────── */}
          <div className="px-2">
            <div className="mb-0.5 text-[10px] font-medium text-muted-foreground px-1">
              {t("sidebar.effects.other")}
            </div>
            <div className="flex flex-wrap gap-0.5">
              <ToggleBtn
                label={t("sidebar.effects.golpeThumb")}
                pressed={beat.golpe === GolpeType.Thumb}
                icon={<Target className="h-3.5 w-3.5" />}
              />
              <ToggleBtn
                label={t("sidebar.effects.golpeFinger")}
                pressed={beat.golpe === GolpeType.Finger}
                textIcon="GF"
              />
              <ToggleBtn
                label={t("sidebar.effects.wahOpen")}
                pressed={beat.wahPedal === WahPedal.Open}
                icon={<ToggleLeft className="h-3.5 w-3.5" />}
              />
              <ToggleBtn
                label={t("sidebar.effects.wahClosed")}
                pressed={beat.wahPedal === WahPedal.Closed}
                icon={<ToggleRight className="h-3.5 w-3.5" />}
              />
            </div>
          </div>

          {/* Ottava */}
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

          {/* Text annotation */}
          {beat.text && (
            <PropRow label={t("sidebar.effects.text")} value={beat.text} />
          )}
          {beat.chordId && (
            <PropRow label={t("sidebar.effects.chord")} value={beat.chordId} />
          )}
        </div>
        <Separator />
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Main Sidebar ────────────────────────────────────────────────────────────

const SIDEBAR_WIDTH = 240;

export function NoteEditorSidebar() {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const selectedBeatInfo = usePlayerStore((s) => s.selectedBeatInfo);
  const selectedBarInfo = usePlayerStore((s) => s.selectedBarInfo);

  // Pick the first note in the beat as the "active" note (Guitar Pro style).
  const activeNote: SelectedNoteInfo | null =
    selectedBeatInfo && selectedBeatInfo.notes.length > 0
      ? selectedBeatInfo.notes[0]
      : null;

  if (collapsed) {
    return (
      <div className="flex flex-col items-center border-r bg-card py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
              onClick={() => setCollapsed(false)}
              aria-label={t("sidebar.expandSidebar")}
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{t("sidebar.expandSidebar")}</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col border-r bg-card"
      style={{ width: SIDEBAR_WIDTH }}
    >
      {/* Sidebar header */}
      <div className="flex h-8 items-center justify-between border-b px-2">
        <span className="text-xs font-semibold">{t("sidebar.inspector")}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-accent"
              onClick={() => setCollapsed(true)}
              aria-label={t("sidebar.collapseSidebar")}
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{t("sidebar.collapseSidebar")}</TooltipContent>
        </Tooltip>
      </div>

      {/* Content */}
      {selectedBeatInfo && selectedBarInfo ? (
        <ScrollArea className="flex-1">
          <div className="pb-4">
            <BarSection bar={selectedBarInfo} />
            <NoteSection beat={selectedBeatInfo} note={activeNote} />
            <EffectsSection beat={selectedBeatInfo} note={activeNote} />
          </div>
        </ScrollArea>
      ) : (
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-center text-xs text-muted-foreground">
            {t("sidebar.emptyState")}
          </p>
        </div>
      )}
    </div>
  );
}
