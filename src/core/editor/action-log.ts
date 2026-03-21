/**
 * action-log.ts — Pure logging logic, no Zustand.
 *
 * Ring buffer with severity filtering and a subscriber pattern.
 * The Zustand shell lives in src/stores/action-log-store.ts.
 */

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

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_LOG_ENTRIES = 500;
const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ─── ActionLog class ─────────────────────────────────────────────────────────

export class ActionLog {
  private logs: LogEntry[] = [];
  private nextId = 1;
  private _minLevel: LogLevel = "debug";
  private subscriber: ((logs: LogEntry[], minLevel: LogLevel) => void) | null = null;

  get minLevel(): LogLevel { return this._minLevel; }
  getLogs(): LogEntry[] { return this.logs; }

  setSubscriber(fn: ((logs: LogEntry[], minLevel: LogLevel) => void) | null): void {
    this.subscriber = fn;
  }

  private publish(): void {
    this.subscriber?.(this.logs, this._minLevel);
  }

  addLog(entry: Omit<LogEntry, "id" | "timestamp">): void {
    if (LEVEL_ORDER[entry.level] < LEVEL_ORDER[this._minLevel]) {
      return;
    }

    const newEntry: LogEntry = {
      id: this.nextId,
      timestamp: Date.now(),
      ...entry,
    };

    this.logs = [...this.logs, newEntry];
    if (this.logs.length > MAX_LOG_ENTRIES) {
      this.logs = this.logs.slice(-MAX_LOG_ENTRIES);
    }
    this.nextId++;
    this.publish();
  }

  clear(): void {
    this.logs = [];
    this.nextId = 1;
    this.publish();
  }

  setMinLevel(level: LogLevel): void {
    this._minLevel = level;
    this.publish();
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

export const actionLog = new ActionLog();

// ─── Convenience function ────────────────────────────────────────────────────

export function debugLog(
  level: LogLevel,
  source: string,
  message: string,
  data?: unknown,
): void {
  actionLog.addLog({ level, source, message, data });
}
