import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronUp,
  ChevronDown,
  HelpCircle,
  GripVertical,
  Pencil,
} from "lucide-react";
import {
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
      <CollapsibleTrigger className="flex flex-1 items-center justify-between py-1.5 pr-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent/50">
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
  } = useSortable({ id });

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
 * A single toggle button with icon + tooltip.
 *
 * NOTE: We apply active styling via the `pressed` prop directly instead of
 * using Radix Toggle's `data-[state=on]` CSS selectors because wrapping
 * the Toggle inside `<TooltipTrigger asChild>` causes the tooltip's
 * `data-state` (open/closed) to override the toggle's `data-state` (on/off).
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
        <Toggle
          size="sm"
          pressed={pressed}
          onPressedChange={onPressedChange}
          className={cn(
            "h-7 w-7 p-0",
            pressed && "bg-primary/15 text-primary ring-1 ring-primary/30",
            className,
          )}
          aria-label={label}
        >
          {icon ?? (
            <span className="text-[10px] font-bold leading-none">
              {textIcon}
            </span>
          )}
        </Toggle>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
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

  const cancel = useCallback(() => {
    setEditing(false);
    setDraft(value);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    },
    [commit, cancel],
  );

  return (
    <div
      className="group flex items-center gap-2 px-3 py-0.5 cursor-text"
      onClick={() => {
        if (!editing) setEditing(true);
      }}
    >
      {icon && (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
          {icon}
        </span>
      )}
      <span className="text-[11px] text-muted-foreground whitespace-nowrap">{label}</span>
      {editing ? (
        <input
          ref={inputRef}
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
        <span
          className={cn(
            "ml-auto text-[11px] font-medium tabular-nums truncate",
            !value && placeholder && "text-muted-foreground/50 italic",
            "group-hover:text-primary transition-colors",
          )}
        >
          {value || placeholder}
          <Pencil className="ml-1 inline-block h-2.5 w-2.5 opacity-0 group-hover:opacity-50 transition-opacity" />
        </span>
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

  const cancel = useCallback(() => {
    setEditing(false);
    setDraft(String(value));
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    },
    [commit, cancel],
  );

  return (
    <div
      className="group flex items-center gap-2 px-3 py-0.5 cursor-text"
      onClick={() => {
        if (!editing) setEditing(true);
      }}
    >
      {icon && (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
          {icon}
        </span>
      )}
      <span className="text-[11px] text-muted-foreground whitespace-nowrap">{label}</span>
      {editing ? (
        <input
          ref={inputRef}
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
        <span className="ml-auto text-[11px] font-medium tabular-nums group-hover:text-primary transition-colors">
          {value > 0 ? `${value}${suffix ? ` ${suffix}` : ""}` : ""}
          <Pencil className="ml-1 inline-block h-2.5 w-2.5 opacity-0 group-hover:opacity-50 transition-opacity" />
        </span>
      )}
    </div>
  );
}
