import { Cloud, HardDrive } from "lucide-react";
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

function ProviderIcon({ providerId }: { providerId: string }) {
  return providerId === "local-disk"
    ? <HardDrive className="h-4 w-4" />
    : <Cloud className="h-4 w-4" />;
}

export function StorageProviderDialog() {
  const { t } = useTranslation();
  const request = useStorageProviderSelection((state) => state.request);
  const providers = documentStorageController.getAvailableProviders();

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
          {providers.map((provider) => (
            <Button
              key={provider.id}
              variant="ghost"
              className="h-auto w-full justify-start gap-3 px-3 py-2.5"
              onClick={() => finishStorageProviderSelection(provider.id)}
            >
              <ProviderIcon providerId={provider.id} />
              <span className="min-w-0 text-left">
                <span className="block text-sm font-medium">{provider.name}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {t(`storage.provider.${provider.id}.description`, {
                    defaultValue: provider.id,
                  })}
                </span>
              </span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
