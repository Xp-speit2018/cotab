/**
 * sync.ts — The sync engine bridging Y.Doc ↔ AlphaTab.
 *
 * Owns the Y.Doc lifecycle (creation, observer, destruction) and provides:
 *   - initDoc / destroyDoc: Y.Doc lifecycle
 *   - importFromAlphaTab: AlphaTab Score → Y.Doc (after GP load)
 *   - rebuildFromYDoc: Y.Doc → AlphaTab Score (for remote changes / edits)
 *   - observeDeep handler that auto-rebuilds when Y.Doc changes
 *
 * Flags prevent infinite loops between the two data paths.
 */

import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { IndexeddbPersistence } from "y-indexeddb";
import { initializeScore } from "./schema";
import { importScoreToYDoc, buildAlphaTabScore } from "./converters";
import { getApi } from "@/stores/player-api";
import { syncUndoState } from "@/stores/undo-store";

// ─── Constants ───────────────────────────────────────────────────────────────

export const FILE_IMPORT_ORIGIN = "file-import";

// ─── Internal state ──────────────────────────────────────────────────────────

let doc: Y.Doc | null = null;
let scoreMap: Y.Map<unknown> | null = null;
let undoManager: Y.UndoManager | null = null;
let provider: WebrtcProvider | null = null;
let persistence: IndexeddbPersistence | null = null;
let _rebuildingFromYDoc = false;

// ─── Accessors ───────────────────────────────────────────────────────────────

export function getDoc(): Y.Doc | null {
  return doc;
}

export function getScoreMap(): Y.Map<unknown> | null {
  return scoreMap;
}

export function isRebuildingFromYDoc(): boolean {
  return _rebuildingFromYDoc;
}

