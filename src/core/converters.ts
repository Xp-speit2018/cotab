/**
 * converters.ts — Bidirectional bridge between AlphaTab's model and the Y.Doc.
 *
 * AlphaTab is imported here ONLY for file import/export (GP7 round-trips) and
 * Y.Doc ↔ AlphaTab Score conversion. It is NOT used for rendering — that lives
 * in the renderer store (render-store.ts) which owns the AlphaTab API instance.
 *
 * Pure conversion:
 *   importScoreToYDoc:   AlphaTab Score → Y.Doc  (after GP file load)
 *   buildAlphaTabScore:  Y.Doc → AlphaTab Score  (for full render sync)
 *   importTrack:         AlphaTab Track → Y.Map   (single track import)
 *   importFromAlphaTab:  Score → Y.Doc via FILE_IMPORT_ORIGIN
 *
 * Renderer bridge functions (rebuildFromYDoc, installRendererObserver, etc.)
 * live in src/stores/renderer-bridge.ts since they require the AlphaTab API.
 */

import * as Y from "yjs";
import * as alphaTab from "@coderline/alphatab";
import { v4 as uuidv4 } from "uuid";

// ─── Engine back-reference (set by engine.ts to avoid circular import) ──────

interface EngineRef {
  getDoc(): Y.Doc | null;
  getScoreMap(): Y.Map<unknown> | null;
  getUndoManager(): Y.UndoManager | null;
}

let _engine: EngineRef | null = null;
let _fileImportOrigin: string = "file-import";

/** Called by engine.ts after the singleton is created. */
export function _setEngineRef(ref: EngineRef, fileImportOrigin: string): void {
  _engine = ref;
  _fileImportOrigin = fileImportOrigin;
}

// ─── AlphaTab → Y.Doc ───────────────────────────────────────────────────────

/**
 * Populate the Y.Doc score map from an AlphaTab Score object.
 * Runs inside a single transaction so observers fire once.
 */
export function importScoreToYDoc(
  score: alphaTab.model.Score,
  doc: Y.Doc,
  origin?: string,
): void {
  const yScore = doc.getMap("score");

  doc.transact(() => {
    yScore.set("title", score.title || "");
    yScore.set("subTitle", score.subTitle || "");
    yScore.set("artist", score.artist || "");
    yScore.set("album", score.album || "");
    yScore.set("words", score.words || "");
    yScore.set("music", score.music || "");
    yScore.set("copyright", score.copyright || "");
    yScore.set("tab", score.tab || "");
    yScore.set("instructions", score.instructions || "");
    yScore.set("notices", score.notices || "");
    yScore.set("tempo", score.tempo);
    yScore.set("tempoLabel", score.tempoLabel || "");

    const yMasterBars = new Y.Array<Y.Map<unknown>>();
    for (const mb of score.masterBars) {
      yMasterBars.push([importMasterBar(mb)]);
    }
    yScore.set("masterBars", yMasterBars);

    const yTracks = new Y.Array<Y.Map<unknown>>();
    for (const track of score.tracks) {
      yTracks.push([importTrack(track)]);
    }
    yScore.set("tracks", yTracks);
  }, origin);
}

function importMasterBar(mb: alphaTab.model.MasterBar): Y.Map<unknown> {
  const y = new Y.Map<unknown>();
  y.set("uuid", uuidv4());
  y.set("timeSignatureNumerator", mb.timeSignatureNumerator);
  y.set("timeSignatureDenominator", mb.timeSignatureDenominator);
  y.set("keySignature", mb.keySignature as unknown as number);
  y.set("keySignatureType", mb.keySignatureType as unknown as number);
  y.set("isRepeatStart", mb.isRepeatStart);
  y.set("repeatCount", mb.repeatCount);
  y.set("alternateEndings", mb.alternateEndings);
  y.set("tripletFeel", mb.tripletFeel as unknown as number);
  y.set("isFreeTime", mb.isFreeTime);
  y.set("isDoubleBar", mb.isDoubleBar);

  if (mb.section) {
    const sec = new Y.Map<unknown>();
    sec.set("text", mb.section.text || "");
    sec.set("marker", mb.section.marker || "");
    y.set("section", sec);
  } else {
    y.set("section", null);
  }

  y.set("fermata", null);

  const tempoAuto = mb.tempoAutomation;
  y.set("tempo", tempoAuto ? tempoAuto.value : null);

  return y;
}

