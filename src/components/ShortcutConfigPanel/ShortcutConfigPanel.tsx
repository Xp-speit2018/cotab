import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useShortcutStore, SHORTCUT_CATEGORY_ORDER } from "@/shortcuts";
import type { ShortcutCategory as ShortcutCategoryType } from "@/shortcuts";
import { ShortcutCategory } from "./ShortcutCategory";
import { PercussionDigitMapping } from "./PercussionDigitMapping";

export function ShortcutConfigPanel() {
  const { t } = useTranslation();
  const isOpen = useShortcutStore((s) => s.isConfigPanelOpen);
  const setOpen = useShortcutStore((s) => s.setConfigPanelOpen);
  const bindings = useShortcutStore((s) => s.bindings);
  const resetAll = useShortcutStore((s) => s.resetAll);
  const [search, setSearch] = useState("");

  const grouped = useMemo(() => {
    const visible = bindings.filter((b) => !b.hidden);
    const lower = search.toLowerCase();
    const filtered = lower
      ? visible.filter((b) => {
          const name = t(`${b.i18nKey}.name`).toLowerCase();
          return name.includes(lower) || b.keys.includes(lower) || b.actionId.includes(lower);
        })
      : visible;

    const groups = new Map<ShortcutCategoryType, typeof filtered>();
    for (const cat of SHORTCUT_CATEGORY_ORDER) {
      const items = filtered.filter((b) => b.category === cat);
      if (items.length > 0) {
        groups.set(cat, items);
      }
    }
    return groups;
  }, [bindings, search, t]);

  const hasModified = bindings.some((b) => b.keys !== b.defaultKeys);

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("shortcuts.title")}</DialogTitle>
          <DialogDescription>{t("shortcuts.description")}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("shortcuts.searchPlaceholder")}
            className="pl-9"
          />
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6 overflow-y-auto max-h-[50vh]">
          <div className="space-y-0.5">
            {Array.from(grouped.entries()).map(([category, items]) => (
              <ShortcutCategory
                key={category}
                category={category}
                bindings={items}
              />
            ))}
            {grouped.size === 0 && !search && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("shortcuts.noResults")}
              </p>
            )}
            {!search && <PercussionDigitMapping />}
            {grouped.size === 0 && search && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("shortcuts.noResults")}
              </p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          {hasModified && (
            <Button variant="outline" size="sm" onClick={resetAll}>
              <RotateCcw />
              {t("shortcuts.resetAll")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
