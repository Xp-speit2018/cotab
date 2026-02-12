/**
 * store.ts — TabStore: the central nervous system of the collaborative editor.
 *
 * Owns the Y.Doc, manages WebRTC + IndexedDB providers, and exposes a Zustand
 * store that follows strict unidirectional data flow:
 *
 *   User Intent  ──command()──▶  Y.Doc  ──observeDeep──▶  Zustand State
 *                                                              │
 *                                                      React UI (future)
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
  type NoteSchema,
  initializeScore,
  snapshotScore,
  buildUuidIndex,
  createTrack,
  createStaff,
  createMeasure,
  createBeat,
  createNote,
} from "./schema";

// ─── Internal State (not exposed via Zustand) ───────────────────────────────

let doc: Y.Doc | null = null;
let provider: WebrtcProvider | null = null;
let persistence: IndexeddbPersistence | null = null;
let uuidIndex: Map<string, Y.Map<unknown>> = new Map();
let scoreMap: Y.Map<unknown> | null = null;

// ─── UUID Index Maintenance ──────────────────────────────────────────────────

function rebuildIndex(): void {
  if (scoreMap) {
    uuidIndex = buildUuidIndex(scoreMap);
  }
}

function lookupYMap(uuid: string): Y.Map<unknown> {
  const yMap = uuidIndex.get(uuid);
  if (!yMap) {
    throw new Error(`Entity with uuid "${uuid}" not found in Y.Doc`);
  }
  return yMap;
}

/**
 * Find the parent Y.Array that contains a child Y.Map with the given uuid,
 * and return both the array and the index. Used for removal operations.
 */
