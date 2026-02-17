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

import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronRight,
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
  // Debug / Selector section
  Layers,
  LayoutList,
  Grid3X3,
  // Song & Tracks sections
  Eye,
  EyeOff,
  Pencil,
  FileText,
  Copyright,
  Guitar,
  Info,
  MessageSquare,
  Album,
  User,
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
  GripVertical,
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
import { ResizeHandle } from "@/components/ui/resize-handle";
import { Button } from "@/components/ui/button";
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
  NoteAccidentalMode,
  Ottavia,
  Duration,
  FermataType,
  BendStyle,
  Fingers,
} from "@/core/schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve percussion articulation display name.
 *
 * Names from the score file (track.percussionArticulations) are returned as-is.
 * GP7 fallback names are stored as i18n keys ("percussion.gp7.{id}") and
 * resolved here via t().
 */
function percussionDisplayName(
  raw: string,
  t: (key: string) => string,
): string {
  if (raw.startsWith("percussion.gp7.")) {
    return t(raw);
  }
  return raw;
}

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

// ─── Debug Label Helpers ──────────────────────────────────────────────────────

function graceTypeLabel(g: GraceType): string {
  switch (g) {
    case GraceType.None: return "None";
    case GraceType.OnBeat: return "On Beat";
    case GraceType.BeforeBeat: return "Before Beat";
    case GraceType.BendGrace: return "Bend Grace";
    default: return String(g);
  }
}

function pickStrokeLabel(p: PickStroke): string {
  switch (p) {
    case PickStroke.None: return "None";
    case PickStroke.Up: return "Up";
    case PickStroke.Down: return "Down";
    default: return String(p);
  }
}

function brushTypeLabel(b: BrushType): string {
  switch (b) {
    case BrushType.None: return "None";
    case BrushType.BrushUp: return "Up";
    case BrushType.BrushDown: return "Down";
    case BrushType.ArpeggioUp: return "Arpeggio Up";
    case BrushType.ArpeggioDown: return "Arpeggio Down";
    default: return String(b);
  }
}

function crescendoLabel(c: CrescendoType): string {
  switch (c) {
    case CrescendoType.None: return "None";
    case CrescendoType.Crescendo: return "Crescendo";
    case CrescendoType.Decrescendo: return "Decrescendo";
    default: return String(c);
  }
}

function vibratoLabel(v: VibratoType): string {
  switch (v) {
    case VibratoType.None: return "None";
    case VibratoType.Slight: return "Slight";
    case VibratoType.Wide: return "Wide";
    default: return String(v);
  }
}

function fadeLabel(f: FadeType): string {
  switch (f) {
    case FadeType.None: return "None";
    case FadeType.FadeIn: return "Fade In";
    case FadeType.FadeOut: return "Fade Out";
    case FadeType.VolumeSwell: return "Volume Swell";
    default: return String(f);
  }
}

function ottavaLabel(o: Ottavia): string {
  switch (o) {
    case Ottavia.Regular: return "Regular";
    case Ottavia._8va: return "8va";
    case Ottavia._8vb: return "8vb";
    case Ottavia._15ma: return "15ma";
    case Ottavia._15mb: return "15mb";
    default: return String(o);
  }
}

function golpeLabel(g: GolpeType): string {
  switch (g) {
    case GolpeType.None: return "None";
    case GolpeType.Finger: return "Finger";
    case GolpeType.Thumb: return "Thumb";
    default: return String(g);
  }
}

function wahPedalLabel(w: WahPedal): string {
  switch (w) {
    case WahPedal.None: return "None";
    case WahPedal.Open: return "Open";
    case WahPedal.Closed: return "Closed";
    default: return String(w);
  }
}

function whammyTypeLabel(w: WhammyType): string {
  switch (w) {
    case WhammyType.None: return "None";
    case WhammyType.Custom: return "Custom";
    case WhammyType.Dive: return "Dive";
    case WhammyType.Dip: return "Dip";
    case WhammyType.Hold: return "Hold";
    case WhammyType.Predive: return "Predive";
    case WhammyType.PrediveDive: return "Predive/Dive";
    default: return String(w);
  }
}

function fermataTypeLabel(f: FermataType | null): string {
  if (f === null) return "—";
  switch (f) {
    case FermataType.Short: return "Short";
    case FermataType.Medium: return "Medium";
    case FermataType.Long: return "Long";
    default: return String(f);
  }
}

function accentuationLabel(a: AccentuationType): string {
  switch (a) {
    case AccentuationType.None: return "None";
    case AccentuationType.Normal: return "Normal";
    case AccentuationType.Heavy: return "Heavy";
    case AccentuationType.Tenuto: return "Tenuto";
    default: return String(a);
  }
}

function slideInLabel(s: SlideInType): string {
  switch (s) {
    case SlideInType.None: return "None";
    case SlideInType.IntoFromBelow: return "From Below";
    case SlideInType.IntoFromAbove: return "From Above";
    default: return String(s);
  }
}

function bendStyleLabel(b: BendStyle): string {
  switch (b) {
    case BendStyle.Default: return "Default";
    case BendStyle.Gradual: return "Gradual";
    case BendStyle.Fast: return "Fast";
    default: return String(b);
  }
}

