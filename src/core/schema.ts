/**
 * schema.ts — Normalized CRDT schema for the shared tab document.
 *
 * Every entity is a nested Y.Type with a permanent `uuid`.
 * Plain-object "snapshot" interfaces are defined for UI consumption.
 * Factory functions create properly initialized Y.Map instances.
 */

import * as Y from "yjs";
import { v4 as uuidv4 } from "uuid";

// ─── Snapshot Interfaces (plain objects for UI / Zustand) ────────────────────

export interface NoteSchema {
  uuid: string;
  fret: number;
  /** 1-indexed guitar string number (1 = highest pitch string) */
  string: number;
}

export interface BeatSchema {
  uuid: string;
  /** Duration value: 1 (whole), 2 (half), 4 (quarter), 8 (eighth), 16, 32 */
  duration: number;
  notes: NoteSchema[];
}

export interface MeasureSchema {
  uuid: string;
  timeSignatureNumerator: number;
  timeSignatureDenominator: number;
  beats: BeatSchema[];
}

export interface StaffSchema {
  uuid: string;
  measures: MeasureSchema[];
}

export interface TrackSchema {
  uuid: string;
  name: string;
  instrument: string;
  tuning: number[];
  staves: StaffSchema[];
}

export interface ScoreSchema {
  title: string;
  artist: string;
  tempo: number;
  tracks: TrackSchema[];
}

// ─── Factory Functions (create initialized Y.Map instances) ──────────────────

/** Standard guitar tuning in MIDI note numbers (E2 A2 D3 G3 B3 E4). */
const STANDARD_TUNING = [40, 45, 50, 55, 59, 64];

export function createNote(fret: number, stringNum: number): Y.Map<unknown> {
  const note = new Y.Map<unknown>();
  note.set("uuid", uuidv4());
  note.set("fret", fret);
  note.set("string", stringNum);
  return note;
}

export function createBeat(duration: number = 4): Y.Map<unknown> {
  const beat = new Y.Map<unknown>();
  beat.set("uuid", uuidv4());
  beat.set("duration", duration);
  beat.set("notes", new Y.Array<Y.Map<unknown>>());
  return beat;
}

export function createMeasure(
  numerator: number = 4,
  denominator: number = 4,
): Y.Map<unknown> {
  const measure = new Y.Map<unknown>();
  measure.set("uuid", uuidv4());
  measure.set("timeSignatureNumerator", numerator);
  measure.set("timeSignatureDenominator", denominator);
  measure.set("beats", new Y.Array<Y.Map<unknown>>());
  return measure;
}

export function createStaff(): Y.Map<unknown> {
  const staff = new Y.Map<unknown>();
  staff.set("uuid", uuidv4());
  staff.set("measures", new Y.Array<Y.Map<unknown>>());
  return staff;
}

export function createTrack(name: string = "Track 1"): Y.Map<unknown> {
  const track = new Y.Map<unknown>();
  track.set("uuid", uuidv4());
  track.set("name", name);
  track.set("instrument", "acoustic-guitar");

  const tuning = new Y.Array<number>();
  tuning.push(STANDARD_TUNING);
  track.set("tuning", tuning);

  track.set("staves", new Y.Array<Y.Map<unknown>>());
  return track;
}

// ─── Initialization ──────────────────────────────────────────────────────────

/**
 * Set up the root Y.Map ('score') with default metadata and an empty tracks
 * array. Only writes if the map is empty (first peer to initialize).
 */
export function initializeScore(doc: Y.Doc): Y.Map<unknown> {
  const score = doc.getMap("score");

  if (!score.has("title")) {
    doc.transact(() => {
      score.set("title", "Untitled");
      score.set("artist", "");
      score.set("tempo", 120);
      score.set("tracks", new Y.Array<Y.Map<unknown>>());
    });
  }

  return score;
}

// ─── Snapshot Helpers ────────────────────────────────────────────────────────

