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
import { resetDocumentId } from "./schema";

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
    if (origin === _fileImportOrigin) resetDocumentId(doc);
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
    yScore.set("defaultSystemsLayout", score.defaultSystemsLayout);
    const ySystemsLayout = new Y.Array<number>();
    ySystemsLayout.push([...score.systemsLayout]);
    yScore.set("systemsLayout", ySystemsLayout);

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

function importAutomation(
  automation: alphaTab.model.Automation,
): Y.Map<unknown> {
  const y = new Y.Map<unknown>();
  y.set("isLinear", automation.isLinear);
  y.set("type", automation.type as unknown as number);
  y.set("value", automation.value);
  y.set("ratioPosition", automation.ratioPosition);
  y.set("text", automation.text || "");
  y.set("isVisible", automation.isVisible);
  return y;
}

function importMasterBar(mb: alphaTab.model.MasterBar): Y.Map<unknown> {
  const y = new Y.Map<unknown>();
  y.set("uuid", uuidv4());
  y.set("timeSignatureNumerator", mb.timeSignatureNumerator);
  y.set("timeSignatureDenominator", mb.timeSignatureDenominator);
  y.set("isRepeatStart", mb.isRepeatStart);
  y.set("repeatCount", mb.repeatCount);
  y.set("alternateEndings", mb.alternateEndings);
  y.set("tripletFeel", mb.tripletFeel as unknown as number);
  y.set("isFreeTime", mb.isFreeTime);
  y.set("displayScale", mb.displayScale);
  y.set("displayWidth", mb.displayWidth);

  if (mb.section) {
    const sec = new Y.Map<unknown>();
    sec.set("text", mb.section.text || "");
    sec.set("marker", mb.section.marker || "");
    y.set("section", sec);
  } else {
    y.set("section", null);
  }

  const yTempoAutomations = new Y.Array<Y.Map<unknown>>();
  for (const automation of mb.tempoAutomations) {
    yTempoAutomations.push([importAutomation(automation)]);
  }
  y.set("tempoAutomations", yTempoAutomations);

  if (mb.fermata && mb.fermata.size > 0) {
    const yFermatas = new Y.Map<Y.Map<unknown>>();
    for (const [offset, fermata] of mb.fermata) {
      const yFermata = new Y.Map<unknown>();
      yFermata.set("type", fermata.type as unknown as number);
      yFermata.set("length", fermata.length);
      yFermatas.set(String(offset), yFermata);
    }
    y.set("fermata", yFermatas);
  } else {
    y.set("fermata", null);
  }

  return y;
}

export function importTrack(track: alphaTab.model.Track): Y.Map<unknown> {
  const y = new Y.Map<unknown>();
  y.set("uuid", uuidv4());
  const yStaves = new Y.Array<Y.Map<unknown>>();
  for (const staff of track.staves) {
    yStaves.push([importStaff(staff)]);
  }
  y.set("staves", yStaves);

  const yPlaybackInfo = new Y.Map<unknown>();
  yPlaybackInfo.set("volume", track.playbackInfo.volume);
  yPlaybackInfo.set("balance", track.playbackInfo.balance);
  yPlaybackInfo.set("port", track.playbackInfo.port);
  yPlaybackInfo.set("program", track.playbackInfo.program);
  yPlaybackInfo.set("bank", track.playbackInfo.bank);
  yPlaybackInfo.set("primaryChannel", track.playbackInfo.primaryChannel);
  yPlaybackInfo.set("secondaryChannel", track.playbackInfo.secondaryChannel);
  yPlaybackInfo.set("isMute", track.playbackInfo.isMute);
  yPlaybackInfo.set("isSolo", track.playbackInfo.isSolo);
  y.set("playbackInfo", yPlaybackInfo);

  const yColor = new Y.Map<unknown>();
  yColor.set("raw", track.color.raw);
  y.set("color", yColor);
  y.set("name", track.name || "");
  y.set("shortName", track.shortName || "");
  y.set("defaultSystemsLayout", track.defaultSystemsLayout);
  const ySystemsLayout = new Y.Array<number>();
  ySystemsLayout.push([...track.systemsLayout]);
  y.set("systemsLayout", ySystemsLayout);

  const yArticulations = new Y.Array<Y.Map<unknown>>();
  for (const articulation of track.percussionArticulations) {
    const yArticulation = new Y.Map<unknown>();
    yArticulation.set("id", articulation.id);
    yArticulation.set("elementType", articulation.elementType);
    yArticulation.set("staffLine", articulation.staffLine);
    yArticulation.set(
      "noteHeadDefault",
      articulation.noteHeadDefault as unknown as number,
    );
    yArticulation.set(
      "noteHeadHalf",
      articulation.noteHeadHalf as unknown as number,
    );
    yArticulation.set(
      "noteHeadWhole",
      articulation.noteHeadWhole as unknown as number,
    );
    yArticulation.set(
      "techniqueSymbol",
      articulation.techniqueSymbol as unknown as number,
    );
    yArticulation.set(
      "techniqueSymbolPlacement",
      articulation.techniqueSymbolPlacement as unknown as number,
    );
    yArticulation.set("outputMidiNumber", articulation.outputMidiNumber);
    yArticulations.push([yArticulation]);
  }
  y.set("percussionArticulations", yArticulations);

  return y;
}