function fingerLabel(f: Fingers): string {
  switch (f) {
    case Fingers.Unknown: return "—";
    case Fingers.Thumb: return "Thumb";
    case Fingers.IndexFinger: return "Index";
    case Fingers.MiddleFinger: return "Middle";
    case Fingers.AnnularFinger: return "Ring";
    case Fingers.LittleFinger: return "Little";
    default: return String(f);
  }
}

function ornamentLabel(o: NoteOrnament): string {
  switch (o) {
    case NoteOrnament.None: return "None";
    case NoteOrnament.InvertedTurn: return "Inverted Turn";
    case NoteOrnament.Turn: return "Turn";
    case NoteOrnament.UpperMordent: return "Upper Mordent";
    case NoteOrnament.LowerMordent: return "Lower Mordent";
    default: return String(o);
  }
}

function accidentalModeLabel(a: NoteAccidentalMode): string {
  switch (a) {
    case NoteAccidentalMode.Default: return "Default";
    case NoteAccidentalMode.ForceNone: return "Force None";
    case NoteAccidentalMode.ForceNatural: return "Force Natural";
    case NoteAccidentalMode.ForceSharp: return "Force Sharp";
    case NoteAccidentalMode.ForceDoubleSharp: return "Force ##";
    case NoteAccidentalMode.ForceFlat: return "Force Flat";
    case NoteAccidentalMode.ForceDoubleFlat: return "Force bb";
    default: return String(a);
  }
}

function keySignatureTypeLabel(t: KeySignatureType): string {
  switch (t) {
    case KeySignatureType.Major: return "Major";
    case KeySignatureType.Minor: return "Minor";
    default: return String(t);
  }
}

/** Format a boolean for debug display. */
function boolLabel(b: boolean): string {
  return b ? "true" : "false";
}

// ─── Reusable Sub-components ─────────────────────────────────────────────────

