import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type * as alphaTab from "@coderline/alphatab";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Drum,
  Eye,
  EyeOff,
  Guitar,
  Music,
  Pencil,
  Piano,
  Plus,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { executeAppAction } from "@/app-actions";
import {
  TRACK_PRESETS,
  type TrackPreset,
  type TrackPresetId,
} from "@/core/presets";
import { cn } from "@/lib/utils";
import { getApi } from "@/stores/render-api";
import { GP7_DEF_BY_ID } from "@/stores/percussion-data";
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
  PopoverPropRow,
  PropRow,
} from "./primitives";
import { ChordLibraryEditor } from "./editors/ChordEditors";
import {
  InstrumentEditor,
  instrumentSummary,
} from "./editors/InstrumentEditor";
import { PercussionMapEditor } from "./editors/PercussionMapEditor";
import {
  ColorEditor,
  colorRgbToHex,
} from "./editors/ColorEditor";
import { MusicGlyph, musicGlyphs } from "./notation-icons";
import { PresetCombobox } from "./PresetCombobox";

function TrackPresetIcon({ presetId }: { presetId: TrackPresetId }) {
  if (presetId === "drumkit") return <Drum className="h-4 w-4" />;
  if (presetId === "acousticPiano") return <Piano className="h-4 w-4" />;
  if (presetId === "violin") return <Music className="h-4 w-4" />;
  return <Guitar className="h-4 w-4" />;
}

function trackPresetSummary(
  preset: TrackPreset,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const notation = [
    preset.staves.some((staff) => staff.showStandardNotation)
      ? t("sidebar.tracks.standardNotation")
      : null,
    preset.staves.some((staff) => staff.showTablature)
      ? t("sidebar.tracks.tablature")
      : null,
  ].filter(Boolean).join(" + ");
  const stringCount = preset.staves[0]?.stringTuning.tunings.length ?? 0;
  return [
    preset.staves.length > 1
      ? t("sidebar.staff.count", { count: preset.staves.length })
      : preset.staves[0]?.isPercussion
        ? t("sidebar.tracks.percussion")
        : null,
    notation,
    stringCount > 0
      ? t("sidebar.tracks.stringCount", { count: stringCount })
      : null,
  ].filter(Boolean).join(" · ");
}

