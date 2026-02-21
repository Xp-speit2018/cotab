/**
 * debug-log-store.ts — Zustand store for structured debug logging.
 *
 * Provides a centralized logging system with standard severity levels
 * (DEBUG, INFO, WARN, ERROR) and a ring buffer to prevent memory leaks.
 * Logs are exposed reactively to UI components for display in a terminal-like panel.
 */

import { create } from "zustand";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: number;
  timestamp: number;
  level: LogLevel;
  source: string;
  message: string;
  data?: unknown;
}

interface DebugLogState {
  logs: LogEntry[];
  minLevel: LogLevel;
  nextId: number;
  clear: () => void;
  setMinLevel: (level: LogLevel) => void;
  addLog: (entry: Omit<LogEntry, "id" | "timestamp">) => void;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAX_LOG_ENTRIES = 500;
const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useDebugLogStore = create<DebugLogState>((set, get) => ({
  logs: [],
  minLevel: "debug",
  nextId: 1,

  clear: () => {
    set({ logs: [], nextId: 1 });
  },

  setMinLevel: (level: LogLevel) => {
    set({ minLevel: level });
  },

  addLog: (entry: Omit<LogEntry, "id" | "timestamp">) => {
    const state = get();
    const { minLevel } = state;

    // Filter by minimum level
    if (LEVEL_ORDER[entry.level] < LEVEL_ORDER[minLevel]) {
      return;
    }

    const newEntry: LogEntry = {
      id: state.nextId,
      timestamp: Date.now(),
      ...entry,
    };

    const newLogs = [...state.logs, newEntry];

    // Ring buffer: remove oldest entries if over limit
    const trimmedLogs =
      newLogs.length > MAX_LOG_ENTRIES
        ? newLogs.slice(-MAX_LOG_ENTRIES)
        : newLogs;

    set({
      logs: trimmedLogs,
      nextId: state.nextId + 1,
    });
  },
}));

// ─── Module-level Helper ───────────────────────────────────────────────────────

/**
 * Log a debug message. Can be called from anywhere without needing to access the store directly.
 *
 * @param level - Severity level (debug, info, warn, error)
 * @param source - Source identifier (e.g., function name, module name)
 * @param message - Human-readable message
 * @param data - Optional additional data to log (will be JSON.stringify'd in UI)
 */
export function debugLog(
  level: LogLevel,
  source: string,
  message: string,
  data?: unknown,
): void {
  useDebugLogStore.getState().addLog({ level, source, message, data });
}
