/**
 * hook.ts — Multi-consumer hook registry for EditorEngine.
 *
 * The HookRegistry allows multiple consumers to register listeners for engine events.
 * Each call to `on()` returns an unsubscribe function that removes only those listeners.
 */

import type * as Y from "yjs";
import type { SelectedBeat, SelectorState, TransportState } from "@/core/engine";
import type { DocumentChange } from "./document-change";

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
  /** Notification: the active Y.Doc instance changed or was destroyed. */
  onDocumentReplaced?: (doc: Y.Doc | null) => void;
  /** Notification: Local client edited Y.Doc (via localEditYDoc) */
  onLocalYDocEdit?: (change: DocumentChange) => void;
  /** Notification: Peer client edited Y.Doc (wired to Y.Doc observer dispatches) */
  onPeerYDocEdit?: (change: DocumentChange) => void;
  /** Notification: Local selection was set (via localSetSelection) */
  onLocalSelectionSet?: (sel: SelectedBeat) => void;
  /** Notification: Local selector state changed */
  onLocalSelectorChange?: (selector: SelectorState) => void;
  /** Notification: Local transport pointer changed */
  onLocalTransportChange?: (transport: TransportState) => void;
  /** Notification: Peer selection changed (placeholder for future peer awareness) */
  onPeerSelectionSet?: (sel: SelectedBeat) => void;
  /** Notification: Connection metadata changed (connected, roomCode, peers, connectionStatus, connectionError, userName) */
  onConnectionMetaChange?: () => void;
  /** Notification: Clipboard content changed (via setClipboard) */
  onClipboardChange?: (text: string | null) => void;
}

type HookKey = keyof EngineHooks;


/**
 * Manages arrays of listeners per hook. Each consumer can register hooks and
 * gets an unsubscribe function that removes only their listeners.
 */
export class HookRegistry {
  private _listeners: { [K in HookKey]: Set<NonNullable<EngineHooks[K]>> } = {
    onDocumentReplaced: new Set(),
    onLocalYDocEdit: new Set(),
    onPeerYDocEdit: new Set(),
    onLocalSelectionSet: new Set(),
    onLocalSelectorChange: new Set(),
    onLocalTransportChange: new Set(),
    onPeerSelectionSet: new Set(),
    onConnectionMetaChange: new Set(),
    onClipboardChange: new Set(),
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
    key: "onConnectionMetaChange",
  ): void {
    const listeners = this._listeners[key] as Set<() => void>;
    for (const fn of listeners) {
      fn();
    }
  }

  emitDocument(
    key: "onDocumentReplaced",
    doc: Y.Doc | null,
  ): void {
    const listeners = this._listeners[key] as Set<(doc: Y.Doc | null) => void>;
    for (const fn of listeners) {
      fn(doc);
    }
  }

  emitDocumentChange(
    key: "onLocalYDocEdit" | "onPeerYDocEdit",
    change: DocumentChange,
  ): void {
    const listeners = this._listeners[key] as Set<
      (change: DocumentChange) => void
    >;
    for (const fn of listeners) {
      fn(change);
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

  emitSelector(
    key: "onLocalSelectorChange",
    selector: SelectorState,
  ): void {
    const listeners = this._listeners[key] as Set<(selector: SelectorState) => void>;
    for (const fn of listeners) {
      fn(selector);
    }
  }

  emitTransport(
    key: "onLocalTransportChange",
    transport: TransportState,
  ): void {
    const listeners = this._listeners[key] as Set<(transport: TransportState) => void>;
    for (const fn of listeners) {
      fn(transport);
    }
  }

  /**
   * Dispatch a clipboard change hook to all listeners.
   */
  emitClipboard(
    key: "onClipboardChange",
    text: string | null,
  ): void {
    const listeners = this._listeners[key] as Set<(text: string | null) => void>;
    for (const fn of listeners) {
      fn(text);
    }
  }
}