function importStaff(staff: alphaTab.model.Staff): Y.Map<unknown> {
  const y = new Y.Map<unknown>();
  y.set("uuid", uuidv4());
  const yBars = new Y.Array<Y.Map<unknown>>();
  for (const bar of staff.bars) {
    yBars.push([importBar(bar)]);
  }
  y.set("bars", yBars);

  if (staff.chords && staff.chords.size > 0) {
    const yChords = new Y.Map<Y.Map<unknown>>();
    for (const [id, chord] of staff.chords) {
      const yChord = new Y.Map<unknown>();
      yChord.set("name", chord.name);
      yChord.set("firstFret", chord.firstFret);
      const yStrings = new Y.Array<number>();
      yStrings.push([...chord.strings]);
      yChord.set("strings", yStrings);
      const yBarreFrets = new Y.Array<number>();
      yBarreFrets.push([...chord.barreFrets]);
      yChord.set("barreFrets", yBarreFrets);
      yChord.set("showName", chord.showName);
      yChord.set("showDiagram", chord.showDiagram);
      yChord.set("showFingering", chord.showFingering);
      yChords.set(id, yChord);
    }
    y.set("chords", yChords);
  } else {
    y.set("chords", null);
  }

  y.set("capo", staff.capo);
  y.set("transpositionPitch", staff.transpositionPitch);
  y.set("displayTranspositionPitch", staff.displayTranspositionPitch);
  y.set("showTablature", staff.showTablature);
  y.set("showStandardNotation", staff.showStandardNotation);
  y.set("isPercussion", staff.isPercussion);

  const yStringTuning = new Y.Map<unknown>();
  yStringTuning.set("isStandard", staff.stringTuning.isStandard);
  yStringTuning.set("name", staff.stringTuning.name);
  const yTunings = new Y.Array<number>();
  yTunings.push([...staff.stringTuning.tunings]);
  yStringTuning.set("tunings", yTunings);
  y.set("stringTuning", yStringTuning);

  return y;
}

