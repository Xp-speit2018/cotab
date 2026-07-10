/**
 * converters.test.ts — Verify buildAlphaTabScore and importScoreToYDoc
 * with real implementations (converters and AlphaTab are unmocked).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
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
import {
  AutomationType,
  Duration,
  createAutomation,
  createBeat,
  createNote,
  snapshotScore,
} from "@/core/schema";
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
      seedOneTrackScore(scoreMap, 1);
      transact(() => {
        scoreMap.set("title", "My Song");
        scoreMap.set("artist", "Test Artist");
        const masterBars = scoreMap.get("masterBars") as Y.Array<
          Y.Map<unknown>
        >;
        (
          masterBars.get(0).get("tempoAutomations") as Y.Array<
            Y.Map<unknown>
          >
        ).push([createAutomation(AutomationType.Tempo, 140, 0)]);
      });

      const settings = createAlphaTabSettings();
      const score = buildAlphaTabScore(scoreMap, settings);

      expect(score.title).toBe("My Song");
      expect(score.artist).toBe("Test Artist");
      expect(score.tempo).toBe(140);
      expect(score.masterBars[0].tempoAutomations[0]?.value).toBe(140);
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

    it("converts master bar tempo automations", () => {
      const scoreMap = getScoreMap()!;
      seedOneTrackScore(scoreMap, 3);

      const yMasterBars = scoreMap.get("masterBars") as Y.Array<Y.Map<unknown>>;
      transact(() => {
        (
          yMasterBars.get(0).get("tempoAutomations") as Y.Array<
            Y.Map<unknown>
          >
        ).push([createAutomation(AutomationType.Tempo, 100, 0)]);
        (
          yMasterBars.get(2).get("tempoAutomations") as Y.Array<
            Y.Map<unknown>
          >
        ).push([createAutomation(AutomationType.Tempo, 132, 0)]);
      });

      const settings = createAlphaTabSettings();
      const score = buildAlphaTabScore(scoreMap, settings);

      expect(score.tempo).toBe(100);
      expect(score.masterBars[0].tempoAutomations[0]?.value).toBe(100);
      expect(score.masterBars[1].tempoAutomations).toHaveLength(0);
      expect(score.masterBars[2].tempoAutomations[0]?.value).toBe(132);
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
      yBeat.set("isEmpty", false);
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
      [64, 59, 55, 50, 45, 40],
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
    expect(yScore.has("tempo")).toBe(false);
    expect(snapshotScore(yScore).tempo).toBe(120);

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

describe("direct AlphaTab model field round-trip", () => {
  it("preserves nested core fields without flattened aliases", () => {
    const scoreMap = getScoreMap()!;
    seedOneTrackScore(scoreMap, 1);

    transact(() => {
      const masterBars = scoreMap.get("masterBars") as Y.Array<
        Y.Map<unknown>
      >;
      const masterBar = masterBars.get(0);
      (
        masterBar.get("tempoAutomations") as Y.Array<Y.Map<unknown>>
      ).push([createAutomation(AutomationType.Tempo, 150, 0)]);

      const tracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;
      const track = tracks.get(0);
      (track.get("playbackInfo") as Y.Map<unknown>).set("program", 30);

      const articulation = new Y.Map<unknown>();
      articulation.set("id", 38);
      articulation.set("elementType", "Snare");
      articulation.set("staffLine", 3);
      articulation.set("noteHeadDefault", 0);
      articulation.set("noteHeadHalf", 0);
      articulation.set("noteHeadWhole", 0);
      articulation.set("techniqueSymbol", 0);
      articulation.set("techniqueSymbolPlacement", 0);
      articulation.set("outputMidiNumber", 38);
      (
        track.get("percussionArticulations") as Y.Array<Y.Map<unknown>>
      ).push([articulation]);

      const staff = (track.get("staves") as Y.Array<Y.Map<unknown>>).get(0);
      staff.set("transpositionPitch", -2);
      staff.set("displayTranspositionPitch", 3);
      const stringTuning = staff.get("stringTuning") as Y.Map<unknown>;
      const tunings = stringTuning.get("tunings") as Y.Array<number>;
      tunings.delete(0, tunings.length);
      tunings.push([64, 59, 55, 50, 45, 38]);

      const chord = new Y.Map<unknown>();
      chord.set("name", "D");
      chord.set("firstFret", 1);
      const strings = new Y.Array<number>();
      strings.push([2, 3, 2, 0, -1, -1]);
      chord.set("strings", strings);
      chord.set("barreFrets", new Y.Array<number>());
      chord.set("showName", true);
      chord.set("showDiagram", true);
      chord.set("showFingering", true);
      const chords = new Y.Map<Y.Map<unknown>>();
      chords.set("d-major", chord);
      staff.set("chords", chords);

      const bar = (staff.get("bars") as Y.Array<Y.Map<unknown>>).get(0);
      bar.set("clefOttava", 1);
      bar.set("simileMark", 1);
      bar.set("keySignature", -2);
      bar.set("keySignatureType", 1);

      const voice = (bar.get("voices") as Y.Array<Y.Map<unknown>>).get(0);
      const beats = voice.get("beats") as Y.Array<Y.Map<unknown>>;
      const originBeat = beats.get(0);
      originBeat.set("isEmpty", false);
      originBeat.set("whammyBarType", 1);
      const whammyPoints = new Y.Array<Y.Map<unknown>>();
      originBeat.set("whammyBarPoints", whammyPoints);
      for (const [offset, value] of [
        [0, 0],
        [60, 4],
      ]) {
        const point = new Y.Map<unknown>();
        point.set("offset", offset);
        point.set("value", value);
        whammyPoints.push([point]);
      }
      const originNote = createNote(5, 3);
      (originBeat.get("notes") as Y.Array<Y.Map<unknown>>).push([
        originNote,
      ]);
      const integratedOriginNote = (
        originBeat.get("notes") as Y.Array<Y.Map<unknown>>
      ).get(0);
      integratedOriginNote.set("bendType", 1);
      const bendPoints = new Y.Array<Y.Map<unknown>>();
      integratedOriginNote.set("bendPoints", bendPoints);
      for (const [offset, value] of [
        [0, 0],
        [60, 4],
      ]) {
        const point = new Y.Map<unknown>();
        point.set("offset", offset);
        point.set("value", value);
        bendPoints.push([point]);
      }

      beats.push([createBeat()]);
      const beat = beats.get(1);
      beat.set("isEmpty", false);
      beat.set("whammyStyle", 1);
      beat.set("brushType", 1);
      beat.set("brushDuration", 120);
      beat.set("dynamics", 6);
      beat.set("isContinuedWhammy", true);
      beat.set("rasgueado", 3);
      beat.set("chordId", "d-major");
      (
        beat.get("automations") as Y.Array<Y.Map<unknown>>
      ).push([createAutomation(AutomationType.Instrument, 27, 0.5)]);
      const lyrics = new Y.Array<string>();
      lyrics.push(["la"]);
      beat.set("lyrics", lyrics);
      const tremolo = new Y.Map<unknown>();
      tremolo.set("marks", 2);
      tremolo.set("style", 0);
      beat.set("tremoloPicking", tremolo);

      const note = createNote(5, 3);
      (beat.get("notes") as Y.Array<Y.Map<unknown>>).push([note]);
      const integratedNote = (
        beat.get("notes") as Y.Array<Y.Map<unknown>>
      ).get(0);
      integratedNote.set("isContinuedBend", true);
      integratedNote.set("dynamics", 6);
    });

    const settings = createAlphaTabSettings();
    const score = buildAlphaTabScore(scoreMap, settings);
    const track = score.tracks[0];
    const staff = track.staves[0];
    const bar = staff.bars[0];
    const beat = bar.voices[0].beats[1];
    const note = beat.notes[0];

    expect(score.masterBars[0].tempoAutomations[0].value).toBe(150);
    expect(track.playbackInfo.program).toBe(30);
    expect(track.percussionArticulations[0].outputMidiNumber).toBe(38);
    expect(staff.stringTuning.tunings).toEqual([64, 59, 55, 50, 45, 38]);
    expect(staff.transpositionPitch).toBe(-2);
    expect(staff.displayTranspositionPitch).toBe(3);
    expect(staff.chords?.get("d-major")?.name).toBe("D");
    expect(bar.clefOttava).toBe(1);
    expect(bar.simileMark).toBe(1);
    expect(bar.keySignature).toBe(-2);
    expect(bar.keySignatureType).toBe(1);
    expect(beat.whammyStyle).toBe(1);
    expect(beat.brushDuration).toBe(120);
    expect(beat.isContinuedWhammy).toBe(true);
    expect(beat.automations[0].type).toBe(AutomationType.Instrument);
    expect(beat.automations[0].ratioPosition).toBe(0.5);
    expect(beat.lyrics).toEqual(["la"]);
    expect(beat.tremoloPicking?.marks).toBe(2);
    expect(beat.rasgueado).toBe(3);
    expect(note.isContinuedBend).toBe(true);
    expect(note.dynamics).toBe(6);

    const importedDoc = new Y.Doc();
    importScoreToYDoc(score, importedDoc);
    const importedScore = importedDoc.getMap("score");
    const importedTrack = (
      importedScore.get("tracks") as Y.Array<Y.Map<unknown>>
    ).get(0);
    const importedStaff = (
      importedTrack.get("staves") as Y.Array<Y.Map<unknown>>
    ).get(0);
    const importedBar = (
      importedStaff.get("bars") as Y.Array<Y.Map<unknown>>
    ).get(0);
    const importedBeat = (
      (
        importedBar.get("voices") as Y.Array<Y.Map<unknown>>
      ).get(0).get("beats") as Y.Array<Y.Map<unknown>>
    ).get(1);

    expect(importedScore.has("tempo")).toBe(false);
    expect(importedTrack.has("playbackProgram")).toBe(false);
    expect(importedStaff.has("tuning")).toBe(false);
    expect(importedStaff.get("transpositionPitch")).toBe(-2);
    expect(importedStaff.get("displayTranspositionPitch")).toBe(3);
    expect(importedBar.get("keySignature")).toBe(-2);
    expect(importedBeat.get("brushDuration")).toBe(120);
    expect(
      (importedBeat.get("tremoloPicking") as Y.Map<unknown>).get("marks"),
    ).toBe(2);
    expect(
      (
        importedBeat.get("notes") as Y.Array<Y.Map<unknown>>
      ).get(0).get("isContinuedBend"),
    ).toBe(true);
  });
});

describe("round-trip (Y → AlphaTab → Y)", () => {
  it("preserves content across Y → buildAlphaTabScore → importScoreToYDoc → Y", () => {
    const scoreMap = getScoreMap()!;

    seedOneTrackScore(scoreMap, 2, [3, 4]);
    transact(() => {
      scoreMap.set("title", "Round Trip Song");
      scoreMap.set("artist", "Round Trip Artist");
      const masterBars = scoreMap.get("masterBars") as Y.Array<
        Y.Map<unknown>
      >;
      (
        masterBars.get(0).get("tempoAutomations") as Y.Array<
          Y.Map<unknown>
        >
      ).push([createAutomation(AutomationType.Tempo, 90, 0)]);
    });
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
    expect(newYScore.has("tempo")).toBe(false);
    expect(snapshotScore(newYScore).tempo).toBe(90);

    const newMasterBars = newYScore.get("masterBars") as Y.Array<Y.Map<unknown>>;
    expect(newMasterBars.length).toBe(2);
    const newTempoAutomations = newMasterBars
      .get(0)
      .get("tempoAutomations") as Y.Array<Y.Map<unknown>>;
    expect(newTempoAutomations.get(0).get("value")).toBe(90);
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

  it("preserves Taijin Kyofusho per-bar tempo map through Y.Doc rebuild", () => {
    const data = readFileSync("public/demos/Taijin_kyofusho.gp");
    const settings = createAlphaTabSettings();
    const alphaScore = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
      new Uint8Array(data),
      settings,
    );

    const doc = new Y.Doc();
    importScoreToYDoc(alphaScore, doc);

    const yScore = doc.getMap("score");
    const yMasterBars = yScore.get("masterBars") as Y.Array<Y.Map<unknown>>;
    const yTempos = yMasterBars
      .map((mb, index) => {
        const automations = mb.get("tempoAutomations") as Y.Array<
          Y.Map<unknown>
        >;
        return [index, automations.get(0)?.get("value") ?? null] as const;
      })
      .filter(([, tempo]) => tempo !== null);

    expect(yTempos).toEqual([
      [0, 70],
      [8, 70],
      [16, 75],
      [24, 78],
      [32, 80],
      [40, 82],
      [48, 85],
    ]);

    const rebuilt = buildAlphaTabScore(yScore, settings);
    const rebuiltTempos = rebuilt.masterBars
      .map(
        (mb, index) =>
          [index, mb.tempoAutomations[0]?.value ?? null] as const,
      )
      .filter(([, tempo]) => tempo !== null);

    expect(rebuiltTempos).toEqual(yTempos);
  });
});
