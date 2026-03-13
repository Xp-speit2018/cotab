import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShortcutBinding, ShortcutCategory as ShortcutCategoryType } from "@/shortcuts";
import { ShortcutRow } from "./ShortcutRow";

interface Props {
  category: ShortcutCategoryType;
  bindings: ShortcutBinding[];
}

export function ShortcutCategory({ category, bindings }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  if (bindings.length === 0) return null;

  return (
    <div className="border-b border-border/50 last:border-b-0">
      <button
        className="flex w-full items-center gap-2 py-2 px-1 text-sm font-medium text-foreground hover:bg-accent/30 rounded-md"
        onClick={() => setOpen(!open)}
      >
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            !open && "-rotate-90",
          )}
        />
        {t(`shortcuts.category.${category}`)}
        <span className="text-xs text-muted-foreground ml-auto">{bindings.length}</span>
      </button>
      {open && (
        <div className="pl-2 pb-1">
          {bindings.map((b) => (
            <ShortcutRow key={b.id} binding={b} />
          ))}
        </div>
      )}
    </div>
  );
}
