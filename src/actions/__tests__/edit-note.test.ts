import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Y from "yjs";
import {
  resetMockState,
  selectBeat,
  setSelectedNoteIndex,
  setMockApiScore,
  buildMockAlphaTabScore,
  seedOneTrackScore,
  seedTrackWithConfig,
  placeNoteDirectly,
  placePercussionNoteDirectly,
  expectPercussionNote,
  testContext,
} from "@/test/setup";
import {
  initDoc,
  destroyDoc,
  getScoreMap,
  resolveYNote,
  resolveYBeat,
} from "@/core/sync";
import { createNote } from "@/core/schema";
import { resolveBeat } from "@/stores/player-helpers";
import { resolveGp7Id } from "@/stores/percussion-data";
import {
  AccentuationType,
  VibratoType,
  BendType,
  SlideOutType,
  SlideInType,
  HarmonicType,
  Duration,
  NoteOrnament,
} from "@/core/schema";
import { executeAction } from "@/actions/registry";
import "@/actions/edit-note";

const defaultSel = {
  trackIndex: 0,
  staffIndex: 0,
  barIndex: 0,
  voiceIndex: 0,
  beatIndex: 0,
  string: 3 as number | null,
};
const ctx = testContext();

beforeEach(() => {
  resetMockState();
  destroyDoc();
  initDoc();
  seedOneTrackScore(getScoreMap()!, 1);
  placeNoteDirectly(getScoreMap()!, 0, 0, 0, 5, 3);
  selectBeat(defaultSel);
  setSelectedNoteIndex(0);
});

function getNote() {
  return resolveYNote(0, 0, 0, 0, 0, 0)!;
}

describe("edit.note.setTie", () => {
  it("sets isTieDestination on note Y.Map", () => {
    executeAction("edit.note.setTie", true, ctx);
    expect(getNote().get("isTieDestination")).toBe(true);
  });

  it("unsets tie", () => {
    executeAction("edit.note.setTie", true, ctx);
    executeAction("edit.note.setTie", false, ctx);
    expect(getNote().get("isTieDestination")).toBe(false);
  });
});

describe("edit.note.setGhost", () => {
  it("toggles isGhost", () => {
    executeAction("edit.note.setGhost", true, ctx);
    expect(getNote().get("isGhost")).toBe(true);
  });
});

describe("edit.note.setDead", () => {
  it("toggles isDead", () => {
    executeAction("edit.note.setDead", true, ctx);
    expect(getNote().get("isDead")).toBe(true);
  });
});

describe("edit.note.setAccent", () => {
  it("sets accentuated field", () => {
    executeAction("edit.note.setAccent", AccentuationType.Heavy, ctx);
    expect(getNote().get("accentuated")).toBe(AccentuationType.Heavy);
  });
});

describe("edit.note.setStaccato", () => {
  it("toggles isStaccato", () => {
    executeAction("edit.note.setStaccato", true, ctx);
    expect(getNote().get("isStaccato")).toBe(true);
  });
});

describe("edit.note.setLetRing", () => {
  it("toggles isLetRing", () => {
    executeAction("edit.note.setLetRing", true, ctx);
    expect(getNote().get("isLetRing")).toBe(true);
  });
});

describe("edit.note.setPalmMute", () => {
  it("toggles isPalmMute", () => {
    executeAction("edit.note.setPalmMute", true, ctx);
    expect(getNote().get("isPalmMute")).toBe(true);
  });
});

describe("edit.note.setHammerPull", () => {
  it("toggles isHammerPullOrigin", () => {
    executeAction("edit.note.setHammerPull", true, ctx);
    expect(getNote().get("isHammerPullOrigin")).toBe(true);
  });
});

describe("edit.note.setVibrato", () => {
  it("sets vibrato enum", () => {
    executeAction("edit.note.setVibrato", VibratoType.Wide, ctx);
    expect(getNote().get("vibrato")).toBe(VibratoType.Wide);
  });
});

describe("edit.note.setBendType", () => {
  it("sets bendType enum", () => {
    executeAction("edit.note.setBendType", BendType.Bend, ctx);
    expect(getNote().get("bendType")).toBe(BendType.Bend);
  });
});

