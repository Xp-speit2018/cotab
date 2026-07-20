import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type * as alphaTab from "@coderline/alphatab";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  Guitar,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { executeAppAction } from "@/app-actions";
import { cn } from "@/lib/utils";
import { getApi } from "@/stores/render-api";
import { usePlayerStore } from "@/stores/render-store";
import type {
  ChordDefinitionInfo,
  TuningPresetInfo,
} from "@/stores/render-types";
import {
  DialogPropRow,
  EditableNumberPropRow,
  EditablePropRow,
  SectionHeader,
} from "./primitives";
import { ChordLibraryEditor } from "./editors/ChordEditors";

interface StaffEditorData {
  staffIndex: number;
  tuningValues: number[];
  tuningName: string;
  capo: number;
  transposition: number;
  showTablature: boolean;
  isPercussion: boolean;
  stringCount: number;
  chords: ChordDefinitionInfo[];
}

function readStaffEditorData(
  staffIndex: number,
  staff: alphaTab.model.Staff,
): StaffEditorData {
  return {
    staffIndex,
    tuningValues: [...staff.tuning],
    tuningName: staff.tuningName,
    capo: staff.capo,
    transposition: staff.transpositionPitch,
    showTablature: staff.showTablature,
    isPercussion: staff.isPercussion,
    stringCount: staff.tuning.length,
    chords: staff.chords
      ? [...staff.chords.entries()].map(([id, chord]) => ({
          id,
          name: chord.name,
          firstFret: chord.firstFret,
          strings: [...chord.strings],
          barreFrets: [...chord.barreFrets],
          showName: chord.showName,
          showDiagram: chord.showDiagram,
          showFingering: chord.showFingering,
        }))
      : [],
  };
}

