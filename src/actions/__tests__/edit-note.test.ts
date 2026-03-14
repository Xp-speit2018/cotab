import { describe, it, expect, beforeEach } from "vitest";
import {
  resetMockState,
  selectBeat,
  setSelectedNoteIndex,
  seedOneTrackScore,
  placeNoteDirectly,
} from "@/test/setup";
import {
  initDoc,
  destroyDoc,
  getScoreMap,
  resolveYNote,
} from "@/core/sync";
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
const ctx = { source: "test" as const };

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
