import { describe, expect, it } from "vitest";
import * as alphaTab from "@coderline/alphatab";
import midiCapabilities from "../../../tools/alphatab/midi-capabilities.json";

interface ScoreFixture {
  score: alphaTab.model.Score;
  settings: alphaTab.Settings;
  masterBar: alphaTab.model.MasterBar;
  bar: alphaTab.model.Bar;
  beat: alphaTab.model.Beat;
  note: alphaTab.model.Note;
}

type FixtureMutation = (fixture: ScoreFixture) => void;

interface MidiCapabilityCase {
  field: string;
  baseline?: FixtureMutation;
  variant: FixtureMutation;
}

type NormalizedMidiEvent = Record<string, number | string>;

function createFixture(): ScoreFixture {
  const score = new alphaTab.model.Score();
  const settings = new alphaTab.Settings();

  const masterBar = new alphaTab.model.MasterBar();
  masterBar.timeSignatureNumerator = 4;
  masterBar.timeSignatureDenominator = 4;
  masterBar.tempoAutomations.push(
    alphaTab.model.Automation.buildTempoAutomation(false, 0, 120, 0),
  );
  score.addMasterBar(masterBar);

  const track = new alphaTab.model.Track();
  track.playbackInfo.primaryChannel = 0;
  track.playbackInfo.secondaryChannel = 1;
  track.playbackInfo.program = 25;
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
  beat.duration = alphaTab.model.Duration.Quarter;
  beat.isEmpty = false;
  voice.addBeat(beat);

  const note = new alphaTab.model.Note();
  note.string = 1;
  note.fret = 0;
  beat.addNote(note);

  return { score, settings, masterBar, bar, beat, note };
}

function normalizeEvent(event: alphaTab.midi.MidiEvent): NormalizedMidiEvent {
  const values = Object.entries(event)
    .filter(([, value]) => typeof value === "number" || typeof value === "string")
    .sort(([left], [right]) => left.localeCompare(right));

  return {
    event: event.constructor.name,
    ...Object.fromEntries(values),
  } as NormalizedMidiEvent;
}

function generateMidiEvents(mutate?: FixtureMutation): NormalizedMidiEvent[] {
  const fixture = createFixture();
  mutate?.(fixture);
  fixture.score.finish(fixture.settings);

  const midiFile = new alphaTab.midi.MidiFile();
  const handler = new alphaTab.midi.AlphaSynthMidiFileHandler(midiFile);
  const generator = new alphaTab.midi.MidiFileGenerator(
    fixture.score,
    fixture.settings,
    handler,
  );
  generator.generate();

  return midiFile.events.map(normalizeEvent);
}

function addSustainMarker(
  fixture: ScoreFixture,
  ratioPosition: number,
  pedalType: alphaTab.model.SustainPedalMarkerType,
): void {
  const marker = new alphaTab.model.SustainPedalMarker();
  marker.ratioPosition = ratioPosition;
  marker.pedalType = pedalType;
  fixture.bar.sustainPedals.push(marker);
}

function addFermata(
  fixture: ScoreFixture,
  type: alphaTab.model.FermataType,
  length: number,
): void {
  const fermata = new alphaTab.model.Fermata();
  fermata.type = type;
  fermata.length = length;
  fixture.masterBar.addFermata(0, fermata);
}

const noMidiDifferenceCases: MidiCapabilityCase[] = [
  {
    field: "Automation.isLinear",
    baseline: ({ masterBar }) => {
      masterBar.tempoAutomations.push(
        alphaTab.model.Automation.buildTempoAutomation(false, 0.5, 90, 0),
      );
    },
    variant: ({ masterBar }) => {
      masterBar.tempoAutomations.push(
        alphaTab.model.Automation.buildTempoAutomation(true, 0.5, 90, 0),
      );
    },
  },
  {
    field: "Bar.sustainPedals",
    variant: (fixture) => {
      addSustainMarker(
        fixture,
        0.25,
        alphaTab.model.SustainPedalMarkerType.Down,
      );
    },
  },
  {
    field: "SustainPedalMarker.ratioPosition",
    baseline: (fixture) => {
      addSustainMarker(
        fixture,
        0.25,
        alphaTab.model.SustainPedalMarkerType.Down,
      );
    },
    variant: (fixture) => {
      addSustainMarker(
        fixture,
        0.75,
        alphaTab.model.SustainPedalMarkerType.Down,
      );
    },
  },
  {
    field: "SustainPedalMarker.pedalType",
    baseline: (fixture) => {
      addSustainMarker(
        fixture,
        0.25,
        alphaTab.model.SustainPedalMarkerType.Down,
      );
    },
    variant: (fixture) => {
      addSustainMarker(
        fixture,
        0.25,
        alphaTab.model.SustainPedalMarkerType.Up,
      );
    },
  },
  {
    field: "Beat.pop",
    variant: ({ beat }) => {
      beat.pop = true;
    },
  },
  {
    field: "Beat.slap",
    variant: ({ beat }) => {
      beat.slap = true;
    },
  },
  {
    field: "Beat.tap",
    variant: ({ beat }) => {
      beat.tap = true;
    },
  },
  {
    field: "Beat.crescendo",
    variant: ({ beat }) => {
      beat.crescendo = alphaTab.model.CrescendoType.Crescendo;
    },
  },
  {
    field: "Beat.golpe",
    variant: ({ beat }) => {
      beat.golpe = alphaTab.model.GolpeType.Thumb;
    },
  },
  {
    field: "Beat.wahPedal",
    variant: ({ beat }) => {
      beat.wahPedal = alphaTab.model.WahPedal.Open;
    },
  },
  {
    field: "MasterBar.fermata",
    variant: (fixture) => {
      addFermata(fixture, alphaTab.model.FermataType.Short, 1);
    },
  },
  {
    field: "Fermata.type",
    baseline: (fixture) => {
      addFermata(fixture, alphaTab.model.FermataType.Short, 1);
    },
    variant: (fixture) => {
      addFermata(fixture, alphaTab.model.FermataType.Long, 1);
    },
  },
  {
    field: "Fermata.length",
    baseline: (fixture) => {
      addFermata(fixture, alphaTab.model.FermataType.Short, 1);
    },
    variant: (fixture) => {
      addFermata(fixture, alphaTab.model.FermataType.Short, 2);
    },
  },
];

describe("AlphaTab MIDI capability audit", () => {
  it("keeps the capability manifest synchronized with the installed AlphaTab and cases", () => {
    expect(alphaTab.meta.version).toBe(midiCapabilities.alphaTabVersion);
    expect(noMidiDifferenceCases.map(({ field }) => field).sort()).toEqual(
      [...midiCapabilities.identicalMidiFields].sort(),
    );
  });

  it("detects a known playback difference", () => {
    const baseline = generateMidiEvents();
    const deadNote = generateMidiEvents(({ note }) => {
      note.isDead = true;
    });

    expect(deadNote).not.toEqual(baseline);
  });

  it.each(noMidiDifferenceCases)(
    "$field does not change generated MIDI events in the installed AlphaTab version",
    ({ baseline, variant }) => {
      expect(generateMidiEvents(variant)).toEqual(generateMidiEvents(baseline));
    },
  );
});
