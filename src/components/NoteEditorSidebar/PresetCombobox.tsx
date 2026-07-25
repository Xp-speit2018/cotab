import { useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type PresetValue = string | number | null;

export interface PresetOption<T extends PresetValue> {
  value: T;
  label: string;
  group?: string;
  disabled?: boolean;
  keywords?: readonly string[];
  icon?: React.ReactNode;
  description?: string;
}

function regexFor(query: string): RegExp | null {
  if (!query) return null;
  try {
    return new RegExp(query, "i");
  } catch {
    return null;
  }
}

function isExactLabel(label: string, query: string): boolean {
  return label.localeCompare(query, undefined, {
    sensitivity: "accent",
    usage: "search",
  }) === 0;
}

export function PresetCombobox<T extends PresetValue>({
  value,
  valueLabel,
  options,
  ariaLabel,
  onValueChange,
  disabled = false,
  triggerClassName,
  contentClassName,
  optionContainerClassName,
  portalled = true,
  align = "end",
}: {
  value: T;
  valueLabel?: string;
  options: readonly PresetOption<T>[];
  ariaLabel: string;
  onValueChange: (value: T) => void;
  disabled?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
  optionContainerClassName?: string;
  portalled?: boolean;
  align?: "start" | "center" | "end";
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const skipImplicitCommit = useRef(false);
  const listboxId = useId();
  const selected = options.find((option) => Object.is(option.value, value));
  const regex = useMemo(() => regexFor(query), [query]);
  const regexValid = !query || regex !== null;
  const filtered = useMemo(() => {
    if (!query) return [...options];
    if (!regex) return [];
    return options.filter((option) =>
      [option.label, ...(option.keywords ?? [])].some((text) => regex.test(text)));
  }, [options, query, regex]);
  const exactMatches = query
    ? options.filter((option) =>
        !option.disabled && isExactLabel(option.label, query))
    : [];
  const uniqueExactMatches = exactMatches.filter((option, index) =>
    exactMatches.findIndex((candidate) => Object.is(candidate.value, option.value)) === index);
  const exactMatch = uniqueExactMatches.length === 1 ? uniqueExactMatches[0] : null;
  const groupedFiltered = useMemo(() => {
    const groups = new Map<string | null, Array<{
      option: PresetOption<T>;
      index: number;
    }>>();
    filtered.forEach((option, index) => {
      const group = option.group ?? null;
      const entries = groups.get(group) ?? [];
      entries.push({ option, index });
      groups.set(group, entries);
    });
    return [...groups.entries()];
  }, [filtered]);

  const commit = (option: PresetOption<T>) => {
    if (option.disabled) return;
    skipImplicitCommit.current = true;
    onValueChange(option.value);
    setOpen(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      skipImplicitCommit.current = false;
      setQuery("");
      setActiveIndex(-1);
      setOpen(true);
      return;
    }

    if (!skipImplicitCommit.current && exactMatch) {
      onValueChange(exactMatch.value);
    }
    skipImplicitCommit.current = false;
    setQuery("");
    setActiveIndex(-1);
    setOpen(false);
  };

  const moveActive = (direction: 1 | -1) => {
    if (filtered.length === 0) return;
    let next = activeIndex;
    for (let attempts = 0; attempts < filtered.length; attempts++) {
      next = (next + direction + filtered.length) % filtered.length;
      if (!filtered[next].disabled) {
        setActiveIndex(next);
        return;
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-interaction="preset-choice"
          role="combobox"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-controls={open ? listboxId : undefined}
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex h-8 w-full cursor-default items-center justify-between gap-2 rounded border border-input bg-background px-2 text-xs text-foreground outline-none transition-colors hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
            triggerClassName,
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            {selected?.icon && (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {selected.icon}
              </span>
            )}
            <span className="truncate">
              {selected?.label ?? valueLabel ?? String(value)}
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        portalled={portalled}
        className={cn("w-64 p-1", contentClassName)}
        onEscapeKeyDown={() => {
          skipImplicitCommit.current = true;
        }}
      >
        <div className="flex h-8 items-center gap-2 border-b px-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            role="searchbox"
            aria-label={t("sidebar.common.searchPresets")}
            aria-controls={listboxId}
            aria-invalid={!regexValid}
            aria-activedescendant={activeIndex >= 0
              ? `${listboxId}-${activeIndex}`
              : undefined}
            value={query}
            placeholder={t("sidebar.common.regexSearch")}
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setActiveIndex(-1);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                moveActive(1);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                moveActive(-1);
              } else if (event.key === "Enter") {
                event.preventDefault();
                const active = filtered[activeIndex];
                if (active && !active.disabled) commit(active);
                else if (exactMatch) commit(exactMatch);
              }
            }}
          />
        </div>
        <div
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className="max-h-64 overflow-y-auto py-1"
        >
          {!regexValid ? (
            <div role="alert" className="px-2 py-3 text-center text-xs text-destructive">
              {t("sidebar.common.invalidRegex")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">
              {t("sidebar.common.noPresetMatches")}
            </div>
          ) : groupedFiltered.map(([group, entries]) => (
            <div
              key={group ?? "__ungrouped"}
              role={group ? "group" : undefined}
              aria-label={group ?? undefined}
            >
              {group && (
                <div className="sticky top-0 z-10 border-y bg-muted px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground first:border-t-0">
                  {group}
                </div>
              )}
              <div className={cn(optionContainerClassName)}>
                {entries.map(({ option, index }) => (
                  <button
                    key={`${group ?? ""}:${typeof option.value}:${String(option.value)}:${index}`}
                    id={`${listboxId}-${index}`}
                    type="button"
                    role="option"
                    aria-selected={Object.is(option.value, value)}
                    disabled={option.disabled}
                    className={cn(
                      "flex min-h-8 w-full cursor-default items-center gap-2 px-2 text-left text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40",
                      activeIndex === index && "bg-accent",
                    )}
                    onMouseMove={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => commit(option)}
                  >
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                      {Object.is(option.value, value) && <Check className="h-3 w-3" />}
                    </span>
                    {option.icon && (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                        {option.icon}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {option.description && (
                      <span
                        aria-hidden="true"
                        className="ml-auto shrink-0 text-[10px] text-muted-foreground"
                      >
                        {option.description}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
