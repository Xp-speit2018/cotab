import { createContext, useContext, useState, type ReactNode } from "react";
import { Check, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const AppMenuCloseContext = createContext<() => void>(() => {});

interface AppMenuProps {
  label: string;
  ariaLabel?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  indicator?: ReactNode;
  title?: string;
  testId?: string;
  contentClassName?: string;
  children: ReactNode;
}

export function AppMenu({
  label,
  ariaLabel,
  icon: Icon,
  iconClassName,
  indicator,
  title,
  testId,
  contentClassName,
  children,
}: AppMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="relative h-8 gap-1 px-1.5 text-xs font-normal"
          aria-label={ariaLabel ?? label}
          title={title}
          data-testid={testId}
        >
          {Icon && <Icon className={cn("h-3.5 w-3.5", iconClassName)} />}
          <span>{label}</span>
          {indicator}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("w-64 p-1.5", contentClassName)}
        role="menu"
      >
        <AppMenuCloseContext.Provider value={() => setOpen(false)}>
          {children}
        </AppMenuCloseContext.Provider>
      </PopoverContent>
    </Popover>
  );
}

interface AppMenuItemProps {
  children: ReactNode;
  icon?: LucideIcon;
  shortcut?: string;
  checked?: boolean;
  disabled?: boolean;
  closeOnSelect?: boolean;
  testId?: string;
  onSelect?: () => unknown | Promise<unknown>;
}

export function AppMenuItem({
  children,
  icon: Icon,
  shortcut,
  checked,
  disabled,
  closeOnSelect = true,
  testId,
  onSelect,
}: AppMenuItemProps) {
  const close = useContext(AppMenuCloseContext);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      role={checked === undefined ? "menuitem" : "menuitemcheckbox"}
      aria-checked={checked}
      className="w-full justify-start font-normal"
      disabled={disabled}
      data-testid={testId}
      onClick={() => {
        if (closeOnSelect) close();
        void onSelect?.();
      }}
    >
      {checked !== undefined ? (
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center">
          {checked && <Check className="h-3.5 w-3.5" />}
        </span>
      ) : Icon ? (
        <Icon className="h-3.5 w-3.5" />
      ) : (
        <span className="h-3.5 w-3.5" />
      )}
      <span className="min-w-0 truncate">{children}</span>
      {shortcut && (
        <span className="ml-auto text-[10px] text-muted-foreground">
          {shortcut}
        </span>
      )}
    </Button>
  );
}

export function AppMenuSeparator() {
  return <div className="my-1 border-t" role="separator" />;
}

interface AppMenuLinkProps {
  href: string;
  children: ReactNode;
  icon?: LucideIcon;
}

export function AppMenuLink({ href, children, icon: Icon }: AppMenuLinkProps) {
  const close = useContext(AppMenuCloseContext);

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      role="menuitem"
      data-interaction="link"
      className="flex h-8 w-full cursor-pointer items-center gap-1.5 rounded-md px-3 text-sm hover:bg-accent hover:text-accent-foreground"
      onClick={close}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5" />}
      <span className="min-w-0 truncate">{children}</span>
    </a>
  );
}

export function AppMenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
      {children}
    </div>
  );
}
