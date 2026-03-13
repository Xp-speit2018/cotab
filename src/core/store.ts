/**
 * store.ts — TabStore: the central nervous system of the collaborative editor.
 *
 * Owns the Y.Doc, manages WebRTC + IndexedDB providers, and exposes a Zustand
 * store that follows strict unidirectional data flow:
 *
 *   User Intent  ──command()──▶  Y.Doc  ──observeDeep──▶  Zustand State
 *                                                              │
 *                                                      React UI / AlphaTab sync
 *
 * AlphaTab / UI events must NEVER write back to Y.Doc.
 * Only direct user intent (mouse/keyboard) triggers commands.
 */

import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { IndexeddbPersistence } from "y-indexeddb";
import { create } from "zustand";

import {
  type ScoreSchema,
  initializeScore,
  snapshotScore,
  buildUuidIndex,
  createTrack,
  createStaff,
  createBar,
  createVoice,
  createBeat,
  createMasterBar,
} from "./schema";

// ─── Internal State (not exposed via Zustand) ───────────────────────────────

let doc: Y.Doc | null = null;
let provider: WebrtcProvider | null = null;
let persistence: IndexeddbPersistence | null = null;
let undoManager: Y.UndoManager | null = null;
let uuidIndex: Map<string, Y.Map<unknown>> = new Map();
let scoreMap: Y.Map<unknown> | null = null;

// ─── Accessors (used by actions and sync engine) ─────────────────────────────

export function getDoc(): Y.Doc | null {
  return doc;
}

export function getScoreMap(): Y.Map<unknown> | null {
  return scoreMap;
}

export function getUndoManager(): Y.UndoManager | null {
  return undoManager;
}

// ─── UUID Index Maintenance ──────────────────────────────────────────────────

function rebuildIndex(): void {
  if (scoreMap) {
    uuidIndex = buildUuidIndex(scoreMap);
  }
}

export function lookupYMap(uuid: string): Y.Map<unknown> {
  const yMap = uuidIndex.get(uuid);
  if (!yMap) {
    throw new Error(`Entity with uuid "${uuid}" not found in Y.Doc`);
  }
  return yMap;
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

// ─── Zustand Store ───────────────────────────────────────────────────────────

export interface TabState {
  connected: boolean;
  roomCode: string | null;
  peers: Array<{ id: string; name: string }>;

  score: ScoreSchema | null;

  connect: (roomCode: string, userName: string) => void;
  disconnect: () => void;
}

/** Sync the Y.Doc score snapshot into Zustand state + rebuild the UUID index. */
function syncToStore(): void {
  if (!scoreMap) return;
  rebuildIndex();
  const snapshot = snapshotScore(scoreMap);
  useTabStore.setState({ score: snapshot });
}

function attachObserver(): void {
  if (!scoreMap) return;
  scoreMap.observeDeep(syncToStore);
}

function detachObserver(): void {
  if (!scoreMap) return;
  scoreMap.unobserveDeep(syncToStore);
}

export const useTabStore = create<TabState>((set) => ({
  connected: false,
  roomCode: null,
  peers: [],
  score: null,

  connect: (roomCode: string, userName: string) => {
    useTabStore.getState().disconnect();

    doc = new Y.Doc();
    scoreMap = initializeScore(doc);

    persistence = new IndexeddbPersistence(`cotab:${roomCode}`, doc);
    persistence.on("synced", () => {
      syncToStore();
    });

    const signalingBase = import.meta.env.VITE_SIGNALING_URL;
    const signalingUrl = `${signalingBase}?roomCode=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(userName)}`;

    provider = new WebrtcProvider(`room:${roomCode}`, doc, {
      signaling: [signalingUrl],
    });

    provider.on("synced", () => {
      syncToStore();
    });

    undoManager = new Y.UndoManager([scoreMap], {
      trackedOrigins: new Set([doc.clientID]),
    });

    attachObserver();
    syncToStore();

    set({ connected: true, roomCode });
  },

  disconnect: () => {
    detachObserver();

    if (undoManager) {
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

    if (doc) {
      doc.destroy();
      doc = null;
    }

    scoreMap = null;
    uuidIndex.clear();

    set({
      connected: false,
      roomCode: null,
      peers: [],
      score: null,
    });
  },
}));

// ─── Convenience: create a default empty bar structure ───────────────────────

/**
 * Create a bar Y.Map with one voice containing one empty beat.
 * Commonly needed when adding tracks, inserting bars, etc.
 */
export function createDefaultBar(clef?: number): Y.Map<unknown> {
  const bar = createBar(clef);
  const voice = createVoice();
  const beat = createBeat();
  (voice.get("beats") as Y.Array<Y.Map<unknown>>).push([beat]);
  (bar.get("voices") as Y.Array<Y.Map<unknown>>).push([voice]);
  return bar;
}

/**
 * Create a track with one staff, one bar, one voice, and one empty beat,
 * plus a corresponding master bar. Returns both for the caller to insert.
 */
export function createDefaultTrack(
  name: string = "Track 1",
): { track: Y.Map<unknown>; masterBar: Y.Map<unknown> } {
  const track = createTrack(name);
  const staff = createStaff();
  const bar = createDefaultBar();
  (staff.get("bars") as Y.Array<Y.Map<unknown>>).push([bar]);
  (track.get("staves") as Y.Array<Y.Map<unknown>>).push([staff]);

  const masterBar = createMasterBar();
  return { track, masterBar };
}
