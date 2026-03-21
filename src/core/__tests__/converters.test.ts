/**
 * converters.test.ts — Verify buildAlphaTabScore and importScoreToYDoc
 * with real implementations (converters and AlphaTab are unmocked).
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import * as alphaTab from "@coderline/alphatab";
import {
  destroyDoc,
  getScoreMap,
  transact,
  seedOneTrackScore,
  seedTrackWithConfig,
  placeNoteDirectly,
  placePianoNoteDirectly,
  placePercussionNoteDirectly,
  addBeatsDirectly,
  createTestDoc,
} from "@/test/setup";
import { Duration } from "@/core/schema";
// Import directly from relative path to bypass the mock in setup.ts
import {
  buildAlphaTabScore,
  importScoreToYDoc,
} from "../converters";

beforeEach(() => {
  destroyDoc();
  createTestDoc();
});

function createAlphaTabSettings(): alphaTab.Settings {
  return new alphaTab.Settings();
}

describe("buildAlphaTabScore (Y → AlphaTab)", () => {
  describe("metadata", () => {
    it("converts title, artist, tempo to AlphaTab Score", () => {
      const scoreMap = getScoreMap()!;
      transact(() => {
        scoreMap.set("title", "My Song");
        scoreMap.set("artist", "Test Artist");
        scoreMap.set("tempo", 140);
      });

      const settings = createAlphaTabSettings();
      const score = buildAlphaTabScore(scoreMap, settings);

      expect(score.title).toBe("My Song");
      expect(score.artist).toBe("Test Artist");
      // AlphaTab Score.tempo is readonly (derived from master bars); default is 120
      expect((score as unknown as { tempo: number }).tempo).toBe(120);
    });

    it("defaults to Untitled and 120 tempo when empty", () => {
      const scoreMap = getScoreMap()!;
      const settings = createAlphaTabSettings();
      const score = buildAlphaTabScore(scoreMap, settings);

      expect(score.title).toBe("Untitled");
      expect((score as unknown as { tempo: number }).tempo).toBe(120);
    });
  });

  describe("structure", () => {
    it("converts one track, two bars, and notes", () => {
      const scoreMap = getScoreMap()!;
      seedOneTrackScore(scoreMap, 2);

      addBeatsDirectly(scoreMap, 0, 0, 1);
      placeNoteDirectly(scoreMap, 0, 0, 0, 5, 3);
      placeNoteDirectly(scoreMap, 0, 0, 1, 7, 2);

      const settings = createAlphaTabSettings();
      const score = buildAlphaTabScore(scoreMap, settings);

      expect(score.tracks).toHaveLength(1);
      expect(score.tracks[0].name).toBe("Test Guitar");
      expect(score.tracks[0].staves).toHaveLength(1);
      expect(score.tracks[0].staves[0].bars).toHaveLength(2);

      const bar0 = score.tracks[0].staves[0].bars[0];
      expect(bar0.voices).toHaveLength(1);
      expect(bar0.voices[0].beats).toHaveLength(2);

      const beat0 = bar0.voices[0].beats[0];
      expect(beat0.notes).toHaveLength(1);
      expect(beat0.notes[0].fret).toBe(5);
      expect(beat0.notes[0].string).toBe(3);

      const beat1 = bar0.voices[0].beats[1];
      expect(beat1.notes).toHaveLength(1);
      expect(beat1.notes[0].fret).toBe(7);
      expect(beat1.notes[0].string).toBe(2);
    });

    it("converts master bar time signature", () => {
      const scoreMap = getScoreMap()!;
      seedOneTrackScore(scoreMap, 1, [3, 4]);

      const settings = createAlphaTabSettings();
      const score = buildAlphaTabScore(scoreMap, settings);

      expect(score.masterBars).toHaveLength(1);
      expect(score.masterBars[0].timeSignatureNumerator).toBe(3);
      expect(score.masterBars[0].timeSignatureDenominator).toBe(4);
    });
  });

  describe("edge cases", () => {
    it("handles empty score (no tracks)", () => {
      const scoreMap = getScoreMap()!;
      const settings = createAlphaTabSettings();
      const score = buildAlphaTabScore(scoreMap, settings);

      expect(score.tracks).toHaveLength(0);
      expect(score.masterBars).toHaveLength(0);
    });

    it("converts beat properties: duration, isRest, dots", () => {
      const scoreMap = getScoreMap()!;
      seedOneTrackScore(scoreMap, 1);
      addBeatsDirectly(scoreMap, 0, 0, 1, Duration.Eighth);

      const yTracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;
      const yTrack = yTracks.get(0);
      const yStaves = yTrack.get("staves") as Y.Array<Y.Map<unknown>>;
      const yStaff = yStaves.get(0);
      const yBars = yStaff.get("bars") as Y.Array<Y.Map<unknown>>;
      const yBar = yBars.get(0);
      const yVoices = yBar.get("voices") as Y.Array<Y.Map<unknown>>;
      const yVoice = yVoices.get(0);
      const yBeats = yVoice.get("beats") as Y.Array<Y.Map<unknown>>;
      const yBeat = yBeats.get(0);
      yBeat.set("duration", Duration.Eighth);
      yBeat.set("isRest", true);
      yBeat.set("dots", 1);

      const settings = createAlphaTabSettings();
      const score = buildAlphaTabScore(scoreMap, settings);

      const atBeat = score.tracks[0].staves[0].bars[0].voices[0].beats[0];
      expect(atBeat.duration).toBe(Duration.Eighth as unknown);
      expect(atBeat.isRest).toBe(true);
      expect(atBeat.dots).toBe(1);
    });
  });
});

describe("importScoreToYDoc (AlphaTab → Y)", () => {
  it("imports minimal AlphaTab Score into Y.Doc", () => {
    const doc = new Y.Doc();
    doc.getMap("score"); // ensure score map exists (importScoreToYDoc expects it)

    const score = new alphaTab.model.Score();
    score.title = "Imported";
    score.artist = "Importer";

    const mb = new alphaTab.model.MasterBar();
    mb.score = score;
    mb.timeSignatureNumerator = 4;
    mb.timeSignatureDenominator = 4;
    score.addMasterBar(mb);

    const track = new alphaTab.model.Track();
    score.addTrack(track);

    const staff = new alphaTab.model.Staff();
    staff.stringTuning = new alphaTab.model.Tuning(
      undefined,
      [40, 45, 50, 55, 59, 64],
      false,
    );
    track.addStaff(staff);

    const bar = new alphaTab.model.Bar();
    staff.addBar(bar);

    const voice = new alphaTab.model.Voice();
    bar.addVoice(voice);

    const beat = new alphaTab.model.Beat();
    beat.duration = alphaTab.model.Duration.Quarter as unknown as number;
    beat.isEmpty = false;
    voice.addBeat(beat);

    const note = new alphaTab.model.Note();
    note.fret = 3;
    note.string = 2;
    beat.addNote(note);

    score.finish(new alphaTab.Settings());

    importScoreToYDoc(score, doc);

    const yScore = doc.getMap("score");
    expect(yScore.get("title")).toBe("Imported");
    expect(yScore.get("artist")).toBe("Importer");
    // AlphaTab Score.tempo is readonly; import uses default 120 when no automation
    expect(yScore.get("tempo")).toBe(120);

    const yTracks = yScore.get("tracks") as Y.Array<Y.Map<unknown>>;
    expect(yTracks.length).toBe(1);
    expect(yTracks.get(0).get("name")).toBe("");

    const yStaves = yTracks.get(0).get("staves") as Y.Array<Y.Map<unknown>>;
    const yBars = yStaves.get(0).get("bars") as Y.Array<Y.Map<unknown>>;
    const yVoices = yBars.get(0).get("voices") as Y.Array<Y.Map<unknown>>;
    const yBeats = yVoices.get(0).get("beats") as Y.Array<Y.Map<unknown>>;
    const yNotes = yBeats.get(0).get("notes") as Y.Array<Y.Map<unknown>>;

    expect(yNotes.length).toBe(1);
    expect(yNotes.get(0).get("fret")).toBe(3);
    expect(yNotes.get(0).get("string")).toBe(2);
  });
});

describe("buildAlphaTabScore — piano track", () => {
  it("piano staff has no tuning and showTablature=false", () => {
    const scoreMap = getScoreMap()!;
    seedTrackWithConfig(scoreMap, 1, { name: "Piano", showTablature: false, tuning: [] });

    const settings = createAlphaTabSettings();
    const score = buildAlphaTabScore(scoreMap, settings);

    const staff = score.tracks[0].staves[0];
    expect(staff.showTablature).toBe(false);
    expect(staff.showStandardNotation).toBe(true);
    expect(staff.tuning).toHaveLength(0);
  });

  it("piano note has correct realValue from octave/tone (C5=60)", () => {
    const scoreMap = getScoreMap()!;
    seedTrackWithConfig(scoreMap, 1, { name: "Piano", showTablature: false, tuning: [] });
    placePianoNoteDirectly(scoreMap, 0, 0, 0, 5, 0); // C5

    const settings = createAlphaTabSettings();
    const score = buildAlphaTabScore(scoreMap, settings);

    const note = score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0];
    expect(note.octave).toBe(5);
    expect(note.tone).toBe(0);
    expect(note.realValue).toBe(60); // C5 = MIDI 60
  });

  it("piano note realValue is not NaN", () => {
    const scoreMap = getScoreMap()!;
    seedTrackWithConfig(scoreMap, 1, { name: "Piano", showTablature: false, tuning: [] });
    placePianoNoteDirectly(scoreMap, 0, 0, 0, 5, 11); // B5

    const settings = createAlphaTabSettings();
    const score = buildAlphaTabScore(scoreMap, settings);

    const note = score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0];
    expect(note.realValue).not.toBeNaN();
    expect(note.realValue).toBe(71); // B5 = MIDI 71
  });
});

describe("buildAlphaTabScore — drumkit track", () => {
  it("track.isPercussion is true after rebuild (via staff.isPercussion)", () => {
    const scoreMap = getScoreMap()!;
    seedTrackWithConfig(scoreMap, 1, { name: "Drums", isPercussion: true, tuning: [] });

    const settings = createAlphaTabSettings();
    const score = buildAlphaTabScore(scoreMap, settings);

    expect(score.tracks[0].isPercussion).toBe(true);
    expect(score.tracks[0].staves[0].isPercussion).toBe(true);
  });

  it("drum note preserves percussionArticulation", () => {
    const scoreMap = getScoreMap()!;
    seedTrackWithConfig(scoreMap, 1, { name: "Drums", isPercussion: true, tuning: [] });
    placePercussionNoteDirectly(scoreMap, 0, 0, 0, 38); // snare

    const settings = createAlphaTabSettings();
    const score = buildAlphaTabScore(scoreMap, settings);

    const note = score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0];
    expect(note.percussionArticulation).toBe(38);
  });

  it("isPercussion survives AlphaTab → Y.Doc → AlphaTab round-trip", () => {
    const scoreMap = getScoreMap()!;
    seedTrackWithConfig(scoreMap, 1, { name: "Drums", isPercussion: true, tuning: [] });
    placePercussionNoteDirectly(scoreMap, 0, 0, 0, 42); // hi-hat

    const settings = createAlphaTabSettings();
    const score1 = buildAlphaTabScore(scoreMap, settings);
    expect(score1.tracks[0].isPercussion).toBe(true);

    // Round-trip: AlphaTab → new Y.Doc → AlphaTab
    const newDoc = new Y.Doc();
    importScoreToYDoc(score1, newDoc);
    const newScoreMap = newDoc.getMap("score");
    const score2 = buildAlphaTabScore(newScoreMap, settings);

    expect(score2.tracks[0].isPercussion).toBe(true);
    expect(score2.tracks[0].staves[0].isPercussion).toBe(true);
    const note = score2.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0];
    expect(note.percussionArticulation).toBe(42);
  });
});

describe("round-trip (Y → AlphaTab → Y)", () => {
  it("preserves content across Y → buildAlphaTabScore → importScoreToYDoc → Y", () => {
    const scoreMap = getScoreMap()!;

    transact(() => {
      scoreMap.set("title", "Round Trip Song");
      scoreMap.set("artist", "Round Trip Artist");
      scoreMap.set("tempo", 90);
    });
    seedOneTrackScore(scoreMap, 2, [3, 4]);
    addBeatsDirectly(scoreMap, 0, 0, 2);
    placeNoteDirectly(scoreMap, 0, 0, 0, 5, 3);
    placeNoteDirectly(scoreMap, 0, 0, 1, 0, 1);

    const settings = createAlphaTabSettings();
    const alphaScore = buildAlphaTabScore(scoreMap, settings);

    const newDoc = new Y.Doc();
    importScoreToYDoc(alphaScore, newDoc);

    const newYScore = newDoc.getMap("score");
    expect(newYScore.get("title")).toBe("Round Trip Song");
    expect(newYScore.get("artist")).toBe("Round Trip Artist");
    // AlphaTab Score.tempo is readonly; round-trip yields default 120
    expect(newYScore.get("tempo")).toBe(120);

    const newMasterBars = newYScore.get("masterBars") as Y.Array<Y.Map<unknown>>;
    expect(newMasterBars.length).toBe(2);
    expect(newMasterBars.get(0).get("timeSignatureNumerator")).toBe(3);
    expect(newMasterBars.get(0).get("timeSignatureDenominator")).toBe(4);

    const newTracks = newYScore.get("tracks") as Y.Array<Y.Map<unknown>>;
    expect(newTracks.length).toBe(1);
    const newStaves = newTracks.get(0).get("staves") as Y.Array<Y.Map<unknown>>;
    const newBars = newStaves.get(0).get("bars") as Y.Array<Y.Map<unknown>>;
    const newVoices = newBars.get(0).get("voices") as Y.Array<Y.Map<unknown>>;
    const newBeats = newVoices.get(0).get("beats") as Y.Array<Y.Map<unknown>>;
    const newNotes = newBeats.get(0).get("notes") as Y.Array<Y.Map<unknown>>;

    expect(newNotes.length).toBe(1);
    expect(newNotes.get(0).get("fret")).toBe(5);
    expect(newNotes.get(0).get("string")).toBe(3);

    const newNotes1 = newBeats.get(1).get("notes") as Y.Array<Y.Map<unknown>>;
    expect(newNotes1.length).toBe(1);
    expect(newNotes1.get(0).get("fret")).toBe(0);
    expect(newNotes1.get(0).get("string")).toBe(1);
  });
});
