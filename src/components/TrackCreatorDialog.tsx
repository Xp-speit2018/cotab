import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Drum, Guitar, Music, Piano } from "lucide-react";

import { executeAppAction } from "@/app-actions";
import {
  PresetCombobox,
} from "@/components/NoteEditorSidebar/PresetCombobox";
import {
  generalMidiInstrumentOptions,
} from "@/components/NoteEditorSidebar/editors/InstrumentEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TRACK_PRESETS,
  type TrackPreset,
  type TrackPresetId,
} from "@/core/presets";
import { generalMidiInstrument } from "@/core/general-midi";
import { cn } from "@/lib/utils";
import { useDocumentWorkspaceStore } from "@/workspace/document-workspace";
import { useWorkspaceUiStore } from "@/workspace/workspace-ui-store";

interface TrackCreationDraft {
  presetId: TrackPresetId | null;
  name: string;
  shortName: string;
  program: number;
  bank: number;
}

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

function draftFromPreset(preset: TrackPreset): TrackCreationDraft {
  return {
    presetId: preset.id as TrackPresetId,
    name: preset.defaultName,
    shortName: preset.shortName,
    program: preset.playbackInfo.program,
    bank: preset.playbackInfo.bank,
  };
}

export function TrackCreatorDialog() {
  const { t } = useTranslation();
  const open = useWorkspaceUiStore((state) => state.trackCreatorOpen);
  const setOpen = useWorkspaceUiStore((state) => state.setTrackCreatorOpen);
  const hasDocument = useDocumentWorkspaceStore(
    (state) => state.activeTabId !== "",
  );
  const [draft, setDraft] = useState<TrackCreationDraft | null>(null);
  const instrumentOptions = useMemo(
    () => generalMidiInstrumentOptions(t("sidebar.tracks.commonInstruments")),
    [t],
  );
  const isPercussion = draft?.presetId === "drumkit";
  const instrumentValue = draft && !isPercussion ? draft.program : null;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setDraft(null);
  };

  useEffect(() => {
    if (!hasDocument && open) {
      setOpen(false);
      setDraft(null);
    }
  }, [hasDocument, open, setOpen]);

  const createTrack = () => {
    if (!draft) return;
    const name = draft.name.trim();
    const shortName = draft.shortName.trim();
    if (!name) return;
    if (draft.presetId !== null) {
      executeAppAction(
        "document.track.add",
        {
          presetId: draft.presetId,
          name,
          shortName,
          program: draft.program,
          bank: draft.bank,
        },
        { t },
      );
    } else {
      executeAppAction(
        "document.track.addInstrument",
        {
          program: draft.program,
          bank: draft.bank,
          name,
          shortName,
        },
        { t },
      );
    }
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("sidebar.tracks.addTrack")}</DialogTitle>
          <DialogDescription>
            {t("sidebar.tracks.addTrackDescription")}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            createTrack();
          }}
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
            <section aria-labelledby="track-creator-quick-presets">
              <h3
                id="track-creator-quick-presets"
                className="mb-2 text-xs font-medium text-muted-foreground"
              >
                {t("sidebar.tracks.quickPresets")}
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {TRACK_PRESETS.map((preset) => {
                  const selected = draft?.presetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      aria-pressed={selected}
                      className={cn(
                        "relative flex min-h-14 cursor-default items-center gap-3 rounded-md border px-3 py-2 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/40",
                        selected && "border-primary bg-accent/60",
                      )}
                      onClick={() => setDraft(draftFromPreset(preset))}
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
                      {selected && (
                        <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="track-creator-details">
              <h3
                id="track-creator-details"
                className="mb-2 text-xs font-medium text-muted-foreground"
              >
                {t("sidebar.tracks.trackDetails")}
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>{t("sidebar.tracks.name")}</span>
                  <Input
                    type="text"
                    value={draft?.name ?? ""}
                    aria-label={t("sidebar.tracks.name")}
                    disabled={!draft}
                    required
                    onChange={(event) => setDraft((current) => current
                      ? { ...current, name: event.currentTarget.value }
                      : current)}
                  />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>{t("sidebar.tracks.shortName")}</span>
                  <Input
                    type="text"
                    value={draft?.shortName ?? ""}
                    aria-label={t("sidebar.tracks.shortName")}
                    disabled={!draft}
                    onChange={(event) => setDraft((current) => current
                      ? { ...current, shortName: event.currentTarget.value }
                      : current)}
                  />
                </label>
              </div>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <span>{t("sidebar.tracks.instrument")}</span>
                <PresetCombobox<number | null>
                  value={instrumentValue}
                  valueLabel={isPercussion
                    ? t("sidebar.tracks.drumKit")
                    : t("sidebar.tracks.chooseInstrument")}
                  ariaLabel={t("sidebar.tracks.instrument")}
                  options={instrumentOptions}
                  disabled={isPercussion}
                  onValueChange={(program) => {
                    if (program === null) return;
                    const instrument = generalMidiInstrument(program);
                    if (!instrument) return;
                    setDraft((current) => current
                      ? { ...current, program, bank: 0 }
                      : {
                          presetId: null,
                          name: instrument.name,
                          shortName: "",
                          program,
                          bank: 0,
                        });
                  }}
                  align="start"
                  portalled={false}
                  contentClassName="w-[min(28rem,calc(100vw-2rem))]"
                  optionContainerClassName="sm:grid sm:grid-cols-2"
                />
              </div>
              <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                {t("sidebar.tracks.standardInstrumentHelp")}
              </p>
            </section>
          </div>

          <DialogFooter className="mt-4 shrink-0 border-t pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t("sidebar.common.cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!draft?.name.trim()}>
              {t("sidebar.tracks.createTrack")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
