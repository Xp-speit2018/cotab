/**
 * gp7-export.test.ts — GP7 export round-trip tests.
 *
 * Verifies that exporting a score via Gp7Exporter and re-importing it
 * via ScoreLoader.loadScoreFromBytes preserves structure and data.
 * Both AlphaTab and converters are unmocked for real serialization.
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as alphaTab from "@coderline/alphatab";
import {
  destroyDoc,
  getScoreMap,
  transact,
  seedOneTrackScore,
  seedTrackWithConfig,
  placeNoteDirectly,
  placePercussionNoteDirectly,
  addBeatsDirectly,
  createTestDoc,
} from "@/test/setup";
// Import directly from relative path to bypass the mock in setup.ts
import { buildAlphaTabScore } from "../converters";

beforeEach(() => {
  destroyDoc();
  createTestDoc();
});

function createSettings(): alphaTab.Settings {
  return new alphaTab.Settings();
}

/** Export a score to GP7 bytes and re-import it. */
function roundTrip(score: alphaTab.model.Score): alphaTab.model.Score {
  const exporter = new alphaTab.exporter.Gp7Exporter();
  const bytes = exporter.export(score, null);
  expect(bytes).toBeInstanceOf(Uint8Array);
  expect(bytes.length).toBeGreaterThan(0);
  return alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes, createSettings());
}