export function importTrack(track: alphaTab.model.Track): Y.Map<unknown> {
  const y = new Y.Map<unknown>();
  y.set("uuid", uuidv4());
  y.set("name", track.name || "");
  y.set("shortName", track.shortName || "");
  y.set("instrument", "");
  y.set("colorR", track.color.r);
  y.set("colorG", track.color.g);
  y.set("colorB", track.color.b);
  y.set("colorA", track.color.a);
  y.set("playbackProgram", track.playbackInfo.program);
  y.set("playbackPrimaryChannel", track.playbackInfo.primaryChannel);
  y.set("playbackSecondaryChannel", track.playbackInfo.secondaryChannel);

  const yStaves = new Y.Array<Y.Map<unknown>>();
  for (const staff of track.staves) {
    yStaves.push([importStaff(staff)]);
  }
  y.set("staves", yStaves);

  return y;
}

function importStaff(staff: alphaTab.model.Staff): Y.Map<unknown> {
  const y = new Y.Map<unknown>();
  y.set("uuid", uuidv4());
  y.set("capo", staff.capo);
  y.set("transpositionPitch", staff.transpositionPitch);
  y.set("showTablature", staff.showTablature);
  y.set("showStandardNotation", staff.showStandardNotation);
  y.set("isPercussion", staff.isPercussion);

  const yTuning = new Y.Array<number>();
  if (staff.tuning.length > 0) {
    yTuning.push([...staff.tuning]);
  }
  y.set("tuning", yTuning);

  const yBars = new Y.Array<Y.Map<unknown>>();
  for (const bar of staff.bars) {
    yBars.push([importBar(bar)]);
  }
  y.set("bars", yBars);

  return y;
}

function importBar(bar: alphaTab.model.Bar): Y.Map<unknown> {
  const y = new Y.Map<unknown>();
  y.set("uuid", uuidv4());
  y.set("clef", bar.clef as unknown as number);

  const yVoices = new Y.Array<Y.Map<unknown>>();
  for (const voice of bar.voices) {
    yVoices.push([importVoice(voice)]);
  }
  y.set("voices", yVoices);

  return y;
}

function importVoice(voice: alphaTab.model.Voice): Y.Map<unknown> {
  const y = new Y.Map<unknown>();
  y.set("uuid", uuidv4());

  const yBeats = new Y.Array<Y.Map<unknown>>();
  for (const beat of voice.beats) {
    yBeats.push([importBeat(beat)]);
  }
  y.set("beats", yBeats);

  return y;
}

function importBeat(beat: alphaTab.model.Beat): Y.Map<unknown> {
  const y = new Y.Map<unknown>();
  y.set("uuid", uuidv4());
  y.set("duration", beat.duration as unknown as number);
  y.set("isEmpty", beat.isEmpty);

  const yNotes = new Y.Array<Y.Map<unknown>>();
  for (const note of beat.notes) {
    yNotes.push([importNote(note)]);
  }
  y.set("notes", yNotes);

  y.set("dots", beat.dots);
  y.set("isRest", beat.isRest);
  y.set("tupletNumerator", beat.tupletNumerator);
  y.set("tupletDenominator", beat.tupletDenominator);

  y.set("graceType", beat.graceType as unknown as number);
  y.set("pickStroke", beat.pickStroke as unknown as number);
  y.set("brushType", beat.brushType as unknown as number);
  y.set("dynamics", beat.dynamics as unknown as number);
  y.set("crescendo", beat.crescendo as unknown as number);
  y.set("vibrato", beat.vibrato as unknown as number);
  y.set("fade", beat.fade as unknown as number);
  y.set("ottava", beat.ottava as unknown as number);
  y.set("golpe", beat.golpe as unknown as number);
  y.set("wahPedal", beat.wahPedal as unknown as number);

  y.set("whammyBarType", beat.whammyBarType as unknown as number);
  const yWhammyPoints = new Y.Array<Y.Map<unknown>>();
  if (beat.whammyBarPoints) {
    for (const pt of beat.whammyBarPoints) {
      const yPt = new Y.Map<unknown>();
      yPt.set("offset", pt.offset);
      yPt.set("value", pt.value);
      yWhammyPoints.push([yPt]);
    }
  }
  y.set("whammyBarPoints", yWhammyPoints);

  y.set("text", beat.text ?? null);
  y.set("chordId", beat.chordId ?? null);

  y.set("tap", beat.tap);
  y.set("slap", beat.slap);
  y.set("pop", beat.pop);
  y.set("slashed", beat.slashed);

  const bAny = beat as unknown as Record<string, unknown>;
  y.set("deadSlapped", (bAny.deadSlapped as boolean) ?? false);
  y.set("isLegatoOrigin", (bAny.isLegatoOrigin as boolean) ?? false);

  if (beat.fermata) {
    const yF = new Y.Map<unknown>();
    yF.set("type", beat.fermata.type as unknown as number);
    yF.set("length", beat.fermata.length);
    y.set("fermata", yF);
  } else {
    y.set("fermata", null);
  }

  return y;
}

