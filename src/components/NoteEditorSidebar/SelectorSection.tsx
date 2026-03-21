import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  LayoutList,
  Grid3X3,
  FileText,
  Guitar,
  Music,
  AudioWaveform,
  Disc,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { executeAction } from "@/actions";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/render-store";
import {
  computeNextBeat,
  computePrevBeat,
  computeMoveUp,
  computeMoveDown,
  computeNextBar,
  computePrevBar,
  computeNextStaff,
  computePrevStaff,
} from "@/components/navigation/navigation-helpers";
import type { SelectedBeatInfo, SelectedNoteInfo } from "@/stores/render-types";
import { SectionHeader } from "./primitives";
import {
  durationLabel,
  dynamicLabel,
  keySignatureLabel,
  keySignatureTypeLabel,
  tripletFeelLabel,
  graceTypeLabel,
  pickStrokeLabel,
  brushTypeLabel,
  crescendoLabel,
  vibratoLabel,
  fadeLabel,
  ottavaLabel,
  golpeLabel,
  wahPedalLabel,
  whammyTypeLabel,
  fermataTypeLabel,
  accentuationLabel,
  slideInLabel,
  slideOutTypeLabel,
  harmonicTypeLabel,
  bendTypeLabel,
  bendStyleLabel,
  fingerLabel,
  ornamentLabel,
  accidentalModeLabel,
  boolLabel,
} from "./labels";

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

