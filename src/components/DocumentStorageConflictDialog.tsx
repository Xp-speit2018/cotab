import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, GitMerge, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  documentStorageController,
} from "@/storage/document-storage-runtime";
import { useEditorStore } from "@/stores/editor-store";

type ConflictOperation = "merge" | "copy" | "overwrite";

export function DocumentStorageConflictDialog() {
  const { t } = useTranslation();
  const status = useEditorStore((state) => state.storage.status);
  const binding = useEditorStore((state) => state.storage.binding);
  const [operation, setOperation] = useState<ConflictOperation | null>(null);
  const open = status === "conflict";

  const run = async (
    nextOperation: ConflictOperation,
    operationFn: () => Promise<boolean>,
  ) => {
    setOperation(nextOperation);
    try {
      await operationFn();
    } finally {
      setOperation(null);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("storage.conflict.title")}</DialogTitle>
          <DialogDescription>
            {t("storage.conflict.description", {
              name: binding?.displayName ?? t("storage.document"),
            })}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("storage.conflict.localBinding")}
        </p>
        <DialogFooter className="sm:flex-wrap">
          <Button
            variant="outline"
            disabled={operation !== null}
            onClick={() =>
              void run("copy", () =>
                documentStorageController.saveConflictCopy(),
              )
            }
          >
            {operation === "copy" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Copy />
            )}
            {t("storage.conflict.saveCopy")}
          </Button>
          <Button
            variant="destructive"
            disabled={operation !== null}
            onClick={() =>
              void run("overwrite", () =>
                documentStorageController.overwriteConflict(),
              )
            }
          >
            {operation === "overwrite" && <Loader2 className="animate-spin" />}
            {t("storage.conflict.overwrite")}
          </Button>
          <Button
            disabled={operation !== null}
            onClick={() =>
              void run("merge", () =>
                documentStorageController.mergeConflict(),
              )
            }
          >
            {operation === "merge" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <GitMerge />
            )}
            {t("storage.conflict.merge")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