function importNote(note: alphaTab.model.Note): Y.Map<unknown> {
  const y = new Y.Map<unknown>();
  y.set("uuid", uuidv4());
  y.set("fret", note.fret);
  y.set("string", note.string);
  y.set("octave", note.octave as unknown as number);
  y.set("tone", note.tone as unknown as number);
  y.set("percussionArticulation", note.percussionArticulation ?? -1);

  y.set("isDead", note.isDead);
  y.set("isGhost", note.isGhost);
  y.set("isStaccato", note.isStaccato);
  y.set("isLetRing", note.isLetRing);
  y.set("isPalmMute", note.isPalmMute);
  y.set("isTieDestination", note.isTieDestination);
  y.set("isHammerPullOrigin", note.isHammerPullOrigin);
  y.set("isLeftHandTapped", note.isLeftHandTapped);

  y.set("accentuated", note.accentuated as unknown as number);
  y.set("vibrato", note.vibrato as unknown as number);
  y.set("slideInType", note.slideInType as unknown as number);
  y.set("slideOutType", note.slideOutType as unknown as number);
  y.set("harmonicType", note.harmonicType as unknown as number);
  y.set("harmonicValue", note.harmonicValue);
  y.set("bendType", note.bendType as unknown as number);
  y.set("bendStyle", note.bendStyle as unknown as number);

  const yBendPoints = new Y.Array<Y.Map<unknown>>();
  if (note.bendPoints) {
    for (const pt of note.bendPoints) {
      const yPt = new Y.Map<unknown>();
      yPt.set("offset", pt.offset);
      yPt.set("value", pt.value);
      yBendPoints.push([yPt]);
    }
  }
  y.set("bendPoints", yBendPoints);

  y.set("leftHandFinger", note.leftHandFinger as unknown as number);
  y.set("rightHandFinger", note.rightHandFinger as unknown as number);
  const noteDyn = note.dynamics as unknown as number | undefined;
  if (noteDyn != null) {
    y.set("dynamics", noteDyn);
  }
  y.set("ornament", note.ornament as unknown as number);
  y.set("accidentalMode", note.accidentalMode as unknown as number);

  y.set("trillValue", note.trillValue);
  y.set("trillSpeed", note.trillSpeed as unknown as number);

  y.set("durationPercent", note.durationPercent);

  return y;
}

// ─── Y.Doc → AlphaTab ───────────────────────────────────────────────────────

/**
 * Build a complete AlphaTab Score from the Y.Doc score map.
 * Calls score.finish() to set up internal linkage (indices, linked lists, etc.)
 */
export function buildAlphaTabScore(
  yScore: Y.Map<unknown>,
  settings: alphaTab.Settings,
): alphaTab.model.Score {
  const score = new alphaTab.model.Score();

  score.title = (yScore.get("title") as string) || "";
  score.subTitle = (yScore.get("subTitle") as string) || "";
  score.artist = (yScore.get("artist") as string) || "";
  score.album = (yScore.get("album") as string) || "";
  score.words = (yScore.get("words") as string) || "";
  score.music = (yScore.get("music") as string) || "";
  score.copyright = (yScore.get("copyright") as string) || "";
  score.tab = (yScore.get("tab") as string) || "";
  score.instructions = (yScore.get("instructions") as string) || "";
  score.notices = (yScore.get("notices") as string) || "";
  // tempo/tempoLabel are readonly on Score; set via first master bar's tempoAutomation

  const scoreTempo = (yScore.get("tempo") as number) || 120;
  const scoreTempoLabel = (yScore.get("tempoLabel") as string) || "";

  const yTracks = yScore.get("tracks") as
    | Y.Array<Y.Map<unknown>>
    | undefined;
  if (yTracks) {
    for (const yTrack of yTracks) {
      const track = buildTrack(yTrack);
      score.addTrack(track);
    }
  }

  const yMasterBars = yScore.get("masterBars") as
    | Y.Array<Y.Map<unknown>>
    | undefined;
  if (yMasterBars) {
    for (const yMb of yMasterBars) {
      const mb = buildMasterBar(score, yMb, scoreTempo, scoreTempoLabel);
      score.addMasterBar(mb);
    }
  }

  score.finish(settings);
  return score;
}

