import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Check,
  CloudOff,
  FileText,
  FolderOpen,
  Loader2,
  Save,
  SaveAll,
} from "lucide-react";

import { executeAppAction } from "@/app-actions";
import {
  AppMenu,
  AppMenuItem,
  AppMenuSeparator,
} from "@/components/ui/app-menu";
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

  const statusLabel = t(`storage.status.${status}`);
  const menuLabel = `${t("toolbar.fileMenu")} · ${statusLabel}`;
  const isSaving = status === "saving";
  const bindingProvider = binding
    ? documentStorageController
        .getAvailableProviders()
        .find((provider) => provider.id === binding.providerId)
    : null;

  return (
    <AppMenu
      label={t("toolbar.fileMenu")}
      ariaLabel={menuLabel}
      icon={isSaving
        ? Loader2
        : status === "conflict" || status === "error"
          ? AlertTriangle
          : FileText}
      iconClassName={cn(
        isSaving && "animate-spin",
        (status === "conflict" || status === "error") && "text-destructive",
      )}
      title={error ? `${menuLabel}: ${error}` : menuLabel}
      testId="file-menu"
      contentClassName="w-72"
      indicator={(
        <span
          className={cn(
            "absolute left-4 top-0.5 h-1.5 w-1.5 rounded-full",
            STATUS_COLORS[status],
          )}
        />
      )}
    >
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

        <AppMenuSeparator />
        <AppMenuItem icon={FolderOpen} onSelect={onOpen}>
          {t("toolbar.openFile")}
        </AppMenuItem>
        <AppMenuItem
          icon={Save}
          disabled={isSaving}
          testId="storage-save"
          shortcut={formatShortcut("Mod+S")}
          onSelect={() => executeAppAction("storage.save", undefined, { t })}
        >
          {t("toolbar.saveDocument")}
        </AppMenuItem>
        <AppMenuItem
          icon={SaveAll}
          disabled={isSaving}
          shortcut={formatShortcut("Mod+Shift+S")}
          onSelect={() => executeAppAction("storage.saveAs", undefined, { t })}
        >
          {t("toolbar.saveDocumentAs")}
        </AppMenuItem>

        <AppMenuSeparator />
        <AppMenuItem
          checked={autoSaveEnabled}
          closeOnSelect={false}
          onSelect={() => documentStorageController.setAutoSaveEnabled(
            !autoSaveEnabled,
          )}
        >
          {t("toolbar.autoSave")}
        </AppMenuItem>
    </AppMenu>
  );
}
