/**
 * action-log-store.ts — Thin Zustand shell for the ActionLog.
 *
 * All logic lives in src/core/editor/action-log.ts.
 * This store merely holds reactive state for UI consumption.
 */

import { create } from "zustand";
import { actionLog, type LogEntry, type LogLevel } from "@/core/editor/action-log";

interface ActionLogState {
  logs: LogEntry[];
  minLevel: LogLevel;
  clear: () => void;
  setMinLevel: (level: LogLevel) => void;
}

export const useActionLogStore = create<ActionLogState>((set) => {
  actionLog.setSubscriber((logs, minLevel) => {
    set({ logs, minLevel });
  });

  return {
    logs: actionLog.getLogs(),
    minLevel: actionLog.minLevel,
    clear: () => actionLog.clear(),
    setMinLevel: (level: LogLevel) => actionLog.setMinLevel(level),
  };
});

// Re-export for convenience
export { debugLog, type LogLevel, type LogEntry } from "@/core/editor/action-log";
