import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ExternalLink,
  GalleryHorizontal,
  Keyboard,
  Redo2,
  Rows3,
  Undo2,
} from "lucide-react";

import { executeAppAction } from "@/app-actions";
import { ScoreLayoutToolbarControls } from "@/components/ScoreLayoutControls";
import {
  AppMenu,
  AppMenuItem,
  AppMenuLabel,
  AppMenuLink,
  AppMenuSeparator,
} from "@/components/ui/app-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import { formatShortcut, useShortcutStore } from "@/shortcuts";
import { useEditorStore } from "@/stores/editor-store";
import { usePlayerStore } from "@/stores/render-store";

export function EditMenu() {
  const { t } = useTranslation();
  const canUndo = useEditorStore((state) => state.canUndo);
  const canRedo = useEditorStore((state) => state.canRedo);

  return (
    <AppMenu label={t("toolbar.editMenu")} testId="edit-menu">
      <AppMenuItem
        icon={Undo2}
        shortcut={formatShortcut("Mod+Z")}
        disabled={!canUndo}
        onSelect={() => executeAppAction("document.undo", {}, { t })}
      >
        {t("toolbar.undo")}
      </AppMenuItem>
      <AppMenuItem
        icon={Redo2}
        shortcut={formatShortcut("Mod+Shift+Z")}
        disabled={!canRedo}
        onSelect={() => executeAppAction("document.redo", {}, { t })}
      >
        {t("toolbar.redo")}
      </AppMenuItem>
    </AppMenu>
  );
}

export function LayoutMenu() {
  const { t } = useTranslation();
  const scoreLayout = usePlayerStore((state) => state.scoreLayout);
  const zoom = usePlayerStore((state) => state.zoom);

  return (
    <AppMenu
      label={t("toolbar.layoutMenu")}
      testId="layout-menu"
      contentClassName="w-72"
    >
      <AppMenuItem
        checked={scoreLayout === "horizontal"}
        onSelect={() => executeAppAction(
          "view.setScoreLayout",
          { layout: "horizontal" },
          { t },
        )}
      >
        <span className="flex items-center gap-2">
          <GalleryHorizontal className="h-3.5 w-3.5" />
          {t("toolbar.horizontalLayout")}
        </span>
      </AppMenuItem>
      <AppMenuItem
        checked={scoreLayout === "parchment"}
        onSelect={() => executeAppAction(
          "view.setScoreLayout",
          { layout: "parchment" },
          { t },
        )}
      >
        <span className="flex items-center gap-2">
          <Rows3 className="h-3.5 w-3.5" />
          {t("toolbar.parchmentLayout")}
        </span>
      </AppMenuItem>

      <AppMenuSeparator />
      <ScoreLayoutToolbarControls variant="menu" />

      <AppMenuSeparator />
      <div className="space-y-2 px-2 py-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{t("toolbar.zoom")}</span>
          <span className="font-mono tabular-nums">{Math.round(zoom * 100)}%</span>
        </div>
        <Slider
          aria-label={t("toolbar.zoom")}
          min={25}
          max={200}
          step={5}
          value={[Math.round(zoom * 100)]}
          onKeyDown={(event) => event.stopPropagation()}
          onValueChange={([value]) =>
            usePlayerStore.getState().setZoom(value / 100)}
        />
      </div>
    </AppMenu>
  );
}

export function PreferencesMenu() {
  const { t, i18n } = useTranslation();

  return (
    <AppMenu
      label={t("toolbar.preferencesMenu")}
      testId="preferences-menu"
    >
      <AppMenuItem
        icon={Keyboard}
        onSelect={() => useShortcutStore.getState().setConfigPanelOpen(true)}
      >
        {t("shortcuts.title")}
      </AppMenuItem>
      <AppMenuSeparator />
      <AppMenuLabel>{t("toolbar.language")}</AppMenuLabel>
      {Object.entries(SUPPORTED_LANGUAGES).map(([code, label]) => (
        <AppMenuItem
          key={code}
          checked={i18n.language === code}
          onSelect={() => i18n.changeLanguage(code)}
        >
          {label}
        </AppMenuItem>
      ))}
    </AppMenu>
  );
}

export function HelpMenu() {
  const { t } = useTranslation();
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <>
      <AppMenu label={t("toolbar.helpMenu")} testId="help-menu">
        <AppMenuItem onSelect={() => setAboutOpen(true)}>
          {t("toolbar.aboutCoTab")}
        </AppMenuItem>
        <AppMenuLink
          href="https://github.com/Xp-speit2018/cotab"
          icon={ExternalLink}
        >
          {t("toolbar.projectHome")}
        </AppMenuLink>
      </AppMenu>

      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>CoTab</DialogTitle>
            <DialogDescription>
              {t("toolbar.aboutDescription")}
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">AGPL-3.0</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
