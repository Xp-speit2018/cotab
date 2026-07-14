/**
 * engine.ts - EditorEngine with local editor state and Y.Doc-backed score data.
 *
 * Selector and transport are local editor state. They are intentionally not
 * stored in the shared Y.Doc; pointer positions can later be projected through
 * presence/awareness without becoming document data.
 */

import * as Y from "yjs";
import { initializeScore, readDocumentId } from "./schema";
import { createSyncState } from "./editor/collaboration";
import type {
  CollaborationAdapter,
  CollaborationPersistence,
  CollaborationProvider,
  CollaborationTransportProfile,
  DocumentPeerConnection,
  LogicalPeerTransferProfile,
  PeerInfo,
  SyncState,
  YjsUpdateSource,
} from "./editor/collaboration";
import {
  createTrack,
  createStaff,
  createBar,
  createVoice,
  createBeat,
  createMasterBar,
} from "./schema";
import { HookRegistry, EngineHooks } from "./editor/hook";
import { _setEngineRef } from "./converters";

// ─── Re-exports for convenience ─────────────────────────────────────────────

export const FILE_IMPORT_ORIGIN = "file-import";

// Re-export collaboration types for host adapters
export type {
  CollaborationAdapter,
  CollaborationPersistence,
  CollaborationProvider,
  CollaborationTransportProfile,
  DocumentPeerConnection,
  LogicalPeerTransferProfile,
  PeerInfo,
  SyncState,
  YjsUpdateSample,
  YjsUpdateSource,
  YjsUpdateStats,
} from "./editor/collaboration";

// Pure converters (headless-safe)
export {
  importScoreToYDoc,
  buildAlphaTabScore,
  importTrack,
  importFromAlphaTab,
} from "./converters";

// ─── Selection types ────────────────────────────────────────────────────────

export interface SelectedBeat {
  trackIndex: number;
  staffIndex: number;
  voiceIndex: number;
  barIndex: number;
  beatIndex: number;
  string: number | null;
  beatUuid?: string; // UUID for stable lookup across re-renders
}

/** Deep equality check for SelectedBeat to prevent circular notifications. */
function selectionsEqual(a: SelectedBeat, b: SelectedBeat): boolean {
  return (
    a.trackIndex === b.trackIndex &&
    a.staffIndex === b.staffIndex &&
    a.voiceIndex === b.voiceIndex &&
    a.barIndex === b.barIndex &&
    a.beatIndex === b.beatIndex &&
    a.string === b.string
  );
}

export interface SelectionRange {
  trackIndex: number;
  staffIndex: number;
  voiceIndex: number;
  startBarIndex: number; // inclusive
  endBarIndex: number;   // inclusive, >= startBarIndex
}

export interface BeatAddress {
  trackIndex: number;
  staffIndex: number;
  voiceIndex: number;
  barIndex: number;
  beatIndex: number;
}

export interface LoopRange {
  start: BeatAddress;
  end: BeatAddress;
}

export interface SelectorState {
  track: unknown | null;
  staff: unknown | null;
  bar: unknown | null;
  voice: unknown | null;
  beat: unknown | null;
  note: unknown | null;
  trackIndex: number | null;
  staffIndex: number | null;
  voiceIndex: number | null;
  barIndex: number | null;
  beatIndex: number | null;
  string: number | null;
  beatUuid: string | null;
  noteIndex: number;
  selectionRange: SelectionRange | null;
}

export type SelectorPointers = Pick<
  SelectorState,
  "track" | "staff" | "bar" | "voice" | "beat" | "note"
>;

export interface TransportState {
  playhead: SelectedBeat | null;
  playheadBeatUuid: string | null;
  loopRange: LoopRange | null;
}

export interface PendingSelection {
  trackIndex: number;
  barIndex: number;
  beatIndex: number;
  staffIndex: number;
  voiceIndex: number;
  string: number | null;
}

function createEmptySelectorState(): SelectorState {
  return {
    track: null,
    staff: null,
    bar: null,
    voice: null,
    beat: null,
    note: null,
    trackIndex: null,
    staffIndex: null,
    voiceIndex: null,
    barIndex: null,
    beatIndex: null,
    string: null,
    beatUuid: null,
    noteIndex: -1,
    selectionRange: null,
  };
}

function createEmptySelectorPointers(): SelectorPointers {
  return {
    track: null,
    staff: null,
    bar: null,
    voice: null,
    beat: null,
    note: null,
  };
}