describe("edit.note.setSlideOut", () => {
  it("sets slideOutType enum", () => {
    executeAction("edit.note.setSlideOut", SlideOutType.Shift, ctx);
    expect(getNote().get("slideOutType")).toBe(SlideOutType.Shift);
  });
});

describe("edit.note.setSlideInType", () => {
  it("sets slideInType enum", () => {
    executeAction("edit.note.setSlideInType", SlideInType.IntoFromBelow, ctx);
    expect(getNote().get("slideInType")).toBe(SlideInType.IntoFromBelow);
  });
});

describe("edit.note.setHarmonicType", () => {
  it("sets harmonicType enum", () => {
    executeAction("edit.note.setHarmonicType", HarmonicType.Natural, ctx);
    expect(getNote().get("harmonicType")).toBe(HarmonicType.Natural);
  });
});

describe("edit.note.setTrill", () => {
  it("sets trillValue and trillSpeed", () => {
    executeAction("edit.note.setTrill", { trillValue: 7, trillSpeed: Duration.Sixteenth }, ctx);
    expect(getNote().get("trillValue")).toBe(7);
    expect(getNote().get("trillSpeed")).toBe(Duration.Sixteenth);
  });
});

describe("edit.note.setOrnament", () => {
  it("sets ornament enum", () => {
    executeAction("edit.note.setOrnament", NoteOrnament.Turn, ctx);
    expect(getNote().get("ornament")).toBe(NoteOrnament.Turn);
  });
});

describe("edit.note.setLeftHandTapped", () => {
  it("toggles isLeftHandTapped", () => {
    executeAction("edit.note.setLeftHandTapped", true, ctx);
    expect(getNote().get("isLeftHandTapped")).toBe(true);
  });
});

describe("applyNoteUpdates guards", () => {
  it("does nothing without selection", () => {
    selectBeat(null);
    executeAction("edit.note.setGhost", true, ctx);
    expect(getNote().get("isGhost")).toBe(false);
  });

  it("does nothing with negative note index", () => {
    setSelectedNoteIndex(-1);
    executeAction("edit.note.setGhost", true, ctx);
    expect(getNote().get("isGhost")).toBe(false);
  });
});

describe("edit.note (violin tab)", () => {
  beforeEach(() => {
    resetMockState();
    destroyDoc();
    initDoc();
    seedTrackWithConfig(getScoreMap()!, 1, { name: "Violin", tuning: [55, 62, 69, 76] });
    placeNoteDirectly(getScoreMap()!, 0, 0, 0, 2, 2);
    selectBeat({ ...defaultSel, string: 2 as number | null });
    setSelectedNoteIndex(0);
  });

  it("setGhost applies to violin note", () => {
    executeAction("edit.note.setGhost", true, ctx);
    expect(getNote().get("isGhost")).toBe(true);
  });
});

describe("edit.note (piano notation)", () => {
  beforeEach(() => {
    resetMockState();
    destroyDoc();
    initDoc();
    seedTrackWithConfig(getScoreMap()!, 1, { name: "Piano", showTablature: false });
    const scoreMap = getScoreMap()!;
    scoreMap.doc!.transact(() => {
      const yTracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;
      const yStaves = yTracks.get(0).get("staves") as Y.Array<Y.Map<unknown>>;
      const yBars = yStaves.get(0).get("bars") as Y.Array<Y.Map<unknown>>;
      const yVoices = yBars.get(0).get("voices") as Y.Array<Y.Map<unknown>>;
      const yBeats = yVoices.get(0).get("beats") as Y.Array<Y.Map<unknown>>;
      const yBeat = yBeats.get(0);
      const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
      const yNote = createNote(0, 0);
      yNote.set("octave", 4);
      yNote.set("tone", 5);
      yNotes.push([yNote]);
      yBeat.set("isEmpty", false);
    });
    selectBeat(defaultSel);
    setSelectedNoteIndex(0);
  });

  it("setGhost applies to piano note", () => {
    executeAction("edit.note.setGhost", true, ctx);
    expect(getNote().get("isGhost")).toBe(true);
  });
});

