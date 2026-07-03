import { useEffect, useState } from "react";
import {
  Braces,
  ChevronDown,
  ChevronRight,
  MousePointer2,
  Radio,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { useEditorStore } from "@/stores/editor-store";
import { SectionHeader } from "./primitives";

const POLL_INTERVAL_MS = 300;

type RuntimeState = Record<string, unknown>;
type Inspectable = object | ((...args: unknown[]) => unknown);

interface RuntimeEntry {
  label: string;
  value: unknown;
}

function readEditorStateSnapshot(): RuntimeState {
  return { ...(useEditorStore.getState() as unknown as RuntimeState) };
}

function isInspectable(value: unknown): value is Inspectable {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

function fieldLabel(key: PropertyKey, parent: unknown): string {
  if (typeof key === "symbol") return key.toString();
  if (Array.isArray(parent) && typeof key === "string" && key !== "length" && /^\d+$/.test(key)) {
    return `[${key}]`;
  }
  return String(key);
}

function getOwnValue(value: Inspectable, key: PropertyKey): unknown {
  try {
    return (value as Record<PropertyKey, unknown>)[key];
  } catch (error) {
    return `<throws ${error instanceof Error ? error.message : String(error)}>`;
  }
}

function formatPrimitive(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "symbol") return value.toString();
  return String(value);
}

function shortValue(value: unknown): string {
  if (!isInspectable(value)) return formatPrimitive(value);
  if (typeof value === "function") {
    return `[Function${value.name ? ` ${value.name}` : ""}]`;
  }
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (value instanceof Map) return `Map(${value.size})`;
  if (value instanceof Set) return `Set(${value.size})`;
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? "Invalid Date" : value.toISOString();
  if (value instanceof RegExp) return value.toString();
  return `${value.constructor?.name ?? "Object"} {${runtimeEntries(value).length}}`;
}

function runtimeEntries(value: Inspectable): RuntimeEntry[] {
  const ownEntries = Reflect.ownKeys(value).map((key) => ({
    label: fieldLabel(key, value),
    value: getOwnValue(value, key),
  }));

  if (value instanceof Map) {
    const mapEntries = Array.from(value.entries()).map(([key, entryValue], index) => ({
      label: `[${index}] ${shortValue(key)}`,
      value: entryValue,
    }));
    return [
      { label: "size", value: value.size },
      ...mapEntries,
      ...ownEntries,
    ];
  }

  if (value instanceof Set) {
    const setEntries = Array.from(value.values()).map((entryValue, index) => ({
      label: `[${index}]`,
      value: entryValue,
    }));
    return [
      { label: "size", value: value.size },
      ...setEntries,
      ...ownEntries,
    ];
  }

  return ownEntries;
}

function useEditorStateSnapshot(isOpen: boolean): RuntimeState {
  const [snapshot, setSnapshot] = useState<RuntimeState>(() => readEditorStateSnapshot());

  useEffect(() => {
    const update = () => setSnapshot(readEditorStateSnapshot());
    update();
    const unsubscribe = useEditorStore.subscribe(update);
    if (!isOpen) return unsubscribe;

    const interval = window.setInterval(update, POLL_INTERVAL_MS);
    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [isOpen]);

  return snapshot;
}

function iconForPath(path: string): React.ReactNode {
  if (path.includes("transport")) return <Radio className="h-3 w-3" />;
  if (path.includes("peer")) return <Users className="h-3 w-3" />;
  if (path.includes("selector") || path.includes("selected")) {
    return <MousePointer2 className="h-3 w-3" />;
  }
  return <Braces className="h-3 w-3" />;
}

function ValueNode({
  label,
  value,
  path,
  depth,
  ancestors,
}: {
  label: string;
  value: unknown;
  path: string;
  depth: number;
  ancestors: Inspectable[];
}) {
  const inspectable = isInspectable(value);
  const cyclic = inspectable && ancestors.includes(value);
  const entries = inspectable && !cyclic ? runtimeEntries(value) : [];
  const [isOpen, setIsOpen] = useState(depth <= 1);
  const indent = 8 + depth * 10;

  if (!inspectable || cyclic) {
    return (
      <div
        className="grid min-h-5 grid-cols-[minmax(96px,0.9fr)_minmax(0,1.1fr)] items-start gap-2 px-2 py-0.5"
        style={{ paddingLeft: `${indent}px` }}
      >
        <span className="min-w-0 break-words text-[10px] text-muted-foreground/75">
          {label}
        </span>
        <span className="min-w-0 break-words text-right font-mono text-[10px] tabular-nums text-foreground">
          {cyclic ? "<cycle>" : shortValue(value)}
        </span>
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className="flex w-full items-start gap-1.5 px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-accent/30"
        style={{ paddingLeft: `${indent}px` }}
      >
        {isOpen ? (
          <ChevronDown className="mt-0.5 h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="mt-0.5 h-3 w-3 shrink-0" />
        )}
        <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center">
          {iconForPath(path)}
        </span>
        <span className="min-w-0 flex-1 break-words text-left">{label}</span>
        <span className="min-w-0 max-w-[45%] break-words text-right font-mono text-[9px] font-normal text-muted-foreground/75">
          {shortValue(value)}
        </span>
        <span className="shrink-0 font-mono text-[9px] font-normal text-muted-foreground/60">
          {entries.length}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-l border-border/50" style={{ marginLeft: `${13 + depth * 10}px` }}>
          {entries.length > 0 ? (
            entries.map((entry, index) => (
              <ValueNode
                key={`${path}.${entry.label}.${index}`}
                label={entry.label}
                value={entry.value}
                path={`${path}.${entry.label}`}
                depth={depth + 1}
                ancestors={[...ancestors, value]}
              />
            ))
          ) : (
            <div className="px-2 py-1 text-[10px] italic text-muted-foreground/60">
              empty
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function RuntimeStateTree({
  label,
  value,
  path,
}: {
  label: string;
  value: unknown;
  path: string;
}) {
  return (
    <ValueNode
      label={label}
      value={value}
      path={path}
      depth={0}
      ancestors={[]}
    />
  );
}

export function EditorStateSection({
  dragHandleProps,
}: {
  dragHandleProps?: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const snapshot = useEditorStateSnapshot(isOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SectionHeader
        title={t("sidebar.editorState.title")}
        helpText={t("sidebar.editorState.help")}
        isOpen={isOpen}
        dragHandleProps={dragHandleProps}
      />
      <CollapsibleContent>
        <div className="py-0.5">
          <RuntimeStateTree
            label={t("sidebar.editorState.topLevel")}
            value={snapshot}
            path="EditorReactiveState"
          />
        </div>
        <Separator />
      </CollapsibleContent>
    </Collapsible>
  );
}