function buildMasterBar(
  score: alphaTab.model.Score,
  yMb: Y.Map<unknown>,
  defaultTempo: number,
  _defaultTempoLabel: string,
): alphaTab.model.MasterBar {
  const mb = new alphaTab.model.MasterBar();
  mb.score = score;
  mb.timeSignatureNumerator =
    (yMb.get("timeSignatureNumerator") as number) ?? 4;
  mb.timeSignatureDenominator =
    (yMb.get("timeSignatureDenominator") as number) ?? 4;
  mb.keySignature =
    (yMb.get("keySignature") as number as unknown as alphaTab.model.KeySignature) ?? 0;
  mb.keySignatureType =
    (yMb.get("keySignatureType") as number as unknown as alphaTab.model.KeySignatureType) ?? 0;
  mb.isRepeatStart = (yMb.get("isRepeatStart") as boolean) ?? false;
  mb.repeatCount = (yMb.get("repeatCount") as number) ?? 0;
  mb.alternateEndings = (yMb.get("alternateEndings") as number) ?? 0;
  mb.tripletFeel =
    (yMb.get("tripletFeel") as number as unknown as alphaTab.model.TripletFeel) ?? 0;
  mb.isFreeTime = (yMb.get("isFreeTime") as boolean) ?? false;
  mb.isDoubleBar = (yMb.get("isDoubleBar") as boolean) ?? false;

  const ySection = yMb.get("section") as Y.Map<unknown> | null;
  if (ySection) {
    const sec = new alphaTab.model.Section();
    sec.text = (ySection.get("text") as string) || "";
    sec.marker = (ySection.get("marker") as string) || "";
    mb.section = sec;
  }

  // Note: AlphaTab's tempoAutomation/temposAutomations are readonly when building
  // programmatically. Tempo is effectively set when loading from GP/AlphaTex.
  // defaultTempo is kept for potential future API support.
  void defaultTempo;

  return mb;
}

function buildTrack(yTrack: Y.Map<unknown>): alphaTab.model.Track {
  const track = new alphaTab.model.Track();
  track.name = (yTrack.get("name") as string) || "";
  track.shortName = (yTrack.get("shortName") as string) || "";
  track.color = new alphaTab.model.Color(
    (yTrack.get("colorR") as number) ?? 255,
    (yTrack.get("colorG") as number) ?? 99,
    (yTrack.get("colorB") as number) ?? 71,
    (yTrack.get("colorA") as number) ?? 255,
  );
  track.playbackInfo.program =
    (yTrack.get("playbackProgram") as number) ?? 25;
  track.playbackInfo.primaryChannel =
    (yTrack.get("playbackPrimaryChannel") as number) ?? 0;
  track.playbackInfo.secondaryChannel =
    (yTrack.get("playbackSecondaryChannel") as number) ?? 1;

  const yStaves = yTrack.get("staves") as Y.Array<Y.Map<unknown>>;
  if (yStaves) {
    for (const yStaff of yStaves) {
      const staff = buildStaff(yStaff);
      track.addStaff(staff);
    }
  }

  return track;
}

function buildStaff(yStaff: Y.Map<unknown>): alphaTab.model.Staff {
  const staff = new alphaTab.model.Staff();
  staff.capo = (yStaff.get("capo") as number) ?? 0;
  staff.transpositionPitch =
    (yStaff.get("transpositionPitch") as number) ?? 0;
  staff.displayTranspositionPitch =
    (yStaff.get("transpositionPitch") as number) ?? 0;
  staff.showTablature = (yStaff.get("showTablature") as boolean) ?? true;
  staff.showStandardNotation =
    (yStaff.get("showStandardNotation") as boolean) ?? true;
  staff.isPercussion = (yStaff.get("isPercussion") as boolean) ?? false;

  const yTuning = yStaff.get("tuning") as Y.Array<number> | undefined;
  if (yTuning && yTuning.length > 0) {
    const tuningValues = yTuning.toArray();
    const found = alphaTab.model.Tuning.findTuning(tuningValues);
    staff.stringTuning =
      found ??
      new alphaTab.model.Tuning(undefined, tuningValues, false);
  }

  const yBars = yStaff.get("bars") as Y.Array<Y.Map<unknown>>;
  if (yBars) {
    for (const yBar of yBars) {
      const bar = buildBar(yBar);
      staff.addBar(bar);
    }
  }

  return staff;
}