describe("edit.note (drumkit percussion)", () => {
  beforeEach(() => {
    resetMockState();
    destroyDoc();
    initDoc();
    seedTrackWithConfig(getScoreMap()!, 1, { name: "Drums", isPercussion: true });
    placePercussionNoteDirectly(getScoreMap()!, 0, 0, 0, 42);
    selectBeat(defaultSel);
    setSelectedNoteIndex(0);
  });

  it("setGhost applies to percussion note", () => {
    executeAction("edit.note.setGhost", true, ctx);
    expect(getNote().get("isGhost")).toBe(true);
  });
});

// ─── togglePercussionArticulation ─────────────────────────────────────────────

describe("edit.beat.togglePercussionArticulation", () => {
  const drumSel = { ...defaultSel, string: 2 as number | null };

  function setupDrumTrack() {
    resetMockState();
    destroyDoc();
    initDoc();
    seedTrackWithConfig(getScoreMap()!, 1, { name: "Drums", isPercussion: true });
    selectBeat(drumSel);
    setMockApiScore(buildMockAlphaTabScore({
      tracks: [{
        isPercussion: true,
        staves: [{
          showTablature: false,
          tuning: [],
          bars: [{ clef: 0, voices: [{ beats: [{ notes: [], duration: 4, isEmpty: true, isRest: false }] }] }],
        }],
      }],
    }));
  }

  it("adds percussion note when gp7Id not present in beat", () => {
    setupDrumTrack();
    vi.mocked(resolveBeat).mockReturnValue({
      notes: [],
      duration: 4,
      isEmpty: true,
      isRest: false,
      voice: { bar: { clef: 0 } },
    } as never);
    vi.mocked(resolveGp7Id).mockReturnValue(-1);

    executeAction("edit.beat.togglePercussionArticulation", 38, ctx);

    const yNotes = resolveYBeat(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(1);
    expectPercussionNote(yNotes.get(0), 38);
  });

  it("removes existing percussion note when gp7Id matches", () => {
    setupDrumTrack();
    placePercussionNoteDirectly(getScoreMap()!, 0, 0, 0, 42);

    vi.mocked(resolveBeat).mockReturnValue({
      notes: [{ percussionArticulation: 42 }],
      duration: 4,
      isEmpty: false,
      isRest: false,
      voice: { bar: { clef: 0 } },
    } as never);
    vi.mocked(resolveGp7Id).mockImplementation((note: unknown) => {
      const n = note as { percussionArticulation: number };
      return n.percussionArticulation === 42 ? 42 : -1;
    });

    executeAction("edit.beat.togglePercussionArticulation", 42, ctx);

    const yNotes = resolveYBeat(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(0);
  });

  it("does nothing when track.isPercussion is false", () => {
    resetMockState();
    destroyDoc();
    initDoc();
    seedOneTrackScore(getScoreMap()!, 1);
    selectBeat(defaultSel);
    setMockApiScore(buildMockAlphaTabScore({
      tracks: [{
        isPercussion: false,
        staves: [{
          showTablature: true,
          tuning: [40, 45, 50, 55, 59, 64],
          bars: [{ voices: [{ beats: [{ notes: [], duration: 4, isEmpty: true, isRest: false }] }] }],
        }],
      }],
    }));
    vi.mocked(resolveBeat).mockReturnValue({
      notes: [],
      duration: 4,
      isEmpty: true,
      isRest: false,
      voice: { bar: { clef: 4 } },
    } as never);

    executeAction("edit.beat.togglePercussionArticulation", 38, ctx);

    const yNotes = resolveYBeat(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(0);
  });

  it("does nothing without selection", () => {
    setupDrumTrack();
    selectBeat(null);

    executeAction("edit.beat.togglePercussionArticulation", 38, ctx);

    const yNotes = resolveYBeat(0, 0, 0, 0, 0)!.get("notes") as Y.Array<Y.Map<unknown>>;
    expect(yNotes.length).toBe(0);
  });
});
