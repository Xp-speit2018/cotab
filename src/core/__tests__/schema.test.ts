import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import {
  createNote,
  createBeat,
  createVoice,
  createBar,
  createMasterBar,
  createStaff,
  createTrack,
  snapshotNote,
  snapshotBeat,
  snapshotMasterBar,
  snapshotScore,
  buildUuidIndex,
  initializeScore,
  Duration,
  Clef,
  AccentuationType,
  VibratoType,
  DynamicValue,
} from "../schema";

/**
 * Yjs requires types to be integrated into a Y.Doc before .get() works.
 * This helper adds a Y.Map to a temporary doc so we can read its values.
 */
function integrate<T extends Y.Map<unknown>>(yMap: T): T {
  const doc = new Y.Doc();
  const root = doc.getMap("root");
  root.set("item", yMap);
  return root.get("item") as T;
}

// ─── Factory Functions ───────────────────────────────────────────────────────

describe("createNote", () => {
  it("sets fret and string", () => {
    const note = integrate(createNote(5, 3));
    expect(note.get("fret")).toBe(5);
    expect(note.get("string")).toBe(3);
  });

  it("generates a uuid", () => {
    const note = integrate(createNote(0, 1));
    expect(note.get("uuid")).toBeTypeOf("string");
    expect((note.get("uuid") as string).length).toBeGreaterThan(0);
  });

  it("has correct boolean defaults", () => {
    const note = integrate(createNote(0, 1));
    expect(note.get("isDead")).toBe(false);
    expect(note.get("isGhost")).toBe(false);
    expect(note.get("isStaccato")).toBe(false);
    expect(note.get("isLetRing")).toBe(false);
    expect(note.get("isPalmMute")).toBe(false);
    expect(note.get("isTieDestination")).toBe(false);
    expect(note.get("isHammerPullOrigin")).toBe(false);
    expect(note.get("isLeftHandTapped")).toBe(false);
  });

  it("has correct enum defaults", () => {
    const note = integrate(createNote(0, 1));
    expect(note.get("accentuated")).toBe(AccentuationType.None);
    expect(note.get("vibrato")).toBe(VibratoType.None);
    expect(note.get("dynamics")).toBeUndefined();
  });

  it("generates unique uuids", () => {
    const a = integrate(createNote(0, 1));
    const doc2 = new Y.Doc();
    const root2 = doc2.getMap("root");
    root2.set("item", createNote(0, 1));
    const b = root2.get("item") as Y.Map<unknown>;
    expect(a.get("uuid")).not.toBe(b.get("uuid"));
  });
});

describe("createBeat", () => {
  it("defaults to quarter duration", () => {
    const beat = integrate(createBeat());
    expect(beat.get("duration")).toBe(Duration.Quarter);
  });

  it("accepts custom duration", () => {
    const beat = integrate(createBeat(Duration.Eighth));
    expect(beat.get("duration")).toBe(Duration.Eighth);
  });

  it("starts as empty with no notes", () => {
    const beat = integrate(createBeat());
    expect(beat.get("isEmpty")).toBe(true);
    const notes = beat.get("notes") as Y.Array<unknown>;
    expect(notes.length).toBe(0);
  });

  it("has correct defaults for rhythm modifiers", () => {
    const beat = integrate(createBeat());
    expect(beat.get("dots")).toBe(0);
    expect(beat.get("isRest")).toBe(false);
    expect(beat.get("tupletNumerator")).toBe(0);
    expect(beat.get("tupletDenominator")).toBe(0);
  });
});

describe("createVoice", () => {
  it("creates voice with uuid and empty beats array", () => {
    const voice = integrate(createVoice());
    expect(voice.get("uuid")).toBeTypeOf("string");
    const beats = voice.get("beats") as Y.Array<unknown>;
    expect(beats.length).toBe(0);
  });
});

describe("createBar", () => {
  it("defaults to G2 clef", () => {
    const bar = integrate(createBar());
    expect(bar.get("clef")).toBe(Clef.G2);
  });

  it("accepts custom clef", () => {
    const bar = integrate(createBar(Clef.F4));
    expect(bar.get("clef")).toBe(Clef.F4);
  });

  it("has empty voices array", () => {
    const bar = integrate(createBar());
    const voices = bar.get("voices") as Y.Array<unknown>;
    expect(voices.length).toBe(0);
  });
});

