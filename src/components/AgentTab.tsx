import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Archive,
  Bot,
  BrainCircuit,
  Check,
  ChevronDown,
  CircleStop,
  Clock3,
  FileMusic,
  FolderPlus,
  Globe2,
  HardDrive,
  History,
  ListTree,
  Loader2,
  Network,
  Plus,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Unplug,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import {
  agentSession,
  type AgentActivityEntry,
  type AgentHistoryEntry,
  type AgentTimelineEntry,
} from "@/agent/agent-session";
import { normalizeCodexProxyUrl } from "@/agent/codex-proxy-settings";
import { engine } from "@/core/engine";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/render-store";

type TimelineBlock =
  | { readonly kind: "message"; readonly entry: AgentTimelineEntry }
  | { readonly kind: "activities"; readonly id: string; readonly entries: AgentActivityEntry[] };

type AgentView = "conversation" | "history";
type HistoryScope = "document" | "all";

function groupTimeline(entries: readonly AgentTimelineEntry[]): TimelineBlock[] {
  const blocks: TimelineBlock[] = [];
  let activities: AgentActivityEntry[] = [];
  const flushActivities = () => {
    if (activities.length === 0) return;
    blocks.push({
      kind: "activities",
      id: `activities:${activities[0].id}`,
      entries: activities,
    });
    activities = [];
  };

  for (const entry of entries) {
    if (entry.kind === "activity") {
      activities.push(entry);
      continue;
    }
    flushActivities();
    blocks.push({ kind: "message", entry });
  }
  flushActivities();
  return blocks;
}

function StatusIcon({ status }: { status: AgentActivityEntry["status"] }) {
  if (status === "running") {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />;
  }
  if (status === "failed") {
    return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  }
  return <Check className="h-3.5 w-3.5 text-emerald-600" />;
}

function ToolArguments({ value }: { value: unknown }) {
  const { t } = useTranslation();
  if (value === undefined) return null;
  let formatted: string;
  try {
    formatted = JSON.stringify(value, null, 2);
  } catch {
    formatted = String(value);
  }
  return (
    <details className="mt-1 text-[11px] text-muted-foreground">
      <summary className="cursor-pointer select-none hover:text-foreground">
        {t("agent.activity.arguments")}
      </summary>
      <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words border-l pl-2 font-mono text-[10px] leading-4">
        {formatted}
      </pre>
    </details>
  );
}