export function SelectorSection({
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
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const deleteBlockedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deleteBarBlocked, setDeleteBarBlocked] = useState(false);
  const deleteBarBlockedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deleteTrackPending, setDeleteTrackPending] = useState(false);
  const deleteTrackPendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSnapGrid = usePlayerStore((s) => s.showSnapGrid);

  const selectedBeat = usePlayerStore((s) => s.selectedBeat);
  const trackInfo = usePlayerStore((s) => s.selectedTrackInfo);
  const staffInfo = usePlayerStore((s) => s.selectedStaffInfo);
  const barInfo = usePlayerStore((s) => s.selectedBarInfo);
  const voiceInfo = usePlayerStore((s) => s.selectedVoiceInfo);
  const tracks = usePlayerStore((s) => s.tracks);

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
              { label: t("sidebar.selector.notePercussionArticulationName"), value: note.percussionArticulationName },
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
        <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 border-b border-border/40">
          <button
            type="button"
            className={cn(
              "flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
              showSnapGrid
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-accent/50",
            )}
            onClick={() => usePlayerStore.getState().setShowSnapGrid(!showSnapGrid)}
          >
            <Grid3X3 className="h-3 w-3" />
            {t("sidebar.selector.showSnapGrid")}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 border-b border-border/40">
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-1.5 text-[10px]"
            disabled={!selectedBeat}
            onClick={() => {
              const target = selectedBeat && computePrevBar(selectedBeat);
              if (target) executeAction("nav.setSelection", target, { t });
            }}
          >
            <ChevronsLeft className="h-3 w-3 mr-0.5" />
            {t("sidebar.selector.navPrevBar")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-1.5 text-[10px]"
            disabled={!selectedBeat}
            onClick={() => {
              const target = selectedBeat && computePrevBeat(selectedBeat);
              if (target) executeAction("nav.setSelection", target, { t });
            }}
          >
            <ChevronLeft className="h-3 w-3 mr-0.5" />
            {t("sidebar.selector.navPrevBeat")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-1.5 text-[10px]"
            disabled={!selectedBeat}
            onClick={() => {
              const target = selectedBeat && computeMoveUp(selectedBeat);
              if (target) executeAction("nav.setSelection", target, { t });
            }}
          >
            <ArrowUp className="h-3 w-3 mr-0.5" />
            {t("sidebar.selector.navMoveUp")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-1.5 text-[10px]"
            disabled={!selectedBeat}
            onClick={() => {
              const target = selectedBeat && computeMoveDown(selectedBeat);
              if (target) executeAction("nav.setSelection", target, { t });
            }}
          >
            <ArrowDown className="h-3 w-3 mr-0.5" />
            {t("sidebar.selector.navMoveDown")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-1.5 text-[10px]"
            disabled={!selectedBeat}
            onClick={() => {
              const target = selectedBeat && computeNextBeat(selectedBeat);
              if (target) executeAction("nav.setSelection", target, { t });
            }}
          >
            {t("sidebar.selector.navNextBeat")}
            <ChevronRight className="h-3 w-3 ml-0.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-1.5 text-[10px]"
            disabled={!selectedBeat}
            onClick={() => {
              const target = selectedBeat && computeNextBar(selectedBeat);
              if (target) executeAction("nav.setSelection", target, { t });
            }}
          >
            {t("sidebar.selector.navNextBar")}
            <ChevronsRight className="h-3 w-3 ml-0.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-1.5 text-[10px]"
            disabled={!selectedBeat}
            onClick={() => {
              const target = selectedBeat && computePrevStaff(selectedBeat);
              if (target) executeAction("nav.setSelection", target, { t });
            }}
          >
            <ChevronUp className="h-3 w-3 mr-0.5" />
            {t("sidebar.selector.navPrevStaff")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-1.5 text-[10px]"
            disabled={!selectedBeat}
            onClick={() => {
              const target = selectedBeat && computeNextStaff(selectedBeat);
              if (target) executeAction("nav.setSelection", target, { t });
            }}
          >
            {t("sidebar.selector.navNextStaff")}
            <ChevronDown className="h-3 w-3 ml-0.5" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 border-b border-border/40">
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px]"
            disabled={!selectedBeat}
            onClick={() => executeAction("edit.beat.insertRestBefore", undefined, { t })}
          >
            {t("sidebar.selector.appendRestBefore")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px]"
            disabled={!selectedBeat}
            onClick={() => executeAction("edit.beat.insertRestAfter", undefined, { t })}
          >
            {t("sidebar.selector.appendRestAfter")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-6 px-2 text-[10px] transition-colors",
              deleteBlocked && "border-destructive text-destructive",
            )}
            disabled={!selectedBeat || (!note && !beat?.isRest && !beat?.isEmpty)}
            title={deleteBlocked ? t("sidebar.selector.deleteNoteLastRest") : undefined}
            onClick={() => {
              const ok = executeAction("edit.beat.deleteNote", undefined, { t });
              if (!ok) {
                setDeleteBlocked(true);
                if (deleteBlockedTimer.current) clearTimeout(deleteBlockedTimer.current);
                deleteBlockedTimer.current = setTimeout(() => setDeleteBlocked(false), 1200);
              }
            }}
          >
            {deleteBlocked
              ? t("sidebar.selector.deleteNoteLastRest")
              : t("sidebar.selector.deleteNote")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-6 px-2 text-[10px]",
              beat?.isEmpty && "bg-primary/15 text-primary",
            )}
            disabled={!selectedBeat}
            onClick={() => executeAction("edit.beat.toggleEmpty", undefined, { t })}
          >
            {t("sidebar.selector.toggleBeatIsEmpty")}
            {beat != null ? `: ${beat.isEmpty}` : ""}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px]"
            disabled={!selectedBeat || selectedBeat?.string === null || selectedBeat?.string === undefined}
            onClick={() => executeAction("edit.beat.placeNote", undefined, { t })}
          >
            {t("sidebar.selector.placeNote")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px]"
            disabled={!selectedBeat}
            onClick={() => executeAction("edit.bar.insertBefore", undefined, { t })}
          >
            {t("sidebar.selector.insertBarBefore")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px]"
            disabled={!selectedBeat}
            onClick={() => executeAction("edit.bar.insertAfter", undefined, { t })}
          >
            {t("sidebar.selector.insertBarAfter")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-6 px-2 text-[10px] transition-colors",
              deleteBarBlocked && "border-destructive text-destructive",
            )}
            disabled={!selectedBeat}
            title={deleteBarBlocked ? t("sidebar.selector.deleteBarNotEmpty") : undefined}
            onClick={() => {
              const ok = executeAction("edit.bar.delete", undefined, { t });
              if (!ok) {
                setDeleteBarBlocked(true);
                if (deleteBarBlockedTimer.current) clearTimeout(deleteBarBlockedTimer.current);
                deleteBarBlockedTimer.current = setTimeout(() => setDeleteBarBlocked(false), 1200);
              }
            }}
          >
            {deleteBarBlocked
              ? t("sidebar.selector.deleteBarNotEmpty")
              : t("sidebar.selector.deleteBar")}
          </Button>
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center rounded-md border bg-background shadow-xs",
              "h-6 px-2 text-[10px] font-medium transition-all",
              "hover:bg-accent hover:text-accent-foreground",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
            disabled={tracks.length === 0}
            onClick={() => usePlayerStore.setState({ addTrackDialogOpen: true })}
          >
            <Plus className="mr-1 h-3 w-3" />
            {t("sidebar.selector.addTrack")}
          </button>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-6 px-2 text-[10px] transition-colors",
              deleteTrackPending && "border-destructive text-destructive",
            )}
            disabled={!selectedBeat || tracks.length <= 1}
            title={
              tracks.length <= 1
                ? t("sidebar.selector.deleteTrackLastTrack")
                : deleteTrackPending
                  ? t("sidebar.selector.deleteTrackConfirm")
                  : undefined
            }
            onClick={() => {
              if (!selectedBeat) return;
              const trackIndex = selectedBeat.trackIndex;
              if (deleteTrackPending) {
                if (deleteTrackPendingTimer.current) {
                  clearTimeout(deleteTrackPendingTimer.current);
                  deleteTrackPendingTimer.current = null;
                }
                setDeleteTrackPending(false);
                executeAction("edit.track.delete", trackIndex, { t });
              } else {
                setDeleteTrackPending(true);
                if (deleteTrackPendingTimer.current) clearTimeout(deleteTrackPendingTimer.current);
                deleteTrackPendingTimer.current = setTimeout(() => {
                  setDeleteTrackPending(false);
                  deleteTrackPendingTimer.current = null;
                }, 3000);
              }
            }}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            {deleteTrackPending && selectedBeat
              ? t("sidebar.selector.deleteTrackConfirm")
              : t("sidebar.selector.deleteTrack")}
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