function buildBar(yBar: Y.Map<unknown>): alphaTab.model.Bar {
  const bar = new alphaTab.model.Bar();
  bar.clef =
    ((yBar.get("clef") as number) ?? 4) as unknown as alphaTab.model.Clef;

  const yVoices = yBar.get("voices") as Y.Array<Y.Map<unknown>>;
  if (yVoices) {
    for (const yVoice of yVoices) {
      const voice = buildVoice(yVoice);
      bar.addVoice(voice);
    }
  }

  return bar;
}

function buildVoice(yVoice: Y.Map<unknown>): alphaTab.model.Voice {
  const voice = new alphaTab.model.Voice();

  const yBeats = yVoice.get("beats") as Y.Array<Y.Map<unknown>>;
  if (yBeats) {
    for (const yBeat of yBeats) {
      const beat = buildBeat(yBeat);
      voice.addBeat(beat);
    }
  }

  return voice;
}

function buildBeat(yBeat: Y.Map<unknown>): alphaTab.model.Beat {
  const beat = new alphaTab.model.Beat();
  beat.duration =
    ((yBeat.get("duration") as number) ?? 4) as unknown as alphaTab.model.Duration;
  beat.isEmpty = (yBeat.get("isEmpty") as boolean) ?? true;

  beat.dots = (yBeat.get("dots") as number) ?? 0;
  beat.tupletNumerator = (yBeat.get("tupletNumerator") as number) ?? 0;
  beat.tupletDenominator = (yBeat.get("tupletDenominator") as number) ?? 0;

  beat.graceType =
    ((yBeat.get("graceType") as number) ?? 0) as unknown as alphaTab.model.GraceType;
  beat.pickStroke =
    ((yBeat.get("pickStroke") as number) ?? 0) as unknown as alphaTab.model.PickStroke;
  beat.brushType =
    ((yBeat.get("brushType") as number) ?? 0) as unknown as alphaTab.model.BrushType;
  const beatDyn = yBeat.get("dynamics") as number | undefined;
  if (beatDyn != null) {
    beat.dynamics = beatDyn as unknown as alphaTab.model.DynamicValue;
  }
  beat.crescendo =
    ((yBeat.get("crescendo") as number) ?? 0) as unknown as alphaTab.model.CrescendoType;
  beat.vibrato =
    ((yBeat.get("vibrato") as number) ?? 0) as unknown as alphaTab.model.VibratoType;
  beat.fade =
    ((yBeat.get("fade") as number) ?? 0) as unknown as alphaTab.model.FadeType;
  beat.ottava =
    ((yBeat.get("ottava") as number) ?? 2) as unknown as alphaTab.model.Ottavia;
  beat.golpe =
    ((yBeat.get("golpe") as number) ?? 0) as unknown as alphaTab.model.GolpeType;
  beat.wahPedal =
    ((yBeat.get("wahPedal") as number) ?? 0) as unknown as alphaTab.model.WahPedal;

  beat.whammyBarType =
    ((yBeat.get("whammyBarType") as number) ?? 0) as unknown as alphaTab.model.WhammyType;
  const yWhammyPoints = yBeat.get("whammyBarPoints") as
    | Y.Array<Y.Map<unknown>>
    | undefined;
  if (yWhammyPoints && yWhammyPoints.length > 0) {
    for (const yPt of yWhammyPoints) {
      const pt = new alphaTab.model.BendPoint(
        (yPt.get("offset") as number) ?? 0,
        (yPt.get("value") as number) ?? 0,
      );
      beat.addWhammyBarPoint(pt);
    }
  }

  beat.text = (yBeat.get("text") as string) ?? "";
  beat.chordId = (yBeat.get("chordId") as string) ?? "";

  beat.tap = (yBeat.get("tap") as boolean) ?? false;
  beat.slap = (yBeat.get("slap") as boolean) ?? false;
  beat.pop = (yBeat.get("pop") as boolean) ?? false;
  beat.slashed = (yBeat.get("slashed") as boolean) ?? false;

  const bAny = beat as unknown as Record<string, unknown>;
  bAny.deadSlapped = (yBeat.get("deadSlapped") as boolean) ?? false;
  bAny.isLegatoOrigin = (yBeat.get("isLegatoOrigin") as boolean) ?? false;

  const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
  if (yNotes) {
    for (const yNote of yNotes) {
      const note = buildNote(yNote);
      beat.addNote(note);
    }
  }

  return beat;
}