function importBar(bar: alphaTab.model.Bar): Y.Map<unknown> {
  const y = new Y.Map<unknown>();
  y.set("uuid", uuidv4());
  y.set("clef", bar.clef as unknown as number);
  y.set("clefOttava", bar.clefOttava as unknown as number);
  y.set("simileMark", bar.simileMark as unknown as number);
  y.set("keySignature", bar.keySignature as unknown as number);
  y.set("keySignatureType", bar.keySignatureType as unknown as number);
  y.set("displayScale", bar.displayScale);
  y.set("displayWidth", bar.displayWidth);

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
  y.set("tupletNumerator", beat.tupletNumerator);
  y.set("tupletDenominator", beat.tupletDenominator);

  y.set("graceType", beat.graceType as unknown as number);
  y.set("pickStroke", beat.pickStroke as unknown as number);
  y.set("brushType", beat.brushType as unknown as number);
  y.set("brushDuration", beat.brushDuration);
  y.set("dynamics", beat.dynamics as unknown as number);
  y.set("crescendo", beat.crescendo as unknown as number);
  y.set("vibrato", beat.vibrato as unknown as number);
  y.set("fade", beat.fade as unknown as number);
  y.set("ottava", beat.ottava as unknown as number);
  y.set("golpe", beat.golpe as unknown as number);
  y.set("wahPedal", beat.wahPedal as unknown as number);

  y.set("whammyStyle", beat.whammyStyle as unknown as number);
  y.set("isContinuedWhammy", beat.isContinuedWhammy);
  y.set("whammyBarType", beat.whammyBarType as unknown as number);
  if (beat.whammyBarPoints) {
    const yWhammyPoints = new Y.Array<Y.Map<unknown>>();
    for (const pt of beat.whammyBarPoints) {
      const yPt = new Y.Map<unknown>();
      yPt.set("offset", pt.offset);
      yPt.set("value", pt.value);
      yWhammyPoints.push([yPt]);
    }
    y.set("whammyBarPoints", yWhammyPoints);
  } else {
    y.set("whammyBarPoints", null);
  }

  const yAutomations = new Y.Array<Y.Map<unknown>>();
  for (const automation of beat.automations) {
    yAutomations.push([importAutomation(automation)]);
  }
  y.set("automations", yAutomations);

  if (beat.lyrics) {
    const yLyrics = new Y.Array<string>();
    yLyrics.push([...beat.lyrics]);
    y.set("lyrics", yLyrics);
  } else {
    y.set("lyrics", null);
  }

  if (beat.tremoloPicking) {
    const yTremolo = new Y.Map<unknown>();
    yTremolo.set("marks", beat.tremoloPicking.marks);
    yTremolo.set("style", beat.tremoloPicking.style as unknown as number);
    y.set("tremoloPicking", yTremolo);
  } else {
    y.set("tremoloPicking", null);
  }
  y.set("rasgueado", beat.rasgueado as unknown as number);

  y.set("text", beat.text ?? null);
  y.set("chordId", beat.chordId ?? null);

  y.set("tap", beat.tap);
  y.set("slap", beat.slap);
  y.set("pop", beat.pop);
  y.set("slashed", beat.slashed);
  y.set("deadSlapped", beat.deadSlapped);
  y.set("isLegatoOrigin", beat.isLegatoOrigin);

  return y;
}

function importNote(note: alphaTab.model.Note): Y.Map<unknown> {
  const y = new Y.Map<unknown>();
  y.set("uuid", uuidv4());
  y.set("fret", note.fret);
  y.set("string", note.string);
  y.set("octave", note.octave);
  y.set("tone", note.tone);
  y.set("percussionArticulation", note.percussionArticulation ?? -1);

  y.set("isDead", note.isDead);
  y.set("isGhost", note.isGhost);
  y.set("isStaccato", note.isStaccato);
  y.set("isLetRing", note.isLetRing);
  y.set("isPalmMute", note.isPalmMute);
  y.set("isTieDestination", note.isTieDestination);
  y.set("isHammerPullOrigin", note.isHammerPullOrigin);
  y.set("isLeftHandTapped", note.isLeftHandTapped);
  y.set("isContinuedBend", note.isContinuedBend);

  y.set("accentuated", note.accentuated as unknown as number);
  y.set("vibrato", note.vibrato as unknown as number);
  y.set("slideInType", note.slideInType as unknown as number);
  y.set("slideOutType", note.slideOutType as unknown as number);
  y.set("harmonicType", note.harmonicType as unknown as number);
  y.set("harmonicValue", note.harmonicValue);
  y.set("bendType", note.bendType as unknown as number);
  y.set("bendStyle", note.bendStyle as unknown as number);

  if (note.bendPoints) {
    const yBendPoints = new Y.Array<Y.Map<unknown>>();
    for (const pt of note.bendPoints) {
      const yPt = new Y.Map<unknown>();
      yPt.set("offset", pt.offset);
      yPt.set("value", pt.value);
      yBendPoints.push([yPt]);
    }
    y.set("bendPoints", yBendPoints);
  } else {
    y.set("bendPoints", null);
  }

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
  score.defaultSystemsLayout =
    (yScore.get("defaultSystemsLayout") as number) ?? 3;
  score.systemsLayout =
    (yScore.get("systemsLayout") as Y.Array<number> | undefined)?.toArray() ?? [];

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
      const mb = buildMasterBar(score, yMb);
      score.addMasterBar(mb);
    }
  }

  score.finish(settings);
  return score;
}

