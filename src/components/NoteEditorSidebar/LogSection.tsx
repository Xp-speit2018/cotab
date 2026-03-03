import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDebugLogStore, type LogLevel } from "@/stores/debug-log-store";
import { SectionHeader } from "./primitives";

export function LogSection({ dragHandleProps }: { dragHandleProps?: Record<string, unknown> }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const logs = useDebugLogStore((s) => s.logs);
  const minLevel = useDebugLogStore((s) => s.minLevel);
  const clear = useDebugLogStore((s) => s.clear);
  const setMinLevel = useDebugLogStore((s) => s.setMinLevel);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current && logs.length > 0) {
      const container = logContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [logs.length]);

  const filteredLogs = logs.filter((log) => {
    const levelOrder: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return levelOrder[log.level] >= levelOrder[minLevel];
  });

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}.${date.getMilliseconds().toString().padStart(3, "0")}`;
  };

  const formatData = (data: unknown): string => {
    if (data === undefined || data === null) return "";
    try {
      const str = JSON.stringify(data, null, 2);
      return str.length > 200 ? str.substring(0, 200) + "..." : str;
    } catch {
      return String(data ?? "");
    }
  };

  const levelColors: Record<LogLevel, string> = {
    debug: "text-green-400",
    info: "text-blue-400",
    warn: "text-yellow-400",
    error: "text-red-400",
  };

  const levelLabels: Record<LogLevel, string> = {
    debug: t("sidebar.log.levelDebug"),
    info: t("sidebar.log.levelInfo"),
    warn: t("sidebar.log.levelWarn"),
    error: t("sidebar.log.levelError"),
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SectionHeader
        title={t("sidebar.log.title")}
        helpText={t("sidebar.log.help")}
        isOpen={isOpen}
        dragHandleProps={dragHandleProps}
      />
      <CollapsibleContent>
        <div className="space-y-1 py-1">
          <div className="flex flex-wrap items-center gap-1 px-3 py-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-2 text-[9px]"
              onClick={() => clear()}
            >
              {t("sidebar.log.clear")}
            </Button>
            {(["debug", "info", "warn", "error"] as LogLevel[]).map((level) => {
              const levelOrder: Record<LogLevel, number> = {
                debug: 0,
                info: 1,
                warn: 2,
                error: 3,
              };
              const isVisible = levelOrder[level] >= levelOrder[minLevel];
              return (
                <Toggle
                  key={level}
                  pressed={isVisible}
                  onPressedChange={(pressed) => {
                    if (pressed) {
                      setMinLevel(level);
                    } else {
                      const levels: LogLevel[] = ["debug", "info", "warn", "error"];
                      const currentIdx = levels.indexOf(level);
                      if (currentIdx < levels.length - 1) {
                        setMinLevel(levels[currentIdx + 1]);
                      }
                    }
                  }}
                  className={cn(
                    "h-5 px-2 text-[9px]",
                    isVisible && "bg-primary/20 text-primary",
                  )}
                >
                  {levelLabels[level]}
                </Toggle>
              );
            })}
          </div>

          <div
            ref={logContainerRef}
            className="mx-3 mb-2 max-h-60 overflow-y-auto rounded border border-border/40 bg-zinc-950 p-2 font-mono text-[10px] leading-tight text-zinc-300"
          >
            {filteredLogs.length === 0 ? (
              <div className="py-2 text-center text-zinc-500">
                {t("sidebar.log.empty")}
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="mb-1 break-words">
                  <span className={cn("font-semibold", levelColors[log.level])}>
                    {formatTimestamp(log.timestamp)} {levelLabels[log.level].padEnd(5)}
                  </span>
                  <span className="text-zinc-400"> [{log.source}]</span>
                  <span className="text-zinc-200"> {log.message}</span>
                  {log.data !== undefined && log.data !== null && (
                    <div className="ml-4 mt-0.5 text-zinc-400">
                      <pre className="whitespace-pre-wrap break-words text-[9px]">
                        {formatData(log.data) || ""}
                      </pre>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        <Separator />
      </CollapsibleContent>
    </Collapsible>
  );
}
