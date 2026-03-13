import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { keyboardEventToCombo } from "@/shortcuts/platform";
import { isDisallowed, getDisallowReason } from "@/shortcuts/disallow-list";
import { useShortcutStore } from "@/shortcuts";
import { cn } from "@/lib/utils";

interface Props {
  bindingId: string;
  onRecord: (combo: string) => void;
  onCancel: () => void;
}

export function ShortcutRecorder({ bindingId, onRecord, onCancel }: Props) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const findDuplicates = useShortcutStore((s) => s.findDuplicates);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        onCancel();
        return;
      }

      const combo = keyboardEventToCombo(e);
      if (!combo) return;

      if (isDisallowed(combo)) {
        const reasonKey = getDisallowReason(combo);
        setError(reasonKey ? t(reasonKey) : t("shortcuts.recorder.disallowed"));
        return;
      }

      const dupes = findDuplicates(combo, bindingId);
      if (dupes.length > 0) {
        const names = dupes.map((d) => t(`${d.i18nKey}.name`)).join(", ");
        setError(t("shortcuts.recorder.duplicateWarning", { actions: names }));
        setTimeout(() => {
          onRecord(combo);
        }, 800);
        return;
      }

      setError(null);
      onRecord(combo);
    },
    [bindingId, findDuplicates, onCancel, onRecord, t],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [handleKeyDown]);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      ref={ref}
      tabIndex={0}
      className={cn(
        "flex items-center gap-2 rounded-md border-2 border-ring px-3 py-1.5 text-sm",
        "animate-pulse bg-accent/30 focus:outline-none",
      )}
    >
      <span className="text-muted-foreground">{t("shortcuts.recorder.prompt")}</span>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