function StaffMetaEditor({
  trackIndex,
  staff,
  showHeader,
  selected,
}: {
  trackIndex: number;
  staff: StaffEditorData;
  showHeader: boolean;
  selected: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(selected);
  const [tuningOpen, setTuningOpen] = useState(false);
  const getTuningPresets = usePlayerStore((state) => state.getTuningPresets);

  useEffect(() => {
    if (selected) setExpanded(true);
  }, [selected]);

  const tuningPresets: TuningPresetInfo[] =
    staff.showTablature && staff.stringCount > 0
      ? getTuningPresets(staff.stringCount)
      : [];
  const summary = staff.isPercussion
    ? t("sidebar.tracks.percussion")
    : staff.stringCount > 0
      ? t("sidebar.tracks.stringCount", { count: staff.stringCount })
      : "";

  const fields = (
    <div className="space-y-0.5 pb-1">
      {staff.showTablature && staff.stringCount > 0 && !staff.isPercussion && (
        <>
          <div className="group flex items-center gap-2 px-3 py-0.5">
            <span className="whitespace-nowrap text-[11px] text-muted-foreground">
              {t("sidebar.tracks.tuning")}
            </span>
            <Popover open={tuningOpen} onOpenChange={setTuningOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="ml-auto flex cursor-pointer items-center gap-1 text-[11px] font-medium tabular-nums transition-colors hover:text-primary"
                >
                  <span className="max-w-[120px] truncate">
                    {staff.tuningName || t("sidebar.tracks.customTuning")}
                  </span>
                  <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="max-h-60 w-56 overflow-y-auto p-1"
                side="left"
                align="start"
              >
                {tuningPresets.map((preset, index) => (
                  <button
                    key={index}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-2 py-1 text-[11px] hover:bg-accent/50",
                      preset.tunings.join(",") === staff.tuningValues.join(",") && "bg-accent",
                    )}
                    onClick={() => {
                      executeAppAction("document.staff.setStringTuning", {
                        trackIndex,
                        staffIndex: staff.staffIndex,
                        stringTuning: preset,
                      }, { t });
                      setTuningOpen(false);
                    }}
                  >
                    <span className="truncate font-medium">{preset.name}</span>
                    {preset.isStandard && (
                      <span className="ml-auto text-[9px] text-muted-foreground">
                        {t("sidebar.tracks.standard")}
                      </span>
                    )}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
          <div className="px-3 py-1">
            <div className="flex flex-col gap-0.5">
              {staff.tuningValues.map((value, index) => {
                const noteName = usePlayerStore.getState().formatTuningNote(value);
                return (
                  <div key={index} className="flex items-center gap-1">
                    <span className="w-3 text-right text-[9px] tabular-nums text-muted-foreground/60">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      onClick={() => {
                        const next = [...staff.tuningValues];
                        next[index] = Math.max(0, next[index] - 1);
                        executeAppAction("document.staff.setStringTuning", {
                          trackIndex,
                          staffIndex: staff.staffIndex,
                          stringTuning: {
                            tunings: next,
                            name: "",
                            isStandard: false,
                          },
                        }, { t });
                      }}
                    >
                      <ChevronDown className="h-2.5 w-2.5" />
                    </button>
                    <span className="w-7 rounded bg-muted/50 px-0.5 text-center font-mono text-[10px] tabular-nums">
                      {noteName}
                    </span>
                    <button
                      type="button"
                      className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      onClick={() => {
                        const next = [...staff.tuningValues];
                        next[index] = Math.min(127, next[index] + 1);
                        executeAppAction("document.staff.setStringTuning", {
                          trackIndex,
                          staffIndex: staff.staffIndex,
                          stringTuning: {
                            tunings: next,
                            name: "",
                            isStandard: false,
                          },
                        }, { t });
                      }}
                    >
                      <ChevronUp className="h-2.5 w-2.5" />
                    </button>
                    <span className="text-[9px] tabular-nums text-muted-foreground/40">
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <EditableNumberPropRow
            label={t("sidebar.tracks.capo")}
            value={staff.capo}
            min={0}
            max={24}
            onCommit={(capo) => executeAppAction("document.staff.setCapo", {
              trackIndex,
              staffIndex: staff.staffIndex,
              capo,
            }, { t })}
          />
        </>
      )}

      {!staff.isPercussion && (
        <DialogPropRow
          label={t("sidebar.tracks.chordLibrary")}
          value={t("sidebar.tracks.chordCount", { count: staff.chords.length })}
          title={t("sidebar.tracks.chordLibrary")}
          description={t("sidebar.tracks.chordLibraryHelp")}
          contentClassName="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-4xl"
        >
          <ChordLibraryEditor
            definitions={staff.chords}
            stringCount={Math.max(1, staff.stringCount)}
            labels={{
              newChord: t("sidebar.tracks.newChord"),
              name: t("sidebar.tracks.chordName"),
              firstFret: t("sidebar.tracks.firstFret"),
              strings: t("sidebar.tracks.chordStrings"),
              barreFrets: t("sidebar.tracks.barreFrets"),
              showName: t("sidebar.tracks.showChordName"),
              showDiagram: t("sidebar.tracks.showChordDiagram"),
              showFingering: t("sidebar.tracks.showChordFingering"),
              save: t("sidebar.common.save"),
              delete: t("sidebar.common.delete"),
              confirmDelete: t("sidebar.common.confirmDelete"),
            }}
            onSave={(id, chord) => executeAppAction(
              "document.staff.setChord",
              {
                trackIndex,
                staffIndex: staff.staffIndex,
                id,
                chord,
              },
              { t },
            )}
            onDelete={(id) => executeAppAction(
              "document.staff.setChord",
              {
                trackIndex,
                staffIndex: staff.staffIndex,
                id,
                chord: null,
              },
              { t },
            )}
          />
        </DialogPropRow>
      )}

      {!staff.isPercussion && (
        <EditableNumberPropRow
          label={t("sidebar.tracks.transposition")}
          value={staff.transposition}
          suffix={t("sidebar.tracks.semitones")}
          min={-24}
          max={24}
          onCommit={(transpositionPitch) => executeAppAction(
            "document.staff.setTranspositionPitch",
            {
              trackIndex,
              staffIndex: staff.staffIndex,
              transpositionPitch,
            },
            { t },
          )}
        />
      )}
    </div>
  );

  if (!showHeader) return fields;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-1 border-t border-border/40 px-3 py-1 text-[10px] font-medium hover:bg-accent/40",
            selected ? "text-primary" : "text-muted-foreground",
          )}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          <span>{t("sidebar.staff.label", { index: staff.staffIndex + 1 })}</span>
          <span className="ml-auto text-[9px] font-normal text-muted-foreground">
            {summary}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>{fields}</CollapsibleContent>
    </Collapsible>
  );
}

function TrackMetaRow({ trackIndex }: { trackIndex: number }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const track = usePlayerStore((state) => state.tracks[trackIndex]);
  const visibleTrackIndices = usePlayerStore((state) => state.visibleTrackIndices);
  const selectedBeat = usePlayerStore((state) => state.selectedBeat);

  if (!track) return null;

  const isVisible = new Set(visibleTrackIndices).has(trackIndex);

  const alphaTrack = getApi()?.score?.tracks[trackIndex];
  const staffs: StaffEditorData[] = (alphaTrack?.staves ?? []).map(
    (staff, staffIndex) => readStaffEditorData(staffIndex, staff),
  );
  const playbackInfo = alphaTrack?.playbackInfo
    ? {
        program: alphaTrack.playbackInfo.program,
        primaryChannel: alphaTrack.playbackInfo.primaryChannel,
      }
    : null;
  const onlyStaff = staffs[0] ?? null;
  const summary = staffs.length > 1
    ? t("sidebar.staff.count", { count: staffs.length })
    : onlyStaff?.isPercussion
      ? t("sidebar.tracks.percussion")
      : onlyStaff?.stringCount
        ? t("sidebar.tracks.stringCount", { count: onlyStaff.stringCount })
        : "";

  return (
    <div className="border-b border-border/30 last:border-b-0">
      <div className="flex items-center gap-1 px-2 py-1">
        <button
          type="button"
          className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label={t("sidebar.tracks.toggleDetails", { name: track.name })}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
        <button
          type="button"
          className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label={t(
            isVisible ? "sidebar.tracks.hideTrack" : "sidebar.tracks.showTrack",
            { name: track.name },
          )}
          onClick={() => executeAppAction(
            "view.setTrackVisible",
            { trackIndex, visible: !isVisible },
            { t },
          )}
        >
          {isVisible ? (
            <Eye className="h-3 w-3" />
          ) : (
            <EyeOff className="h-3 w-3 opacity-50" />
          )}
        </button>
        <span
          className={cn(
            "flex-1 truncate text-[11px] font-medium",
            !isVisible && "text-muted-foreground opacity-50",
          )}
        >
          {track.name}
        </span>
        <span className="text-[9px] tabular-nums text-muted-foreground">
          {summary}
        </span>
      </div>

      {expanded && (
        <div className="space-y-0.5 pb-2">
          <EditablePropRow
            label={t("sidebar.tracks.name")}
            value={track.name}
            placeholder={t("sidebar.tracks.placeholderName")}
            icon={<Guitar className="h-3 w-3" />}
            onCommit={(name) => executeAppAction(
              "document.track.setName",
              { trackIndex, name },
              { t },
            )}
          />
          <EditablePropRow
            label={t("sidebar.tracks.shortName")}
            value={alphaTrack?.shortName ?? ""}
            placeholder={t("sidebar.tracks.placeholderShortName")}
            onCommit={(shortName) => executeAppAction(
              "document.track.setShortName",
              { trackIndex, shortName },
              { t },
            )}
          />

          {staffs.map((staff) => (
            <StaffMetaEditor
              key={staff.staffIndex}
              trackIndex={trackIndex}
              staff={staff}
              showHeader={staffs.length > 1}
              selected={selectedBeat?.trackIndex === trackIndex
                && selectedBeat.staffIndex === staff.staffIndex}
            />
          ))}

          {playbackInfo && (
            <EditableNumberPropRow
              label={t("sidebar.tracks.midiProgram")}
              value={playbackInfo.program}
              min={0}
              max={127}
              onCommit={(program) => executeAppAction(
                "document.track.setPlaybackInfoProgram",
                { trackIndex, program },
                { t },
              )}
            />
          )}

          {playbackInfo && (
            <div className="flex items-center gap-2 px-3 py-0.5">
              <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                {t("sidebar.tracks.midiChannel")}
              </span>
              <span className="ml-auto text-[11px] font-medium tabular-nums">
                {playbackInfo.primaryChannel + 1}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TracksSection({
  dragHandleProps,
}: {
  dragHandleProps?: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const tracks = usePlayerStore((state) => state.tracks);

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
          {tracks.map((track) => (
            <TrackMetaRow key={track.index} trackIndex={track.index} />
          ))}
        </div>
        <Separator />
      </CollapsibleContent>
    </Collapsible>
  );
}
