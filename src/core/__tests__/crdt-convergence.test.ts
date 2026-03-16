/**
 * CRDT convergence tests — verifies that two Y.Docs with our schema
 * merge correctly via Y.applyUpdate (the same bytes WebRTC would carry).
 *
 * No network, no mocks — pure Yjs merge semantics.
 * Does NOT import from @/test/setup.ts to avoid global mocks.
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import {
  initializeScore,
  createTrack,
  createStaff,
  createBar,
  createVoice,
  createBeat,
  createNote,
  createMasterBar,
  snapshotScore,
  type ScoreSchema,
} from "@/core/schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function syncAtoB(a: Y.Doc, b: Y.Doc): void {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
}

function syncDocs(a: Y.Doc, b: Y.Doc): void {
  syncAtoB(a, b);
  syncAtoB(b, a);
}

interface PeerDoc {
  doc: Y.Doc;
  scoreMap: Y.Map<unknown>;
}

function createPeerDoc(): PeerDoc {
  const doc = new Y.Doc();
  const scoreMap = initializeScore(doc);
  return { doc, scoreMap };
}

/**
 * Create a peer that gets its initial state from another peer via sync.
 * Avoids both peers independently calling initializeScore which creates
 * conflicting Y.Arrays (LWW on Y.Map keys).
 */
function createSyncedPeer(source: PeerDoc): PeerDoc {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(source.doc));
  const scoreMap = doc.getMap("score");
  return { doc, scoreMap };
}

function seedTrack(
  scoreMap: Y.Map<unknown>,
  barCount: number,
  trackName: string = "Guitar",
): void {
  const doc = scoreMap.doc!;
  doc.transact(() => {
    const yMasterBars = scoreMap.get("masterBars") as Y.Array<Y.Map<unknown>>;
    const yTracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;

    yTracks.push([createTrack(trackName)]);
    const intTrack = yTracks.get(yTracks.length - 1);

    const staves = intTrack.get("staves") as Y.Array<Y.Map<unknown>>;
    staves.push([createStaff()]);
    const intStaff = staves.get(0);
    const yBars = intStaff.get("bars") as Y.Array<Y.Map<unknown>>;

    for (let i = 0; i < barCount; i++) {
      yMasterBars.push([createMasterBar()]);

      const bar = createBar();
      yBars.push([bar]);
      const intBar = yBars.get(yBars.length - 1);
      const voices = intBar.get("voices") as Y.Array<Y.Map<unknown>>;
      voices.push([createVoice()]);
      const intVoice = voices.get(0);
      (intVoice.get("beats") as Y.Array<Y.Map<unknown>>).push([createBeat()]);
    }
  });
}

function placeNote(
  scoreMap: Y.Map<unknown>,
  barIdx: number,
  beatIdx: number,
  fret: number,
  stringNum: number,
): void {
  const doc = scoreMap.doc!;
  doc.transact(() => {
    const yTracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;
    const yStaves = yTracks
      .get(0)
      .get("staves") as Y.Array<Y.Map<unknown>>;
    const yBars = yStaves.get(0).get("bars") as Y.Array<Y.Map<unknown>>;
    const yVoices = yBars
      .get(barIdx)
      .get("voices") as Y.Array<Y.Map<unknown>>;
    const yBeats = yVoices
      .get(0)
      .get("beats") as Y.Array<Y.Map<unknown>>;
    const yBeat = yBeats.get(beatIdx);
    const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
    yNotes.push([createNote(fret, stringNum)]);
    yBeat.set("isEmpty", false);
  }, doc.clientID);
}

