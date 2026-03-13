import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useShortcutStore } from "@/shortcuts";
import { formatShortcut } from "@/shortcuts";
import type { ShortcutBinding } from "@/shortcuts";
import { ShortcutRecorder } from "./ShortcutRecorder";
import { ConflictBadge } from "./ConflictBadge";

interface Props {
  binding: ShortcutBinding;
}

export function ShortcutRow({ binding }: Props) {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);
  const setBindingKeys = useShortcutStore((s) => s.setBindingKeys);
  const resetOne = useShortcutStore((s) => s.resetOne);

  const isModified = binding.keys !== binding.defaultKeys;

  const handleRecord = useCallback(
    (combo: string) => {
      setBindingKeys(binding.id, combo);
      setRecording(false);
    },
    [binding.id, setBindingKeys],
  );

  const handleUnbind = useCallback(() => {
    setBindingKeys(binding.id, "");
    setRecording(false);
  }, [binding.id, setBindingKeys]);

  return (
    <div className="flex items-center gap-2 py-1.5 px-1 rounded-md hover:bg-accent/30 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm truncate">{t(`${binding.i18nKey}.name`)}</span>
          {binding.placeholder && (
            <Badge variant="secondary" className="text-[10px] leading-tight">
              {t("shortcuts.comingSoon")}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {recording ? (
          <ShortcutRecorder
            bindingId={binding.id}
            onRecord={handleRecord}
            onCancel={() => setRecording(false)}
          />
        ) : (
          <>
            {binding.keys ? (
              <kbd className="inline-flex items-center gap-1 rounded border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                {formatShortcut(binding.keys)}
              </kbd>
            ) : (
              <span className="text-xs text-muted-foreground italic">
                {t("shortcuts.unbound")}
              </span>
            )}

            <ConflictBadge combo={binding.keys} bindingId={binding.id} />
          </>
        )}

        {!binding.placeholder && !recording && (
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setRecording(true)}
                >
                  <Pencil />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("shortcuts.edit")}</TooltipContent>
            </Tooltip>

            {binding.keys && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleUnbind}
                  >
                    <X />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("shortcuts.unbind")}</TooltipContent>
              </Tooltip>
            )}

            {isModified && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => resetOne(binding.id)}
                  >
                    <RotateCcw />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("shortcuts.resetOne")}</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
