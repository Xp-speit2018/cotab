import { BookOpen, Cloud, FilePlus2, HardDrive } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { documentStorageController } from "@/storage/document-storage-runtime";
import {
  finishStorageProviderSelection,
  useStorageProviderSelection,
} from "@/storage/provider-selection";
import { useEditorStore } from "@/stores/editor-store";

function ProviderIcon({ providerId }: { providerId: string }) {
  return providerId === "local-disk" || providerId === "local-file"
    ? <HardDrive className="h-4 w-4" />
    : <Cloud className="h-4 w-4" />;
}

export function StorageProviderDialog() {
  const { t } = useTranslation();
  const request = useStorageProviderSelection((state) => state.request);
  const availableProviderIds = useEditorStore(
    (state) => state.storage.availableProviderIds,
  );
  const providers = documentStorageController
    .getAvailableProviders()
    .filter((provider) => availableProviderIds.includes(provider.id));

  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) finishStorageProviderSelection(null);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {request?.operation === "open"
              ? t("storage.provider.chooseOpen")
              : t("storage.provider.chooseSave")}
          </DialogTitle>
          <DialogDescription>
            {t("storage.provider.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          {request?.operation === "open" && (
            <Button
              variant="ghost"
              className="h-auto w-full justify-start gap-3 px-3 py-2.5"
              onClick={() => finishStorageProviderSelection("blank-file")}
            >
              <FilePlus2 className="h-4 w-4" />
              <span className="min-w-0 text-left">
                <span className="block text-sm font-medium">
                  {t("storage.provider.blank-file.name")}
                </span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {t("storage.provider.blank-file.description")}
                </span>
              </span>
            </Button>
          )}
          {providers.map((provider) => (
            <Button
              key={provider.id}
              variant="ghost"
              className="h-auto w-full justify-start gap-3 px-3 py-2.5"
              onClick={() => finishStorageProviderSelection(provider.id)}
            >
              <ProviderIcon providerId={provider.id} />
              <span className="min-w-0 text-left">
                <span className="block text-sm font-medium">
                  {t(`storage.provider.${provider.id}.name`, {
                    defaultValue: provider.name,
                  })}
                </span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {t(`storage.provider.${provider.id}.description`, {
                    defaultValue: provider.id,
                  })}
                </span>
              </span>
            </Button>
          ))}
          {request?.operation === "open" && (
            <Button
              variant="ghost"
              className="h-auto w-full justify-start gap-3 px-3 py-2.5"
              onClick={() => finishStorageProviderSelection("demo-library")}
            >
              <BookOpen className="h-4 w-4" />
              <span className="min-w-0 text-left">
                <span className="block text-sm font-medium">
                  {t("storage.provider.demo-library.name")}
                </span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {t("storage.provider.demo-library.description")}
                </span>
              </span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