function createEmptyTransportState(): TransportState {
  return {
    playhead: null,
    playheadBeatUuid: null,
    loopRange: null,
  };
}

function selectionRangesEqual(a: SelectionRange | null, b: SelectionRange | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.trackIndex === b.trackIndex &&
    a.staffIndex === b.staffIndex &&
    a.voiceIndex === b.voiceIndex &&
    a.startBarIndex === b.startBarIndex &&
    a.endBarIndex === b.endBarIndex
  );
}

function beatAddressesEqual(a: BeatAddress, b: BeatAddress): boolean {
  return (
    a.trackIndex === b.trackIndex &&
    a.staffIndex === b.staffIndex &&
    a.voiceIndex === b.voiceIndex &&
    a.barIndex === b.barIndex &&
    a.beatIndex === b.beatIndex
  );
}

function loopRangesEqual(a: LoopRange | null, b: LoopRange | null): boolean {
  if (a === null || b === null) return a === b;
  return beatAddressesEqual(a.start, b.start) && beatAddressesEqual(a.end, b.end);
}

// Re-export EngineHooks for consumers
export type { EngineHooks };

// ─── EditorEngine class ─────────────────────────────────────────────────────

export class EditorEngine {
  // ── Static builder methods ────────────────────────────────────────────────
  // TODO: Simplify this section. I'll define what's a default blank score later

  static pushDefaultBar(
    yBars: Y.Array<Y.Map<unknown>>,
    index?: number,
    clef?: number,
  ): Y.Map<unknown> {
    const insertionIndex = index ?? yBars.length;
    const adjacentBar = yBars.length > 0
      ? yBars.get(Math.min(insertionIndex, yBars.length - 1))
      : null;
    const adjacentVoices = adjacentBar?.get("voices") as
      | Y.Array<Y.Map<unknown>>
      | undefined;
    const voiceCount = Math.max(1, adjacentVoices?.length ?? 1);
    const bar = createBar(clef);
    if (index !== undefined) {
      yBars.insert(index, [bar]);
    } else {
      yBars.push([bar]);
    }
    const intBar = yBars.get(index ?? yBars.length - 1);
    const voices = intBar.get("voices") as Y.Array<Y.Map<unknown>>;
    for (let voiceIndex = 0; voiceIndex < voiceCount; voiceIndex++) {
      voices.push([createVoice()]);
      const intVoice = voices.get(voiceIndex);
      (intVoice.get("beats") as Y.Array<Y.Map<unknown>>).push([createBeat()]);
    }
    return intBar;
  }

  static pushDefaultTrack(
    yTracks: Y.Array<Y.Map<unknown>>,
    yMasterBars: Y.Array<Y.Map<unknown>>,
    name: string = "Track 1",
  ): { track: Y.Map<unknown>; masterBar: Y.Map<unknown> } {
    yTracks.push([createTrack(name)]);
    const intTrack = yTracks.get(yTracks.length - 1);
    const staves = intTrack.get("staves") as Y.Array<Y.Map<unknown>>;
    staves.push([createStaff()]);
    const intStaff = staves.get(0);
    const yBars = intStaff.get("bars") as Y.Array<Y.Map<unknown>>;
    EditorEngine.pushDefaultBar(yBars);

    yMasterBars.push([createMasterBar()]);
    const intMb = yMasterBars.get(yMasterBars.length - 1);

    return { track: intTrack, masterBar: intMb };
  }

  static createNewScore(scoreMap: Y.Map<unknown>): void {
    const d = scoreMap.doc;
    if (!d) return;

    d.transact(() => {
      scoreMap.set("title", "Untitled");
      scoreMap.set("subTitle", "");
      scoreMap.set("artist", "");
      scoreMap.set("album", "");
      scoreMap.set("words", "");
      scoreMap.set("music", "");
      scoreMap.set("copyright", "");
      scoreMap.set("tab", "");
      scoreMap.set("instructions", "");
      scoreMap.set("notices", "");

      scoreMap.set("masterBars", new Y.Array<Y.Map<unknown>>());
      scoreMap.set("tracks", new Y.Array<Y.Map<unknown>>());

      const yMasterBars = scoreMap.get("masterBars") as Y.Array<Y.Map<unknown>>;
      const yTracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;

      EditorEngine.pushDefaultTrack(yTracks, yMasterBars, "Acoustic Guitar");
    });
  }

  // ── Local editor state (public) ───────────────────────────────────────────