describe("createMasterBar", () => {
  it("defaults to 4/4 time signature", () => {
    const mb = integrate(createMasterBar());
    expect(mb.get("timeSignatureNumerator")).toBe(4);
    expect(mb.get("timeSignatureDenominator")).toBe(4);
  });

  it("accepts custom time signature", () => {
    const mb = integrate(createMasterBar(3, 8));
    expect(mb.get("timeSignatureNumerator")).toBe(3);
    expect(mb.get("timeSignatureDenominator")).toBe(8);
  });

  it("has correct defaults for repeat/section fields", () => {
    const mb = integrate(createMasterBar());
    expect(mb.get("isRepeatStart")).toBe(false);
    expect(mb.get("repeatCount")).toBe(0);
    expect(mb.get("section")).toBeNull();
    expect(mb.get("fermata")).toBeNull();
    expect(mb.get("tempo")).toBeNull();
  });
});

describe("createStaff", () => {
  it("includes standard guitar tuning", () => {
    const staff = integrate(createStaff());
    const tuning = staff.get("tuning") as Y.Array<number>;
    expect(tuning.toArray()).toEqual([40, 45, 50, 55, 59, 64]);
  });

  it("defaults to showing tab and standard notation", () => {
    const staff = integrate(createStaff());
    expect(staff.get("showTablature")).toBe(true);
    expect(staff.get("showStandardNotation")).toBe(true);
  });

  it("defaults capo to 0", () => {
    const staff = integrate(createStaff());
    expect(staff.get("capo")).toBe(0);
  });
});

describe("createTrack", () => {
  it("sets the name", () => {
    const track = integrate(createTrack("My Guitar"));
    expect(track.get("name")).toBe("My Guitar");
  });

  it("has default color", () => {
    const track = integrate(createTrack());
    expect(track.get("colorR")).toBe(255);
    expect(track.get("colorG")).toBe(99);
    expect(track.get("colorB")).toBe(71);
  });

  it("has empty staves array", () => {
    const track = integrate(createTrack());
    const staves = track.get("staves") as Y.Array<unknown>;
    expect(staves.length).toBe(0);
  });

  it("has default playback program", () => {
    const track = integrate(createTrack());
    expect(track.get("playbackProgram")).toBe(25);
  });
});

// ─── Snapshot Round-trips ────────────────────────────────────────────────────

describe("snapshotNote", () => {
  it("round-trips all fields from createNote", () => {
    const yNote = integrate(createNote(5, 3));
    const snap = snapshotNote(yNote);

    expect(snap.fret).toBe(5);
    expect(snap.string).toBe(3);
    expect(snap.uuid).toBe(yNote.get("uuid"));
    expect(snap.isDead).toBe(false);
    expect(snap.accentuated).toBe(AccentuationType.None);
    expect(snap.dynamics).toBe(DynamicValue.F);
    expect(snap.durationPercent).toBe(1);
    expect(snap.trillValue).toBe(-1);
  });
});

describe("snapshotBeat", () => {
  it("round-trips beat with notes", () => {
    const doc = new Y.Doc();
    const root = doc.getMap("root");
    const yBeat = createBeat(Duration.Eighth);
    root.set("beat", yBeat);
    const intBeat = root.get("beat") as Y.Map<unknown>;

    doc.transact(() => {
      const yNotes = intBeat.get("notes") as Y.Array<Y.Map<unknown>>;
      yNotes.push([createNote(3, 2)]);
      intBeat.set("isEmpty", false);
    });

    const snap = snapshotBeat(intBeat);
    expect(snap.duration).toBe(Duration.Eighth);
    expect(snap.isEmpty).toBe(false);
    expect(snap.notes).toHaveLength(1);
    expect(snap.notes[0].fret).toBe(3);
    expect(snap.notes[0].string).toBe(2);
  });
});

describe("snapshotMasterBar", () => {
  it("round-trips time signature", () => {
    const yMb = integrate(createMasterBar(6, 8));
    const snap = snapshotMasterBar(yMb);
    expect(snap.timeSignatureNumerator).toBe(6);
    expect(snap.timeSignatureDenominator).toBe(8);
  });
});