function MarkdownContent({
  children,
  compact = false,
}: {
  children: string;
  compact?: boolean;
}) {
  const textSize = compact ? "text-xs leading-5" : "text-sm leading-6";
  return (
    <div className={textSize}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        h1: ({ children: content }) => <h1 className="mb-2 text-base font-semibold last:mb-0">{content}</h1>,
        h2: ({ children: content }) => <h2 className="mb-2 text-sm font-semibold last:mb-0">{content}</h2>,
        h3: ({ children: content }) => <h3 className="mb-1 text-sm font-medium last:mb-0">{content}</h3>,
        p: ({ children: content }) => <p className="mb-2 last:mb-0">{content}</p>,
        ul: ({ children: content }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{content}</ul>,
        ol: ({ children: content }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{content}</ol>,
        li: ({ children: content }) => <li>{content}</li>,
        blockquote: ({ children: content }) => <blockquote className="mb-2 border-l-2 border-muted-foreground/40 pl-3 text-muted-foreground last:mb-0">{content}</blockquote>,
        code: ({ children: content, className }) => (
          <code className={cn(
            "rounded bg-background/70 px-1 py-0.5 font-mono text-[0.9em]",
            className,
          )}>
            {content}
          </code>
        ),
        pre: ({ children: content }) => <pre className="mb-2 overflow-x-auto rounded bg-background/70 p-2 last:mb-0">{content}</pre>,
        a: ({ children: content, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {content}
          </a>
        ),
        table: ({ children: content }) => <div className="mb-2 overflow-x-auto last:mb-0"><table className="w-full border-collapse text-left">{content}</table></div>,
        th: ({ children: content }) => <th className="border px-2 py-1 font-medium">{content}</th>,
        td: ({ children: content }) => <td className="border px-2 py-1 align-top">{content}</td>,
        img: () => null,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

function ActivityGroup({ activities }: { activities: AgentActivityEntry[] }) {
  const { t } = useTranslation();
  const running = activities.some((activity) => activity.status === "running");
  const failed = activities.some((activity) => activity.status === "failed");
  const [open, setOpen] = useState(running);

  const toolLabel = (tool: string | undefined) => {
    if (!tool) return t("agent.activity.tool");
    const key = `agent.tools.${tool}`;
    const translated = t(key);
    return translated === key ? tool : translated;
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-y bg-muted/20">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent/50">
        {running ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
        ) : failed ? (
          <XCircle className="h-3.5 w-3.5 text-destructive" />
        ) : (
          <ListTree className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate font-medium">
          {running
            ? t("agent.activity.working")
            : t("agent.activity.completed", { count: activities.length })}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t px-3 py-1.5">
          {activities.map((activity) => (
            <div key={activity.id} className="flex gap-2 border-b py-2 last:border-b-0">
              <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                <StatusIcon status={activity.status} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
                  {activity.activityType === "tool" && (
                    <Wrench className="h-3 w-3 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate">
                    {activity.activityType === "reasoning"
                      ? t("agent.activity.reasoning")
                      : activity.activityType === "plan"
                        ? t("agent.activity.plan")
                        : toolLabel(activity.tool)}
                  </span>
                  {typeof activity.durationMs === "number" && (
                    <span className="ml-auto shrink-0 text-[10px] font-normal tabular-nums text-muted-foreground">
                      {(activity.durationMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
                {activity.detail && (
                  <div className="mt-1 break-words text-muted-foreground">
                    <MarkdownContent compact>{activity.detail}</MarkdownContent>
                  </div>
                )}
                {activity.activityType === "tool" && (
                  <ToolArguments value={activity.arguments} />
                )}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ConversationTimeline({
  timeline,
  working,
}: {
  timeline: readonly AgentTimelineEntry[];
  working: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const blocks = useMemo(() => groupTimeline(timeline), [timeline]);
  const hasRunningActivity = timeline.some(
    (entry) => entry.kind === "activity" && entry.status === "running",
  );
  const { t } = useTranslation();

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [timeline]);

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="py-3">
        {blocks.map((block) => {
          if (block.kind === "activities") {
            return <ActivityGroup key={block.id} activities={block.entries} />;
          }
          const entry = block.entry;
          if (entry.kind !== "message") return null;
          const isUser = entry.role === "user";
          return (
            <div
              key={entry.id}
              className={cn(
                "mx-3 mb-3 flex gap-2",
                isUser ? "justify-end" : "justify-start",
              )}
            >
              {!isUser && (
                <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                  <Bot className="h-3 w-3" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[88%] whitespace-pre-wrap break-words rounded-md px-3 py-2 text-sm leading-6",
                  isUser
                    ? "bg-primary text-primary-foreground"
                    : "border bg-muted/45",
                )}
              >
                <MarkdownContent>{entry.text}</MarkdownContent>
              </div>
            </div>
          );
        })}
        {working && !hasRunningActivity && (
          <div className="mx-3 mb-3 flex gap-2">
            <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
              <Bot className="h-3 w-3" />
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-muted/45 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
              <span>{t("agent.activity.thinking")}</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </ScrollArea>
  );
}

function formatHistoryDate(timestamp: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function HistoryView({
  scope,
  setScope,
  setView,
}: {
  scope: HistoryScope;
  setScope: (scope: HistoryScope) => void;
  setView: (view: AgentView) => void;
}) {
  const { t, i18n } = useTranslation();
  const session = useSyncExternalStore(agentSession.subscribe, agentSession.getSnapshot);
  const [search, setSearch] = useState("");
  const documentId = engine.getDocumentId();

  const history = session.history.filter((entry) => {
    if (scope === "document" && entry.documentId !== documentId) return false;
    const query = search.trim().toLocaleLowerCase();
    if (!query) return true;
    return `${entry.title} ${entry.preview} ${entry.scoreLabel}`
      .toLocaleLowerCase()
      .includes(query);
  });

  const openThread = async (entry: AgentHistoryEntry) => {
    if (entry.documentId !== documentId) return;
    await agentSession.openThread(entry.threadId).catch(() => undefined);
    setView("conversation");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-3 py-2.5">
        <div role="tablist" className="grid h-8 grid-cols-2 rounded-md bg-muted p-0.5">
          <button
            type="button"
            role="tab"
            aria-selected={scope === "document"}
            className={cn(
              "rounded px-2 text-xs",
              scope === "document" && "bg-background shadow-sm",
            )}
            onClick={() => setScope("document")}
          >
            {t("agent.history.currentScore")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scope === "all"}
            className={cn(
              "rounded px-2 text-xs",
              scope === "all" && "bg-background shadow-sm",
            )}
            onClick={() => setScope("all")}
          >
            {t("agent.history.all")}
          </button>
        </div>
        <label className="mt-2 flex h-8 items-center gap-2 rounded-md border px-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            placeholder={t("agent.history.search")}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {session.historyLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs text-muted-foreground">
            {t("agent.history.empty")}
          </div>
        ) : (
          <div>
            {history.map((entry) => {
              const belongsToCurrentDocument = entry.documentId === documentId;
              return (
                <div
                  key={entry.threadId}
                  className={cn(
                    "group flex items-start border-b",
                    session.threadId === entry.threadId && "bg-accent/50",
                  )}
                >
                  <button
                    type="button"
                    disabled={!belongsToCurrentDocument}
                    className="min-w-0 flex-1 px-3 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-55"
                    onClick={() => void openThread(entry)}
                  >
                    <div className="truncate text-xs font-medium">{entry.title}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <FileMusic className="h-3 w-3 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{entry.scoreLabel}</span>
                      <span className="shrink-0 tabular-nums">
                        {formatHistoryDate(entry.updatedAt, i18n.language)}
                      </span>
                    </div>
                  </button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="mr-2 mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded opacity-0 hover:bg-accent group-hover:opacity-100 focus:opacity-100"
                        aria-label={t("agent.history.archive")}
                        onClick={() => void agentSession.archiveThread(entry.threadId)}
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t("agent.history.archive")}</TooltipContent>
                  </Tooltip>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function ProxySettingsPopover() {
  const { t } = useTranslation();
  const session = useSyncExternalStore(agentSession.subscribe, agentSession.getSnapshot);
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(session.proxy.enabled);
  const [url, setUrl] = useState(session.proxy.url);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEnabled(session.proxy.enabled);
    setUrl(session.proxy.url);
    setError(null);
  }, [open, session.proxy.enabled, session.proxy.url]);

  const apply = async () => {
    let normalizedUrl = url.trim();
    if (enabled) {
      try {
        normalizedUrl = normalizeCodexProxyUrl(normalizedUrl);
      } catch {
        setError(t("agent.proxy.invalid"));
        return;
      }
    }

    setSaving(true);
    try {
      await agentSession.setProxy({ enabled, url: normalizedUrl });
      setError(null);
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : String(applyError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant={session.proxy.enabled ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              aria-label={t("agent.proxy.title")}
              disabled={session.phase === "connecting" || session.phase === "working"}
            >
              <Network className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("agent.proxy.title")}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="text-xs font-medium">{t("agent.proxy.title")}</div>
        <label className="mt-2 flex cursor-pointer items-center gap-2 rounded py-1">
          <input
            type="checkbox"
            checked={enabled}
            className="h-3.5 w-3.5 accent-primary"
            onChange={(event) => setEnabled(event.target.checked)}
          />
          <span className="text-xs">{t("agent.proxy.enabled")}</span>
        </label>
        <label className="mt-2 block">
          <span className="mb-1 block text-[10px] font-medium text-muted-foreground">
            {t("agent.proxy.url")}
          </span>
          <input
            type="url"
            value={url}
            disabled={!enabled}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
            aria-label={t("agent.proxy.url")}
            placeholder="http://127.0.0.1:9098"
            className="h-8 w-full rounded-md border bg-background px-2 font-mono text-xs outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            onChange={(event) => setUrl(event.target.value)}
          />
        </label>
        {error && <div className="mt-2 text-[11px] text-destructive">{error}</div>}
        <div className="mt-3 flex justify-end">
          <Button
            size="xs"
            disabled={saving || (enabled && !url.trim())}
            onClick={() => void apply()}
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            {t("agent.proxy.apply")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Composer() {
  const { t } = useTranslation();
  const session = useSyncExternalStore(agentSession.subscribe, agentSession.getSnapshot);
  const [prompt, setPrompt] = useState("");
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const working = session.phase === "working";
  const connected = session.phase === "connected" || working;
  const selectedModel = session.models.find((model) => model.model === session.model);

  const send = async () => {
    const text = prompt.trim();
    if (!text || working) return;
    setPrompt("");
    await agentSession.sendPrompt(text).catch(() => setPrompt(text));
  };

  const updateSetting = async (operation: () => Promise<void>) => {
    try {
      await operation();
      setSettingsError(null);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="border-t p-3">
      <div className="rounded-md border bg-background focus-within:ring-1 focus-within:ring-ring">
        <textarea
          value={prompt}
          rows={3}
          disabled={!connected || working}
          className="block max-h-40 min-h-20 w-full resize-none bg-transparent px-3 pb-9 pt-2.5 text-sm leading-5 outline-none placeholder:text-muted-foreground disabled:opacity-60"
          placeholder={t("agent.promptPlaceholder")}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <div className="flex h-8 items-center justify-between px-1.5 pb-1.5">
          <div className="flex min-w-0 items-center gap-1">
            <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="xs"
                  variant="ghost"
                  className="max-w-40 truncate"
                  aria-label={t("agent.modelSettings")}
                  disabled={!connected || working || session.modelsLoading}
                >
                  <SlidersHorizontal className="h-3 w-3" />
                  <span className="truncate">{selectedModel?.displayName ?? session.model ?? t("agent.model")}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-1.5">
                <div className="px-1.5 pb-1 pt-0.5 text-[10px] font-medium text-muted-foreground">
                  {t("agent.model")}
                </div>
                {session.models.map((model) => (
                  <button
                    key={model.model}
                    type="button"
                    className={cn(
                      "flex w-full items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-accent",
                      model.model === session.model && "bg-accent/70",
                    )}
                    onClick={() => void updateSetting(() => agentSession.setModel(model.model))}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{model.displayName}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">{model.description}</span>
                    </span>
                    {model.model === session.model && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                  </button>
                ))}
                <div className="my-1 border-t" />
                <div className="px-1.5 pb-1 text-[10px] font-medium text-muted-foreground">
                  {t("agent.reasoningEffort")}
                </div>
                <div className="flex flex-wrap gap-1 px-1">
                  {(selectedModel?.supportedReasoningEfforts ?? []).map((option) => (
                    <Button
                      key={option.reasoningEffort}
                      size="xs"
                      variant={option.reasoningEffort === session.reasoningEffort ? "secondary" : "ghost"}
                      onClick={() => void updateSetting(() => agentSession.setReasoningEffort(option.reasoningEffort))}
                    >
                      {option.reasoningEffort}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Popover open={resourcesOpen} onOpenChange={setResourcesOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={t("agent.resources.title")}
                  disabled={!connected || working}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 p-2">
                <div className="px-1 pb-1.5 text-[10px] font-medium text-muted-foreground">
                  {t("agent.resources.title")}
                </div>
                <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-2 hover:bg-accent">
                  <input
                    type="checkbox"
                    checked={session.resources.localResources}
                    className="h-3.5 w-3.5 accent-primary"
                    onChange={(event) => void updateSetting(() =>
                      agentSession.setLocalResources(event.target.checked),
                    )}
                  />
                  <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs">{t("agent.resources.local")}</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-2 hover:bg-accent">
                  <input
                    type="checkbox"
                    checked={session.resources.webResources}
                    className="h-3.5 w-3.5 accent-primary"
                    onChange={(event) => void updateSetting(() =>
                      agentSession.setWebResources(event.target.checked),
                    )}
                  />
                  <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs">{t("agent.resources.web")}</span>
                </label>
                <div className="mt-1 border-t pt-1">
                  <div className="flex items-center gap-2 rounded px-1.5 py-2">
                    <input
                      type="checkbox"
                      checked={session.resources.localWriteRoots.length > 0}
                      className="h-3.5 w-3.5 accent-primary"
                      aria-label={t("agent.resources.write")}
                      onChange={(event) => void updateSetting(() =>
                        event.target.checked
                          ? agentSession.addLocalWriteRoot()
                          : agentSession.clearLocalWriteRoots(),
                      )}
                    />
                    <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="min-w-0 flex-1 text-xs">{t("agent.resources.write")}</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label={t("agent.resources.addFolder")}
                          onClick={() => void updateSetting(() => agentSession.addLocalWriteRoot())}
                        >
                          <FolderPlus className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("agent.resources.addFolder")}</TooltipContent>
                    </Tooltip>
                  </div>
                  {session.resources.localWriteRoots.map((root) => (
                    <div key={root} className="group flex items-center gap-1 px-1.5 py-1 text-[11px] text-muted-foreground">
                      <span className="min-w-0 flex-1 truncate font-mono" title={root}>{root}</span>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100"
                        aria-label={t("agent.resources.removeFolder")}
                        onClick={() => void updateSetting(() => agentSession.removeLocalWriteRoot(root))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-xs"
                  variant={session.collaborationMode === "plan" ? "secondary" : "ghost"}
                  aria-label={t("agent.planMode")}
                  aria-pressed={session.collaborationMode === "plan"}
                  disabled={!connected || working || !session.model}
                  onClick={() => void updateSetting(() =>
                    agentSession.setCollaborationMode(
                      session.collaborationMode === "plan" ? "default" : "plan",
                    ),
                  )}
                >
                  <BrainCircuit className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("agent.planMode")}</TooltipContent>
            </Tooltip>
          </div>
          {working ? (
            <Button
              size="icon"
              variant="secondary"
              className="h-7 w-7"
              aria-label={t("agent.stop")}
              onClick={() => void agentSession.interrupt()}
            >
              <CircleStop className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="h-7 w-7"
              disabled={!connected || !prompt.trim()}
              aria-label={t("agent.send")}
              onClick={() => void send()}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      {settingsError && <div className="mt-2 text-xs text-destructive">{settingsError}</div>}
    </div>
  );
}

export function AgentTab() {
  const { t } = useTranslation();
  const session = useSyncExternalStore(agentSession.subscribe, agentSession.getSnapshot);
  const [view, setView] = useState<AgentView>("conversation");
  const [historyScope, setHistoryScope] = useState<HistoryScope>("document");
  const scoreTitle = usePlayerStore((state) => state.scoreTitle);
  const connected = session.phase === "connected" || session.phase === "working";
  const connecting = session.phase === "connecting";
  const activeModel = session.models.find((model) => model.model === session.model);
  const connectionLabel = session.model
    ? `${activeModel?.displayName ?? session.model}${session.reasoningEffort ? ` · ${session.reasoningEffort}` : ""}`
    : session.version ?? t(`agent.codexStatus.${session.phase}`);

  useEffect(() => {
    void agentSession.initialize();
  }, []);

  const createThread = async () => {
    await agentSession.newThread().catch(() => undefined);
    setView("conversation");
  };

  const showHistory = async () => {
    setView("history");
    await agentSession.loadHistory();
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-card">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b px-2">
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            session.phase === "working"
              ? "bg-amber-500"
              : connected
                ? "bg-emerald-500"
                : session.phase === "error"
                  ? "bg-destructive"
                  : "bg-muted-foreground/40",
          )}
        />
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
          {connectionLabel}
        </span>

        <ProxySettingsPopover />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={view === "history" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              aria-label={t("agent.history.title")}
              disabled={!connected}
              onClick={() => {
                if (view === "history") setView("conversation");
                else void showHistory();
              }}
            >
              <History className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("agent.history.title")}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={t("agent.newConversation")}
              disabled={connecting || session.phase === "working" || !session.installed}
              onClick={() => void createThread()}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("agent.newConversation")}</TooltipContent>
        </Tooltip>

        {connected && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={t("agent.disconnect")}
                disabled={session.phase === "working"}
                onClick={() => void agentSession.disconnect()}
              >
                <Unplug className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("agent.disconnect")}</TooltipContent>
          </Tooltip>
        )}

      </div>

      {!connected ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <Bot className="h-7 w-7 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">{t("agent.localCodex")}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {session.installed
                  ? session.version ?? t("agent.codexStatus.installed")
                  : t("agent.codexStatus.notFound")}
              </div>
            </div>
            <Button
              size="sm"
              className="h-8 gap-1.5"
              disabled={!session.installed || connecting}
              onClick={() => void agentSession.connect()}
            >
              {connecting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Bot className="h-3.5 w-3.5" />
              )}
              {t("agent.connect")}
            </Button>
          </div>
          {session.error && (
            <div className="border-t px-3 py-2 text-xs text-destructive">
              {session.error}
            </div>
          )}
        </div>
      ) : view === "history" ? (
        <HistoryView
          scope={historyScope}
          setScope={setHistoryScope}
          setView={setView}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-8 shrink-0 items-center gap-1.5 border-b px-3 text-[11px] text-muted-foreground">
            <FileMusic className="h-3 w-3" />
            <span className="truncate">{scoreTitle || t("agent.untitledScore")}</span>
            {session.phase === "working" && (
              <>
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span>{t("agent.codexStatus.working")}</span>
              </>
            )}
          </div>
          {session.timeline.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
              <Clock3 className="h-5 w-5" />
              <span className="text-xs">{t("agent.emptyConversation")}</span>
            </div>
          ) : (
            <ConversationTimeline
              timeline={session.timeline}
              working={session.phase === "working"}
            />
          )}
          {session.error && (
            <div className="border-t px-3 py-2 text-xs text-destructive">
              {session.error}
            </div>
          )}
          <Composer />
        </div>
      )}
    </div>
  );
}
