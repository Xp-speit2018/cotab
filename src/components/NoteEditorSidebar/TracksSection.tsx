import { useState } from "react";
import { useTranslation } from "react-i18next";
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
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { executeAction } from "@/actions";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/render-store";
import type { TuningPresetInfo } from "@/stores/render-types";
import { SectionHeader, EditablePropRow, EditableNumberPropRow } from "./primitives";

function TrackMetaRow({ trackIndex }: { trackIndex: number }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [tuningOpen, setTuningOpen] = useState(false);
  const track = usePlayerStore((s) => s.tracks[trackIndex]);
  const visibleTrackIndices = usePlayerStore((s) => s.visibleTrackIndices);
  const getTuningPresets = usePlayerStore((s) => s.getTuningPresets);

  if (!track) return null;

  const isVisible = new Set(visibleTrackIndices).has(trackIndex);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const alphaTabApi = (window as unknown as Record<string, any>).__ALPHATAB_API__;
  const staffInfo = (() => {
    const selected = usePlayerStore.getState().selectedBeat;
    const staffIndex = selected?.trackIndex === trackIndex ? selected.staffIndex : 0;
    const staff = alphaTabApi?.score?.tracks?.[trackIndex]?.staves?.[staffIndex ?? 0];
    if (!staff) return null;
    return {
      tuningValues: [...staff.tuning] as number[],
      tuningName: staff.tuningName as string,
      capo: staff.capo as number,
      transposition: staff.transpositionPitch as number,
      showTablature: staff.showTablature as boolean,
      showStandardNotation: staff.showStandardNotation as boolean,
      isPercussion: staff.isPercussion as boolean,
      stringCount: (staff.tuning as number[]).length,
    };
  })();

  const playbackInfo = (() => {
    const pi = alphaTabApi?.score?.tracks?.[trackIndex]?.playbackInfo;
    if (!pi) return null;
    return {
      program: pi.program as number,
      primaryChannel: pi.primaryChannel as number,
    };
  })();

  const tuningPresets: TuningPresetInfo[] =
    staffInfo && staffInfo.showTablature && staffInfo.stringCount > 0
      ? getTuningPresets(staffInfo.stringCount)
      : [];

  return (
    <div className="border-b border-border/30 last:border-b-0">
      <div className="flex items-center gap-1 px-2 py-1">
        <button
          type="button"
          className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
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
          onClick={() => executeAction("edit.track.setVisible", { trackIndex, visible: !isVisible }, { t })}
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
        <span className="text-[9px] text-muted-foreground tabular-nums">
          {staffInfo?.isPercussion
            ? t("sidebar.tracks.percussion")
            : staffInfo?.stringCount
              ? t("sidebar.tracks.stringCount", { count: staffInfo.stringCount })
              : ""}
        </span>
      </div>

      {expanded && (
        <div className="space-y-0.5 pb-2">
          <EditablePropRow
            label={t("sidebar.tracks.name")}
            value={track.name}
            placeholder={t("sidebar.tracks.placeholderName")}
            icon={<Guitar className="h-3 w-3" />}
            onCommit={(v) => executeAction("edit.track.setName", { trackIndex, name: v }, { t })}
          />
          <EditablePropRow
            label={t("sidebar.tracks.shortName")}
            value={(alphaTabApi?.score?.tracks?.[trackIndex]?.shortName as string) ?? ""}
            placeholder={t("sidebar.tracks.placeholderShortName")}
            onCommit={(v) => executeAction("edit.track.setShortName", { trackIndex, shortName: v }, { t })}
          />

          {staffInfo &&
            staffInfo.showTablature &&
            staffInfo.stringCount > 0 &&
            !staffInfo.isPercussion && (
            <>
              <div className="group flex items-center gap-2 px-3 py-0.5">
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                  {t("sidebar.tracks.tuning")}
                </span>
                <Popover open={tuningOpen} onOpenChange={setTuningOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="ml-auto flex items-center gap-1 text-[11px] font-medium tabular-nums hover:text-primary transition-colors cursor-pointer"
                    >
                      <span className="truncate max-w-[120px]">
                        {staffInfo.tuningName || t("sidebar.tracks.customTuning")}
                      </span>
                      <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-56 p-1 max-h-60 overflow-y-auto"
                    side="left"
                    align="start"
                  >
                    {tuningPresets.map((preset, i) => (
                      <button
                        key={i}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 rounded px-2 py-1 text-[11px] hover:bg-accent/50",
                          preset.tunings.join(",") === staffInfo.tuningValues.join(",") && "bg-accent",
                        )}
                        onClick={() => {
                          executeAction("edit.staff.setTuning", { trackIndex, staffIndex: 0, tuningValues: preset.tunings }, { t });
                          setTuningOpen(false);
                        }}
                      >
                        <span className="font-medium truncate">{preset.name}</span>
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
                  {staffInfo.tuningValues.map((val, i) => {
                    const noteName = usePlayerStore.getState().formatTuningNote(val);
                    return (
                      <div key={i} className="flex items-center gap-1">
                        <span className="text-[9px] text-muted-foreground/60 w-3 text-right tabular-nums">
                          {i + 1}
                        </span>
                        <button
                          type="button"
                          className="h-4 w-4 flex items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          onClick={() => {
                            const next = [...staffInfo.tuningValues];
                            next[i] = Math.max(0, next[i] - 1);
                            executeAction("edit.staff.setTuning", { trackIndex, staffIndex: 0, tuningValues: next }, { t });
                          }}
                        >
                          <ChevronDown className="h-2.5 w-2.5" />
                        </button>
                        <span className="text-[10px] font-mono tabular-nums w-7 text-center bg-muted/50 rounded px-0.5">
                          {noteName}
                        </span>
                        <button
                          type="button"
                          className="h-4 w-4 flex items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          onClick={() => {
                            const next = [...staffInfo.tuningValues];
                            next[i] = Math.min(127, next[i] + 1);
                            executeAction("edit.staff.setTuning", { trackIndex, staffIndex: 0, tuningValues: next }, { t });
                          }}
                        >
                          <ChevronUp className="h-2.5 w-2.5" />
                        </button>
                        <span className="text-[9px] text-muted-foreground/40 tabular-nums">
                          {val}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <EditableNumberPropRow
                label={t("sidebar.tracks.capo")}
                value={staffInfo.capo}
                min={0}
                max={24}
                onCommit={(v) => executeAction("edit.staff.setCapo", { trackIndex, staffIndex: 0, capo: v }, { t })}
              />
            </>
          )}

          {staffInfo && !staffInfo.isPercussion && (
            <EditableNumberPropRow
              label={t("sidebar.tracks.transposition")}
              value={staffInfo.transposition}
              suffix={t("sidebar.tracks.semitones")}
              min={-24}
              max={24}
              onCommit={(v) => executeAction("edit.staff.setTransposition", { trackIndex, staffIndex: 0, semitones: v }, { t })}
            />
          )}

          {playbackInfo && (
            <EditableNumberPropRow
              label={t("sidebar.tracks.midiProgram")}
              value={playbackInfo.program}
              min={0}
              max={127}
              onCommit={(v) => executeAction("edit.track.setProgram", { trackIndex, program: v }, { t })}
            />
          )}

          {playbackInfo && (
            <div className="flex items-center gap-2 px-3 py-0.5">
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
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

export function TracksSection({ dragHandleProps }: { dragHandleProps?: Record<string, unknown> }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const tracks = usePlayerStore((s) => s.tracks);

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