  selector: SelectorState = createEmptySelectorState();
  transport: TransportState = createEmptyTransportState();

  pendingSelection: PendingSelection | null = null; // Post-mutation selection hint
  connected: boolean = false;
  roomCode: string | null = null;
  peers: PeerInfo[] = [];
  syncState: SyncState = createSyncState();
  connectionStatus: "idle" | "connecting" | "connected" | "error" = "idle";
  connectionError: string | null = null;
  userName: string = "";

  // ── Internal state (private) ─────────────────────────────────────────────

  private doc: Y.Doc | null = null;
  private scoreMap: Y.Map<unknown> | null = null;
  private undoManager: Y.UndoManager | null = null;
  private _collaborationAdapter: CollaborationAdapter | null = null;
  private _hookRegistry = new HookRegistry();
  private _documentPeers = new Map<
    DocumentPeerConnection,
    { origin: symbol; unsubscribe: () => void; unsubscribeStatus: (() => void) | null }
  >();
  private _networkPeers = new Map<string, PeerInfo>();
  private _connectionGeneration = 0;

  // Clipboard buffer (text-based for cross-platform compatibility)
  private _clipboardText: string | null = null;

  private provider: CollaborationProvider | null = null;
  private persistence: CollaborationPersistence | null = null;

  // ── State mutation ──────────────────────────────────────────────────────

  registerHooks(hooks: EngineHooks): () => void {
    return this._hookRegistry.on(hooks);
  }

  registerDocumentPeer(connection: DocumentPeerConnection): () => void {
    const existing = this._documentPeers.get(connection);
    if (existing) {
      return () => this.unregisterDocumentPeer(connection);
    }

    const origin = Symbol("document-peer");
    const unsubscribe = connection.onDocumentUpdate((update) => {
      if (this.doc) Y.applyUpdate(this.doc, update, origin);
    });
    const unsubscribeStatus = connection.onPeerStatusChange?.((status) => {
      if (connection.peer) {
        connection.peer.status = status;
        this.refreshPeerRoster();
      }
    }) ?? null;
    this._documentPeers.set(connection, { origin, unsubscribe, unsubscribeStatus });
    if (this.doc) {
      const update = Y.encodeStateAsUpdate(this.doc);
      connection.resetDocument(update);
      this.recordLogicalPeerTransfer(connection, "reset", update.byteLength);
    }
    this.refreshPeerRoster();

    return () => this.unregisterDocumentPeer(connection);
  }

  private unregisterDocumentPeer(connection: DocumentPeerConnection): void {
    const peer = this._documentPeers.get(connection);
    if (!peer) return;
    peer.unsubscribe();
    peer.unsubscribeStatus?.();
    this._documentPeers.delete(connection);
    this.refreshPeerRoster();
  }

  private resetDocumentPeers(): void {
    if (!this.doc) return;
    const update = Y.encodeStateAsUpdate(this.doc);
    for (const connection of this._documentPeers.keys()) {
      connection.resetDocument(update);
      this.recordLogicalPeerTransfer(connection, "reset", update.byteLength);
    }
  }

  localSetSelection(
    sel: SelectedBeat,
    selectedNoteIndex: number = -1,
    pointers: Partial<SelectorPointers> = {},
    preserveSelectionRange: boolean = false,
  ): void {
    const sameSelection =
      this.selector.trackIndex === sel.trackIndex &&
      this.selector.staffIndex === sel.staffIndex &&
      this.selector.voiceIndex === sel.voiceIndex &&
      this.selector.barIndex === sel.barIndex &&
      this.selector.beatIndex === sel.beatIndex &&
      this.selector.string === sel.string;
    // Skip if same value (prevent circular notifications)
    if (
      sameSelection &&
      this.selector.noteIndex === selectedNoteIndex &&
      Object.keys(pointers).length === 0
    ) {
      return;
    }
    // Store UUID for stable lookup across re-renders
    const yBeat = this.resolveYBeat(sel.trackIndex, sel.staffIndex, sel.barIndex, sel.voiceIndex, sel.beatIndex);
    const beatUuid = yBeat?.get("uuid") as string ?? null;
    this.selector = {
      ...this.selector,
      ...createEmptySelectorPointers(),
      ...pointers,
      trackIndex: sel.trackIndex,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      barIndex: sel.barIndex,
      beatIndex: sel.beatIndex,
      string: sel.string,
      beatUuid,
      noteIndex: selectedNoteIndex,
      selectionRange: preserveSelectionRange
        ? this.selector.selectionRange
        : null,
    };
    this._hookRegistry.emitSelector("onLocalSelectorChange", this.selector);
    if (!sameSelection) {
      this._hookRegistry.emitSelection('onLocalSelectionSet', sel);
    }
  }

