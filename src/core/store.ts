/**
 * store.ts — TabStore: Zustand store for collaboration state and score snapshots.
 *
 * Y.Doc lifecycle is managed by sync.ts. This store handles:
 *   - Connection state (connected, roomCode, peers)
 *   - Score snapshots (plain-object view for lightweight UI access)
 *   - UUID index for entity lookups
 *
 * connect() / disconnect() delegate to sync.ts for provider management.
 */

import * as Y from "yjs";
import { create } from "zustand";

import {
  type ScoreSchema,
  snapshotScore,
  buildUuidIndex,
  createTrack,
  createStaff,
  createBar,
  createVoice,
  createBeat,
  createMasterBar,
} from "./schema";

import {
  getScoreMap,
  connectProviders,
  disconnectProviders,
} from "./sync";

// ─── Internal State ──────────────────────────────────────────────────────────

let uuidIndex: Map<string, Y.Map<unknown>> = new Map();

// ─── UUID Index Maintenance ──────────────────────────────────────────────────

function rebuildIndex(): void {
  const scoreMap = getScoreMap();
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

// ─── Zustand Store ───────────────────────────────────────────────────────────

export interface TabState {
  connected: boolean;
  roomCode: string | null;
  peers: Array<{ id: string; name: string }>;

  score: ScoreSchema | null;

  connect: (roomCode: string, userName: string) => void;
  disconnect: () => void;
}

function syncToStore(): void {
  const scoreMap = getScoreMap();
  if (!scoreMap) return;
  rebuildIndex();
  const snapshot = snapshotScore(scoreMap);
  useTabStore.setState({ score: snapshot });
}

function attachSnapshotObserver(): void {
  const scoreMap = getScoreMap();
  if (!scoreMap) return;
  scoreMap.observeDeep(syncToStore);
}

function detachSnapshotObserver(): void {
  const scoreMap = getScoreMap();
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

    connectProviders(roomCode, userName);
    attachSnapshotObserver();
    syncToStore();

    set({ connected: true, roomCode });
  },

  disconnect: () => {
    detachSnapshotObserver();
    disconnectProviders();

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
