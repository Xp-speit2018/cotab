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
 * Insert a bar with one voice and one empty beat into an already-integrated
 * Y.Array of bars. Yjs requires types to be integrated into a doc before
 * nested types can be read, so the bar is pushed first, then populated.
 *
 * Returns the integrated bar Y.Map.
 */
export function pushDefaultBar(
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

/**
 * Push a track with one staff, one bar (one voice, one empty beat), and a
 * corresponding master bar, into already-integrated Y.Arrays.
 *
 * Yjs requires integration before nested reads, so this operates on the
 * doc's arrays directly rather than returning standalone types.
 */
export function pushDefaultTrack(
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
  pushDefaultBar(yBars);

  yMasterBars.push([createMasterBar()]);
  const intMb = yMasterBars.get(yMasterBars.length - 1);

  return { track: intTrack, masterBar: intMb };
}

/**
 * Build a minimal playable score inside an already-initialized Y.Doc.
 * Sets default metadata, one 4/4 master bar, and one acoustic guitar track
 * with a single staff, one bar, one voice, and one empty beat.
 */
export function createNewScore(scoreMap: Y.Map<unknown>): void {
  const doc = scoreMap.doc;
  if (!doc) return;

  doc.transact(() => {
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

    pushDefaultTrack(yTracks, yMasterBars, "Acoustic Guitar");
  });
}
