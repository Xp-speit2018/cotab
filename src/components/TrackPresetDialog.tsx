import { useTranslation } from "react-i18next";
import { Guitar, Piano, Drum, Music } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { executeAction } from "@/actions";
import { usePlayerStore } from "@/stores/render-store";
import { TRACK_PRESETS } from "@/stores/render-types";
import { cn } from "@/lib/utils";

const PRESET_ICONS: Record<string, React.ReactNode> = {
  acousticGuitar: <Guitar className="h-5 w-5" />,
  electricGuitarClean: <Guitar className="h-5 w-5" />,
  electricGuitarDistortion: <Guitar className="h-5 w-5" />,
  bassGuitar: <Guitar className="h-5 w-5" />,
  violin: <Music className="h-5 w-5" />,
  acousticPiano: <Piano className="h-5 w-5" />,
  drumkit: <Drum className="h-5 w-5" />,
};

export function TrackPresetDialog() {
  const { t } = useTranslation();
  const open = usePlayerStore((s) => s.addTrackDialogOpen);

  const handleSelect = (presetId: string) => {
    usePlayerStore.setState({ addTrackDialogOpen: false });
    executeAction("edit.track.add", presetId, { t });
  };

  const handleOpenChange = (value: boolean) => {
    usePlayerStore.setState({ addTrackDialogOpen: value });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("trackPresetDialog.title")}</DialogTitle>
          <DialogDescription>{t("trackPresetDialog.description")}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 py-2">
          {TRACK_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm",
                "transition-colors hover:bg-accent hover:text-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              onClick={() => handleSelect(preset.id)}
            >
              <span className="shrink-0 text-muted-foreground">
                {PRESET_ICONS[preset.id] ?? <Music className="h-5 w-5" />}
              </span>
              <span className="truncate font-medium">{t(preset.nameKey)}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