function snap(scoreMap: Y.Map<unknown>): ScoreSchema {
  return snapshotScore(scoreMap);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

let peerA: PeerDoc;

beforeEach(() => {
  peerA = createPeerDoc();
});

describe("CRDT convergence", () => {
  it("User A places a note, syncs to User B", () => {
    seedTrack(peerA.scoreMap, 2);
    const peerB = createSyncedPeer(peerA);

    // A places a note
    placeNote(peerA.scoreMap, 0, 0, 5, 3);
    syncAtoB(peerA.doc, peerB.doc);

    const snapB = snap(peerB.scoreMap);
    const notes = snapB.tracks[0].staves[0].bars[0].voices[0].beats[0].notes;
    expect(notes).toHaveLength(1);
    expect(notes[0].fret).toBe(5);
    expect(notes[0].string).toBe(3);
  });

  it("concurrent edits on different bars converge", () => {
    seedTrack(peerA.scoreMap, 3);
    const peerB = createSyncedPeer(peerA);

    // A edits bar 0, B edits bar 2 — offline
    placeNote(peerA.scoreMap, 0, 0, 7, 1);
    placeNote(peerB.scoreMap, 2, 0, 3, 5);

    // Sync both ways
    syncDocs(peerA.doc, peerB.doc);

    const snapA = snap(peerA.scoreMap);
    const snapB = snap(peerB.scoreMap);

    // Both should see both notes
    expect(snapA.tracks[0].staves[0].bars[0].voices[0].beats[0].notes).toHaveLength(1);
    expect(snapA.tracks[0].staves[0].bars[2].voices[0].beats[0].notes).toHaveLength(1);
    expect(snapB.tracks[0].staves[0].bars[0].voices[0].beats[0].notes).toHaveLength(1);
    expect(snapB.tracks[0].staves[0].bars[2].voices[0].beats[0].notes).toHaveLength(1);
  });

  it("concurrent edits on same beat — both notes present after sync", () => {
    seedTrack(peerA.scoreMap, 1);
    const peerB = createSyncedPeer(peerA);

    // Both add notes to beat 0 of bar 0
    placeNote(peerA.scoreMap, 0, 0, 5, 1);
    placeNote(peerB.scoreMap, 0, 0, 3, 6);

    syncDocs(peerA.doc, peerB.doc);

    const snapA = snap(peerA.scoreMap);
    const notes = snapA.tracks[0].staves[0].bars[0].voices[0].beats[0].notes;
    expect(notes).toHaveLength(2);

    const frets = notes.map((n) => n.fret).sort();
    expect(frets).toEqual([3, 5]);
  });

  it("late joiner receives full state", () => {
    // A builds a score
    seedTrack(peerA.scoreMap, 2);
    placeNote(peerA.scoreMap, 0, 0, 7, 2);
    placeNote(peerA.scoreMap, 1, 0, 12, 1);
    peerA.scoreMap.set("title", "My Song");
    peerA.scoreMap.set("tempo", 140);

    // B joins later — one-way sync from A
    const peerB = createSyncedPeer(peerA);

    const snapB = snap(peerB.scoreMap);
    expect(snapB.title).toBe("My Song");
    expect(snapB.tempo).toBe(140);
    expect(snapB.tracks).toHaveLength(1);
    expect(snapB.tracks[0].staves[0].bars).toHaveLength(2);
    expect(snapB.tracks[0].staves[0].bars[0].voices[0].beats[0].notes).toHaveLength(1);
    expect(snapB.tracks[0].staves[0].bars[1].voices[0].beats[0].notes).toHaveLength(1);
  });

  it("score metadata sync — title and tempo propagate", () => {
    seedTrack(peerA.scoreMap, 1);
    const peerB = createSyncedPeer(peerA);

    // A changes title, B changes tempo
    peerA.doc.transact(() => {
      peerA.scoreMap.set("title", "A Title");
    });
    peerB.doc.transact(() => {
      peerB.scoreMap.set("tempo", 200);
    });

    syncDocs(peerA.doc, peerB.doc);

    expect(snap(peerA.scoreMap).title).toBe("A Title");
    expect(snap(peerA.scoreMap).tempo).toBe(200);
    expect(snap(peerB.scoreMap).title).toBe("A Title");
    expect(snap(peerB.scoreMap).tempo).toBe(200);
  });

  it("add bar concurrently — both bars present after sync", () => {
    seedTrack(peerA.scoreMap, 1);
    const peerB = createSyncedPeer(peerA);

    // Both peers add a bar
    function addBar(peer: PeerDoc): void {
      const doc = peer.doc;
      doc.transact(() => {
        const yTracks = peer.scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;
        const yStaves = yTracks
          .get(0)
          .get("staves") as Y.Array<Y.Map<unknown>>;
        const yBars = yStaves
          .get(0)
          .get("bars") as Y.Array<Y.Map<unknown>>;
        const yMasterBars = peer.scoreMap.get("masterBars") as Y.Array<
          Y.Map<unknown>
        >;

        const bar = createBar();
        yBars.push([bar]);
        const intBar = yBars.get(yBars.length - 1);
        const voices = intBar.get("voices") as Y.Array<Y.Map<unknown>>;
        voices.push([createVoice()]);
        const intVoice = voices.get(0);
        (intVoice.get("beats") as Y.Array<Y.Map<unknown>>).push([
          createBeat(),
        ]);

        yMasterBars.push([createMasterBar()]);
      }, doc.clientID);
    }

    addBar(peerA);
    addBar(peerB);

    syncDocs(peerA.doc, peerB.doc);

    // Both should have 3 bars (1 original + 2 added)
    const barsA = snap(peerA.scoreMap).tracks[0].staves[0].bars.length;
    const barsB = snap(peerB.scoreMap).tracks[0].staves[0].bars.length;
    expect(barsA).toBe(3);
    expect(barsB).toBe(3);
  });

  it("delete + edit conflict — no crash and convergence", () => {
    seedTrack(peerA.scoreMap, 1);
    placeNote(peerA.scoreMap, 0, 0, 5, 3);
    const peerB = createSyncedPeer(peerA);

    // A deletes the note
    peerA.doc.transact(() => {
      const yTracks = peerA.scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;
      const yStaves = yTracks
        .get(0)
        .get("staves") as Y.Array<Y.Map<unknown>>;
      const yBars = yStaves
        .get(0)
        .get("bars") as Y.Array<Y.Map<unknown>>;
      const yVoices = yBars
        .get(0)
        .get("voices") as Y.Array<Y.Map<unknown>>;
      const yBeats = yVoices
        .get(0)
        .get("beats") as Y.Array<Y.Map<unknown>>;
      const yNotes = yBeats.get(0).get("notes") as Y.Array<Y.Map<unknown>>;
      yNotes.delete(0, 1);
      yBeats.get(0).set("isEmpty", true);
    }, peerA.doc.clientID);

    // B edits the same beat (adds a different note)
    placeNote(peerB.scoreMap, 0, 0, 9, 2);

    // Sync should not throw
    expect(() => syncDocs(peerA.doc, peerB.doc)).not.toThrow();

    // Both docs converge to the same state
    const snapA = snap(peerA.scoreMap);
    const snapB = snap(peerB.scoreMap);

    const notesA = snapA.tracks[0].staves[0].bars[0].voices[0].beats[0].notes;
    const notesB = snapB.tracks[0].staves[0].bars[0].voices[0].beats[0].notes;

    // The exact outcome depends on CRDT merge — both should converge
    expect(notesA.length).toBe(notesB.length);
    expect(notesA.map((n) => n.fret).sort()).toEqual(
      notesB.map((n) => n.fret).sort(),
    );
  });
});