export function getUndoManager(): Y.UndoManager | null {
  return undoManager;
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

export function initDoc(): void {
  if (doc) return;
  doc = new Y.Doc();
  scoreMap = initializeScore(doc);
  scoreMap.observeDeep(onYDocChange);

  undoManager = new Y.UndoManager([scoreMap], {
    trackedOrigins: new Set([doc.clientID]),
  });
  attachUndoListeners(undoManager);
}

export function destroyDoc(): void {
  if (undoManager) {
    detachUndoListeners(undoManager);
    undoManager.destroy();
    undoManager = null;
  }
  if (provider) {
    provider.destroy();
    provider = null;
  }
  if (persistence) {
    persistence.destroy();
    persistence = null;
  }
  if (scoreMap) {
    scoreMap.unobserveDeep(onYDocChange);
    scoreMap = null;
  }
  if (doc) {
    doc.destroy();
    doc = null;
  }
}

// ─── AlphaTab → Y.Doc (after GP file load) ──────────────────────────────────

/**
 * Import an AlphaTab Score into Y.Doc using the FILE_IMPORT_ORIGIN
 * so the observer knows NOT to rebuild AlphaTab (it already has the score).
 */
export function importFromAlphaTab(
  score: import("@coderline/alphatab").model.Score,
): void {
  if (!doc) return;
  importScoreToYDoc(score, doc, FILE_IMPORT_ORIGIN);
  undoManager?.clear();
}

// ─── Collaboration Providers ──────────────────────────────────────────────────

/**
 * Swap the current local Y.Doc for a collaborative one connected to a room.
 * Attaches WebRTC and IndexedDB providers. Previous doc is destroyed.
 */
export function connectProviders(
  roomCode: string,
  userName: string,
  onPresenceMessage?: (msg: Record<string, unknown>) => void,
): void {
  destroyDoc();

  doc = new Y.Doc();
  // Don't call initializeScore here — it would create default data that
  // competes with the remote state in the CRDT merge (e.g., empty tracks
  // array overwrites the creator's populated tracks). The remote sync or
  // IndexedDB persistence will populate the doc.
  scoreMap = doc.getMap("score");
  scoreMap.observeDeep(onYDocChange);

  persistence = new IndexeddbPersistence(`cotab:${roomCode}`, doc);
  persistence.on("synced", () => {
    rebuildFromYDoc();
  });

  const httpBase = import.meta.env.VITE_SIGNALING_URL;
  const wsBase = httpBase.replace(/^http/, "ws");
  const signalingUrl = `${wsBase}?roomCode=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(userName)}`;

  provider = new WebrtcProvider(`room:${roomCode}`, doc, {
    signaling: [signalingUrl],
  });
  provider.on("synced", () => {
    rebuildFromYDoc();
  });

  if (onPresenceMessage) {
    for (const sigConn of provider.signalingConns) {
      sigConn.on("message", (msg: Record<string, unknown>) => {
        onPresenceMessage(msg);
      });
    }
  }

  undoManager = new Y.UndoManager([scoreMap], {
    trackedOrigins: new Set([doc.clientID]),
  });
  attachUndoListeners(undoManager);
}

/**
 * Tear down collaboration providers but keep the doc alive for local editing.
 * After disconnecting, the doc remains in its current state without syncing.
 */
export function disconnectProviders(): void {
  if (provider) {
    provider.destroy();
    provider = null;
  }
  if (persistence) {
    persistence.destroy();
    persistence = null;
  }
}

// ─── Y.Doc → AlphaTab (for remote changes and local edits) ──────────────────

/**
 * Rebuild a complete AlphaTab Score from Y.Doc and load it into the API.
 * Sets _rebuildingFromYDoc so the scoreLoaded handler knows not to re-import.
 */
export function rebuildFromYDoc(): void {
  const api = getApi();
  if (!scoreMap || !api) return;

  // Don't load an empty score — it causes AlphaTab errors and breaks bounds/cursor.
  // Let the next change (createNewScore or remote sync) trigger a proper rebuild.
  const yTracks = scoreMap.get("tracks") as Y.Array<unknown> | undefined;
  if (!yTracks || yTracks.length === 0) return;

  _rebuildingFromYDoc = true;
  try {
    const score = buildAlphaTabScore(scoreMap, api.settings);
    // api.load(score) fires scoreLoaded synchronously, then our handler renders
    api.load(score);
  } finally {
    _rebuildingFromYDoc = false;
  }
}

// ─── Transaction helper ───────────────────────────────────────────────────────

/**
 * Run a mutation inside a Y.Doc transaction tagged with the local clientID.
 * The observer will detect the change and rebuild AlphaTab automatically.
 */
export function transact(fn: () => void): void {
  if (!doc) return;
  doc.transact(fn, doc.clientID);
}

// ─── Index-based Y.Doc Navigators ────────────────────────────────────────────

export function resolveYTrack(trackIndex: number): Y.Map<unknown> | null {
  if (!scoreMap) return null;
  const tracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>> | undefined;
  if (!tracks || trackIndex < 0 || trackIndex >= tracks.length) return null;
  return tracks.get(trackIndex);
}

export function resolveYStaff(
  trackIndex: number,
  staffIndex: number,
): Y.Map<unknown> | null {
  const yTrack = resolveYTrack(trackIndex);
  if (!yTrack) return null;
  const staves = yTrack.get("staves") as Y.Array<Y.Map<unknown>>;
  if (!staves || staffIndex < 0 || staffIndex >= staves.length) return null;
  return staves.get(staffIndex);
}

export function resolveYBar(
  trackIndex: number,
  staffIndex: number,
  barIndex: number,
): Y.Map<unknown> | null {
  const yStaff = resolveYStaff(trackIndex, staffIndex);
  if (!yStaff) return null;
  const bars = yStaff.get("bars") as Y.Array<Y.Map<unknown>>;
  if (!bars || barIndex < 0 || barIndex >= bars.length) return null;
  return bars.get(barIndex);
}

export function resolveYVoice(
  trackIndex: number,
  staffIndex: number,
  barIndex: number,
  voiceIndex: number,
): Y.Map<unknown> | null {
  const yBar = resolveYBar(trackIndex, staffIndex, barIndex);
  if (!yBar) return null;
  const voices = yBar.get("voices") as Y.Array<Y.Map<unknown>>;
  if (!voices || voiceIndex < 0 || voiceIndex >= voices.length) return null;
  return voices.get(voiceIndex);
}

export function resolveYBeat(
  trackIndex: number,
  staffIndex: number,
  barIndex: number,
  voiceIndex: number,
  beatIndex: number,
): Y.Map<unknown> | null {
  const yVoice = resolveYVoice(trackIndex, staffIndex, barIndex, voiceIndex);
  if (!yVoice) return null;
  const beats = yVoice.get("beats") as Y.Array<Y.Map<unknown>>;
  if (!beats || beatIndex < 0 || beatIndex >= beats.length) return null;
  return beats.get(beatIndex);
}

export function resolveYNote(
  trackIndex: number,
  staffIndex: number,
  barIndex: number,
  voiceIndex: number,
  beatIndex: number,
  noteIndex: number,
): Y.Map<unknown> | null {
  const yBeat = resolveYBeat(
    trackIndex,
    staffIndex,
    barIndex,
    voiceIndex,
    beatIndex,
  );
  if (!yBeat) return null;
  const notes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
  if (!notes || noteIndex < 0 || noteIndex >= notes.length) return null;
  return notes.get(noteIndex);
}

export function resolveYMasterBar(barIndex: number): Y.Map<unknown> | null {
  if (!scoreMap) return null;
  const masterBars = scoreMap.get("masterBars") as
    | Y.Array<Y.Map<unknown>>
    | undefined;
  if (!masterBars || barIndex < 0 || barIndex >= masterBars.length) return null;
  return masterBars.get(barIndex);
}

// ─── Undo Manager Listeners ──────────────────────────────────────────────────

function attachUndoListeners(um: Y.UndoManager): void {
  um.on("stack-item-added", syncUndoState);
  um.on("stack-item-popped", syncUndoState);
  um.on("stack-cleared", syncUndoState);
  syncUndoState();
}

function detachUndoListeners(um: Y.UndoManager): void {
  um.off("stack-item-added", syncUndoState);
  um.off("stack-item-popped", syncUndoState);
  um.off("stack-cleared", syncUndoState);
  syncUndoState();
}

// ─── Observer ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onYDocChange(
  _events: Y.YEvent<any>[],
  transaction: Y.Transaction,
): void {
  if (transaction.origin === FILE_IMPORT_ORIGIN) {
    return;
  }

  rebuildFromYDoc();
}
