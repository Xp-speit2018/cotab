import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Music,
  FileText,
  User,
  Album,
  Pencil,
  Copyright,
  Guitar,
  Info,
  MessageSquare,
  Gauge,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { executeAppAction } from "@/app-actions";
import { usePlayerStore } from "@/stores/render-store";
import type { ScoreMetadataField } from "@/stores/render-types";
import {
  DialogPropRow,
  EditableNumberPropRow,
  EditablePropRow,
  SectionHeader,
} from "./primitives";
import {
  LongTextEditor,
  longTextSummary,
} from "./editors/LongTextEditor";

export function SongSection({ dragHandleProps }: { dragHandleProps?: Record<string, unknown> }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
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

  const handleMeta = useCallback(
    (field: ScoreMetadataField) => (value: string) => {
      executeAppAction("document.score.setMetadata", { field, value }, { t });
    },
    [t],
  );

  const handleTempo = useCallback(
    (tempo: number) => {
      executeAppAction("document.score.setTempo", { tempo }, { t });
    },
    [t],
  );

  const handleTempoLabel = useCallback(
    (label: string) => {
      executeAppAction("document.score.setTempoLabel", { label }, { t });
    },
    [t],
  );

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
          <EditablePropRow
            label={t("sidebar.song.songTitle")}
            value={scoreTitle}
            placeholder={t("sidebar.song.placeholderTitle")}
            icon={<Music className="h-3.5 w-3.5" />}
            onCommit={handleMeta("title")}
          />
          <EditablePropRow
            label={t("sidebar.song.subTitle")}
            value={scoreSubTitle}
            placeholder={t("sidebar.song.placeholderSubTitle")}
            icon={<FileText className="h-3.5 w-3.5" />}
            onCommit={handleMeta("subTitle")}
          />
          <EditablePropRow
            label={t("sidebar.song.songArtist")}
            value={scoreArtist}
            placeholder={t("sidebar.song.placeholderArtist")}
            icon={<User className="h-3.5 w-3.5" />}
            onCommit={handleMeta("artist")}
          />
          <EditablePropRow
            label={t("sidebar.song.album")}
            value={scoreAlbum}
            placeholder={t("sidebar.song.placeholderAlbum")}
            icon={<Album className="h-3.5 w-3.5" />}
            onCommit={handleMeta("album")}
          />
          <EditablePropRow
            label={t("sidebar.song.words")}
            value={scoreWords}
            placeholder={t("sidebar.song.placeholderWords")}
            icon={<Pencil className="h-3.5 w-3.5" />}
            onCommit={handleMeta("words")}
          />
          <EditablePropRow
            label={t("sidebar.song.music")}
            value={scoreMusic}
            placeholder={t("sidebar.song.placeholderMusic")}
            icon={<Music className="h-3.5 w-3.5" />}
            onCommit={handleMeta("music")}
          />
          <EditablePropRow
            label={t("sidebar.song.copyright")}
            value={scoreCopyright}
            placeholder={t("sidebar.song.placeholderCopyright")}
            icon={<Copyright className="h-3.5 w-3.5" />}
            onCommit={handleMeta("copyright")}
          />
          <EditablePropRow
            label={t("sidebar.song.tab")}
            value={scoreTab}
            placeholder={t("sidebar.song.placeholderTab")}
            icon={<Guitar className="h-3.5 w-3.5" />}
            onCommit={handleMeta("tab")}
          />
          <DialogPropRow
            label={t("sidebar.song.instructions")}
            value={longTextSummary(
              scoreInstructions,
              t("sidebar.common.none"),
            )}
            icon={<Info className="h-3.5 w-3.5" />}
            open={instructionsOpen}
            onOpenChange={setInstructionsOpen}
            description={t("sidebar.song.longTextHelp")}
          >
            <LongTextEditor
              value={scoreInstructions}
              label={t("sidebar.song.instructions")}
              placeholder={t("sidebar.song.placeholderInstructions")}
              applyLabel={t("sidebar.common.apply")}
              onCommit={handleMeta("instructions")}
              onDone={() => setInstructionsOpen(false)}
            />
          </DialogPropRow>
          <DialogPropRow
            label={t("sidebar.song.notices")}
            value={longTextSummary(scoreNotices, t("sidebar.common.none"))}
            icon={<MessageSquare className="h-3.5 w-3.5" />}
            open={noticesOpen}
            onOpenChange={setNoticesOpen}
            description={t("sidebar.song.longTextHelp")}
          >
            <LongTextEditor
              value={scoreNotices}
              label={t("sidebar.song.notices")}
              placeholder={t("sidebar.song.placeholderNotices")}
              applyLabel={t("sidebar.common.apply")}
              onCommit={handleMeta("notices")}
              onDone={() => setNoticesOpen(false)}
            />
          </DialogPropRow>
          <EditableNumberPropRow
            label={t("sidebar.song.tempo")}
            value={scoreTempo}
            suffix="BPM"
            icon={<Gauge className="h-3.5 w-3.5" />}
            min={20}
            max={400}
            onCommit={handleTempo}
          />
          <EditablePropRow
            label={t("sidebar.song.tempoLabel")}
            value={scoreTempoLabel}
            placeholder={t("sidebar.song.placeholderTempoLabel")}
            icon={<Gauge className="h-3.5 w-3.5" />}
            onCommit={handleTempoLabel}
          />
        </div>
        <Separator />
      </CollapsibleContent>
    </Collapsible>
  );
}
