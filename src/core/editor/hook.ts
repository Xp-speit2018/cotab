/**
 * hook.ts — Multi-consumer hook registry for EditorEngine.
 *
 * The HookRegistry allows multiple consumers to register listeners for engine events.
 * Each call to `on()` returns an unsubscribe function that removes only those listeners.
 */

import type { SelectedBeat } from "@/core/engine";

/**
 * Event-driven hooks for engine integrations.
 *
 * Naming convention:
 *   - on<Who><Noun><Verb> = notification (something happened)
 *   - <Verb> = delegation (please do something)
 *
 * Who: Local = this client, Peer = remote client
 */
export interface EngineHooks {
  /** Notification: Local client edited Y.Doc (via localEditYDoc) */
  onLocalYDocEdit?: () => void;
  /** Notification: Peer client edited Y.Doc (wired to Y.Doc observer dispatches) */
  onPeerYDocEdit?: () => void;
  /** Notification: Local selection was set (via localSetSelection) */
  onLocalSelectionSet?: (sel: SelectedBeat) => void;
  /** Notification: Peer selection changed (placeholder for future peer awareness) */
  onPeerSelectionSet?: (sel: SelectedBeat) => void;
  /** Notification: Connection metadata changed (connected, roomCode, peers, connectionStatus, connectionError, userName) */
  onConnectionMetaChange?: () => void;
}

type HookKey = keyof EngineHooks;

/**
 * Manages arrays of listeners per hook. Each consumer can register hooks and
 * gets an unsubscribe function that removes only their listeners.
 */
export class HookRegistry {
  private _listeners: { [K in HookKey]: Set<NonNullable<EngineHooks[K]>> } = {
    onLocalYDocEdit: new Set(),
    onPeerYDocEdit: new Set(),
    onLocalSelectionSet: new Set(),
    onPeerSelectionSet: new Set(),
    onConnectionMetaChange: new Set(),
  };

  /**
   * Add listeners. Returns an unsubscribe function that removes only these listeners.
   */
  on(hooks: EngineHooks): () => void {
    const added: Array<{ key: HookKey; fn: unknown }> = [];

    for (const [key, fn] of Object.entries(hooks) as Array<
      [HookKey, EngineHooks[HookKey]]
    >) {
      if (fn !== undefined) {
        (this._listeners[key] as Set<unknown>).add(fn);
        added.push({ key, fn });
      }
    }

    return () => {
      for (const { key, fn } of added) {
        (this._listeners[key] as Set<unknown>).delete(fn);
      }
    };
  }

  /**
   * Dispatch a void hook to all listeners.
   */
  emit(
    key:
      | "onLocalYDocEdit"
      | "onPeerYDocEdit"
      | "onConnectionMetaChange",
  ): void {
    const listeners = this._listeners[key] as Set<() => void>;
    for (const fn of listeners) {
      fn();
    }
  }

  /**
   * Dispatch a hook with SelectedBeat arg to all listeners.
   */
  emitSelection(
    key: "onLocalSelectionSet" | "onPeerSelectionSet",
    sel: SelectedBeat,
  ): void {
    const listeners = this._listeners[key] as Set<(sel: SelectedBeat) => void>;
    for (const fn of listeners) {
      fn(sel);
    }
  }
}
