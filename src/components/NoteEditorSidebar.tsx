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

import { useState, useCallback } from "react";
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
  // Selector section
  Crosshair,
  Hash,
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

// ─── Selector Info Section ───────────────────────────────────────────────────

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
  const selectedBeat = usePlayerStore((s) => s.selectedBeat);
  const tracks = usePlayerStore((s) => s.tracks);

  const trackName =
    selectedBeat && tracks[selectedBeat.trackIndex]
      ? tracks[selectedBeat.trackIndex].name
      : null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SectionHeader
        title={t("sidebar.selector.title")}
        helpText={t("sidebar.selector.help")}
        isOpen={isOpen}
        dragHandleProps={dragHandleProps}
      />
      <CollapsibleContent>
        <div className="space-y-0.5 py-1">
          {selectedBeat ? (
            <>
              <PropRow
                label={t("sidebar.selector.track")}
                value={
                  trackName
                    ? `${selectedBeat.trackIndex}: ${trackName}`
                    : String(selectedBeat.trackIndex)
                }
                icon={<Crosshair className="h-3.5 w-3.5" />}
              />
              <PropRow
                label={t("sidebar.selector.bar")}
                value={String(selectedBeat.barIndex)}
                icon={<Hash className="h-3.5 w-3.5" />}
              />
              <PropRow
                label={t("sidebar.selector.beat")}
                value={String(selectedBeat.beatIndex)}
                icon={<Hash className="h-3.5 w-3.5" />}
              />
              {beat && (
                <>
                  <PropRow
                    label={t("sidebar.selector.noteCount")}
                    value={String(beat.notes.length)}
                    icon={<Hash className="h-3.5 w-3.5" />}
                  />
                  <PropRow
                    label={t("sidebar.selector.duration")}
                    value={durationLabel(beat.duration)}
                    icon={<Music className="h-3.5 w-3.5" />}
                  />
                  <PropRow
                    label={t("sidebar.selector.dynamics")}
                    value={dynamicLabel(beat.dynamics)}
                    icon={<AudioWaveform className="h-3.5 w-3.5" />}
                  />
                </>
              )}
              {note ? (
                <>
                  <PropRow
                    label={t("sidebar.selector.noteIndex")}
                    value={`${noteIndex} / ${beat?.notes.length ?? 0}`}
                    icon={<Crosshair className="h-3.5 w-3.5" />}
                  />
                  {note.isPercussion ? (
                    <PropRow
                      label={t("sidebar.selector.articulation")}
                      value={percussionDisplayName(note.percussionArticulationName, t)}
                      icon={<Disc className="h-3.5 w-3.5" />}
                    />
                  ) : (
                    <>
                      <PropRow
                        label={t("sidebar.selector.fret")}
                        value={String(note.fret)}
                        icon={<Guitar className="h-3.5 w-3.5" />}
                      />
                      <PropRow
                        label={t("sidebar.selector.string")}
                        value={String(note.string)}
                        icon={<Guitar className="h-3.5 w-3.5" />}
                      />
                    </>
                  )}
                </>
              ) : (
                <div className="px-3 py-0.5">
                  <span className="text-[10px] text-muted-foreground italic">
                    {t("sidebar.note.noNoteSelected")}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="px-3 py-0.5">
              <span className="text-[10px] text-muted-foreground italic">
                {t("sidebar.selector.noSelection")}
              </span>
            </div>
          )}
        </div>
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

const SIDEBAR_WIDTH = 240;
const STORAGE_KEY = "cotab:sidebar-tab-layout";
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
    <div
      className="flex min-h-0 flex-col border-r bg-card"
      style={{ width: SIDEBAR_WIDTH }}
    >
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

      {/* Content */}
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="pb-4">
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
  );
}
