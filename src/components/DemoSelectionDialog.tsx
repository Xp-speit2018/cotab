import { BookOpen, Music2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEMO_DOCUMENTS,
  finishDemoSelection,
  useDemoSelection,
} from "@/storage/demo-selection";

export function DemoSelectionDialog() {
  const { t } = useTranslation();
  const request = useDemoSelection((state) => state.request);

  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) finishDemoSelection(null);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {t("storage.demo.title")}
          </DialogTitle>
          <DialogDescription>
            {t("storage.demo.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          {DEMO_DOCUMENTS.map((demo) => (
            <Button
              key={demo.id}
              variant="ghost"
              className="h-auto w-full justify-start gap-3 px-3 py-2.5"
              onClick={() => finishDemoSelection(demo)}
            >
              <Music2 className="h-4 w-4" />
              <span className="min-w-0 text-left">
                <span className="block text-sm font-medium">{demo.name}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {demo.description}
                </span>
              </span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
