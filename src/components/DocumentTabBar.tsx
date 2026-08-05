import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  activateDocumentSession,
  closeDocumentSession,
  useDocumentWorkspaceStore,
} from "@/workspace/document-workspace";
import { openBlankDocument } from "@/workspace/open-document";

export function DocumentTabBar() {
  const { t } = useTranslation();
  const tabs = useDocumentWorkspaceStore((state) => state.tabs);
  const activeTabId = useDocumentWorkspaceStore((state) => state.activeTabId);

  const closeTab = (id: string, status: (typeof tabs)[number]["storageStatus"]) => {
    if (
      (status === "dirty" || status === "conflict" || status === "error")
      && !window.confirm(t("workspace.closeUnsaved"))
    ) {
      return;
    }
    closeDocumentSession(id);
  };

  return (
    <div
      className="flex h-8 min-w-0 items-stretch border-b bg-muted/25"
      data-testid="document-tab-bar"
      role="tablist"
      aria-label={t("workspace.documents")}
    >
      <div className="flex min-w-0 flex-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          const unsaved = tab.storageStatus === "dirty"
            || tab.storageStatus === "conflict"
            || tab.storageStatus === "error";
          return (
            <div
              key={tab.id}
              className={cn(
                "group relative flex min-w-32 max-w-60 items-center border-r px-3 text-sm",
                active
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
              role="tab"
              aria-selected={active}
              data-testid={`document-tab-${tab.id}`}
            >
              {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left"
                onClick={() => activateDocumentSession(tab.id)}
                title={tab.title || t("workspace.untitled")}
              >
                {tab.title || t("workspace.untitled")}
              </button>
              <span className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center">
                {unsaved && (
                  <span
                    className="h-2 w-2 rounded-full bg-amber-500 group-hover:hidden"
                    aria-label={t("storage.status.dirty")}
                  />
                )}
                <button
                  type="button"
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-sm opacity-0 hover:bg-muted",
                    "group-hover:opacity-100 focus:opacity-100",
                    !unsaved && "text-muted-foreground opacity-100",
                  )}
                  onClick={() => closeTab(tab.id, tab.storageStatus)}
                  aria-label={t("workspace.closeDocument", {
                    title: tab.title || t("workspace.untitled"),
                  })}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
              {tab.connected && (
                <span
                  className="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                  title={tab.roomCode ?? t("workspace.collaborating")}
                />
              )}
            </div>
          );
        })}
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-none border-r"
            onClick={openBlankDocument}
            aria-label={t("workspace.newBlankFile")}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("workspace.newBlankFile")}</TooltipContent>
      </Tooltip>
    </div>
  );
}