  localSetSelectorPointers(pointers: Partial<SelectorPointers>): void {
    this.selector = {
      ...this.selector,
      ...pointers,
    };
    this._hookRegistry.emitSelector("onLocalSelectorChange", this.selector);
  }

  localSetSelectionRange(range: SelectionRange | null): void {
    if (selectionRangesEqual(this.selector.selectionRange, range)) return;
    this.selector = {
      ...this.selector,
      selectionRange: range,
    };
    this._hookRegistry.emitSelector("onLocalSelectorChange", this.selector);
  }

  localClearSelection(): void {
    this.selector = createEmptySelectorState();
    this._hookRegistry.emitSelector("onLocalSelectorChange", this.selector);
  }

  localSetTransportPlayhead(playhead: SelectedBeat | null): void {
    const current = this.transport.playhead;
    if (
      (current === null && playhead === null) ||
      (current !== null && playhead !== null && selectionsEqual(current, playhead))
    ) {
      return;
    }

    const yBeat = playhead
      ? this.resolveYBeat(
          playhead.trackIndex,
          playhead.staffIndex,
          playhead.barIndex,
          playhead.voiceIndex,
          playhead.beatIndex,
        )
      : null;
    this.transport = {
      ...this.transport,
      playhead,
      playheadBeatUuid: yBeat?.get("uuid") as string ?? null,
    };
    this._hookRegistry.emitTransport("onLocalTransportChange", this.transport);
  }

  localSetTransportLoopRange(range: LoopRange | null): void {
    if (loopRangesEqual(this.transport.loopRange, range)) return;
    this.transport = {
      ...this.transport,
      loopRange: range,
    };
    this._hookRegistry.emitTransport("onLocalTransportChange", this.transport);
  }

  // ── Clipboard ────────────────────────────────────────────────────────────

  setClipboard(text: string | null): void {
    this._clipboardText = text;
    this._hookRegistry.emitClipboard('onClipboardChange', text);
  }

  getClipboard(): string | null {
    return this._clipboardText;
  }

  registerClipboardHook(callback: (text: string | null) => void): () => void {
    return this._hookRegistry.on({ onClipboardChange: callback });
  }

  // ── Y.Doc lifecycle ─────────────────────────────────────────────────────

  private attachUndoManager(): void {
    if (!this.scoreMap || !this.doc) return;
    this.undoManager = new Y.UndoManager([this.scoreMap], {
      trackedOrigins: new Set([this.doc.clientID]),
    });
  }

  private detachUndoManager(): void {
    if (this.undoManager) {
      this.undoManager.destroy();
      this.undoManager = null;
    }
  }

  private documentPeerForOrigin(
    origin: unknown,
  ): [DocumentPeerConnection, { origin: symbol }] | null {
    for (const [connection, peer] of this._documentPeers) {
      if (peer.origin === origin) return [connection, peer];
    }
    return null;
  }

  private yjsUpdateSource(
    origin: unknown,
    sourcePeer: DocumentPeerConnection | null,
  ): YjsUpdateSource {
    if (
      (this.doc && origin === this.doc.clientID)
      || origin === FILE_IMPORT_ORIGIN
      || (this.undoManager !== null && origin === this.undoManager)
    ) return "local";
    if (sourcePeer?.peer?.kind === "agent") return "agent";
    if (sourcePeer) return "logicalPeer";
    if (this.provider?.ownsOrigin?.(origin)) return "network";
    if (this.persistence?.ownsOrigin?.(origin)) return "persistence";
    return "system";
  }

  private recordYjsUpdate(
    source: YjsUpdateSource,
    update: Uint8Array,
    peerId: string | null,
  ): void {
    const at = Date.now();
    const previous = this.syncState.yjs.bySource[source];
    const sample = { at, source, peerId, bytes: update.byteLength };
    this.syncState = {
      ...this.syncState,
      yjs: {
        bySource: {
          ...this.syncState.yjs.bySource,
          [source]: {
            updates: previous.updates + 1,
            bytes: previous.bytes + update.byteLength,
            maxBytes: Math.max(previous.maxBytes, update.byteLength),
            lastAt: at,
          },
        },
        lastUpdate: sample,
        recentUpdates: [...this.syncState.yjs.recentUpdates, sample].slice(-50),
      },
    };
  }

