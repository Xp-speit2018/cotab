import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CloudOff,
  Loader2,
  Save,
} from "lucide-react";

import { executeAppAction } from "@/app-actions";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { EditorStorageStatus } from "@/core/engine";
import {
  documentStorageController,
} from "@/storage/document-storage-runtime";
import { useEditorStore } from "@/stores/editor-store";

const STATUS_COLORS: Record<EditorStorageStatus, string> = {
  unbound: "bg-muted-foreground/45",
  saved: "bg-emerald-500",
  dirty: "bg-amber-500",
  saving: "bg-blue-500",
  conflict: "bg-destructive",
  error: "bg-destructive",
};

export function DocumentStorageControls() {
  const { t } = useTranslation();
  const available = useEditorStore(
    (state) => state.storage.availableProviderIds.length > 0,
  );
  const status = useEditorStore((state) => state.storage.status);
  const binding = useEditorStore((state) => state.storage.binding);
  const autoSaveEnabled = useEditorStore(
    (state) => state.storage.autoSaveEnabled,
  );
  const error = useEditorStore((state) => state.storage.error);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!available) return null;

  const statusLabel = t(`storage.status.${status}`);
  const saveLabel = `${t("toolbar.saveDocument")} · ${statusLabel}`;
  const isSaving = status === "saving";
  const bindingProvider = binding
    ? documentStorageController
        .getAvailableProviders()
        .find((provider) => provider.id === binding.providerId)
    : null;
  const save = () => {
    void executeAppAction("storage.save", undefined, { t });
  };
  const saveAs = () => {
    void executeAppAction("storage.saveAs", undefined, { t });
  };

  return (
    <div
      role="group"
      aria-label={t("toolbar.documentStorage")}
      data-storage-status={status}
      className="flex h-8 items-center rounded-md border"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-7 w-8 rounded-r-none"
            disabled={isSaving}
            onClick={save}
            aria-label={saveLabel}
            data-testid="storage-save"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : status === "conflict" || status === "error" ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span
              className={cn(
                "absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full",
                STATUS_COLORS[status],
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-80">
          <p>{saveLabel}</p>
          {error && <p className="mt-1 opacity-80">{error}</p>}
        </TooltipContent>
      </Tooltip>

      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-6 rounded-l-none border-l"
                aria-label={t("toolbar.saveOptions")}
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>{t("toolbar.saveOptions")}</TooltipContent>
        </Tooltip>
        <PopoverContent align="start" className="w-64 p-1.5">
          <div className="px-2 py-1.5">
            <div className="flex items-center gap-2 text-sm font-medium">
              {status === "saved" ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : status === "unbound" ? (
                <CloudOff className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    STATUS_COLORS[status],
                  )}
                />
              )}
              <span>{statusLabel}</span>
            </div>
            {binding && (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {bindingProvider
                  ? t(`storage.provider.${bindingProvider.id}.name`, {
                      defaultValue: bindingProvider.name,
                    })
                  : binding.providerId}
                {" · "}
                {binding.displayName}
              </p>
            )}
            {error && (
              <p className="mt-1 text-xs text-destructive">{error}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start font-normal"
            onClick={saveAs}
          >
            <Save className="h-3.5 w-3.5" />
            {t("toolbar.saveDocumentAs")}
          </Button>
          <label className="flex h-8 items-center gap-2 rounded-md px-2 text-sm hover:bg-accent">
            <input
              type="checkbox"
              checked={autoSaveEnabled}
              onChange={(event) =>
                documentStorageController.setAutoSaveEnabled(
                  event.currentTarget.checked,
                )
              }
            />
            <span>{t("toolbar.autoSave")}</span>
          </label>
        </PopoverContent>
      </Popover>
    </div>
  );
}
