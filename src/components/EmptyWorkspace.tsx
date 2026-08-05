import { FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { openDocumentFromProvider } from "@/workspace/open-document";

export function EmptyWorkspace() {
  const { t } = useTranslation();

  return (
    <main
      className="flex min-h-0 flex-1 items-center justify-center bg-background"
      data-testid="empty-workspace"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="text-3xl font-semibold tracking-normal text-foreground/20">
          CoTab
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {t("workspace.noDocument")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("workspace.openPrompt")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void openDocumentFromProvider(t)}
        >
          <FolderOpen className="h-4 w-4" />
          {t("toolbar.openFile")}
        </Button>
      </div>
    </main>
  );
}