  private recordLogicalPeerTransfer(
    connection: DocumentPeerConnection,
    direction: "reset" | "sent" | "received",
    bytes: number,
  ): void {
    const peerId = connection.peer?.id;
    if (!peerId) return;
    const previous: LogicalPeerTransferProfile = this.syncState.logicalPeers[peerId] ?? {
      resetCount: 0,
      resetBytes: 0,
      sentUpdates: 0,
      sentBytes: 0,
      receivedUpdates: 0,
      receivedBytes: 0,
      lastTransferAt: null,
    };
    const next = { ...previous, lastTransferAt: Date.now() };
    if (direction === "reset") {
      next.resetCount += 1;
      next.resetBytes += bytes;
    } else if (direction === "sent") {
      next.sentUpdates += 1;
      next.sentBytes += bytes;
    } else {
      next.receivedUpdates += 1;
      next.receivedBytes += bytes;
    }
    this.syncState = {
      ...this.syncState,
      logicalPeers: {
        ...this.syncState.logicalPeers,
        [peerId]: next,
      },
    };
  }

  private _onDocumentUpdate = (update: Uint8Array, origin: unknown): void => {
    const sourceEntry = this.documentPeerForOrigin(origin);
    const sourceConnection = sourceEntry?.[0] ?? null;
    const source = this.yjsUpdateSource(origin, sourceConnection);
    this.recordYjsUpdate(source, update, sourceConnection?.peer?.id ?? null);
    if (sourceConnection) {
      this.recordLogicalPeerTransfer(sourceConnection, "received", update.byteLength);
    }

    for (const [connection, peer] of this._documentPeers) {
      if (origin !== peer.origin) {
        connection.updateDocument(update);
        this.recordLogicalPeerTransfer(connection, "sent", update.byteLength);
      }
    }
    this._hookRegistry.emit('onConnectionMetaChange');
  };

  private attachObserver(): void {
    if (this.scoreMap) {
      this.scoreMap.observeDeep(this._onYDocChange);
    }
    this.doc?.on("update", this._onDocumentUpdate);
  }

  private detachObserver(): void {
    if (this.scoreMap) {
      this.scoreMap.unobserveDeep(this._onYDocChange);
    }
    this.doc?.off("update", this._onDocumentUpdate);
  }

  initDoc(): void {
    if (this.doc) return;
    this.doc = new Y.Doc();
    this.scoreMap = initializeScore(this.doc);
    this.attachObserver();
    this.attachUndoManager();
    this.resetDocumentPeers();
  }

  destroyDoc(): void {
    this.detachUndoManager();
    this.detachObserver();
    if (this.doc) {
      this.doc.destroy();
      this.doc = null;
    }
    this.scoreMap = null;
    this.localClearSelection();
    this.localSetTransportPlayhead(null);
  }

  replaceDoc(newDoc: Y.Doc, newScoreMap: Y.Map<unknown>): void {
    this.detachUndoManager();
    this.detachObserver();
    this.doc = newDoc;
    this.scoreMap = newScoreMap;
    this.attachObserver();
    this.attachUndoManager();
    this.resetDocumentPeers();
    // Trigger renderer rebuild after doc swap
    this._hookRegistry.emit('onLocalYDocEdit');
  }

  localEditYDoc(fn: () => void, nextSelection?: PendingSelection | null): void {
    if (!this.doc) return;
    this.pendingSelection = nextSelection ?? null;
    this.doc.transact(fn, this.doc.clientID);
    this._hookRegistry.emit('onLocalYDocEdit');
  }

  getDoc(): Y.Doc | null { return this.doc; }
  getScoreMap(): Y.Map<unknown> | null { return this.scoreMap; }
  getUndoManager(): Y.UndoManager | null { return this.undoManager; }
  getDocumentId(): string | null {
    return this.doc ? readDocumentId(this.doc) : null;
  }