describe("snapshotScore", () => {
  it("round-trips a fully populated doc", () => {
    const doc = new Y.Doc();
    const scoreMap = initializeScore(doc);

    doc.transact(() => {
      const yMasterBars = scoreMap.get("masterBars") as Y.Array<Y.Map<unknown>>;
      yMasterBars.push([createMasterBar(3, 4)]);

      const track = createTrack("Guitar");
      const staff = createStaff();
      const bar = createBar();
      const voice = createVoice();
      const beat = createBeat();
      (scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>).push([track]);
      (track.get("staves") as Y.Array<Y.Map<unknown>>).push([staff]);
      (staff.get("bars") as Y.Array<Y.Map<unknown>>).push([bar]);
      (bar.get("voices") as Y.Array<Y.Map<unknown>>).push([voice]);
      (voice.get("beats") as Y.Array<Y.Map<unknown>>).push([beat]);

      const note = createNote(5, 3);
      (beat.get("notes") as Y.Array<Y.Map<unknown>>).push([note]);
      beat.set("isEmpty", false);
    });

    const snap = snapshotScore(scoreMap);
    expect(snap.title).toBe("Untitled");
    expect(snap.tempo).toBe(120);
    expect(snap.masterBars).toHaveLength(1);
    expect(snap.masterBars[0].timeSignatureNumerator).toBe(3);
    expect(snap.tracks).toHaveLength(1);
    expect(snap.tracks[0].name).toBe("Guitar");
    expect(snap.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].fret).toBe(5);
  });
});

// ─── UUID Index ──────────────────────────────────────────────────────────────

describe("buildUuidIndex", () => {
  it("indexes all entities in the tree", () => {
    const doc = new Y.Doc();
    const scoreMap = initializeScore(doc);

    doc.transact(() => {
      const yMasterBars = scoreMap.get("masterBars") as Y.Array<Y.Map<unknown>>;
      yMasterBars.push([createMasterBar()]);

      const track = createTrack("T");
      const staff = createStaff();
      const bar = createBar();
      const voice = createVoice();
      const beat = createBeat();
      const note = createNote(1, 1);

      (scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>).push([track]);
      (track.get("staves") as Y.Array<Y.Map<unknown>>).push([staff]);
      (staff.get("bars") as Y.Array<Y.Map<unknown>>).push([bar]);
      (bar.get("voices") as Y.Array<Y.Map<unknown>>).push([voice]);
      (voice.get("beats") as Y.Array<Y.Map<unknown>>).push([beat]);
      (beat.get("notes") as Y.Array<Y.Map<unknown>>).push([note]);
    });

    const index = buildUuidIndex(scoreMap);

    // masterBar + track + staff + bar + voice + beat + note = 7
    expect(index.size).toBe(7);

    const yMasterBars = scoreMap.get("masterBars") as Y.Array<Y.Map<unknown>>;
    const mbUuid = yMasterBars.get(0).get("uuid") as string;
    expect(index.get(mbUuid)).toBeDefined();

    const yTracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;
    const trackUuid = yTracks.get(0).get("uuid") as string;
    expect(index.get(trackUuid)).toBeDefined();
  });
});

// ─── initializeScore ─────────────────────────────────────────────────────────

describe("initializeScore", () => {
  it("creates all required keys on a fresh doc", () => {
    const doc = new Y.Doc();
    const scoreMap = initializeScore(doc);

    expect(scoreMap.get("title")).toBe("Untitled");
    expect(scoreMap.get("tempo")).toBe(120);
    expect(scoreMap.get("artist")).toBe("");
    expect(scoreMap.get("masterBars")).toBeInstanceOf(Y.Array);
    expect(scoreMap.get("tracks")).toBeInstanceOf(Y.Array);
  });

  it("is idempotent", () => {
    const doc = new Y.Doc();
    const first = initializeScore(doc);
    first.set("title", "Changed");

    const second = initializeScore(doc);
    expect(second).toBe(first);
    expect(second.get("title")).toBe("Changed");
  });
});