/** Convert a Note Y.Map to a plain NoteSchema object. */
export function snapshotNote(yNote: Y.Map<unknown>): NoteSchema {
  return {
    uuid: yNote.get("uuid") as string,
    fret: yNote.get("fret") as number,
    string: yNote.get("string") as number,
  };
}

/** Convert a Beat Y.Map to a plain BeatSchema object. */
export function snapshotBeat(yBeat: Y.Map<unknown>): BeatSchema {
  const notes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
  return {
    uuid: yBeat.get("uuid") as string,
    duration: yBeat.get("duration") as number,
    notes: notes.map((n) => snapshotNote(n)),
  };
}

/** Convert a Measure Y.Map to a plain MeasureSchema object. */
export function snapshotMeasure(yMeasure: Y.Map<unknown>): MeasureSchema {
  const beats = yMeasure.get("beats") as Y.Array<Y.Map<unknown>>;
  return {
    uuid: yMeasure.get("uuid") as string,
    timeSignatureNumerator: yMeasure.get("timeSignatureNumerator") as number,
    timeSignatureDenominator: yMeasure.get(
      "timeSignatureDenominator",
    ) as number,
    beats: beats.map((b) => snapshotBeat(b)),
  };
}

/** Convert a Staff Y.Map to a plain StaffSchema object. */
export function snapshotStaff(yStaff: Y.Map<unknown>): StaffSchema {
  const measures = yStaff.get("measures") as Y.Array<Y.Map<unknown>>;
  return {
    uuid: yStaff.get("uuid") as string,
    measures: measures.map((m) => snapshotMeasure(m)),
  };
}

/** Convert a Track Y.Map to a plain TrackSchema object. */
export function snapshotTrack(yTrack: Y.Map<unknown>): TrackSchema {
  const staves = yTrack.get("staves") as Y.Array<Y.Map<unknown>>;
  const tuning = yTrack.get("tuning") as Y.Array<number>;
  return {
    uuid: yTrack.get("uuid") as string,
    name: yTrack.get("name") as string,
    instrument: yTrack.get("instrument") as string,
    tuning: tuning.toArray(),
    staves: staves.map((s) => snapshotStaff(s)),
  };
}

/** Snapshot the entire score Y.Map into a plain ScoreSchema object. */
export function snapshotScore(yScore: Y.Map<unknown>): ScoreSchema {
  const tracks = yScore.get("tracks") as Y.Array<Y.Map<unknown>>;
  return {
    title: yScore.get("title") as string,
    artist: yScore.get("artist") as string,
    tempo: yScore.get("tempo") as number,
    tracks: tracks.map((t) => snapshotTrack(t)),
  };
}

// ─── UUID Index Builder ──────────────────────────────────────────────────────

/**
 * Walk the entire Y.Doc score tree and build a Map<uuid, Y.Map> for O(1)
 * lookups. Called once on init and incrementally updated by the store.
 */
export function buildUuidIndex(yScore: Y.Map<unknown>): Map<string, Y.Map<unknown>> {
  const index = new Map<string, Y.Map<unknown>>();

  const tracks = yScore.get("tracks") as Y.Array<Y.Map<unknown>> | undefined;
  if (!tracks) return index;

  for (const yTrack of tracks) {
    index.set(yTrack.get("uuid") as string, yTrack);

    const staves = yTrack.get("staves") as Y.Array<Y.Map<unknown>>;
    for (const yStaff of staves) {
      index.set(yStaff.get("uuid") as string, yStaff);

      const measures = yStaff.get("measures") as Y.Array<Y.Map<unknown>>;
      for (const yMeasure of measures) {
        index.set(yMeasure.get("uuid") as string, yMeasure);

        const beats = yMeasure.get("beats") as Y.Array<Y.Map<unknown>>;
        for (const yBeat of beats) {
          index.set(yBeat.get("uuid") as string, yBeat);

          const notes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
          for (const yNote of notes) {
            index.set(yNote.get("uuid") as string, yNote);
          }
        }
      }
    }
  }

  return index;
}