  // Internal observer that dispatches peer edit notifications
  private _onYDocChange = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _events: Y.YEvent<any>[],
    transaction: Y.Transaction,
  ): void => {
    if (transaction.origin === FILE_IMPORT_ORIGIN) return;
    if (!this.doc) return;
    if (transaction.origin === this.doc.clientID) return; // Local already handled

    // Peer edit (WebRTC sync, etc.)
    this._hookRegistry.emit('onPeerYDocEdit');
  };

  // ── Navigators ───────────────────────────────────────────────────────────

  resolveYTrack(trackIndex: number): Y.Map<unknown> | null {
    if (!this.scoreMap) return null;
    const tracks = this.scoreMap.get("tracks") as Y.Array<Y.Map<unknown>> | undefined;
    if (!tracks || trackIndex < 0 || trackIndex >= tracks.length) return null;
    return tracks.get(trackIndex);
  }

  resolveYStaff(trackIndex: number, staffIndex: number): Y.Map<unknown> | null {
    const yTrack = this.resolveYTrack(trackIndex);
    if (!yTrack) return null;
    const staves = yTrack.get("staves") as Y.Array<Y.Map<unknown>>;
    if (!staves || staffIndex < 0 || staffIndex >= staves.length) return null;
    return staves.get(staffIndex);
  }

  resolveYBar(trackIndex: number, staffIndex: number, barIndex: number): Y.Map<unknown> | null {
    const yStaff = this.resolveYStaff(trackIndex, staffIndex);
    if (!yStaff) return null;
    const bars = yStaff.get("bars") as Y.Array<Y.Map<unknown>>;
    if (!bars || barIndex < 0 || barIndex >= bars.length) return null;
    return bars.get(barIndex);
  }

  resolveYVoice(
    trackIndex: number, staffIndex: number, barIndex: number, voiceIndex: number,
  ): Y.Map<unknown> | null {
    const yBar = this.resolveYBar(trackIndex, staffIndex, barIndex);
    if (!yBar) return null;
    const voices = yBar.get("voices") as Y.Array<Y.Map<unknown>>;
    if (!voices || voiceIndex < 0 || voiceIndex >= voices.length) return null;
    return voices.get(voiceIndex);
  }

  resolveYBeat(
    trackIndex: number, staffIndex: number, barIndex: number, voiceIndex: number, beatIndex: number,
  ): Y.Map<unknown> | null {
    const yVoice = this.resolveYVoice(trackIndex, staffIndex, barIndex, voiceIndex);
    if (!yVoice) return null;
    const beats = yVoice.get("beats") as Y.Array<Y.Map<unknown>>;
    if (!beats || beatIndex < 0 || beatIndex >= beats.length) return null;
    return beats.get(beatIndex);
  }

  resolveYNote(
    trackIndex: number, staffIndex: number, barIndex: number, voiceIndex: number, beatIndex: number, noteIndex: number,
  ): Y.Map<unknown> | null {
    const yBeat = this.resolveYBeat(trackIndex, staffIndex, barIndex, voiceIndex, beatIndex);
    if (!yBeat) return null;
    const notes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
    if (!notes || noteIndex < 0 || noteIndex >= notes.length) return null;
    return notes.get(noteIndex);
  }

  resolveYMasterBar(barIndex: number): Y.Map<unknown> | null {
    if (!this.scoreMap) return null;
    const masterBars = this.scoreMap.get("masterBars") as Y.Array<Y.Map<unknown>> | undefined;
    if (!masterBars || barIndex < 0 || barIndex >= masterBars.length) return null;
    return masterBars.get(barIndex);
  }

  /**
   * Find a beat by its UUID and return its current indices.
   * Used to restore selection after Y.Doc changes cause re-render.
   */
  resolveSelectionByUuid(beatUuid: string): SelectedBeat | null {
    if (!this.scoreMap) return null;
    const yTracks = this.scoreMap.get("tracks") as Y.Array<Y.Map<unknown>> | undefined;
    if (!yTracks) return null;

    for (let trackIndex = 0; trackIndex < yTracks.length; trackIndex++) {
      const yTrack = yTracks.get(trackIndex);
      const yStaves = yTrack.get("staves") as Y.Array<Y.Map<unknown>> | undefined;
      if (!yStaves) continue;

      for (let staffIndex = 0; staffIndex < yStaves.length; staffIndex++) {
        const yStaff = yStaves.get(staffIndex);
        const yBars = yStaff.get("bars") as Y.Array<Y.Map<unknown>> | undefined;
        if (!yBars) continue;

        for (let barIndex = 0; barIndex < yBars.length; barIndex++) {
          const yBar = yBars.get(barIndex);
          const yVoices = yBar.get("voices") as Y.Array<Y.Map<unknown>> | undefined;
          if (!yVoices) continue;

          for (let voiceIndex = 0; voiceIndex < yVoices.length; voiceIndex++) {
            const yVoice = yVoices.get(voiceIndex);
            const yBeats = yVoice.get("beats") as Y.Array<Y.Map<unknown>> | undefined;
            if (!yBeats) continue;

            for (let beatIndex = 0; beatIndex < yBeats.length; beatIndex++) {
              const yBeat = yBeats.get(beatIndex);
              if ((yBeat.get("uuid") as string) === beatUuid) {
                // Preserve string from current selection if available
                const currentString = this.selector.string;
                return {
                  trackIndex,
                  staffIndex,
                  barIndex,
                  voiceIndex,
                  beatIndex,
                  string: currentString,
                  beatUuid,
                };
              }
            }
          }
        }
      }
    }
    return null;
  }

  // ── Collaboration ─────────────────────────────────────────────────────────

  setCollaborationAdapter(adapter: CollaborationAdapter): void {
    this._collaborationAdapter = adapter;
  }

  private syncPhase(): SyncState["phase"] {
    if (this.connectionStatus === "error") return "error";
    if (!this.connected) {
      return this.connectionStatus === "connecting" ? "connecting" : "offline";
    }

    const transport = this.syncState.transport;
    if (this._networkPeers.size === 0) {
      return transport.signalingConnected ? "ready" : "connecting";
    }
    if (
      transport.syncedPeerCount >= this._networkPeers.size
      && [...this._networkPeers.values()].every((peer) => peer.status === "synced")
    ) {
      return "synced";
    }
    return transport.connectedPeerCount > 0 ? "syncing" : "connecting";
  }

  private refreshSyncPhase(): void {
    const phase = this.syncPhase();
    const firstSynced = phase === "synced" && this.syncState.phase !== "synced";
    this.syncState = {
      ...this.syncState,
      phase,
      error: phase === "error" ? this.connectionError : null,
      networkPeerCount: this._networkPeers.size,
      logicalPeerCount: [...this._documentPeers.keys()].filter((connection) => connection.peer).length,
      lastSyncedAt: firstSynced ? Date.now() : this.syncState.lastSyncedAt,
    };
  }

  private refreshPeerRoster(): void {
    const logicalPeers = [...this._documentPeers.keys()]
      .map((connection) => connection.peer)
      .filter((peer): peer is PeerInfo => peer !== undefined);
    const peers = new Map(this._networkPeers);
    for (const peer of logicalPeers) peers.set(peer.id, peer);
    this.peers = [...peers.values()];
    this.refreshSyncPhase();
    this._hookRegistry.emit('onConnectionMetaChange');
  }

  private setTransportProfile(profile: CollaborationTransportProfile): void {
    this.syncState = {
      ...this.syncState,
      transport: profile,
    };
    this.refreshSyncPhase();
    this._hookRegistry.emit('onConnectionMetaChange');
  }

  async connect(roomCode: string, userName: string): Promise<void> {
    if (!this._collaborationAdapter) {
      throw new Error("Collaboration adapter not set. Call setCollaborationAdapter() first.");
    }

    const connectionGeneration = ++this._connectionGeneration;

    // Disconnect existing connection
    await this.disconnectInternal();
    if (connectionGeneration !== this._connectionGeneration) return;

    this.connected = false;
    this.roomCode = null;
    this.connectionStatus = "connecting";
    this.connectionError = null;
    this.userName = userName;
    this.syncState = createSyncState("connecting");
    this.refreshPeerRoster();
    this._hookRegistry.emit('onConnectionMetaChange');

    if (this._collaborationAdapter.roomExists) {
      try {
        const exists = await this._collaborationAdapter.roomExists(roomCode);
        if (connectionGeneration !== this._connectionGeneration) return;
        if (!exists) {
          this.connectionStatus = "error";
          this.connectionError = "errorRoomNotFound";
          this.refreshSyncPhase();
          this._hookRegistry.emit('onConnectionMetaChange');
          return;
        }
      } catch {
        // Some adapters cannot confirm room existence before joining.
      }
    }
    if (connectionGeneration !== this._connectionGeneration) return;

    let pendingDoc: Y.Doc | null = null;
    try {
      this.destroyDoc();
      const newDoc = new Y.Doc();
      pendingDoc = newDoc;
      const newScoreMap = newDoc.getMap("score");

      this.persistence = this._collaborationAdapter.createPersistence?.(roomCode, newDoc) ?? null;
      if (this.persistence) {
        this.persistence.on("synced", () => {
          if (connectionGeneration !== this._connectionGeneration) return;
          this._hookRegistry.emit('onPeerYDocEdit');
        });
      }

      this.provider = this._collaborationAdapter.createProvider({
        roomCode,
        userName,
        doc: newDoc,
        onPresenceMessage: (msg) => {
          if (connectionGeneration === this._connectionGeneration) {
            this.handlePresenceMessage(msg);
          }
        },
      });
      this.provider.on("synced", () => {
        if (connectionGeneration !== this._connectionGeneration) return;
        this._hookRegistry.emit('onPeerYDocEdit');
      });

      // Swap doc (triggers observer attach + rebuild)
      this.replaceDoc(newDoc, newScoreMap);

      this.connected = true;
      this.roomCode = roomCode;
      this.connectionStatus = "connected";
      this.refreshSyncPhase();
      this._hookRegistry.emit('onConnectionMetaChange');
    } catch {
      await this.disconnectInternal();
      if (pendingDoc && this.doc !== pendingDoc) pendingDoc.destroy();
      if (connectionGeneration !== this._connectionGeneration) return;
      if (!this.doc) this.initDoc();
      this.connected = false;
      this.roomCode = null;
      this.connectionStatus = "error";
      this.connectionError = "errorConnection";
      this.refreshSyncPhase();
      this._hookRegistry.emit('onConnectionMetaChange');
    }
  }

  async disconnect(): Promise<void> {
    this._connectionGeneration += 1;
    await this.disconnectInternal();
    this.connected = false;
    this.roomCode = null;
    this.syncState = createSyncState();
    this.connectionStatus = "idle";
    this.connectionError = null;
    this.refreshPeerRoster();
  }

  private async disconnectInternal(): Promise<void> {
    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
    }
    if (this.persistence) {
      this.persistence.destroy();
      this.persistence = null;
    }
    this._networkPeers.clear();
  }

  async createRoom(userName: string): Promise<void> {
    if (!this._collaborationAdapter) {
      throw new Error("Collaboration adapter not set. Call setCollaborationAdapter() first.");
    }
    if (!this._collaborationAdapter.createRoom) {
      throw new Error("Current collaboration adapter does not support room creation.");
    }

    const roomGeneration = ++this._connectionGeneration;
    await this.disconnectInternal();
    if (roomGeneration !== this._connectionGeneration) return;

    this.connected = false;
    this.roomCode = null;
    this.connectionStatus = "connecting";
    this.connectionError = null;
    this.userName = userName;
    this.syncState = createSyncState("connecting");
    this.refreshPeerRoster();

    try {
      const roomCode = await this._collaborationAdapter.createRoom();
      if (roomGeneration !== this._connectionGeneration) return;
      await this.connect(roomCode, userName);
      if (!this.connected) return;

      // Ensure default score content
      if (this.scoreMap) {
        const yTracks = this.scoreMap.get("tracks") as Y.Array<unknown> | undefined;
        if (!yTracks || yTracks.length === 0) {
          this.localEditYDoc(() => EditorEngine.createNewScore(this.scoreMap!));
        }
      }
    } catch {
      if (roomGeneration !== this._connectionGeneration) return;
      this.connectionStatus = "error";
      this.connectionError = "errorConnection";
      this.refreshSyncPhase();
      this._hookRegistry.emit('onConnectionMetaChange');
    }
  }

  private handlePresenceMessage(msg: Record<string, unknown>): void {
    const type = msg.type as string | undefined;
    if (!type) return;

    if (type === "network-peers") {
      const peers = Array.isArray(msg.peers) ? msg.peers as PeerInfo[] : [];
      this._networkPeers = new Map(peers.map((peer) => [peer.id, peer]));
      this.refreshPeerRoster();
      return;
    }

    if (type === "transport-profile") {
      this.setTransportProfile(msg.profile as CollaborationTransportProfile);
      return;
    }

    if (type === "collaboration-error") {
      this.connectionStatus = "error";
      this.connectionError = typeof msg.error === "string" ? msg.error : "errorConnection";
      this.refreshSyncPhase();
      this._hookRegistry.emit('onConnectionMetaChange');
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const engine = new EditorEngine();

// Set engine reference for converters (avoids circular import)
_setEngineRef(
  {
    getDoc: () => engine.getDoc(),
    getScoreMap: () => engine.getScoreMap(),
    getUndoManager: () => engine.getUndoManager(),
  },
  FILE_IMPORT_ORIGIN,
);
