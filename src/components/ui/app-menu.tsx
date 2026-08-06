import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { Check, type LucideIcon } from "lucide-react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const menuContentClassName =
  "z-50 w-72 rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none";
const menuItemClassName =
  "relative flex h-8 w-full cursor-default select-none items-center gap-2 rounded px-2 text-xs font-normal outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground";

export function AppMenuBar({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      data-app-menu-bar
      className="flex shrink-0 items-center gap-0.5"
    >
      {children}
    </nav>
  );
}

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
  return (
    <DropdownMenuPrimitive.Root modal={false}>
      <DropdownMenuPrimitive.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="relative h-8 gap-1 rounded px-2 text-xs font-normal transition-none data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
          aria-label={ariaLabel ?? label}
          title={title}
          data-testid={testId}
          data-app-menu-trigger
        >
          {Icon && <Icon className={cn("h-3.5 w-3.5", iconClassName)} />}
          <span>{label}</span>
          {indicator}
        </Button>
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className={cn(menuContentClassName, contentClassName)}
          data-app-menu-content
        >
          {children}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}

interface AppMenuItemProps {
  children: ReactNode;
  icon?: LucideIcon;
  shortcut?: string;
  disabled?: boolean;
  closeOnSelect?: boolean;
  testId?: string;
  onSelect?: () => unknown | Promise<unknown>;
}

export function AppMenuItem({
  children,
  icon: Icon,
  shortcut,
  disabled,
  closeOnSelect = true,
  testId,
  onSelect,
}: AppMenuItemProps) {
  const content = (
    <>
      {Icon ? (
        <Icon className="h-4 w-4 shrink-0" />
      ) : (
        <span className="h-4 w-4 shrink-0" />
      )}
      <span className="min-w-0 truncate">{children}</span>
      {shortcut && (
        <span
          data-app-menu-shortcut
          className="ml-auto text-[10px] text-muted-foreground"
        >
          {shortcut}
        </span>
      )}
    </>
  );
  const handleSelect = (event: Event) => {
    if (!closeOnSelect) event.preventDefault();
    void onSelect?.();
  };

  return (
    <DropdownMenuPrimitive.Item
      disabled={disabled}
      className={menuItemClassName}
      data-testid={testId}
      data-app-menu-item
      onSelect={handleSelect}
    >
      {content}
    </DropdownMenuPrimitive.Item>
  );
}

interface AppMenuButtonProps extends ComponentPropsWithoutRef<"button"> {
  icon?: LucideIcon;
}

export const AppMenuButton = forwardRef<HTMLButtonElement, AppMenuButtonProps>(function AppMenuButton({
  children,
  icon: Icon,
  className,
  ...props
}, ref) {
  return (
    <button
      ref={ref}
      type="button"
      role="menuitem"
      data-app-menu-item
      className={cn(menuItemClassName, className)}
      {...props}
    >
      {Icon ? (
        <Icon className="h-4 w-4 shrink-0" />
      ) : (
        <span className="h-4 w-4 shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
    </button>
  );
});

export function AppMenuGroup({
  label,
  children,
}: {
  label?: ReactNode;
  children: ReactNode;
}) {
  return (
    <DropdownMenuPrimitive.Group data-app-menu-group>
      {label && <AppMenuLabel>{label}</AppMenuLabel>}
      {children}
    </DropdownMenuPrimitive.Group>
  );
}

export function AppMenuCheckboxItem({
  children,
  checked,
  disabled,
  closeOnSelect = true,
  onSelect,
}: {
  children: ReactNode;
  checked: boolean;
  disabled?: boolean;
  closeOnSelect?: boolean;
  onSelect?: () => unknown | Promise<unknown>;
}) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      checked={checked}
      disabled={disabled}
      className={menuItemClassName}
      data-app-menu-item
      onSelect={(event) => {
        if (!closeOnSelect) event.preventDefault();
        void onSelect?.();
      }}
    >
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="h-3.5 w-3.5" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

export function AppMenuRadioGroup({
  value,
  onValueChange,
  children,
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      value={value}
      onValueChange={onValueChange}
      data-app-menu-radio-group
    >
      {children}
    </DropdownMenuPrimitive.RadioGroup>
  );
}

export function AppMenuRadioItem({
  value,
  children,
  disabled,
}: {
  value: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.RadioItem
      value={value}
      disabled={disabled}
      className={menuItemClassName}
      data-app-menu-item
    >
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="h-3.5 w-3.5" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </DropdownMenuPrimitive.RadioItem>
  );
}

export function AppMenuPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-app-menu-panel
      className={cn("px-2 py-2", className)}
    >
      {children}
    </div>
  );
}

export function AppMenuControl({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-app-menu-control
      className={cn("px-2 py-2", className)}
    >
      {children}
    </div>
  );
}

export function AppMenuSeparator() {
  return (
    <DropdownMenuPrimitive.Separator
      data-app-menu-separator
      className="my-1 border-t"
    />
  );
}

interface AppMenuLinkProps {
  href: string;
  children: ReactNode;
  icon?: LucideIcon;
}

export function AppMenuLink({ href, children, icon: Icon }: AppMenuLinkProps) {
  return (
    <DropdownMenuPrimitive.Item asChild>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        data-interaction="link"
        data-app-menu-item
        className={cn(menuItemClassName, "cursor-pointer")}
      >
        {Icon ? <Icon className="h-4 w-4 shrink-0" /> : <span className="h-4 w-4 shrink-0" />}
        <span className="min-w-0 truncate">{children}</span>
      </a>
    </DropdownMenuPrimitive.Item>
  );
}

export function AppMenuLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownMenuPrimitive.Label
      data-app-menu-label
      className="flex h-6 items-center px-2 text-[10px] font-semibold uppercase text-muted-foreground"
    >
      {children}
    </DropdownMenuPrimitive.Label>
  );
}
