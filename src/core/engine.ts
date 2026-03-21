/**
 * engine.ts — EditorEngine with flattened state properties.
 *
 * State properties are public on the class. No separate state type.
 * Stores layer registers callbacks to receive notifications.
 */

import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { initializeScore } from "./schema";
import {
  createProvider,
  destroyProvider,
  createPersistence,
  type SignalingConfig,
  type PeerInfo,
} from "./editor/signaling";
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

export { type SignalingConfig, type PersistenceAdapter } from "./editor/signaling";

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
    const bar = createBar(clef);
    if (index !== undefined) {
      yBars.insert(index, [bar]);
    } else {
      yBars.push([bar]);
    }
    const intBar = yBars.get(index ?? yBars.length - 1);
    const voices = intBar.get("voices") as Y.Array<Y.Map<unknown>>;
    voices.push([createVoice()]);
    const intVoice = voices.get(0);
    (intVoice.get("beats") as Y.Array<Y.Map<unknown>>).push([createBeat()]);
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
      scoreMap.set("tempo", 120);
      scoreMap.set("tempoLabel", "");

      scoreMap.set("masterBars", new Y.Array<Y.Map<unknown>>());
      scoreMap.set("tracks", new Y.Array<Y.Map<unknown>>());

      const yMasterBars = scoreMap.get("masterBars") as Y.Array<Y.Map<unknown>>;
      const yTracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;

      EditorEngine.pushDefaultTrack(yTracks, yMasterBars, "Acoustic Guitar");
    });
  }

  // ── Possibly reactive state (public) ───────────────────────────────────────────────

  selectedBeat: SelectedBeat | null = null;
  selectedBeatUuid: string | null = null; // Stable UUID for selection persistence
  selectedNoteIndex: number = -1;
  selectionRange: SelectionRange | null = null;
  connected: boolean = false;
  roomCode: string | null = null;
  peers: PeerInfo[] = [];
  connectionStatus: "idle" | "connecting" | "connected" | "error" = "idle";
  connectionError: string | null = null;
  userName: string = "";

  // ── Internal state (private) ─────────────────────────────────────────────

  private doc: Y.Doc | null = null;
  private scoreMap: Y.Map<unknown> | null = null;
  private undoManager: Y.UndoManager | null = null;
  private _signalingConfig: SignalingConfig | null = null;
  private _hookRegistry = new HookRegistry();

  // Clipboard buffer (text-based for cross-platform compatibility)
  private _clipboardText: string | null = null;

  // Provider state
  private provider: WebrtcProvider | null = null;
  private persistence: { on: (event: string, cb: () => void) => void; destroy: () => void } | null = null;

  // ── State mutation ──────────────────────────────────────────────────────

  registerHooks(hooks: EngineHooks): () => void {
    return this._hookRegistry.on(hooks);
  }

  localSetSelection(sel: SelectedBeat): void {
    // Skip if same value (prevent circular notifications)
    if (this.selectedBeat && selectionsEqual(this.selectedBeat, sel)) {
      return;
    }
    this.selectedBeat = sel;
    // Store UUID for stable lookup across re-renders
    const yBeat = this.resolveYBeat(sel.trackIndex, sel.staffIndex, sel.barIndex, sel.voiceIndex, sel.beatIndex);
    this.selectedBeatUuid = yBeat?.get("uuid") as string ?? null;
    this.selectedNoteIndex = -1;
    this._hookRegistry.emitSelection('onLocalSelectionSet', sel);
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

  private attachObserver(): void {
    if (this.scoreMap) {
      this.scoreMap.observeDeep(this._onYDocChange);
    }
  }

  private detachObserver(): void {
    if (this.scoreMap) {
      this.scoreMap.unobserveDeep(this._onYDocChange);
    }
  }

  initDoc(): void {
    if (this.doc) return;
    this.doc = new Y.Doc();
    this.scoreMap = initializeScore(this.doc);
    this.attachObserver();
    this.attachUndoManager();
  }

  destroyDoc(): void {
    this.detachUndoManager();
    this.detachObserver();
    if (this.doc) {
      this.doc.destroy();
      this.doc = null;
    }
    this.scoreMap = null;
  }

  replaceDoc(newDoc: Y.Doc, newScoreMap: Y.Map<unknown>): void {
    this.detachUndoManager();
    this.detachObserver();
    this.doc = newDoc;
    this.scoreMap = newScoreMap;
    this.attachObserver();
    this.attachUndoManager();
    // Trigger renderer rebuild after doc swap
    this._hookRegistry.emit('onLocalYDocEdit');
  }

  localEditYDoc(fn: () => void): void {
    if (!this.doc) return;
    this.doc.transact(fn, this.doc.clientID);
    this._hookRegistry.emit('onLocalYDocEdit');
  }

  getDoc(): Y.Doc | null { return this.doc; }
  getScoreMap(): Y.Map<unknown> | null { return this.scoreMap; }
  getUndoManager(): Y.UndoManager | null { return this.undoManager; }

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
                const currentString = this.selectedBeat?.string ?? null;
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

  setSignalingConfig(config: SignalingConfig): void {
    this._signalingConfig = config;
  }

  async connect(roomCode: string, userName: string): Promise<void> {
    if (!this._signalingConfig) {
      throw new Error("Signaling config not set. Call setSignalingConfig() first.");
    }

    // Disconnect existing connection
    this.disconnectInternal();

    this.connectionStatus = "connecting";
    this.connectionError = null;
    this.userName = userName;
    this._hookRegistry.emit('onConnectionMetaChange');

    // Check room exists
    try {
      const res = await fetch(`${this._signalingConfig.signalingUrl}/api/rooms/${encodeURIComponent(roomCode)}`);
      if (!res.ok) {
        this.connectionStatus = "error";
        this.connectionError = "errorRoomNotFound";
        this._hookRegistry.emit('onConnectionMetaChange');
        return;
      }
    } catch {
      // If the API is not available, proceed anyway
    }

    try {
      // Create new doc
      this.destroyDoc();
      const newDoc = new Y.Doc();
      const newScoreMap = newDoc.getMap("score");

      // Setup persistence
      this.persistence = createPersistence(roomCode, newDoc, this._signalingConfig.persistence);
      if (this.persistence) {
        this.persistence.on("synced", () => {
          this._hookRegistry.emit('onPeerYDocEdit');
        });
      }

      // Setup provider
      this.provider = createProvider(
        roomCode,
        userName,
        newDoc,
        this._signalingConfig,
        (msg) => this.handlePresenceMessage(msg),
      );
      this.provider.on("synced", () => {
        this._hookRegistry.emit('onPeerYDocEdit');
      });

      // Swap doc (triggers observer attach + rebuild)
      this.replaceDoc(newDoc, newScoreMap);

      this.connected = true;
      this.roomCode = roomCode;
      this.connectionStatus = "connected";
      this._hookRegistry.emit('onConnectionMetaChange');
    } catch {
      this.connectionStatus = "error";
      this.connectionError = "errorConnection";
      this._hookRegistry.emit('onConnectionMetaChange');
    }
  }

  disconnect(): void {
    this.disconnectInternal();
    this.connected = false;
    this.roomCode = null;
    this.peers = [];
    this.connectionStatus = "idle";
    this.connectionError = null;
    this._hookRegistry.emit('onConnectionMetaChange');
  }

  private disconnectInternal(): void {
    destroyProvider(this.provider);
    this.provider = null;
    if (this.persistence) {
      this.persistence.destroy();
      this.persistence = null;
    }
  }

  async createRoom(userName: string): Promise<void> {
    if (!this._signalingConfig) {
      throw new Error("Signaling config not set. Call setSignalingConfig() first.");
    }

    this.connectionStatus = "connecting";
    this.connectionError = null;
    this.userName = userName;
    this._hookRegistry.emit('onConnectionMetaChange');

    try {
      const res = await fetch(`${this._signalingConfig.signalingUrl}/api/rooms`, { method: "POST" });
      if (!res.ok) {
        this.connectionStatus = "error";
        this.connectionError = "errorConnection";
        this._hookRegistry.emit('onConnectionMetaChange');
        return;
      }
      const data = (await res.json()) as { code: string };
      await this.connect(data.code, userName);

      // Ensure default score content
      if (this.scoreMap) {
        const yTracks = this.scoreMap.get("tracks") as Y.Array<unknown> | undefined;
        if (!yTracks || yTracks.length === 0) {
          EditorEngine.createNewScore(this.scoreMap);
        }
      }
    } catch {
      this.connectionStatus = "error";
      this.connectionError = "errorConnection";
      this._hookRegistry.emit('onConnectionMetaChange');
    }
  }

  private handlePresenceMessage(msg: Record<string, unknown>): void {
    const type = msg.type as string | undefined;
    if (!type) return;

    let next: PeerInfo[] = this.peers;

    if (type === "auth-ok") {
      const peerList = msg.peers as PeerInfo[] | undefined;
      next = peerList ?? [];
    } else if (type === "peer-joined") {
      const id = (msg.peerId ?? msg.id) as string;
      const name = msg.name as string;
      if (id && !this.peers.some((p) => p.id === id)) {
        next = [...this.peers, { id, name: name ?? id }];
      }
    } else if (type === "peer-left") {
      const id = (msg.peerId ?? msg.id) as string;
      if (id) {
        next = this.peers.filter((p) => p.id !== id);
      }
    }

    if (next !== this.peers) {
      this.peers = next;
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