describe("GP7 export round-trip", () => {
  it("preserves metadata (title, artist, album, copyright)", () => {
    const scoreMap = getScoreMap()!;
    transact(() => {
      scoreMap.set("title", "Export Test");
      scoreMap.set("artist", "Test Artist");
      scoreMap.set("album", "Test Album");
      scoreMap.set("copyright", "2026 Test");
    });
    seedOneTrackScore(scoreMap, 1);

    const original = buildAlphaTabScore(scoreMap, createSettings());
    const reimported = roundTrip(original);

    expect(reimported.title).toBe("Export Test");
    expect(reimported.artist).toBe("Test Artist");
    expect(reimported.album).toBe("Test Album");
    expect(reimported.copyright).toBe("2026 Test");
  });

  it("preserves track and staff structure", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 3);

    const original = buildAlphaTabScore(scoreMap, createSettings());
    const reimported = roundTrip(original);

    expect(reimported.tracks).toHaveLength(1);
    expect(reimported.masterBars).toHaveLength(3);
    expect(reimported.tracks[0].staves).toHaveLength(1);
    expect(reimported.tracks[0].staves[0].bars).toHaveLength(3);
  });

  it("preserves note fret and string values", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 1);
    addBeatsDirectly(scoreMap, 0, 0, 2);
    placeNoteDirectly(scoreMap, 0, 0, 0, 5, 3); // fret 5, string 3
    placeNoteDirectly(scoreMap, 0, 0, 1, 12, 1); // fret 12, string 1
    placeNoteDirectly(scoreMap, 0, 0, 2, 0, 6); // fret 0, string 6

    const original = buildAlphaTabScore(scoreMap, createSettings());
    const reimported = roundTrip(original);

    const beats = reimported.tracks[0].staves[0].bars[0].voices[0].beats;
    expect(beats).toHaveLength(3);

    expect(beats[0].notes[0].fret).toBe(5);
    expect(beats[0].notes[0].string).toBe(3);

    expect(beats[1].notes[0].fret).toBe(12);
    expect(beats[1].notes[0].string).toBe(1);

    expect(beats[2].notes[0].fret).toBe(0);
    expect(beats[2].notes[0].string).toBe(6);
  });

  it("preserves time signature", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 1, [6, 8]);

    const original = buildAlphaTabScore(scoreMap, createSettings());
    const reimported = roundTrip(original);

    expect(reimported.masterBars[0].timeSignatureNumerator).toBe(6);
    expect(reimported.masterBars[0].timeSignatureDenominator).toBe(8);
  });

  it("preserves beat duration and dots", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 1);

    // Set the default beat to a half note with a dot, then place a note on it
    const yTracks = scoreMap.get("tracks") as import("yjs").Array<import("yjs").Map<unknown>>;
    const yBars = (yTracks.get(0).get("staves") as import("yjs").Array<import("yjs").Map<unknown>>)
      .get(0).get("bars") as import("yjs").Array<import("yjs").Map<unknown>>;
    const yVoices = yBars.get(0).get("voices") as import("yjs").Array<import("yjs").Map<unknown>>;
    const yBeats = yVoices.get(0).get("beats") as import("yjs").Array<import("yjs").Map<unknown>>;
    yBeats.get(0).set("duration", 2); // half note
    yBeats.get(0).set("dots", 1);
    placeNoteDirectly(scoreMap, 0, 0, 0, 5, 1);

    const original = buildAlphaTabScore(scoreMap, createSettings());
    const reimported = roundTrip(original);

    const beat = reimported.tracks[0].staves[0].bars[0].voices[0].beats[0];
    expect(beat.duration).toBe(alphaTab.model.Duration.Half);
    expect(beat.dots).toBe(1);
  });

  it("preserves percussion track and articulations", () => {
    const scoreMap = getScoreMap()!;
    seedTrackWithConfig(scoreMap, 1, { name: "Drums", isPercussion: true, tuning: [] });
    placePercussionNoteDirectly(scoreMap, 0, 0, 0, 38); // snare

    const original = buildAlphaTabScore(scoreMap, createSettings());
    const reimported = roundTrip(original);

    expect(reimported.tracks[0].isPercussion).toBe(true);
    const note = reimported.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0];
    expect(note.percussionArticulation).toBe(38);
  });

  it("preserves staff tuning", () => {
    const scoreMap = getScoreMap()!;
    // Drop D tuning: D2-A2-D3-G3-B3-E4
    const dropD = [38, 45, 50, 55, 59, 64];
    seedTrackWithConfig(scoreMap, 1, { name: "Drop D", tuning: dropD });

    const original = buildAlphaTabScore(scoreMap, createSettings());
    const reimported = roundTrip(original);

    const tuning = reimported.tracks[0].staves[0].tuning;
    expect(tuning).toEqual(dropD);
  });

  it("round-trips a multi-bar score with notes across bars", () => {
    const scoreMap = getScoreMap()!;
    transact(() => {
      scoreMap.set("title", "Multi-Bar Test");
    });
    seedOneTrackScore(scoreMap, 3);
    placeNoteDirectly(scoreMap, 0, 0, 0, 3, 2); // bar 0
    placeNoteDirectly(scoreMap, 0, 1, 0, 7, 4); // bar 1
    placeNoteDirectly(scoreMap, 0, 2, 0, 0, 5); // bar 2

    const original = buildAlphaTabScore(scoreMap, createSettings());
    const reimported = roundTrip(original);

    expect(reimported.title).toBe("Multi-Bar Test");
    expect(reimported.masterBars).toHaveLength(3);

    const staves = reimported.tracks[0].staves[0];
    expect(staves.bars[0].voices[0].beats[0].notes[0].fret).toBe(3);
    expect(staves.bars[0].voices[0].beats[0].notes[0].string).toBe(2);

    expect(staves.bars[1].voices[0].beats[0].notes[0].fret).toBe(7);
    expect(staves.bars[1].voices[0].beats[0].notes[0].string).toBe(4);

    expect(staves.bars[2].voices[0].beats[0].notes[0].fret).toBe(0);
    expect(staves.bars[2].voices[0].beats[0].notes[0].string).toBe(5);
  });

  it("exported bytes form a valid ZIP (GP7 is a ZIP archive)", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 1);

    const original = buildAlphaTabScore(scoreMap, createSettings());
    const exporter = new alphaTab.exporter.Gp7Exporter();
    const bytes = exporter.export(original, null);

    // ZIP files start with PK\x03\x04
    expect(bytes[0]).toBe(0x50); // P
    expect(bytes[1]).toBe(0x4b); // K
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
  });
});