function AddTrackPopover() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const addTrack = (presetId: TrackPresetId) => {
    setOpen(false);
    executeAppAction("document.track.add", { presetId }, { t });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip open={open ? false : undefined}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-interaction="command"
              aria-label={t("sidebar.tracks.addTrack")}
              className="flex h-7 w-7 shrink-0 cursor-default items-center justify-center text-muted-foreground/70 transition-colors hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {t("sidebar.tracks.addTrack")}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={40}
        collisionPadding={12}
        className="w-72 p-2"
      >
        <PopoverHeader className="px-1 pb-1">
          <PopoverTitle>{t("sidebar.tracks.addTrack")}</PopoverTitle>
        </PopoverHeader>
        <div role="menu" aria-label={t("sidebar.tracks.addTrack")}>
          {TRACK_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              role="menuitem"
              className="flex min-h-11 w-full items-center gap-3 px-2 py-1.5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
              onClick={() => addTrack(preset.id)}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground">
                <TrackPresetIcon presetId={preset.id} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium">
                  {t(preset.nameKey)}
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {trackPresetSummary(preset, t)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface StaffEditorData {
  staffIndex: number;
  tuningValues: number[];
  capo: number;
  transposition: number;
  displayTransposition: number;
  showTablature: boolean;
  showStandardNotation: boolean;
  isPercussion: boolean;
  stringCount: number;
  chords: ChordDefinitionInfo[];
}

function findMatchingTuningPreset(
  tunings: readonly number[],
  presets: readonly TuningPresetInfo[],
): TuningPresetInfo | null {
  return presets.find((preset) =>
    preset.tunings.length === tunings.length
    && preset.tunings.every((value, index) => value === tunings[index])
  ) ?? null;
}

function readStaffEditorData(
  staffIndex: number,
  staff: alphaTab.model.Staff,
): StaffEditorData {
  return {
    staffIndex,
    tuningValues: [...staff.tuning],
    capo: staff.capo,
    transposition: staff.transpositionPitch,
    displayTransposition: staff.displayTranspositionPitch,
    showTablature: staff.showTablature,
    showStandardNotation: staff.showStandardNotation,
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
  const formatTuningNote = usePlayerStore((state) => state.formatTuningNote);

  useEffect(() => {
    if (selected) setExpanded(true);
  }, [selected]);

  const tuningPresets: TuningPresetInfo[] =
    staff.showTablature && staff.stringCount > 0
      ? getTuningPresets(staff.stringCount)
      : [];
  const matchingTuningPreset = findMatchingTuningPreset(
    staff.tuningValues,
    tuningPresets,
  );
  const summary = staff.isPercussion
    ? t("sidebar.tracks.percussion")
    : staff.stringCount > 0
      ? t("sidebar.tracks.stringCount", { count: staff.stringCount })
      : "";
  const notationSummary = [
    staff.showStandardNotation
      ? t("sidebar.tracks.standardNotation")
      : null,
    staff.showTablature ? t("sidebar.tracks.tablature") : null,
  ].filter(Boolean).join(", ");

  const setNotationVisibility = (
    showStandardNotation: boolean,
    showTablature: boolean,
  ) => {
    if (!showStandardNotation && !showTablature) return;
    executeAppAction("document.staff.setNotationVisibility", {
      trackIndex,
      staffIndex: staff.staffIndex,
      showStandardNotation,
      showTablature,
    }, { t });
  };

  const setTuningValues = (tunings: number[]) => {
    const matchingPreset = findMatchingTuningPreset(tunings, tuningPresets);
    executeAppAction("document.staff.setStringTuning", {
      trackIndex,
      staffIndex: staff.staffIndex,
      stringTuning: matchingPreset ?? {
        tunings,
        name: "",
        isStandard: false,
      },
    }, { t });
  };

  const fields = (
    <div className="space-y-0.5 pb-1">
      <PopoverPropRow
        label={t("sidebar.tracks.notation")}
        value={notationSummary}
        title={t("sidebar.tracks.notation")}
        description={t("sidebar.tracks.notationHelp")}
        contentClassName="w-64 p-2"
      >
        <div role="menu" aria-label={t("sidebar.tracks.notation")}>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-label={t("sidebar.tracks.standardNotation")}
            aria-checked={staff.showStandardNotation}
            disabled={staff.showStandardNotation && !staff.showTablature}
            className="flex min-h-9 w-full items-center gap-2 px-2 text-left text-xs transition-colors hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setNotationVisibility(
              !staff.showStandardNotation,
              staff.showTablature,
            )}
          >
            <span className="flex h-4 w-4 items-center justify-center">
              {staff.showStandardNotation && <Check className="h-3.5 w-3.5" />}
            </span>
            <MusicGlyph glyph={musicGlyphs.gClef} className="w-5 text-[18px]" />
            <span>{t("sidebar.tracks.standardNotation")}</span>
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-label={t("sidebar.tracks.tablature")}
            aria-checked={staff.showTablature}
            disabled={staff.showTablature && !staff.showStandardNotation}
            className="flex min-h-9 w-full items-center gap-2 px-2 text-left text-xs transition-colors hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setNotationVisibility(
              staff.showStandardNotation,
              !staff.showTablature,
            )}
          >
            <span className="flex h-4 w-4 items-center justify-center">
              {staff.showTablature && <Check className="h-3.5 w-3.5" />}
            </span>
            <MusicGlyph glyph={musicGlyphs.tabClef6} className="w-5 text-[18px]" />
            <span>{t("sidebar.tracks.tablature")}</span>
          </button>
        </div>
      </PopoverPropRow>

      {staff.showTablature && staff.stringCount > 0 && !staff.isPercussion && (
        <>
          <PopoverPropRow
            label={t("sidebar.tracks.tuning")}
            value={matchingTuningPreset?.name ?? t("sidebar.tracks.customTuning")}
            title={t("sidebar.tracks.tuning")}
            description={t("sidebar.tracks.tuningHelp")}
            open={tuningOpen}
            onOpenChange={setTuningOpen}
            contentClassName="w-72"
          >
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-[10px] font-medium text-muted-foreground">
                  {t("sidebar.tracks.tuningPreset")}
                </div>
                <PresetCombobox
                  value={matchingTuningPreset
                    ? tuningPresets.indexOf(matchingTuningPreset)
                    : -1}
                  valueLabel={t("sidebar.tracks.customTuning")}
                  ariaLabel={t("sidebar.tracks.tuningPreset")}
                  options={tuningPresets.map((preset, index) => ({
                    value: index,
                    label: preset.name,
                    keywords: preset.isStandard
                      ? [t("sidebar.tracks.standard")]
                      : undefined,
                  }))}
                  onValueChange={(index) => {
                    const preset = tuningPresets[index];
                    if (preset) setTuningValues([...preset.tunings]);
                  }}
                  align="start"
                />
              </div>

              <div>
                <div className="mb-1 text-[10px] font-medium text-muted-foreground">
                  {t("sidebar.tracks.customTuning")}
                </div>
                <div className="space-y-0.5">
                  {staff.tuningValues.map((value, index) => {
                    const noteName = formatTuningNote(value);
                    return (
                      <div key={index} className="flex h-7 items-center gap-1">
                        <span className="w-4 text-right text-[9px] tabular-nums text-muted-foreground/60">
                          {index + 1}
                        </span>
                        <button
                          type="button"
                          aria-label={t("sidebar.tracks.lowerStringTuning", {
                            string: index + 1,
                          })}
                          disabled={value <= 0}
                          className="flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                          onClick={() => {
                            const next = [...staff.tuningValues];
                            next[index] = Math.max(0, next[index] - 1);
                            setTuningValues(next);
                          }}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                        <span className="w-10 border-b px-0.5 text-center font-mono text-[11px] tabular-nums">
                          {noteName}
                        </span>
                        <button
                          type="button"
                          aria-label={t("sidebar.tracks.raiseStringTuning", {
                            string: index + 1,
                          })}
                          disabled={value >= 127}
                          className="flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                          onClick={() => {
                            const next = [...staff.tuningValues];
                            next[index] = Math.min(127, next[index] + 1);
                            setTuningValues(next);
                          }}
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <span className="ml-auto text-[9px] tabular-nums text-muted-foreground/50">
                          MIDI {value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </PopoverPropRow>
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
        <>
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
          {staff.showStandardNotation && (
            <EditableNumberPropRow
              label={t("sidebar.tracks.displayTransposition")}
              value={staff.displayTransposition}
              suffix={t("sidebar.tracks.semitones")}
              min={-24}
              max={24}
              onCommit={(displayTranspositionPitch) => executeAppAction(
                "document.staff.setDisplayTranspositionPitch",
                {
                  trackIndex,
                  staffIndex: staff.staffIndex,
                  displayTranspositionPitch,
                },
                { t },
              )}
            />
          )}
        </>
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
  const [instrumentOpen, setInstrumentOpen] = useState(false);
  const [percussionMapOpen, setPercussionMapOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [nameEditing, setNameEditing] = useState(false);
  const track = usePlayerStore((state) => state.tracks[trackIndex]);
  const visibleTrackIndices = usePlayerStore((state) => state.visibleTrackIndices);
  const selectedBeat = usePlayerStore((state) => state.selectedBeat);
  const [nameDraft, setNameDraft] = useState(track?.name ?? "");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (track && !nameEditing) setNameDraft(track.name);
  }, [track?.name, nameEditing]);

  useEffect(() => {
    if (nameEditing) nameInputRef.current?.focus();
  }, [nameEditing]);

  if (!track) return null;

  const isVisible = new Set(visibleTrackIndices).has(trackIndex);

  const alphaTrack = getApi()?.score?.tracks[trackIndex];
  const staffs: StaffEditorData[] = (alphaTrack?.staves ?? []).map(
    (staff, staffIndex) => readStaffEditorData(staffIndex, staff),
  );
  const onlyStaff = staffs[0] ?? null;
  const summary = staffs.length > 1
    ? t("sidebar.staff.count", { count: staffs.length })
    : onlyStaff?.isPercussion
      ? t("sidebar.tracks.percussion")
      : onlyStaff?.stringCount
        ? t("sidebar.tracks.stringCount", { count: onlyStaff.stringCount })
        : "";
  const colorHex = colorRgbToHex(
    track.color.r,
    track.color.g,
    track.color.b,
  );
  const commitName = () => {
    setNameEditing(false);
    const name = nameDraft.trim();
    setNameDraft(name);
    if (name !== track.name) {
      executeAppAction("document.track.setName", { trackIndex, name }, { t });
    }
  };

  return (
    <div className="border-b border-border/30 last:border-b-0">
      <div
        data-track-header
        className="group flex items-center gap-1 px-2 py-1 transition-colors hover:bg-accent/40"
        onMouseDownCapture={(event) => {
          if (!nameEditing) return;
          const target = event.target;
          if (target instanceof Element
            && target.closest("[data-track-name-edit-field]")) return;
          commitName();
        }}
        onClick={(event) => {
          const target = event.target;
          if (target instanceof Element
            && target.closest("button, input")) return;
          setExpanded(!expanded);
        }}
      >
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
        <Popover open={colorOpen} onOpenChange={setColorOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`${t("sidebar.tracks.trackColor")}: ${track.name} ${colorHex.toUpperCase()}`}
              className="group/color flex h-4 w-4 shrink-0 cursor-default items-center justify-center outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <span
                className={cn(
                  "h-2.5 w-2.5 border border-black/10 transition-[transform,box-shadow] group-hover/color:scale-110 group-hover/color:ring-1 group-hover/color:ring-foreground/30",
                  colorOpen && "scale-110 ring-1 ring-primary ring-offset-1",
                )}
                style={{ backgroundColor: colorHex }}
              />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            collisionPadding={12}
            className="w-72 p-3"
          >
            <PopoverHeader>
              <PopoverTitle>{t("sidebar.tracks.trackColor")}</PopoverTitle>
            </PopoverHeader>
            <div className="mt-3">
              <ColorEditor
                value={colorHex}
                labels={{
                  custom: t("sidebar.tracks.customColor"),
                  apply: t("sidebar.common.apply"),
                }}
                onCommit={(raw) => executeAppAction(
                  "document.track.setColor",
                  { trackIndex, raw },
                  { t },
                )}
                onDone={() => setColorOpen(false)}
              />
            </div>
          </PopoverContent>
        </Popover>
        {nameEditing ? (
          <input
            ref={nameInputRef}
            data-track-name-edit-field
            type="text"
            aria-label={t("sidebar.tracks.name")}
            value={nameDraft}
            placeholder={t("sidebar.tracks.placeholderName")}
            spellCheck={false}
            autoComplete="off"
            className={cn(
              "h-5 min-w-0 flex-1 border-b border-primary/40 bg-transparent px-0 text-[11px] font-medium outline-none",
              !isVisible && "text-muted-foreground opacity-50",
            )}
            onChange={(event) => setNameDraft(event.currentTarget.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "Escape") {
                event.preventDefault();
                commitName();
              }
            }}
          />
        ) : (
          <button
            type="button"
            data-track-name-edit-field
            aria-label={t("sidebar.tracks.editTrackName", { name: track.name })}
            className={cn(
              "flex h-5 min-w-0 flex-1 cursor-text items-center border-b border-transparent text-left transition-colors group-hover:border-border",
              !isVisible && "text-muted-foreground opacity-50",
            )}
            onClick={() => setNameEditing(true)}
          >
            <span className="truncate text-[11px] font-medium">
              {track.name || t("sidebar.tracks.placeholderName")}
            </span>
            <Pencil
              data-track-name-edit-icon
              className="ml-auto h-2.5 w-2.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-50"
            />
          </button>
        )}
        <span
          data-track-summary
          className="cursor-default select-none text-[9px] tabular-nums text-muted-foreground"
        >
          {summary}
        </span>
      </div>

      {expanded && (
        <div className="space-y-0.5 pb-2">
          <EditablePropRow
            label={t("sidebar.tracks.shortName")}
            value={track.shortName}
            placeholder={t("sidebar.tracks.placeholderShortName")}
            onCommit={(shortName) => executeAppAction(
              "document.track.setShortName",
              { trackIndex, shortName },
              { t },
            )}
          />

          {track.isPercussion ? (
            <PropRow
              label={t("sidebar.tracks.instrument")}
              value={t("sidebar.tracks.drumKit")}
            />
          ) : (
            <DialogPropRow
              label={t("sidebar.tracks.instrument")}
              value={instrumentSummary(
                track.playbackInfo.program,
                track.playbackInfo.bank,
                t("sidebar.tracks.unknownInstrument"),
                t("sidebar.tracks.instrumentBank"),
              )}
              title={t("sidebar.tracks.instrument")}
              description={t("sidebar.tracks.instrumentHelp")}
              open={instrumentOpen}
              onOpenChange={setInstrumentOpen}
              contentClassName="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl"
            >
              <InstrumentEditor
                program={track.playbackInfo.program}
                bank={track.playbackInfo.bank}
                labels={{
                  search: t("sidebar.tracks.instrumentSearch"),
                  common: t("sidebar.tracks.commonInstruments"),
                  bank: t("sidebar.tracks.instrumentBank"),
                  apply: t("sidebar.common.apply"),
                }}
                onCommit={(program, bank) => executeAppAction(
                  "document.track.setInstrument",
                  { trackIndex, program, bank },
                  { t },
                )}
                onDone={() => setInstrumentOpen(false)}
              />
            </DialogPropRow>
          )}

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

          {track.isPercussion && track.percussionArticulations.length > 0 && (
            <DialogPropRow
              label={t("sidebar.tracks.percussionMap")}
              value={t("sidebar.tracks.percussionMapCount", {
                count: track.percussionArticulations.length,
              })}
              title={t("sidebar.tracks.percussionMap")}
              description={t("sidebar.tracks.percussionMapHelp")}
              open={percussionMapOpen}
              onOpenChange={setPercussionMapOpen}
              contentClassName="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl"
            >
              <PercussionMapEditor
                articulations={track.percussionArticulations.map(
                  (articulation, articulationIndex) => ({
                    ...articulation,
                    articulationIndex,
                    technique:
                      GP7_DEF_BY_ID.get(articulation.id)?.technique ?? "",
                  }),
                )}
                labels={{
                  search: t("sidebar.tracks.percussionMapSearch"),
                  midiNote: t("sidebar.tracks.percussionMidiNote"),
                  customSound: t("sidebar.tracks.percussionCustomSound"),
                  noResults: t("sidebar.tracks.noPercussionMapResults"),
                  apply: t("sidebar.common.apply"),
                }}
                onCommit={(mappings) => executeAppAction(
                  "document.track.setPercussionMap",
                  { trackIndex, mappings },
                  { t },
                )}
                onDone={() => setPercussionMapOpen(false)}
              />
            </DialogPropRow>
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
        actions={<AddTrackPopover />}
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