function SectionHeader({
  title,
  helpText,
  isOpen,
  dragHandleProps,
}: {
  title: string;
  helpText: string;
  isOpen: boolean;
  dragHandleProps?: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  return (
    <div className="group flex w-full items-center">
      {/* Drag handle — visible on hover */}
      <button
        type="button"
        className="flex h-6 w-4 shrink-0 cursor-grab items-center justify-center opacity-0 transition-opacity group-hover:opacity-60 active:cursor-grabbing"
        aria-label={t("sidebar.reorderSection")}
        {...dragHandleProps}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </button>
      <CollapsibleTrigger className="flex flex-1 items-center justify-between py-1.5 pr-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent/50">
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

/**
 * Sortable wrapper for sidebar sections. Provides drag transform styles on the
 * outer div and passes drag-handle listeners into the children render prop.
 */
function SortableSection({
  id,
  children,
}: {
  id: string;
  children: (dragHandleProps: Record<string, unknown>) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

/**
 * A single toggle button with icon + tooltip.
 *
 * NOTE: We apply active styling via the `pressed` prop directly instead of
 * using Radix Toggle's `data-[state=on]` CSS selectors because wrapping
 * the Toggle inside `<TooltipTrigger asChild>` causes the tooltip's
 * `data-state` (open/closed) to override the toggle's `data-state` (on/off).
 */
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
          className={cn(
            "h-7 w-7 p-0",
            pressed && "bg-primary/15 text-primary ring-1 ring-primary/30",
            className,
          )}
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

// ─── Song Section ────────────────────────────────────────────────────────────

function SongSection({ dragHandleProps }: { dragHandleProps?: Record<string, unknown> }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const scoreTitle = usePlayerStore((s) => s.scoreTitle);
  const scoreSubTitle = usePlayerStore((s) => s.scoreSubTitle);
  const scoreArtist = usePlayerStore((s) => s.scoreArtist);
  const scoreAlbum = usePlayerStore((s) => s.scoreAlbum);
  const scoreWords = usePlayerStore((s) => s.scoreWords);
  const scoreMusic = usePlayerStore((s) => s.scoreMusic);
  const scoreCopyright = usePlayerStore((s) => s.scoreCopyright);
  const scoreTab = usePlayerStore((s) => s.scoreTab);
  const scoreInstructions = usePlayerStore((s) => s.scoreInstructions);
  const scoreNotices = usePlayerStore((s) => s.scoreNotices);
  const scoreTempo = usePlayerStore((s) => s.scoreTempo);
  const scoreTempoLabel = usePlayerStore((s) => s.scoreTempoLabel);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SectionHeader
        title={t("sidebar.song.title")}
        helpText={t("sidebar.song.help")}
        isOpen={isOpen}
        dragHandleProps={dragHandleProps}
      />
      <CollapsibleContent>
        <div className="space-y-0.5 py-1">
          <PropRow
            label={t("sidebar.song.songTitle")}
            value={scoreTitle || t("sidebar.song.noTitle")}
            icon={<Music className="h-3.5 w-3.5" />}
          />
          <PropRow
            label={t("sidebar.song.subTitle")}
            value={scoreSubTitle}
            icon={<FileText className="h-3.5 w-3.5" />}
          />
          <PropRow
            label={t("sidebar.song.songArtist")}
            value={scoreArtist || t("sidebar.song.noArtist")}
            icon={<User className="h-3.5 w-3.5" />}
          />
          <PropRow
            label={t("sidebar.song.album")}
            value={scoreAlbum}
            icon={<Album className="h-3.5 w-3.5" />}
          />
          <PropRow
            label={t("sidebar.song.words")}
            value={scoreWords}
            icon={<Pencil className="h-3.5 w-3.5" />}
          />
          <PropRow
            label={t("sidebar.song.music")}
            value={scoreMusic}
            icon={<Music className="h-3.5 w-3.5" />}
          />
          <PropRow
            label={t("sidebar.song.copyright")}
            value={scoreCopyright}
            icon={<Copyright className="h-3.5 w-3.5" />}
          />
          <PropRow
            label={t("sidebar.song.tab")}
            value={scoreTab}
            icon={<Guitar className="h-3.5 w-3.5" />}
          />
          <PropRow
            label={t("sidebar.song.instructions")}
            value={scoreInstructions}
            icon={<Info className="h-3.5 w-3.5" />}
          />
          <PropRow
            label={t("sidebar.song.notices")}
            value={scoreNotices}
            icon={<MessageSquare className="h-3.5 w-3.5" />}
          />
          <PropRow
            label={t("sidebar.song.tempo")}
            value={scoreTempo > 0 ? t("sidebar.song.bpm", { value: scoreTempo }) : ""}
            icon={<Gauge className="h-3.5 w-3.5" />}
          />
          <PropRow
            label={t("sidebar.song.tempoLabel")}
            value={scoreTempoLabel}
            icon={<Gauge className="h-3.5 w-3.5" />}
          />
        </div>
        <Separator />
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Tracks Section ──────────────────────────────────────────────────────────

function TracksSection({ dragHandleProps }: { dragHandleProps?: Record<string, unknown> }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const tracks = usePlayerStore((s) => s.tracks);
  const visibleTrackIndices = usePlayerStore((s) => s.visibleTrackIndices);
  const setTrackVisible = usePlayerStore((s) => s.setTrackVisible);

  const visibleSet = new Set(visibleTrackIndices);

  if (tracks.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SectionHeader
        title={t("sidebar.tracks.title")}
        helpText={t("sidebar.tracks.help")}
        isOpen={isOpen}
        dragHandleProps={dragHandleProps}
      />
      <CollapsibleContent>
        <div className="py-1">
          {tracks.map((track) => {
            const isVisible = visibleSet.has(track.index);
            return (
              <button
                key={track.index}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1 text-[11px] hover:bg-accent/50",
                  !isVisible && "text-muted-foreground opacity-50",
                )}
                onClick={() => setTrackVisible(track.index, !isVisible)}
              >
                {isVisible ? (
                  <Eye className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate">{track.name}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {isVisible
                    ? t("sidebar.tracks.visible")
                    : t("sidebar.tracks.hidden")}
                </span>
              </button>
            );
          })}
        </div>
        <Separator />
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Debug Hierarchy Level ────────────────────────────────────────────────────

/**
 * A collapsible sub-section for one level of the AlphaTab data model hierarchy.
 * Renders a compact header and a list of key-value property rows.
 */
function DebugLevel({
  title,
  icon,
  items,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ReactNode;
  items: { label: string; value: string }[];
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent/30">
        {isOpen ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
          {icon}
        </span>
        <span className="truncate">{title}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-l border-border/50 ml-[13px] pl-1">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex items-baseline gap-1 px-1 py-px"
            >
              <span className="shrink-0 text-[10px] text-muted-foreground/70">
                {item.label}
              </span>
              <span className="ml-auto truncate text-right text-[10px] font-mono tabular-nums">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Debug Inspector Section (replaces old SelectorSection) ──────────────────

function SelectorSection({
  beat,
  note,
  noteIndex,
  dragHandleProps,
}: {
  beat: SelectedBeatInfo | null;
  note: SelectedNoteInfo | null;
  noteIndex: number;
  dragHandleProps?: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);

  const showSnapGrid = usePlayerStore((s) => s.showSnapGrid);
  const setShowSnapGrid = usePlayerStore((s) => s.setShowSnapGrid);

  const selectedBeat = usePlayerStore((s) => s.selectedBeat);
  const trackInfo = usePlayerStore((s) => s.selectedTrackInfo);
  const staffInfo = usePlayerStore((s) => s.selectedStaffInfo);
  const barInfo = usePlayerStore((s) => s.selectedBarInfo);
  const voiceInfo = usePlayerStore((s) => s.selectedVoiceInfo);
  const tracks = usePlayerStore((s) => s.tracks);

  // Score-level fields
  const scoreTitle = usePlayerStore((s) => s.scoreTitle);
  const scoreSubTitle = usePlayerStore((s) => s.scoreSubTitle);
  const scoreArtist = usePlayerStore((s) => s.scoreArtist);
  const scoreAlbum = usePlayerStore((s) => s.scoreAlbum);
  const scoreWords = usePlayerStore((s) => s.scoreWords);
  const scoreMusic = usePlayerStore((s) => s.scoreMusic);
  const scoreCopyright = usePlayerStore((s) => s.scoreCopyright);
  const scoreTab = usePlayerStore((s) => s.scoreTab);
  const scoreInstructions = usePlayerStore((s) => s.scoreInstructions);
  const scoreNotices = usePlayerStore((s) => s.scoreNotices);
  const scoreTempo = usePlayerStore((s) => s.scoreTempo);
  const scoreTempoLabel = usePlayerStore((s) => s.scoreTempoLabel);

  // ── Build items for each hierarchy level ──

  const scoreItems = [
    { label: t("sidebar.selector.scoreTitle"), value: scoreTitle || "—" },
    { label: t("sidebar.selector.scoreSubTitle"), value: scoreSubTitle || "—" },
    { label: t("sidebar.selector.scoreArtist"), value: scoreArtist || "—" },
    { label: t("sidebar.selector.scoreAlbum"), value: scoreAlbum || "—" },
    { label: t("sidebar.selector.scoreWords"), value: scoreWords || "—" },
    { label: t("sidebar.selector.scoreMusic"), value: scoreMusic || "—" },
    { label: t("sidebar.selector.scoreCopyright"), value: scoreCopyright || "—" },
    { label: t("sidebar.selector.scoreTab"), value: scoreTab || "—" },
    { label: t("sidebar.selector.scoreInstructions"), value: scoreInstructions || "—" },
    { label: t("sidebar.selector.scoreNotices"), value: scoreNotices || "—" },
    { label: t("sidebar.selector.scoreTempo"), value: String(scoreTempo) },
    { label: t("sidebar.selector.scoreTempoLabel"), value: scoreTempoLabel || "—" },
    { label: t("sidebar.selector.scoreTrackCount"), value: String(tracks.length) },
  ];

  const trackItems: { label: string; value: string }[] = trackInfo
    ? [
        { label: t("sidebar.selector.trackIndex"), value: String(trackInfo.index) },
        { label: t("sidebar.selector.trackName"), value: trackInfo.name || "—" },
        { label: t("sidebar.selector.trackShortName"), value: trackInfo.shortName || "—" },
        { label: t("sidebar.selector.trackIsPercussion"), value: boolLabel(trackInfo.isPercussion) },
        { label: t("sidebar.selector.trackStaffCount"), value: String(trackInfo.staffCount) },
        { label: t("sidebar.selector.trackPlaybackChannel"), value: String(trackInfo.playbackChannel) },
        { label: t("sidebar.selector.trackPlaybackProgram"), value: String(trackInfo.playbackProgram) },
        { label: t("sidebar.selector.trackPlaybackPort"), value: String(trackInfo.playbackPort) },
      ]
    : [];

  const staffItems: { label: string; value: string }[] = staffInfo
    ? [
        { label: t("sidebar.selector.staffIndex"), value: String(staffInfo.index) },
        { label: t("sidebar.selector.staffShowTablature"), value: boolLabel(staffInfo.showTablature) },
        { label: t("sidebar.selector.staffShowStandardNotation"), value: boolLabel(staffInfo.showStandardNotation) },
        { label: t("sidebar.selector.staffStringCount"), value: String(staffInfo.stringCount) },
        { label: t("sidebar.selector.staffCapo"), value: String(staffInfo.capo) },
        { label: t("sidebar.selector.staffTranspositionPitch"), value: String(staffInfo.transpositionPitch) },
        { label: t("sidebar.selector.staffDisplayTranspositionPitch"), value: String(staffInfo.displayTranspositionPitch) },
      ]
    : [];

  const barItems: { label: string; value: string }[] = barInfo
    ? [
        { label: t("sidebar.selector.barIndex"), value: String(barInfo.index) },
        { label: t("sidebar.selector.barTimeSig"), value: `${barInfo.timeSignatureNumerator}/${barInfo.timeSignatureDenominator}` },
        { label: t("sidebar.selector.barKeySignature"), value: keySignatureLabel(barInfo.keySignature, barInfo.keySignatureType) },
        { label: t("sidebar.selector.barKeySignatureType"), value: keySignatureTypeLabel(barInfo.keySignatureType) },
        { label: t("sidebar.selector.barIsRepeatStart"), value: boolLabel(barInfo.isRepeatStart) },
        { label: t("sidebar.selector.barRepeatCount"), value: String(barInfo.repeatCount) },
        { label: t("sidebar.selector.barAlternateEndings"), value: String(barInfo.alternateEndings) },
        { label: t("sidebar.selector.barTripletFeel"), value: tripletFeelLabel(barInfo.tripletFeel, t) },
        { label: t("sidebar.selector.barIsFreeTime"), value: boolLabel(barInfo.isFreeTime) },
        { label: t("sidebar.selector.barIsDoubleBar"), value: boolLabel(barInfo.isDoubleBar) },
        { label: t("sidebar.selector.barHasSection"), value: boolLabel(barInfo.hasSection) },
        { label: t("sidebar.selector.barSectionText"), value: barInfo.sectionText || "—" },
        { label: t("sidebar.selector.barSectionMarker"), value: barInfo.sectionMarker || "—" },
        { label: t("sidebar.selector.barTempo"), value: barInfo.tempo !== null ? String(barInfo.tempo) : "—" },
      ]
    : [];

  const voiceItems: { label: string; value: string }[] = voiceInfo
    ? [
        { label: t("sidebar.selector.voiceIndex"), value: String(voiceInfo.index) },
        { label: t("sidebar.selector.voiceIsEmpty"), value: boolLabel(voiceInfo.isEmpty) },
        { label: t("sidebar.selector.voiceBeatCount"), value: String(voiceInfo.beatCount) },
      ]
    : [];

  const beatItems: { label: string; value: string }[] = beat
    ? [
        { label: t("sidebar.selector.beatIndex"), value: String(beat.index) },
        { label: t("sidebar.selector.beatDuration"), value: durationLabel(beat.duration) },
        { label: t("sidebar.selector.beatDots"), value: String(beat.dots) },
        { label: t("sidebar.selector.beatIsRest"), value: boolLabel(beat.isRest) },
        { label: t("sidebar.selector.beatIsEmpty"), value: boolLabel(beat.isEmpty) },
        { label: t("sidebar.selector.beatTupletNumerator"), value: String(beat.tupletNumerator) },
        { label: t("sidebar.selector.beatTupletDenominator"), value: String(beat.tupletDenominator) },
        { label: t("sidebar.selector.beatGraceType"), value: graceTypeLabel(beat.graceType) },
        { label: t("sidebar.selector.beatPickStroke"), value: pickStrokeLabel(beat.pickStroke) },
        { label: t("sidebar.selector.beatBrushType"), value: brushTypeLabel(beat.brushType) },
        { label: t("sidebar.selector.beatDynamics"), value: dynamicLabel(beat.dynamics) },
        { label: t("sidebar.selector.beatCrescendo"), value: crescendoLabel(beat.crescendo) },
        { label: t("sidebar.selector.beatVibrato"), value: vibratoLabel(beat.vibrato) },
        { label: t("sidebar.selector.beatFade"), value: fadeLabel(beat.fade) },
        { label: t("sidebar.selector.beatOttava"), value: ottavaLabel(beat.ottava) },
        { label: t("sidebar.selector.beatGolpe"), value: golpeLabel(beat.golpe) },
        { label: t("sidebar.selector.beatWahPedal"), value: wahPedalLabel(beat.wahPedal) },
        { label: t("sidebar.selector.beatWhammyBarType"), value: whammyTypeLabel(beat.whammyBarType) },
        { label: t("sidebar.selector.beatWhammyBarPoints"), value: beat.whammyBarPoints.length > 0 ? `${beat.whammyBarPoints.length} pts` : "—" },
        { label: t("sidebar.selector.beatText"), value: beat.text ?? "—" },
        { label: t("sidebar.selector.beatChordId"), value: beat.chordId ?? "—" },
        { label: t("sidebar.selector.beatTap"), value: boolLabel(beat.tap) },
        { label: t("sidebar.selector.beatSlap"), value: boolLabel(beat.slap) },
        { label: t("sidebar.selector.beatPop"), value: boolLabel(beat.pop) },
        { label: t("sidebar.selector.beatSlashed"), value: boolLabel(beat.slashed) },
        { label: t("sidebar.selector.beatHasFermata"), value: boolLabel(beat.hasFermata) },
        { label: t("sidebar.selector.beatFermataType"), value: fermataTypeLabel(beat.fermataType) },
        { label: t("sidebar.selector.beatNoteCount"), value: String(beat.notes.length) },
      ]
    : [];

  const noteItems: { label: string; value: string }[] = note
    ? [
        { label: t("sidebar.selector.noteIndex"), value: `${noteIndex} / ${beat?.notes.length ?? 0}` },
        { label: t("sidebar.selector.noteFret"), value: String(note.fret) },
        { label: t("sidebar.selector.noteString"), value: String(note.string) },
        { label: t("sidebar.selector.noteIsDead"), value: boolLabel(note.isDead) },
        { label: t("sidebar.selector.noteIsGhost"), value: boolLabel(note.isGhost) },
        { label: t("sidebar.selector.noteIsStaccato"), value: boolLabel(note.isStaccato) },
        { label: t("sidebar.selector.noteIsLetRing"), value: boolLabel(note.isLetRing) },
        { label: t("sidebar.selector.noteIsPalmMute"), value: boolLabel(note.isPalmMute) },
        { label: t("sidebar.selector.noteIsTieDestination"), value: boolLabel(note.isTieDestination) },
        { label: t("sidebar.selector.noteIsHammerPullOrigin"), value: boolLabel(note.isHammerPullOrigin) },
        { label: t("sidebar.selector.noteIsLeftHandTapped"), value: boolLabel(note.isLeftHandTapped) },
        { label: t("sidebar.selector.noteAccentuated"), value: accentuationLabel(note.accentuated) },
        { label: t("sidebar.selector.noteVibrato"), value: vibratoLabel(note.vibrato) },
        { label: t("sidebar.selector.noteSlideInType"), value: slideInLabel(note.slideInType) },
        { label: t("sidebar.selector.noteSlideOutType"), value: slideOutTypeLabel(note.slideOutType, t) },
        { label: t("sidebar.selector.noteHarmonicType"), value: harmonicTypeLabel(note.harmonicType, t) },
        { label: t("sidebar.selector.noteHarmonicValue"), value: String(note.harmonicValue) },
        { label: t("sidebar.selector.noteBendType"), value: bendTypeLabel(note.bendType, t) },
        { label: t("sidebar.selector.noteBendStyle"), value: bendStyleLabel(note.bendStyle) },
        { label: t("sidebar.selector.noteBendPoints"), value: note.bendPoints.length > 0 ? `${note.bendPoints.length} pts` : "—" },
        { label: t("sidebar.selector.noteLeftHandFinger"), value: fingerLabel(note.leftHandFinger) },
        { label: t("sidebar.selector.noteRightHandFinger"), value: fingerLabel(note.rightHandFinger) },
        { label: t("sidebar.selector.noteDynamics"), value: dynamicLabel(note.dynamics) },
        { label: t("sidebar.selector.noteOrnament"), value: ornamentLabel(note.ornament) },
        { label: t("sidebar.selector.noteAccidentalMode"), value: accidentalModeLabel(note.accidentalMode) },
        { label: t("sidebar.selector.noteTrillValue"), value: note.trillValue > 0 ? String(note.trillValue) : "—" },
        { label: t("sidebar.selector.noteTrillSpeed"), value: note.trillValue > 0 ? durationLabel(note.trillSpeed) : "—" },
        { label: t("sidebar.selector.noteDurationPercent"), value: `${note.durationPercent}%` },
        { label: t("sidebar.selector.noteIsPercussion"), value: boolLabel(note.isPercussion) },
        ...(note.isPercussion
          ? [
              { label: t("sidebar.selector.notePercussionArticulation"), value: String(note.percussionArticulation) },
              { label: t("sidebar.selector.notePercussionArticulationName"), value: percussionDisplayName(note.percussionArticulationName, t) },
            ]
          : []),
      ]
    : [];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SectionHeader
        title={t("sidebar.selector.title")}
        helpText={t("sidebar.selector.help")}
        isOpen={isOpen}
        dragHandleProps={dragHandleProps}
      />
      <CollapsibleContent>
        {/* Debug visualisation toggles */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 border-b border-border/40">
          <button
            type="button"
            className={cn(
              "flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
              showSnapGrid
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-accent/50",
            )}
            onClick={() => setShowSnapGrid(!showSnapGrid)}
          >
            <Grid3X3 className="h-3 w-3" />
            {t("sidebar.selector.showSnapGrid")}
          </button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px]"
            disabled={!selectedBeat}
            onClick={() => usePlayerStore.getState().appendRestBefore()}
          >
            {t("sidebar.selector.appendRestBefore")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px]"
            disabled={!selectedBeat}
            onClick={() => usePlayerStore.getState().appendRestAfter()}
          >
            {t("sidebar.selector.appendRestAfter")}
          </Button>
        </div>

        {selectedBeat ? (
          <div className="py-0.5">
            <DebugLevel
              title={t("sidebar.selector.score")}
              icon={<FileText className="h-3 w-3" />}
              items={scoreItems}
            />
            <DebugLevel
              title={`${t("sidebar.selector.track")} [${selectedBeat.trackIndex}]`}
              icon={<Guitar className="h-3 w-3" />}
              items={trackItems}
              defaultOpen
            />
            <DebugLevel
              title={`${t("sidebar.selector.staff")} [${selectedBeat.staffIndex}]`}
              icon={<Layers className="h-3 w-3" />}
              items={staffItems}
              defaultOpen
            />
            <DebugLevel
              title={`${t("sidebar.selector.bar")} [${selectedBeat.barIndex}]`}
              icon={<LayoutList className="h-3 w-3" />}
              items={barItems}
              defaultOpen
            />
            <DebugLevel
              title={`${t("sidebar.selector.voice")} [${selectedBeat.voiceIndex}]`}
              icon={<AudioWaveform className="h-3 w-3" />}
              items={voiceItems}
              defaultOpen
            />
            <DebugLevel
              title={`${t("sidebar.selector.beat")} [${selectedBeat.beatIndex}]`}
              icon={<Music className="h-3 w-3" />}
              items={beatItems}
              defaultOpen
            />
            {note ? (
              <DebugLevel
                title={`${t("sidebar.selector.note")} [${noteIndex}]`}
                icon={<Disc className="h-3 w-3" />}
                items={noteItems}
                defaultOpen
              />
            ) : (
              <div className="ml-[13px] border-l border-border/50 px-2 py-1">
                <span className="text-[10px] text-muted-foreground/60 italic">
                  {t("sidebar.selector.noNote")}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="px-3 py-3">
            <span className="text-[10px] text-muted-foreground italic">
              {t("sidebar.selector.noSelection")}
            </span>
          </div>
        )}
        <Separator />
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Bar Section ─────────────────────────────────────────────────────────────

function BarSection({ bar, dragHandleProps }: { bar: SelectedBarInfo; dragHandleProps?: Record<string, unknown> }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SectionHeader title={t("sidebar.bar.title")} helpText={t("sidebar.bar.help")} isOpen={isOpen} dragHandleProps={dragHandleProps} />
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
      <SectionHeader title={t("sidebar.note.title")} helpText={t("sidebar.note.help")} isOpen={isOpen} dragHandleProps={dragHandleProps} />
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
              {/* Percussion: show articulation name */}
              {note.isPercussion && (
                <PropRow
                  label={t("sidebar.note.articulation")}
                  value={percussionDisplayName(note.percussionArticulationName, t)}
                  icon={<Disc className="h-3.5 w-3.5" />}
                />
              )}

              <div className="px-2">
                <div className="mb-0.5 text-[10px] font-medium text-muted-foreground px-1">
                  {t("sidebar.note.noteProperties")}
                </div>
                <div className="flex flex-wrap gap-0.5">
                  {/* Guitar-only toggles hidden for percussion */}
                  {!note.isPercussion && (
                    <>
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
                    </>
                  )}
                  {/* Shared toggles: accent, staccato */}
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
                  {/* Guitar-only toggles hidden for percussion */}
                  {!note.isPercussion && (
                    <>
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
                    </>
                  )}
                </div>
              </div>

              {/* Fingering row — guitar only */}
              {!note.isPercussion &&
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
      <SectionHeader title={t("sidebar.effects.title")} helpText={t("sidebar.effects.help")} isOpen={isOpen} dragHandleProps={dragHandleProps} />
      <CollapsibleContent>
        <div className="space-y-1 py-1">
          {/* ── Note-level Effects (guitar only, hidden for percussion) ── */}
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

// ─── Tab Droppable Container ─────────────────────────────────────────────────

/**
 * A droppable container for a tab's content. When a section is dragged over
 * this area, it becomes a valid drop target even if the tab is empty.
 */
function TabDroppable({
  tabId,
  children,
}: {
  tabId: string;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: tabId });
  return (
    <div
      ref={setNodeRef}
      className={cn("min-h-[32px]", isOver && "bg-accent/20")}
    >
      {children}
    </div>
  );
}

// ─── Main Sidebar ────────────────────────────────────────────────────────────

const DEFAULT_SIDEBAR_WIDTH = 280;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 480;
const SIDEBAR_WIDTH_KEY = "cotab:sidebar-width";
const STORAGE_KEY = "cotab:sidebar-tab-layout";

function loadSidebarWidth(): number {
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (raw) {
      const v = Number(raw);
      if (v >= MIN_SIDEBAR_WIDTH && v <= MAX_SIDEBAR_WIDTH) return v;
    }
  } catch {
    // ignore
  }
  return DEFAULT_SIDEBAR_WIDTH;
}

function saveSidebarWidth(w: number) {
  localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
}
const TAB_COUNT = 3;

type SectionId = "song" | "tracks" | "selector" | "bar" | "note" | "effects";
const ALL_SECTION_IDS: SectionId[] = ["song", "tracks", "selector", "bar", "note", "effects"];

/** Default tab layout: tab0 = editing sections, tab1 = song+tracks, tab2 = selection */
type TabLayout = SectionId[][];
const DEFAULT_LAYOUT: TabLayout = [
  ["bar", "note", "effects"],
  ["song", "tracks"],
  ["selector"],
];

function loadTabLayout(): TabLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as string[][];
    if (!Array.isArray(parsed) || parsed.length !== TAB_COUNT) return DEFAULT_LAYOUT;
    // Collect all IDs and validate
    const allIds = parsed.flat();
    if (
      allIds.length === ALL_SECTION_IDS.length &&
      ALL_SECTION_IDS.every((id) => allIds.includes(id))
    ) {
      return parsed as TabLayout;
    }
  } catch {
    // ignore
  }
  return DEFAULT_LAYOUT;
}

function saveTabLayout(layout: TabLayout) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

/** Find which tab contains a given section ID. */
function findTabIndex(layout: TabLayout, sectionId: string): number {
  for (let i = 0; i < layout.length; i++) {
    if (layout[i].includes(sectionId as SectionId)) return i;
  }
  return -1;
}

export function NoteEditorSidebar() {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const widthAtDragStart = useRef(sidebarWidth);
  const [activeTab, setActiveTab] = useState(0);
  const [tabLayout, setTabLayout] = useState<TabLayout>(loadTabLayout);
  const selectedBeatInfo = usePlayerStore((s) => s.selectedBeatInfo);
  const selectedBarInfo = usePlayerStore((s) => s.selectedBarInfo);
  const selectedNoteIndex = usePlayerStore((s) => s.selectedNoteIndex);

  // Use the store's note index (set by noteMouseDown) to pick the active note.
  const activeNote: SelectedNoteInfo | null =
    selectedBeatInfo &&
    selectedNoteIndex >= 0 &&
    selectedNoteIndex < selectedBeatInfo.notes.length
      ? selectedBeatInfo.notes[selectedNoteIndex]
      : null;

  const hasBeat = !!(selectedBeatInfo && selectedBarInfo);

  // ── Sidebar resize ──
  const handleSidebarResize = useCallback((deltaX: number) => {
    const newWidth = Math.min(
      MAX_SIDEBAR_WIDTH,
      Math.max(MIN_SIDEBAR_WIDTH, widthAtDragStart.current + deltaX),
    );
    setSidebarWidth(newWidth);
  }, []);

  const handleSidebarResizeEnd = useCallback(() => {
    saveSidebarWidth(sidebarWidth);
    widthAtDragStart.current = sidebarWidth;
  }, [sidebarWidth]);

  const handleSidebarResizeStart = useCallback(() => {
    widthAtDragStart.current = sidebarWidth;
  }, [sidebarWidth]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  /** Handle dragging over a different container (tab). */
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // Determine source and destination tabs
      const fromTab = findTabIndex(tabLayout, activeId);
      // overId could be a section ID or a tab droppable ID like "tab-0"
      let toTab: number;
      if (overId.startsWith("tab-")) {
        toTab = parseInt(overId.split("-")[1], 10);
      } else {
        toTab = findTabIndex(tabLayout, overId);
      }

      if (fromTab === -1 || toTab === -1 || fromTab === toTab) return;

      // Move section from one tab to another
      setTabLayout((prev) => {
        const next = prev.map((tab) => [...tab]);
        const idx = next[fromTab].indexOf(activeId as SectionId);
        if (idx === -1) return prev;
        next[fromTab].splice(idx, 1);

        // Insert at the position of the over item, or at the end if dropping on the tab itself
        if (overId.startsWith("tab-")) {
          next[toTab].push(activeId as SectionId);
        } else {
          const overIdx = next[toTab].indexOf(overId as SectionId);
          if (overIdx === -1) {
            next[toTab].push(activeId as SectionId);
          } else {
            next[toTab].splice(overIdx, 0, activeId as SectionId);
          }
        }

        saveTabLayout(next);
        return next;
      });
    },
    [tabLayout],
  );

  /** Handle reordering within the same tab on drag end. */
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // Only handle same-tab reorder (cross-tab is handled in onDragOver)
      if (overId.startsWith("tab-")) return;

      const activeTabIdx = findTabIndex(tabLayout, activeId);
      const overTabIdx = findTabIndex(tabLayout, overId);

      if (activeTabIdx === -1 || activeTabIdx !== overTabIdx) return;
      if (activeId === overId) return;

      setTabLayout((prev) => {
        const next = prev.map((tab) => [...tab]);
        const oldIndex = next[activeTabIdx].indexOf(activeId as SectionId);
        const newIndex = next[activeTabIdx].indexOf(overId as SectionId);
        next[activeTabIdx] = arrayMove(next[activeTabIdx], oldIndex, newIndex);
        saveTabLayout(next);
        return next;
      });
    },
    [tabLayout],
  );

  const renderSection = useCallback(
    (id: SectionId, dragHandleProps: Record<string, unknown>) => {
      switch (id) {
        case "song":
          return <SongSection dragHandleProps={dragHandleProps} />;
        case "tracks":
          return <TracksSection dragHandleProps={dragHandleProps} />;
        case "selector":
          return (
            <SelectorSection
              beat={selectedBeatInfo}
              note={activeNote}
              noteIndex={selectedNoteIndex}
              dragHandleProps={dragHandleProps}
            />
          );
        case "bar":
          return hasBeat ? (
            <BarSection bar={selectedBarInfo!} dragHandleProps={dragHandleProps} />
          ) : null;
        case "note":
          return hasBeat ? (
            <NoteSection beat={selectedBeatInfo!} note={activeNote} dragHandleProps={dragHandleProps} />
          ) : null;
        case "effects":
          return hasBeat ? (
            <EffectsSection beat={selectedBeatInfo!} note={activeNote} dragHandleProps={dragHandleProps} />
          ) : null;
        default:
          return null;
      }
    },
    [selectedBeatInfo, selectedBarInfo, selectedNoteIndex, activeNote, hasBeat],
  );

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

  const currentTabSections = tabLayout[activeTab] ?? [];

  return (
    <div className="flex min-h-0 flex-shrink-0" style={{ width: sidebarWidth }}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-card">
        {/* Tab bar with collapse button */}
        <div className="flex shrink-0 items-center border-b">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => setCollapsed(true)}
                aria-label={t("sidebar.collapseSidebar")}
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{t("sidebar.collapseSidebar")}</TooltipContent>
          </Tooltip>
          {Array.from({ length: TAB_COUNT }, (_, i) => (
            <button
              key={i}
              type="button"
              className={cn(
                "flex-1 py-2 text-center text-[10px] font-medium uppercase tracking-wider transition-colors",
                activeTab === i
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setActiveTab(i)}
            >
              {t(`sidebar.tabNames.${i}`)}
            </button>
          ))}
        </div>

        {/* Content — pr-3 reserves space so the overlay scrollbar doesn't clip values */}
        <ScrollArea className="flex-1 overflow-hidden">
          <div className="pb-4 pr-3">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={currentTabSections}
                strategy={verticalListSortingStrategy}
              >
                <TabDroppable tabId={`tab-${activeTab}`}>
                  {currentTabSections.length > 0 ? (
                    currentTabSections.map((id) => (
                      <SortableSection key={id} id={id}>
                        {(dragHandleProps) => renderSection(id, dragHandleProps)}
                      </SortableSection>
                    ))
                  ) : (
                    <div className="flex items-center justify-center p-6">
                      <p className="text-center text-[10px] text-muted-foreground">
                        {t("sidebar.dropHereHint")}
                      </p>
                    </div>
                  )}
                </TabDroppable>
              </SortableContext>
            </DndContext>

            {/* Empty state when no beat is selected (only on tabs with beat-dependent sections) */}
            {!hasBeat &&
              currentTabSections.some((id) => id === "bar" || id === "note" || id === "effects") && (
                <div className="flex items-center justify-center p-4">
                  <p className="text-center text-xs text-muted-foreground">
                    {t("sidebar.emptyState")}
                  </p>
                </div>
              )}
          </div>
        </ScrollArea>
      </div>

      {/* Drag handle to resize sidebar */}
      <ResizeHandle
        side="right"
        onResizeStart={handleSidebarResizeStart}
        onResize={handleSidebarResize}
        onResizeEnd={handleSidebarResizeEnd}
      />
    </div>
  );
}