function buildAutomation(
  yAutomation: Y.Map<unknown>,
): alphaTab.model.Automation {
  const automation = new alphaTab.model.Automation();
  automation.isLinear =
    (yAutomation.get("isLinear") as boolean) ?? false;
  automation.type =
    ((yAutomation.get("type") as number) ?? 0) as alphaTab.model.AutomationType;
  automation.value = (yAutomation.get("value") as number) ?? 0;
  automation.ratioPosition =
    (yAutomation.get("ratioPosition") as number) ?? 0;
  automation.text = (yAutomation.get("text") as string) ?? "";
  automation.isVisible =
    (yAutomation.get("isVisible") as boolean) ?? true;
  return automation;
}

function buildMasterBar(
  score: alphaTab.model.Score,
  yMb: Y.Map<unknown>,
): alphaTab.model.MasterBar {
  const mb = new alphaTab.model.MasterBar();
  mb.score = score;
  mb.timeSignatureNumerator =
    (yMb.get("timeSignatureNumerator") as number) ?? 4;
  mb.timeSignatureDenominator =
    (yMb.get("timeSignatureDenominator") as number) ?? 4;
  mb.isRepeatStart = (yMb.get("isRepeatStart") as boolean) ?? false;
  mb.repeatCount = (yMb.get("repeatCount") as number) ?? 0;
  mb.alternateEndings = (yMb.get("alternateEndings") as number) ?? 0;
  mb.tripletFeel =
    (yMb.get("tripletFeel") as number as unknown as alphaTab.model.TripletFeel) ?? 0;
  mb.isFreeTime = (yMb.get("isFreeTime") as boolean) ?? false;
  mb.displayScale = (yMb.get("displayScale") as number) ?? 1;
  mb.displayWidth = (yMb.get("displayWidth") as number) ?? -1;

  const ySection = yMb.get("section") as Y.Map<unknown> | null;
  if (ySection) {
    const sec = new alphaTab.model.Section();
    sec.text = (ySection.get("text") as string) || "";
    sec.marker = (ySection.get("marker") as string) || "";
    mb.section = sec;
  }

  const yTempoAutomations = yMb.get("tempoAutomations") as
    | Y.Array<Y.Map<unknown>>
    | undefined;
  if (yTempoAutomations) {
    for (const yAutomation of yTempoAutomations) {
      mb.tempoAutomations.push(buildAutomation(yAutomation));
    }
  }

  const yFermatas = yMb.get("fermata") as
    | Y.Map<Y.Map<unknown>>
    | null
    | undefined;
  if (yFermatas) {
    for (const [offset, yFermata] of yFermatas) {
      const fermata = new alphaTab.model.Fermata();
      fermata.type =
        ((yFermata.get("type") as number) ?? 1) as alphaTab.model.FermataType;
      fermata.length = (yFermata.get("length") as number) ?? 1;
      mb.addFermata(Number(offset), fermata);
    }
  }

  return mb;
}

