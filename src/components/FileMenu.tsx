import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CloudOff,
  FileText,
  FolderOpen,
  Loader2,
  Save,
  SaveAll,
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
import type { EditorStorageStatus } from "@/core/engine";
import { cn } from "@/lib/utils";
import { formatShortcut } from "@/shortcuts";
import { documentStorageController } from "@/storage/document-storage-runtime";
import { useEditorStore } from "@/stores/editor-store";

const STATUS_COLORS: Record<EditorStorageStatus, string> = {
  unbound: "bg-muted-foreground/45",
  saved: "bg-emerald-500",
  dirty: "bg-amber-500",
  saving: "bg-blue-500",
  conflict: "bg-destructive",
  error: "bg-destructive",
};

interface FileMenuProps {
  onOpen(): void | Promise<void>;
}

export function FileMenu({ onOpen }: FileMenuProps) {
  const { t } = useTranslation();
  const status = useEditorStore((state) => state.storage.status);
  const binding = useEditorStore((state) => state.storage.binding);
  const autoSaveEnabled = useEditorStore(
    (state) => state.storage.autoSaveEnabled,
  );
  const error = useEditorStore((state) => state.storage.error);
  const [open, setOpen] = useState(false);

  const statusLabel = t(`storage.status.${status}`);
  const menuLabel = `${t("toolbar.fileMenu")} · ${statusLabel}`;
  const isSaving = status === "saving";
  const bindingProvider = binding
    ? documentStorageController
        .getAvailableProviders()
        .find((provider) => provider.id === binding.providerId)
    : null;

  const run = (command: () => unknown | Promise<unknown>) => {
    setOpen(false);
    void command();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="relative h-8 gap-1.5 px-2"
              aria-label={menuLabel}
              data-testid="file-menu"
            >
              {isSaving
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : status === "conflict" || status === "error"
                  ? <AlertTriangle className="h-4 w-4 text-destructive" />
                  : <FileText className="h-4 w-4" />}
              <span className="text-xs">{t("toolbar.fileMenu")}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
              <span
                className={cn(
                  "absolute left-5 top-0.5 h-1.5 w-1.5 rounded-full",
                  STATUS_COLORS[status],
                )}
              />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent className="max-w-80">
          <p>{menuLabel}</p>
          {error && <p className="mt-1 opacity-80">{error}</p>}
        </TooltipContent>
      </Tooltip>

      <PopoverContent align="start" className="w-72 p-1.5" role="menu">
        <div className="px-2 py-1.5">
          <div className="flex items-center gap-2 text-xs font-medium">
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
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              {bindingProvider
                ? t(`storage.provider.${bindingProvider.id}.name`, {
                    defaultValue: bindingProvider.name,
                  })
                : binding.providerId}
              {" · "}
              {binding.displayName}
            </p>
          )}
          {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
        </div>

        <div className="my-1 border-t" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          role="menuitem"
          className="w-full justify-start font-normal"
          onClick={() => run(onOpen)}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          <span>{t("toolbar.openFile")}</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          role="menuitem"
          className="w-full justify-start font-normal"
          disabled={isSaving}
          data-testid="storage-save"
          onClick={() => run(() =>
            executeAppAction("storage.save", undefined, { t }))}
        >
          <Save className="h-3.5 w-3.5" />
          <span>{t("toolbar.saveDocument")}</span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {formatShortcut("Mod+S")}
          </span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          role="menuitem"
          className="w-full justify-start font-normal"
          disabled={isSaving}
          onClick={() => run(() =>
            executeAppAction("storage.saveAs", undefined, { t }))}
        >
          <SaveAll className="h-3.5 w-3.5" />
          <span>{t("toolbar.saveDocumentAs")}</span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {formatShortcut("Mod+Shift+S")}
          </span>
        </Button>

        <div className="my-1 border-t" />
        <label className="flex h-8 items-center gap-2 rounded-md px-2 text-sm hover:bg-accent">
          <input
            type="checkbox"
            checked={autoSaveEnabled}
            onChange={(event) =>
              documentStorageController.setAutoSaveEnabled(
                event.currentTarget.checked,
              )}
          />
          <span>{t("toolbar.autoSave")}</span>
        </label>
      </PopoverContent>
    </Popover>
  );
}