function findParentArray(
  childUuid: string,
  parentUuid: string,
  arrayKey: string,
): { array: Y.Array<Y.Map<unknown>>; index: number } {
  const parent = lookupYMap(parentUuid);
  const array = parent.get(arrayKey) as Y.Array<Y.Map<unknown>>;

  let targetIndex = -1;
  for (let i = 0; i < array.length; i++) {
    const item = array.get(i);
    if (item.get("uuid") === childUuid) {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex === -1) {
    throw new Error(
      `Child "${childUuid}" not found in ${arrayKey} of "${parentUuid}"`,
    );
  }

  return { array, index: targetIndex };
}

// ─── Zustand Store ───────────────────────────────────────────────────────────

export interface TabState {
  // Connection
  connected: boolean;
  roomCode: string | null;
  peers: Array<{ id: string; name: string }>;

  // Score snapshot (derived from Y.Doc on every update)
  score: ScoreSchema | null;

  // Commands — these write to Y.Doc, never to Zustand directly
  connect: (roomCode: string, userName: string) => void;
  disconnect: () => void;
  setMetadata: (
    field: "title" | "artist",
    value: string,
  ) => void;
  setTempo: (tempo: number) => void;
  addTrack: (name: string) => void;
  removeTrack: (trackUuid: string) => void;
  addStaff: (trackUuid: string) => void;
  addMeasure: (staffUuid: string, numerator?: number, denominator?: number) => void;
  addBeat: (measureUuid: string, duration?: number) => void;
  addNote: (beatUuid: string, fret: number, stringNum: number) => void;
  updateNote: (noteUuid: string, updates: Partial<Pick<NoteSchema, "fret" | "string">>) => void;
  removeNote: (beatUuid: string, noteUuid: string) => void;
}

/** Sync the Y.Doc score snapshot into Zustand state + rebuild the UUID index. */
function syncToStore(): void {
  if (!scoreMap) return;
  rebuildIndex();
  const snapshot = snapshotScore(scoreMap);
  useTabStore.setState({ score: snapshot });
}

/** Attach a deep observer on the score Y.Map so any nested change triggers sync. */
function attachObserver(): void {
  if (!scoreMap) return;
  scoreMap.observeDeep(syncToStore);
}

function detachObserver(): void {
  if (!scoreMap) return;
  scoreMap.unobserveDeep(syncToStore);
}

export const useTabStore = create<TabState>((set, _get) => ({
  // ── Initial State ──────────────────────────────────────────────────────────

  connected: false,
  roomCode: null,
  peers: [],
  score: null,

  // ── Connection Commands ────────────────────────────────────────────────────

  connect: (roomCode: string, userName: string) => {
    // Tear down previous session if any
    useTabStore.getState().disconnect();

    // Create Y.Doc and initialize score structure
    doc = new Y.Doc();
    scoreMap = initializeScore(doc);

    // IndexedDB persistence for offline support
    persistence = new IndexeddbPersistence(`cotab:${roomCode}`, doc);
    persistence.on("synced", () => {
      // Re-snapshot after IndexedDB state is loaded
      syncToStore();
    });

    // WebRTC provider connecting through the signaling server
    const signalingBase = import.meta.env.VITE_SIGNALING_URL;
    const signalingUrl = `${signalingBase}?roomCode=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(userName)}`;

    provider = new WebrtcProvider(`room:${roomCode}`, doc, {
      signaling: [signalingUrl],
    });

    provider.on("synced", () => {
      syncToStore();
    });

    // Observe changes and push to Zustand
    attachObserver();

    // Initial snapshot
    syncToStore();

    set({
      connected: true,
      roomCode,
    });
  },

  disconnect: () => {
    detachObserver();

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

  // ── Metadata Commands ──────────────────────────────────────────────────────

  setMetadata: (field, value) => {
    if (!doc || !scoreMap) return;
    doc.transact(() => {
      scoreMap!.set(field, value);
    });
  },

  setTempo: (tempo) => {
    if (!doc || !scoreMap) return;
    doc.transact(() => {
      scoreMap!.set("tempo", tempo);
    });
  },

  // ── Track Commands ─────────────────────────────────────────────────────────

  addTrack: (name) => {
    if (!doc || !scoreMap) return;
    doc.transact(() => {
      const tracks = scoreMap!.get("tracks") as Y.Array<Y.Map<unknown>>;
      const track = createTrack(name);

      // Every new track gets one staff with one empty measure
      const staff = createStaff();
      const measure = createMeasure();
      const beat = createBeat();

      (measure.get("beats") as Y.Array<Y.Map<unknown>>).push([beat]);
      (staff.get("measures") as Y.Array<Y.Map<unknown>>).push([measure]);
      (track.get("staves") as Y.Array<Y.Map<unknown>>).push([staff]);

      tracks.push([track]);
    });
  },

  removeTrack: (trackUuid) => {
    if (!doc || !scoreMap) return;
    doc.transact(() => {
      const tracks = scoreMap!.get("tracks") as Y.Array<Y.Map<unknown>>;
      for (let i = 0; i < tracks.length; i++) {
        if (tracks.get(i).get("uuid") === trackUuid) {
          tracks.delete(i, 1);
          break;
        }
      }
    });
  },

  // ── Staff Commands ─────────────────────────────────────────────────────────

  addStaff: (trackUuid) => {
    if (!doc) return;
    doc.transact(() => {
      const track = lookupYMap(trackUuid);
      const staves = track.get("staves") as Y.Array<Y.Map<unknown>>;
      const staff = createStaff();

      // New staff gets one empty measure with one beat
      const measure = createMeasure();
      const beat = createBeat();
      (measure.get("beats") as Y.Array<Y.Map<unknown>>).push([beat]);
      (staff.get("measures") as Y.Array<Y.Map<unknown>>).push([measure]);

      staves.push([staff]);
    });
  },

  // ── Measure Commands ───────────────────────────────────────────────────────

  addMeasure: (staffUuid, numerator = 4, denominator = 4) => {
    if (!doc) return;
    doc.transact(() => {
      const staff = lookupYMap(staffUuid);
      const measures = staff.get("measures") as Y.Array<Y.Map<unknown>>;
      const measure = createMeasure(numerator, denominator);

      // New measure starts with one empty beat
      const beat = createBeat();
      (measure.get("beats") as Y.Array<Y.Map<unknown>>).push([beat]);

      measures.push([measure]);
    });
  },

  // ── Beat Commands ──────────────────────────────────────────────────────────

  addBeat: (measureUuid, duration = 4) => {
    if (!doc) return;
    doc.transact(() => {
      const measure = lookupYMap(measureUuid);
      const beats = measure.get("beats") as Y.Array<Y.Map<unknown>>;
      const beat = createBeat(duration);
      beats.push([beat]);
    });
  },

  // ── Note Commands ──────────────────────────────────────────────────────────

  addNote: (beatUuid, fret, stringNum) => {
    if (!doc) return;
    doc.transact(() => {
      const beat = lookupYMap(beatUuid);
      const notes = beat.get("notes") as Y.Array<Y.Map<unknown>>;
      const note = createNote(fret, stringNum);
      notes.push([note]);
    });
  },

  updateNote: (noteUuid, updates) => {
    if (!doc) return;
    doc.transact(() => {
      const note = lookupYMap(noteUuid);
      if (updates.fret !== undefined) note.set("fret", updates.fret);
      if (updates.string !== undefined) note.set("string", updates.string);
    });
  },

  removeNote: (beatUuid, noteUuid) => {
    if (!doc) return;
    doc.transact(() => {
      const { array, index } = findParentArray(noteUuid, beatUuid, "notes");
      array.delete(index, 1);
    });
  },
}));
