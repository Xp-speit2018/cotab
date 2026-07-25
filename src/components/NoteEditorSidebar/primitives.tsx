import * as React from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronRight,
  ChevronUp,
  ChevronDown,
  HelpCircle,
  GripVertical,
  Pencil,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  PresetCombobox,
  type PresetOption,
} from "./PresetCombobox";

interface InspectorDisclosureRowProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  open?: boolean;
  disabled?: boolean;
  className?: string;
}

export const InspectorDisclosureRow = React.forwardRef<
  HTMLButtonElement,
  InspectorDisclosureRowProps & Omit<React.ComponentPropsWithoutRef<"button">, "value">
>(function InspectorDisclosureRow(
  {
    label,
    value,
    icon,
    open = false,
    disabled = false,
    className,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      data-interaction="disclosure"
      disabled={disabled}
      aria-expanded={open}
      className={cn(
        "group flex min-h-7 w-full cursor-default items-center gap-2 px-3 py-0.5 text-left transition-colors hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-50",
        open && "bg-accent/30",
        className,
      )}
      {...props}
    >
      {icon && (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
          {icon}
        </span>
      )}
      <span className="whitespace-nowrap text-[11px] text-muted-foreground">
        {label}
      </span>
      <span className="ml-auto min-w-0 truncate text-[11px] font-medium tabular-nums group-hover:text-primary">
        {value}
      </span>
      <ChevronRight
        className={cn(
          "h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform",
          open && "rotate-90",
        )}
      />
    </button>
  );
});