function buildTrack(yTrack: Y.Map<unknown>): alphaTab.model.Track {
  const track = new alphaTab.model.Track();
  const yPlaybackInfo = yTrack.get("playbackInfo") as
    | Y.Map<unknown>
    | undefined;
  if (yPlaybackInfo) {
    track.playbackInfo.volume =
      (yPlaybackInfo.get("volume") as number) ?? 15;
    track.playbackInfo.balance =
      (yPlaybackInfo.get("balance") as number) ?? 8;
    track.playbackInfo.port = (yPlaybackInfo.get("port") as number) ?? 1;
    track.playbackInfo.program =
      (yPlaybackInfo.get("program") as number) ?? 25;
    track.playbackInfo.bank = (yPlaybackInfo.get("bank") as number) ?? 0;
    track.playbackInfo.primaryChannel =
      (yPlaybackInfo.get("primaryChannel") as number) ?? 0;
    track.playbackInfo.secondaryChannel =
      (yPlaybackInfo.get("secondaryChannel") as number) ?? 1;
    track.playbackInfo.isMute =
      (yPlaybackInfo.get("isMute") as boolean) ?? false;
    track.playbackInfo.isSolo =
      (yPlaybackInfo.get("isSolo") as boolean) ?? false;
  }

  const yColor = yTrack.get("color") as Y.Map<unknown> | undefined;
  if (yColor) {
    track.color.raw = (yColor.get("raw") as number) ?? track.color.raw;
    track.color.updateRgba();
  }
  track.name = (yTrack.get("name") as string) || "";
  track.shortName = (yTrack.get("shortName") as string) || "";
  track.defaultSystemsLayout =
    (yTrack.get("defaultSystemsLayout") as number) ?? 3;
  track.systemsLayout =
    (yTrack.get("systemsLayout") as Y.Array<number> | undefined)?.toArray() ?? [];

  const yArticulations = yTrack.get("percussionArticulations") as
    | Y.Array<Y.Map<unknown>>
    | undefined;
  if (yArticulations) {
    for (const yArticulation of yArticulations) {
      track.percussionArticulations.push(
        new alphaTab.model.InstrumentArticulation(
          (yArticulation.get("elementType") as string) ?? "",
          (yArticulation.get("staffLine") as number) ?? 0,
          (yArticulation.get("outputMidiNumber") as number) ?? 0,
          ((yArticulation.get("noteHeadDefault") as number) ??
            0) as alphaTab.model.MusicFontSymbol,
          ((yArticulation.get("noteHeadHalf") as number) ??
            0) as alphaTab.model.MusicFontSymbol,
          ((yArticulation.get("noteHeadWhole") as number) ??
            0) as alphaTab.model.MusicFontSymbol,
          ((yArticulation.get("techniqueSymbol") as number) ??
            0) as alphaTab.model.MusicFontSymbol,
          ((yArticulation.get("techniqueSymbolPlacement") as number) ??
            0) as alphaTab.model.TechniqueSymbolPlacement,
          (yArticulation.get("id") as number) ?? 0,
        ),
      );
    }
  }

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
  const yChords = yStaff.get("chords") as
    | Y.Map<Y.Map<unknown>>
    | null
    | undefined;
  if (yChords) {
    for (const [id, yChord] of yChords) {
      const chord = new alphaTab.model.Chord();
      chord.name = (yChord.get("name") as string) ?? "";
      chord.firstFret = (yChord.get("firstFret") as number) ?? 1;
      chord.strings =
        (yChord.get("strings") as Y.Array<number> | undefined)?.toArray() ?? [];
      chord.barreFrets =
        (yChord.get("barreFrets") as Y.Array<number> | undefined)?.toArray() ??
        [];
      chord.showName = (yChord.get("showName") as boolean) ?? true;
      chord.showDiagram = (yChord.get("showDiagram") as boolean) ?? true;
      chord.showFingering =
        (yChord.get("showFingering") as boolean) ?? true;
      staff.addChord(id, chord);
    }
  }

  staff.capo = (yStaff.get("capo") as number) ?? 0;
  staff.transpositionPitch =
    (yStaff.get("transpositionPitch") as number) ?? 0;
  staff.displayTranspositionPitch =
    (yStaff.get("displayTranspositionPitch") as number) ?? 0;
  staff.showTablature = (yStaff.get("showTablature") as boolean) ?? true;
  staff.showStandardNotation =
    (yStaff.get("showStandardNotation") as boolean) ?? true;
  staff.isPercussion = (yStaff.get("isPercussion") as boolean) ?? false;

  const yStringTuning = yStaff.get("stringTuning") as
    | Y.Map<unknown>
    | undefined;
  if (yStringTuning) {
    const tunings =
      (
        yStringTuning.get("tunings") as Y.Array<number> | undefined
      )?.toArray() ?? [];
    staff.stringTuning = new alphaTab.model.Tuning(
      (yStringTuning.get("name") as string) ?? "",
      tunings,
      (yStringTuning.get("isStandard") as boolean) ?? false,
    );
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
  bar.clefOttava =
    ((yBar.get("clefOttava") as number) ??
      2) as unknown as alphaTab.model.Ottavia;
  bar.simileMark =
    ((yBar.get("simileMark") as number) ??
      0) as unknown as alphaTab.model.SimileMark;
  bar.keySignature =
    ((yBar.get("keySignature") as number) ??
      0) as unknown as alphaTab.model.KeySignature;
  bar.keySignatureType =
    ((yBar.get("keySignatureType") as number) ??
      0) as unknown as alphaTab.model.KeySignatureType;
  bar.displayScale = (yBar.get("displayScale") as number) ?? 1;
  bar.displayWidth = (yBar.get("displayWidth") as number) ?? -1;

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
  beat.tupletNumerator = (yBeat.get("tupletNumerator") as number) ?? -1;
  beat.tupletDenominator =
    (yBeat.get("tupletDenominator") as number) ?? -1;

  beat.graceType =
    ((yBeat.get("graceType") as number) ?? 0) as unknown as alphaTab.model.GraceType;
  beat.pickStroke =
    ((yBeat.get("pickStroke") as number) ?? 0) as unknown as alphaTab.model.PickStroke;
  beat.brushType =
    ((yBeat.get("brushType") as number) ?? 0) as unknown as alphaTab.model.BrushType;
  beat.brushDuration = (yBeat.get("brushDuration") as number) ?? 0;
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

  beat.whammyStyle =
    ((yBeat.get("whammyStyle") as number) ??
      0) as unknown as alphaTab.model.BendStyle;
  beat.isContinuedWhammy =
    (yBeat.get("isContinuedWhammy") as boolean) ?? false;
  beat.whammyBarType =
    ((yBeat.get("whammyBarType") as number) ?? 0) as unknown as alphaTab.model.WhammyType;
  const yWhammyPoints = yBeat.get("whammyBarPoints") as
    | Y.Array<Y.Map<unknown>>
    | null
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

  const yAutomations = yBeat.get("automations") as
    | Y.Array<Y.Map<unknown>>
    | undefined;
  if (yAutomations) {
    for (const yAutomation of yAutomations) {
      beat.automations.push(buildAutomation(yAutomation));
    }
  }

  const yLyrics = yBeat.get("lyrics") as Y.Array<string> | null | undefined;
  beat.lyrics = yLyrics?.toArray() ?? null;

  const yTremolo = yBeat.get("tremoloPicking") as
    | Y.Map<unknown>
    | null
    | undefined;
  if (yTremolo) {
    const tremolo = new alphaTab.model.TremoloPickingEffect();
    tremolo.marks = (yTremolo.get("marks") as number) ?? 0;
    tremolo.style =
      ((yTremolo.get("style") as number) ??
        0) as unknown as alphaTab.model.TremoloPickingStyle;
    beat.tremoloPicking = tremolo;
  }
  beat.rasgueado =
    ((yBeat.get("rasgueado") as number) ??
      0) as unknown as alphaTab.model.Rasgueado;

  beat.text = (yBeat.get("text") as string | null | undefined) ?? null;
  beat.chordId = (yBeat.get("chordId") as string | null | undefined) ?? null;

  beat.tap = (yBeat.get("tap") as boolean) ?? false;
  beat.slap = (yBeat.get("slap") as boolean) ?? false;
  beat.pop = (yBeat.get("pop") as boolean) ?? false;
  beat.slashed = (yBeat.get("slashed") as boolean) ?? false;

  beat.deadSlapped = (yBeat.get("deadSlapped") as boolean) ?? false;
  beat.isLegatoOrigin =
    (yBeat.get("isLegatoOrigin") as boolean) ?? false;

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
  note.octave = (yNote.get("octave") as number) ?? 0;
  note.tone = (yNote.get("tone") as number) ?? 0;

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
  note.isContinuedBend =
    (yNote.get("isContinuedBend") as boolean) ?? false;

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
    | null
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