function buildNote(yNote: Y.Map<unknown>): alphaTab.model.Note {
  const note = new alphaTab.model.Note();
  note.fret = (yNote.get("fret") as number) ?? 0;
  note.string = (yNote.get("string") as number) ?? 1;
  note.octave =
    ((yNote.get("octave") as number) ?? 0) as unknown as alphaTab.model.Ottavia;
  note.tone =
    ((yNote.get("tone") as number) ?? 0) as unknown as alphaTab.model.Ottavia;

  const percArt = (yNote.get("percussionArticulation") as number) ?? -1;
  if (percArt >= 0) {
    note.percussionArticulation = percArt;
  }

  note.isDead = (yNote.get("isDead") as boolean) ?? false;
  note.isGhost = (yNote.get("isGhost") as boolean) ?? false;
  note.isStaccato = (yNote.get("isStaccato") as boolean) ?? false;
  note.isLetRing = (yNote.get("isLetRing") as boolean) ?? false;
  note.isPalmMute = (yNote.get("isPalmMute") as boolean) ?? false;
  note.isTieDestination = (yNote.get("isTieDestination") as boolean) ?? false;
  note.isHammerPullOrigin =
    (yNote.get("isHammerPullOrigin") as boolean) ?? false;
  note.isLeftHandTapped =
    (yNote.get("isLeftHandTapped") as boolean) ?? false;

  note.accentuated =
    ((yNote.get("accentuated") as number) ?? 0) as unknown as alphaTab.model.AccentuationType;
  note.vibrato =
    ((yNote.get("vibrato") as number) ?? 0) as unknown as alphaTab.model.VibratoType;
  note.slideInType =
    ((yNote.get("slideInType") as number) ?? 0) as unknown as alphaTab.model.SlideInType;
  note.slideOutType =
    ((yNote.get("slideOutType") as number) ?? 0) as unknown as alphaTab.model.SlideOutType;
  note.harmonicType =
    ((yNote.get("harmonicType") as number) ?? 0) as unknown as alphaTab.model.HarmonicType;
  note.harmonicValue = (yNote.get("harmonicValue") as number) ?? 0;
  note.bendType =
    ((yNote.get("bendType") as number) ?? 0) as unknown as alphaTab.model.BendType;
  note.bendStyle =
    ((yNote.get("bendStyle") as number) ?? 0) as unknown as alphaTab.model.BendStyle;

  const yBendPoints = yNote.get("bendPoints") as
    | Y.Array<Y.Map<unknown>>
    | undefined;
  if (yBendPoints && yBendPoints.length > 0) {
    for (const yPt of yBendPoints) {
      const pt = new alphaTab.model.BendPoint(
        (yPt.get("offset") as number) ?? 0,
        (yPt.get("value") as number) ?? 0,
      );
      note.addBendPoint(pt);
    }
  }

  note.leftHandFinger =
    ((yNote.get("leftHandFinger") as number) ?? -2) as unknown as alphaTab.model.Fingers;
  note.rightHandFinger =
    ((yNote.get("rightHandFinger") as number) ?? -2) as unknown as alphaTab.model.Fingers;
  const noteDyn = yNote.get("dynamics") as number | undefined;
  if (noteDyn != null) {
    note.dynamics = noteDyn as unknown as alphaTab.model.DynamicValue;
  }
  note.ornament =
    ((yNote.get("ornament") as number) ?? 0) as unknown as alphaTab.model.NoteOrnament;
  note.accidentalMode =
    ((yNote.get("accidentalMode") as number) ?? 0) as unknown as alphaTab.model.NoteAccidentalMode;

  note.trillValue = (yNote.get("trillValue") as number) ?? -1;
  note.trillSpeed =
    ((yNote.get("trillSpeed") as number) ?? 16) as unknown as alphaTab.model.Duration;

  note.durationPercent = (yNote.get("durationPercent") as number) ?? 1;

  return note;
}

// ─── Import from AlphaTab (convenience wrapper) ──────────────────────────────

/**
 * Import an AlphaTab Score into Y.Doc using the FILE_IMPORT_ORIGIN
 * so the observer knows NOT to rebuild AlphaTab (it already has the score).
 */
export function importFromAlphaTab(
  score: import("@coderline/alphatab").model.Score,
): void {
  if (!_engine) return;
  const doc = _engine.getDoc();
  if (!doc) return;
  importScoreToYDoc(score, doc, _fileImportOrigin);
  _engine.getUndoManager()?.clear();
}