export function PopoverPropRow({
  label,
  value,
  icon,
  title = label,
  description,
  children,
  open,
  onOpenChange,
  contentClassName,
}: InspectorDisclosureRowProps & {
  title?: string;
  description?: string;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  contentClassName?: string;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const resolvedOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  return (
    <Popover open={resolvedOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <InspectorDisclosureRow
          label={label}
          value={value}
          icon={icon}
          open={resolvedOpen}
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="right"
        collisionPadding={12}
        className={cn("w-72 p-3", contentClassName)}
      >
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
          {description && (
            <PopoverDescription>{description}</PopoverDescription>
          )}
        </PopoverHeader>
        <div className="mt-3">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

export function DialogPropRow({
  label,
  value,
  icon,
  title = label,
  description,
  children,
  open,
  onOpenChange,
  contentClassName,
}: InspectorDisclosureRowProps & {
  title?: string;
  description?: string;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  contentClassName?: string;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const resolvedOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  return (
    <Dialog open={resolvedOpen} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <InspectorDisclosureRow
          label={label}
          value={value}
          icon={icon}
          open={resolvedOpen}
        />
      </DialogTrigger>
      <DialogContent className={cn("sm:max-w-xl", contentClassName)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function SectionHeader({
  title,
  helpText,
  isOpen,
  dragHandleProps,
}: {
  title: string;
  helpText: string;
  isOpen: boolean;
  dragHandleProps?: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  return (
    <div className="group flex w-full items-center">
      {/* Drag handle — visible on hover */}
      <button
        type="button"
        className="flex h-6 w-4 shrink-0 cursor-grab items-center justify-center opacity-0 transition-opacity group-hover:opacity-60 active:cursor-grabbing"
        aria-label={t("sidebar.reorderSection")}
        {...dragHandleProps}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </button>
      <CollapsibleTrigger
        data-interaction="disclosure"
        className="flex flex-1 cursor-default items-center justify-between py-1.5 pr-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent/50"
      >
        <span className="flex items-center gap-1">
          {title}
        </span>
        {isOpen ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </CollapsibleTrigger>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 hover:text-muted-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px]">
          {helpText}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

/**
 * Sortable wrapper for sidebar sections. Provides drag transform styles on the
 * outer div and passes drag-handle listeners into the children render prop.
 */
export function SortableSection({
  id,
  children,
}: {
  id: string;
  children: (dragHandleProps: Record<string, unknown>) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `section:${id}`,
    data: { type: "section", sectionId: id },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

/**
 * An immediate command represented by an icon. Commands use the default
 * desktop cursor; links are the only interaction that uses a pointer cursor.
 */
export function IconCommand({
  label,
  onClick,
  icon,
  disabled = false,
  className,
}: {
  label: string;
  onClick?: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-interaction="command"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className={cn(
            "inline-flex h-7 w-7 cursor-default items-center justify-center text-muted-foreground/70 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * A single toggle button with icon + tooltip.
 *
 * TooltipTrigger owns `data-state`, so this uses an explicitly controlled
 * button instead of relying on Radix Toggle's conflicting state attribute.
 */
export function ToggleBtn({
  label,
  pressed,
  onPressedChange,
  icon,
  textIcon,
  className,
}: {
  label: string;
  pressed: boolean;
  onPressedChange?: (pressed: boolean) => void;
  icon?: React.ReactNode;
  textIcon?: string;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-interaction="toggle"
          onClick={() => onPressedChange?.(!pressed)}
          disabled={!onPressedChange}
          aria-pressed={pressed}
          className={cn(
            "inline-flex h-7 w-7 cursor-default items-center justify-center p-0 text-muted-foreground/70 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 [&>*]:transition-transform [&>*]:duration-150",
            pressed
              ? "text-blue-700 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-300 [&>*]:scale-110 hover:[&>*]:scale-110"
              : "hover:[&>*]:scale-105",
            className,
          )}
          aria-label={label}
        >
          {icon ?? (
            <span className="text-[10px] font-bold leading-none">
              {textIcon}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>{label}</TooltipContent>
    </Tooltip>
  );
}

export function PropRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-0.5">
      {icon && (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
          {icon}
        </span>
      )}
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="ml-auto text-[11px] font-medium tabular-nums">{value}</span>
    </div>
  );
}

export function SelectPropRow({
  label,
  value,
  options,
  icon,
  onValueChange,
}: {
  label: string;
  value: number;
  options: readonly PresetOption<number>[];
  icon?: React.ReactNode;
  onValueChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-0.5">
      {icon && (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
          {icon}
        </span>
      )}
      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
        {label}
      </span>
      <PresetCombobox
        value={value}
        options={options}
        ariaLabel={label}
        onValueChange={onValueChange}
        triggerClassName="ml-auto h-6 min-w-24 max-w-36 border-0 px-1.5 text-[11px] shadow-none"
      />
    </div>
  );
}

export function EditablePropRow({
  label,
  value,
  placeholder,
  icon,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  icon?: React.ReactNode;
  onCommit: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== value) onCommit(trimmed);
  }, [draft, value, onCommit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        commit();
      }
    },
    [commit],
  );

  return (
    <div
      data-interaction="inline-edit"
      className="group flex items-center gap-2 px-3 py-0.5 transition-colors hover:bg-accent/40"
      onMouseDown={(event) => {
        if (!editing) return;
        const target = event.target;
        if (target instanceof Element
          && target.closest("[data-single-line-edit-field]")) return;
        event.preventDefault();
        commit();
      }}
    >
      {icon && (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
          {icon}
        </span>
      )}
      <span className="cursor-default whitespace-nowrap text-[11px] text-muted-foreground">
        {label}
      </span>
      {editing ? (
        <input
          ref={inputRef}
          data-single-line-edit-field
          aria-label={label}
          className="ml-auto w-0 min-w-0 flex-1 bg-transparent text-right text-[11px] font-medium outline-none border-b border-primary/40 py-0 px-0"
          value={draft}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <button
          type="button"
          data-single-line-edit-field
          aria-label={label}
          className={cn(
            "ml-auto flex w-0 min-w-0 flex-1 cursor-text items-center justify-end border-b border-transparent text-[11px] font-medium tabular-nums transition-colors group-hover:border-border group-hover:text-primary",
            !value && placeholder && "text-muted-foreground/50 italic",
          )}
          onClick={() => setEditing(true)}
        >
          <span className="truncate">{value || placeholder}</span>
          <Pencil className="ml-1 h-2.5 w-2.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-50" />
        </button>
      )}
    </div>
  );
}

export function EditableNumberPropRow({
  label,
  value,
  suffix,
  icon,
  min,
  max,
  onCommit,
}: {
  label: string;
  value: number;
  suffix?: string;
  icon?: React.ReactNode;
  min?: number;
  max?: number;
  onCommit: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    const parsed = parseInt(draft, 10);
    if (isNaN(parsed)) return;
    const clamped = Math.max(min ?? 1, Math.min(max ?? 999, parsed));
    if (clamped !== value) onCommit(clamped);
  }, [draft, value, onCommit, min, max]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        commit();
      }
    },
    [commit],
  );

  return (
    <div
      data-interaction="inline-edit"
      className="group flex items-center gap-2 px-3 py-0.5 transition-colors hover:bg-accent/40"
      onMouseDown={(event) => {
        if (!editing) return;
        const target = event.target;
        if (target instanceof Element
          && target.closest("[data-single-line-edit-field]")) return;
        event.preventDefault();
        commit();
      }}
    >
      {icon && (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
          {icon}
        </span>
      )}
      <span className="cursor-default whitespace-nowrap text-[11px] text-muted-foreground">
        {label}
      </span>
      {editing ? (
        <input
          ref={inputRef}
          data-single-line-edit-field
          aria-label={label}
          type="number"
          className="ml-auto w-16 bg-transparent text-right text-[11px] font-medium outline-none border-b border-primary/40 py-0 px-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          value={draft}
          min={min}
          max={max}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <button
          type="button"
          data-single-line-edit-field
          aria-label={label}
          className="ml-auto inline-flex min-w-16 cursor-text items-center justify-end border-b border-transparent text-[11px] font-medium tabular-nums transition-colors group-hover:border-border group-hover:text-primary"
          onClick={() => setEditing(true)}
        >
          <span>{`${value}${suffix ? ` ${suffix}` : ""}`}</span>
          <Pencil className="ml-1 h-2.5 w-2.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-50" />
        </button>
      )}
    </div>
  );
}
