/**
 * audit-alphatab-fields.ts
 *
 * Parses the installed @coderline/alphatab declaration file and emits a
 * complete Markdown audit of all exported model fields.
 *
 * Usage:
 *   npm run audit:alphatab-fields
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";
import { fileURLToPath } from "node:url";

type FieldNature =
  | "document-structure"
  | "metadata"
  | "playback-audible"
  | "playback-control"
  | "notation-semantic"
  | "layout-style"
  | "roundtrip-compat"
  | "runtime-derived"
  | "runtime-link"
  | "deprecated";

type CotabDecision =
  | "core-edit-v0"
  | "preserve-roundtrip"
  | "needs-midi-diff"
  | "regenerate-runtime"
  | "drop-deprecated";

interface Classification {
  nature: FieldNature;
  decision: CotabDecision;
  reason: string;
}

interface FieldInfo {
  className: string;
  name: string;
  type: string;
  kinds: Set<string>;
  docs: string[];
  line: number;
  readonly: boolean;
  static: boolean;
  optional: boolean;
}

interface ClassInfo {
  name: string;
  doc: string;
  fields: FieldInfo[];
}

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDirectory, "../..");
const alphaTabPackageJson = path.join(repoRoot, "node_modules/@coderline/alphatab/package.json");
const alphaTabDts = path.join(repoRoot, "node_modules/@coderline/alphatab/dist/alphaTab.d.ts");
const alphaTabCore = path.join(repoRoot, "node_modules/@coderline/alphatab/dist/alphaTab.core.mjs");
const midiCapabilitiesFile = path.join(toolDirectory, "midi-capabilities.json");

const alphaTabVersion = JSON.parse(fs.readFileSync(alphaTabPackageJson, "utf8")).version as string;
const midiCapabilities = JSON.parse(fs.readFileSync(midiCapabilitiesFile, "utf8")) as {
  alphaTabVersion: string;
  identicalMidiFields: string[];
};

if (midiCapabilities.alphaTabVersion !== alphaTabVersion) {
  throw new Error(
    `AlphaTab MIDI capability evidence targets ${midiCapabilities.alphaTabVersion}, but ${alphaTabVersion} is installed. Re-run the MIDI capability tests and update the manifest.`,
  );
}

const dtsText = fs.readFileSync(alphaTabDts, "utf8");
const coreText = fs.readFileSync(alphaTabCore, "utf8");
const sourceFile = ts.createSourceFile(alphaTabDts, dtsText, ts.ScriptTarget.Latest, true);

function cleanDoc(raw: string): string {
  return raw
    .replace(/\/\*\*|\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function getJSDoc(node: ts.Node): string {
  return cleanDoc(ts.getJSDocCommentsAndTags(node).map((doc) => doc.getText(sourceFile)).join("\n"));
}

function getNodeName(node: ts.NamedDeclaration): string | undefined {
  if (!node.name) return undefined;
  if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) || ts.isNumericLiteral(node.name)) {
    return node.name.text;
  }
  return node.name.getText(sourceFile);
}

function getModelExports(): Set<string> {
  const exports = new Set<string>();

  function visit(node: ts.Node): void {
    if (ts.isModuleDeclaration(node) && node.name.text === "model") {
      const body = node.body;
      if (body && ts.isModuleBlock(body)) {
        for (const statement of body.statements) {
          if (
            ts.isExportDeclaration(statement) &&
            statement.exportClause &&
            ts.isNamedExports(statement.exportClause)
          ) {
            for (const element of statement.exportClause.elements) {
              exports.add(element.name.text);
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return exports;
}

function extractClasses(modelExports: Set<string>): ClassInfo[] {
  const classes: ClassInfo[] = [];

  function visit(node: ts.Node): void {
    if (ts.isClassDeclaration(node) && node.name && modelExports.has(node.name.text)) {
      const fields = new Map<string, FieldInfo>();

      for (const member of node.members) {
        if (!(ts.isPropertyDeclaration(member) || ts.isGetAccessor(member) || ts.isSetAccessor(member))) {
          continue;
        }

        const name = getNodeName(member);
        if (!name) continue;

        const flags = ts.getCombinedModifierFlags(member);
        if ((flags & ts.ModifierFlags.Private) !== 0) continue;

        const existing =
          fields.get(name) ??
          ({
            className: node.name.text,
            name,
            type: "",
            kinds: new Set<string>(),
            docs: [],
            line: sourceFile.getLineAndCharacterOfPosition(member.getStart(sourceFile)).line + 1,
            readonly: false,
            static: false,
            optional: false
          } satisfies FieldInfo);

        if (ts.isPropertyDeclaration(member)) {
          existing.kinds.add("property");
        } else if (ts.isGetAccessor(member)) {
          existing.kinds.add("get");
        } else {
          existing.kinds.add("set");
        }

        if (member.type) {
          existing.type = member.type.getText(sourceFile).replace(/\s+/g, " ");
        }

        const doc = getJSDoc(member);
        if (doc) existing.docs.push(doc);

        existing.readonly = existing.readonly || (flags & ts.ModifierFlags.Readonly) !== 0;
        existing.static = existing.static || (flags & ts.ModifierFlags.Static) !== 0;
        existing.optional = existing.optional || Boolean(member.questionToken);
        fields.set(name, existing);
      }

      classes.push({
        name: node.name.text,
        doc: getJSDoc(node),
        fields: [...fields.values()]
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return classes.sort((a, b) => a.name.localeCompare(b.name));
}

function key(field: Pick<FieldInfo, "className" | "name">): string {
  return `${field.className}.${field.name}`;
}

const runtimeKeys = new Set<string>([
  "Bar.id",
  "Bar.index",
  "Bar.nextBar",
  "Bar.previousBar",
  "Bar.staff",
  "Bar.masterBar",
  "Bar.isMultiVoice",
  "Bar.filledVoices",
  "Bar.isEmpty",
  "Bar.hasChanges",
  "Bar.isRestOnly",
  "Beat.id",
  "Beat.index",
  "Beat.previousBeat",
  "Beat.nextBeat",
  "Beat.isLastOfVoice",
  "Beat.voice",
  "Beat.noteStringLookup",
  "Beat.noteValueLookup",
  "Beat.fermata",
  "Beat.minNote",
  "Beat.maxNote",
  "Beat.maxStringNote",
  "Beat.minStringNote",
  "Beat.isRest",
  "Beat.isFullBarRest",
  "Beat.isLetRing",
  "Beat.isPalmMute",
  "Beat.hasRasgueado",
  "Beat.hasTuplet",
  "Beat.tupletGroup",
  "Beat.maxWhammyPoint",
  "Beat.minWhammyPoint",
  "Beat.hasWhammyBar",
  "Beat.hasChord",
  "Beat.chord",
  "Beat.graceGroup",
  "Beat.graceIndex",
  "Beat.isTremolo",
  "Beat.displayStart",
  "Beat.displayEnd",
  "Beat.playbackStart",
  "Beat.displayDuration",
  "Beat.playbackDuration",
  "Beat.absoluteDisplayStart",
  "Beat.absolutePlaybackStart",
  "Beat.isEffectSlurOrigin",
  "Beat.isEffectSlurDestination",
  "Beat.effectSlurOrigin",
  "Beat.effectSlurDestination",
  "Beat.timer",
  "Chord.staff",
  "Chord.uniqueId",
  "Color.a",
  "Color.r",
  "Color.g",
  "Color.b",
  "Color.rgba",
  "Font.isBold",
  "Font.isItalic",
  "GraceGroup.beats",
  "GraceGroup.id",
  "GraceGroup.isComplete",
  "MasterBar.nextMasterBar",
  "MasterBar.previousMasterBar",
  "MasterBar.index",
  "MasterBar.hasChanges",
  "MasterBar.isRepeatEnd",
  "MasterBar.repeatGroup",
  "MasterBar.isSectionStart",
  "MasterBar.score",
  "MasterBar.start",
  "Note.id",
  "Note.index",
  "Note.bendOrigin",
  "Note.maxBendPoint",
  "Note.hasBend",
  "Note.isStringed",
  "Note.isPiano",
  "Note.isPercussion",
  "Note.isHammerPullDestination",
  "Note.hammerPullOrigin",
  "Note.hammerPullDestination",
  "Note.isSlurOrigin",
  "Note.slurOrigin",
  "Note.slurDestination",
  "Note.isHarmonic",
  "Note.letRingDestination",
  "Note.palmMuteDestination",
  "Note.slideTarget",
  "Note.slideOrigin",
  "Note.tieOrigin",
  "Note.tieDestination",
  "Note.isTieOrigin",
  "Note.isFingering",
  "Note.trillFret",
  "Note.isTrill",
  "Note.beat",
  "Note.isEffectSlurOrigin",
  "Note.hasEffectSlur",
  "Note.isEffectSlurDestination",
  "Note.effectSlurOrigin",
  "Note.effectSlurDestination",
  "Note.stringTuning",
  "Note.realValue",
  "Note.realValueWithoutHarmonic",
  "Note.harmonicPitch",
  "Note.initialBendValue",
  "Note.displayValue",
  "Note.displayValueWithoutBend",
  "Note.hasQuarterToneOffset",
  "RepeatGroup.masterBars",
  "RepeatGroup.opening",
  "RepeatGroup.openings",
  "RepeatGroup.closings",
  "RepeatGroup.isOpened",
  "RepeatGroup.isClosed",
  "Staff.index",
  "Staff.track",
  "Staff.tuning",
  "Staff.tuningName",
  "Staff.isStringed",
  "Staff.filledVoices",
  "SustainPedalMarker.bar",
  "SustainPedalMarker.nextPedalMarker",
  "SustainPedalMarker.previousPedalMarker",
  "Track.index",
  "Track.score",
  "Track.isPercussion",
  "TupletGroup.totalDuration",
  "TupletGroup.beats",
  "TupletGroup.voice",
  "TupletGroup.isFull",
  "Voice.id",
  "Voice.index",
  "Voice.bar",
  "Voice.isEmpty",
  "Voice.isRestOnly"
]);

const coreKeys = new Set<string>([
  "Bar.clef",
  "Bar.clefOttava",
  "Bar.voices",
  "Bar.keySignature",
  "Bar.keySignatureType",
  "Beat.notes",
  "Beat.isEmpty",
  "Beat.duration",
  "Beat.dots",
  "Beat.automations",
  "Beat.lyrics",
  "Beat.text",
  "Beat.chordId",
  "Beat.graceType",
  "Beat.dynamics",
  "Lyrics.startBar",
  "Lyrics.text",
  "Lyrics.chunks",
  "MasterBar.alternateEndings",
  "MasterBar.isRepeatStart",
  "MasterBar.repeatCount",
  "MasterBar.timeSignatureNumerator",
  "MasterBar.timeSignatureDenominator",
  "MasterBar.isFreeTime",
  "MasterBar.tripletFeel",
  "MasterBar.section",
  "MasterBar.tempoAutomations",
  "Note.fret",
  "Note.string",
  "Note.octave",
  "Note.tone",
  "Note.percussionArticulation",
  "Note.dynamics",
  "Score.album",
  "Score.artist",
  "Score.copyright",
  "Score.instructions",
  "Score.music",
  "Score.notices",
  "Score.subTitle",
  "Score.title",
  "Score.words",
  "Score.tab",
  "Score.tempo",
  "Score.tempoLabel",
  "Score.masterBars",
  "Score.tracks",
  "Section.marker",
  "Section.text",
  "Staff.bars",
  "Staff.chords",
  "Staff.capo",
  "Staff.transpositionPitch",
  "Staff.stringTuning",
  "Staff.isPercussion",
  "Track.staves",
  "Track.playbackInfo",
  "Track.name",
  "Track.shortName",
  "Track.percussionArticulations",
  "Voice.beats"
]);

const playerKeys = new Set<string>([
  "Automation.type",
  "Automation.value",
  "Automation.ratioPosition",
  "Automation.syncPointValue",
  "BackingTrack.rawAudioFile",
  "Bar.simileMark",
  "Beat.whammyStyle",
  "Beat.deadSlapped",
  "Beat.brushType",
  "Beat.brushDuration",
  "Beat.tupletDenominator",
  "Beat.tupletNumerator",
  "Beat.isContinuedWhammy",
  "Beat.whammyBarType",
  "Beat.whammyBarPoints",
  "Beat.vibrato",
  "Beat.tremoloPicking",
  "Beat.fade",
  "Beat.rasgueado",
  "BendPoint.offset",
  "BendPoint.value",
  "InstrumentArticulation.outputMidiNumber",
  "MasterBar.alternateEndings",
  "MasterBar.isRepeatStart",
  "MasterBar.repeatCount",
  "MasterBar.tripletFeel",
  "MasterBar.tempoAutomations",
  "MasterBar.syncPoints",
  "Note.accentuated",
  "Note.bendType",
  "Note.bendStyle",
  "Note.isContinuedBend",
  "Note.bendPoints",
  "Note.fret",
  "Note.string",
  "Note.octave",
  "Note.tone",
  "Note.percussionArticulation",
  "Note.isLeftHandTapped",
  "Note.isHammerPullOrigin",
  "Note.harmonicType",
  "Note.harmonicValue",
  "Note.isGhost",
  "Note.isLetRing",
  "Note.isPalmMute",
  "Note.isDead",
  "Note.isStaccato",
  "Note.slideInType",
  "Note.slideOutType",
  "Note.vibrato",
  "Note.isTieDestination",
  "Note.trillValue",
  "Note.trillSpeed",
  "Note.dynamics",
  "Note.ornament",
  "PlaybackInformation.volume",
  "PlaybackInformation.balance",
  "PlaybackInformation.program",
  "PlaybackInformation.bank",
  "PlaybackInformation.primaryChannel",
  "PlaybackInformation.secondaryChannel",
  "PlaybackInformation.isMute",
  "PlaybackInformation.isSolo",
  "Score.backingTrack",
  "Score.tempo",
  "Staff.capo",
  "Staff.transpositionPitch",
  "Staff.stringTuning",
  "SyncPointData.barOccurence",
  "SyncPointData.millisecondOffset",
  "Track.playbackInfo",
  "Track.percussionArticulations",
  "TremoloPickingEffect.marks",
  "Tuning.tunings"
]);

// Verified by src/core/__tests__/alphatab-midi-capabilities.test.ts.
// These fields do not alter generated MIDI events in AlphaTab 1.8.1.
const noMidiDifferenceKeys = new Set<string>(midiCapabilities.identicalMidiFields);

const needsMidiDiffKeys = new Set<string>();

const roundtripKeys = new Set<string>([
  "Automation.text",
  "Automation.isVisible",
  "Bar.barLineLeft",
  "Bar.barLineRight",
  "Beat.pickStroke",
  "Beat.barreFret",
  "Beat.barreShape",
  "Beat.isBarre",
  "Chord.name",
  "Chord.firstFret",
  "Chord.strings",
  "Chord.barreFrets",
  "Chord.showName",
  "Chord.showDiagram",
  "Chord.showFingering",
  "InstrumentArticulation.id",
  "InstrumentArticulation.elementType",
  "InstrumentArticulation.staffLine",
  "InstrumentArticulation.noteHeadDefault",
  "InstrumentArticulation.noteHeadHalf",
  "InstrumentArticulation.noteHeadWhole",
  "InstrumentArticulation.techniqueSymbol",
  "InstrumentArticulation.techniqueSymbolPlacement",
  "MasterBar.directions",
  "Note.isSlurDestination",
  "Note.durationPercent",
  "PlaybackInformation.port",
  "TremoloPickingEffect.style",
  "Tuning.noteNames",
  "Tuning.isStandard",
  "Tuning.name"
]);

const roundtripOnlyPlayerKeys = new Set<string>([
  "Automation.syncPointValue",
  "BackingTrack.rawAudioFile",
  "MasterBar.syncPoints",
  "PlaybackInformation.volume",
  "PlaybackInformation.balance",
  "PlaybackInformation.bank",
  "PlaybackInformation.primaryChannel",
  "PlaybackInformation.secondaryChannel",
  "PlaybackInformation.isMute",
  "PlaybackInformation.isSolo",
  "Score.backingTrack",
  "SyncPointData.barOccurence",
  "SyncPointData.millisecondOffset"
]);

const metadataKeys = new Set<string>([
  "Automation.text",
  "Automation.isVisible",
  "Lyrics.startBar",
  "Lyrics.text",
  "Lyrics.chunks",
  "Score.album",
  "Score.artist",
  "Score.copyright",
  "Score.instructions",
  "Score.music",
  "Score.notices",
  "Score.subTitle",
  "Score.title",
  "Score.words",
  "Score.tab",
  "Score.tempoLabel",
  "Section.marker",
  "Section.text",
  "Track.name",
  "Track.shortName"
]);

const documentStructureKeys = new Set<string>([
  "Automation.type",
  "Automation.value",
  "Automation.ratioPosition",
  "Bar.voices",
  "Beat.notes",
  "Beat.isEmpty",
  "Beat.automations",
  "MasterBar.alternateEndings",
  "MasterBar.isRepeatStart",
  "MasterBar.repeatCount",
  "MasterBar.timeSignatureNumerator",
  "MasterBar.timeSignatureDenominator",
  "MasterBar.isFreeTime",
  "MasterBar.tripletFeel",
  "MasterBar.section",
  "MasterBar.tempoAutomations",
  "Score.masterBars",
  "Score.tracks",
  "Staff.bars",
  "Staff.chords",
  "Staff.isPercussion",
  "Track.staves",
  "Track.percussionArticulations",
  "Voice.beats"
]);

const visualClasses = new Set<string>([
  "BarStyle",
  "BeatStyle",
  "Color",
  "ElementStyle",
  "Font",
  "HeaderFooterStyle",
  "NoteStyle",
  "RenderStylesheet",
  "ScoreStyle",
  "TrackStyle",
  "VoiceStyle"
]);

const visualKeys = new Set<string>([
  "Bar.displayScale",
  "Bar.displayWidth",
  "Bar.barNumberDisplay",
  "Bar.style",
  "Bar.clefOttava",
  "Bar.keySignature",
  "Bar.keySignatureType",
  "Beat.ottava",
  "Beat.slashed",
  "Beat.invertBeamDirection",
  "Beat.preferredBeamDirection",
  "Beat.beamingMode",
  "Beat.showTimer",
  "Beat.style",
  "BeamingRules.groups",
  "MasterBar.timeSignatureCommon",
  "MasterBar.beamingRules",
  "MasterBar.displayScale",
  "MasterBar.displayWidth",
  "Note.showStringNumber",
  "Note.isVisible",
  "Note.leftHandFinger",
  "Note.rightHandFinger",
  "Note.accidentalMode",
  "Note.style",
  "Score.defaultSystemsLayout",
  "Score.systemsLayout",
  "Score.stylesheet",
  "Score.style",
  "Staff.displayTranspositionPitch",
  "Staff.showSlash",
  "Staff.showNumbered",
  "Staff.showTablature",
  "Staff.showStandardNotation",
  "Staff.standardNotationLineCount",
  "Track.color",
  "Track.isVisibleOnMultiTrack",
  "Track.defaultSystemsLayout",
  "Track.systemsLayout",
  "Track.lineBreaks",
  "Track.style",
  "Voice.style"
]);

const notationSemanticKeys = new Set<string>([
  "Bar.barLineLeft",
  "Bar.barLineRight",
  "Bar.clef",
  "Bar.clefOttava",
  "Bar.keySignature",
  "Bar.keySignatureType",
  "Beat.barreFret",
  "Beat.barreShape",
  "Beat.beamingMode",
  "Beat.chordId",
  "Beat.graceType",
  "Beat.invertBeamDirection",
  "Beat.isBarre",
  "Beat.isLegatoOrigin",
  "Beat.lyrics",
  "Beat.ottava",
  "Beat.pop",
  "Beat.pickStroke",
  "Beat.preferredBeamDirection",
  "Beat.slap",
  "Beat.slashed",
  "Beat.tap",
  "Beat.text",
  "Beat.crescendo",
  "Beat.golpe",
  "Beat.wahPedal",
  "Chord.name",
  "Chord.firstFret",
  "Chord.strings",
  "Chord.barreFrets",
  "Chord.showName",
  "Chord.showDiagram",
  "Chord.showFingering",
  "MasterBar.directions",
  "MasterBar.fermata",
  "Bar.sustainPedals",
  "Fermata.type",
  "Fermata.length",
  "Note.accidentalMode",
  "Note.durationPercent",
  "Note.isSlurDestination",
  "Note.leftHandFinger",
  "Note.rightHandFinger",
  "Note.showStringNumber",
  "Tuning.isStandard",
  "Tuning.name",
  "Tuning.noteNames",
  "SustainPedalMarker.ratioPosition",
  "SustainPedalMarker.pedalType"
]);

const playbackControlKeys = new Set<string>([
  "Automation.isLinear",
  "Automation.syncPointValue",
  "BackingTrack.rawAudioFile",
  "MasterBar.syncPoints",
  "PlaybackInformation.volume",
  "PlaybackInformation.balance",
  "PlaybackInformation.program",
  "PlaybackInformation.bank",
  "PlaybackInformation.primaryChannel",
  "PlaybackInformation.secondaryChannel",
  "PlaybackInformation.isMute",
  "PlaybackInformation.isSolo",
  "PlaybackInformation.port",
  "Score.backingTrack",
  "SyncPointData.barOccurence",
  "SyncPointData.millisecondOffset",
  "Track.playbackInfo"
]);

function doc(field: FieldInfo): string {
  return field.docs.join(" ");
}

function hasTag(field: FieldInfo, tag: string): boolean {
  return doc(field).includes(tag);
}

function midiReferences(field: FieldInfo): number {
  const start = coreText.indexOf("class MidiFileGenerator");
  const end = coreText.indexOf("class ToNextBeatAnimatingCursorHandler");
  const region = start >= 0 && end > start ? coreText.slice(start, end) : coreText;
  const escaped = field.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = region.match(new RegExp(`\\.${escaped}\\b`, "g"));
  return matches?.length ?? 0;
}

function runtimeNature(field: FieldInfo): FieldNature {
  if (
    /\b(Score|MasterBar|Track|Staff|Bar|Voice|Beat|Note|Chord|RepeatGroup|TupletGroup|GraceGroup|SustainPedalMarker)\b/.test(
      field.type
    )
  ) {
    return "runtime-link";
  }
  return "runtime-derived";
}

function fieldNature(field: FieldInfo): FieldNature {
  const fieldKey = key(field);

  if (field.static) {
    return "runtime-derived";
  }

  if (hasTag(field, "@deprecated")) {
    return "deprecated";
  }

  if (runtimeKeys.has(fieldKey)) {
    return runtimeNature(field);
  }

  if (metadataKeys.has(fieldKey)) {
    return "metadata";
  }

  if (documentStructureKeys.has(fieldKey)) {
    return "document-structure";
  }

  if (playbackControlKeys.has(fieldKey)) {
    return "playback-control";
  }

  if (playerKeys.has(fieldKey) || needsMidiDiffKeys.has(fieldKey)) {
    return "playback-audible";
  }

  if (notationSemanticKeys.has(fieldKey)) {
    return "notation-semantic";
  }

  if (visualKeys.has(fieldKey) || visualClasses.has(field.className)) {
    return "layout-style";
  }

  if (roundtripKeys.has(fieldKey)) {
    return "roundtrip-compat";
  }

  if (field.kinds.has("get") && !field.kinds.has("set") && !field.kinds.has("property")) {
    return "runtime-derived";
  }

  if (hasTag(field, "@json_ignore") || hasTag(field, "@clone_ignore")) {
    return runtimeNature(field);
  }

  return "roundtrip-compat";
}

function classify(field: FieldInfo): Classification {
  const fieldKey = key(field);
  const nature = fieldNature(field);

  if (nature === "deprecated") {
    return {
      nature,
      decision: "drop-deprecated",
      reason: "Deprecated AlphaTab API; keep importer migration only if needed."
    };
  }

  if (nature === "runtime-derived" || nature === "runtime-link") {
    return {
      nature,
      decision: "regenerate-runtime",
      reason: "Runtime relation/cache/index/computed field; reconstruct from the document graph."
    };
  }

  if (needsMidiDiffKeys.has(fieldKey)) {
    return {
      nature,
      decision: "needs-midi-diff",
      reason: "Musical playback candidate, but current MIDI generator path is not confirmed."
    };
  }

  if (noMidiDifferenceKeys.has(fieldKey)) {
    return {
      nature,
      decision: "preserve-roundtrip",
      reason: "Automated AlphaTab MIDI diff produced identical playback events; preserve notation/roundtrip data only."
    };
  }

  if (coreKeys.has(fieldKey) && !roundtripOnlyPlayerKeys.has(fieldKey)) {
    return {
      nature,
      decision: "core-edit-v0",
      reason: "Core score/document field for logical editing."
    };
  }

  if (playerKeys.has(fieldKey) && !roundtripOnlyPlayerKeys.has(fieldKey)) {
    return {
      nature,
      decision: "core-edit-v0",
      reason: "Confirmed AlphaTab player/MIDI input that changes audible playback or playback timing."
    };
  }

  return {
    nature,
    decision: "preserve-roundtrip",
    reason: "Persistent AlphaTab model field outside core-edit-v0; preserve for import/export fidelity."
  };
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

function shortDoc(field: FieldInfo): string {
  return escapeCell(
    doc(field)
      .replace(/@\w+(?:\s+[^@]*)?/g, "")
      .replace(/\{[^}]*\}/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180)
  );
}

const natureOrder: FieldNature[] = [
  "document-structure",
  "metadata",
  "playback-audible",
  "playback-control",
  "notation-semantic",
  "layout-style",
  "roundtrip-compat",
  "runtime-derived",
  "runtime-link",
  "deprecated"
];

const decisionOrder: CotabDecision[] = [
  "core-edit-v0",
  "preserve-roundtrip",
  "needs-midi-diff",
  "regenerate-runtime",
  "drop-deprecated"
];

function countBy<T extends string>(values: T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function groupedFieldsTable(fields: FieldInfo[]): string[] {
  if (fields.length === 0) return ["_None._"];

  const byClass = new Map<string, string[]>();
  for (const field of fields) {
    const list = byClass.get(field.className) ?? [];
    list.push(`\`${field.name}\``);
    byClass.set(field.className, list);
  }

  const lines: string[] = [];
  lines.push("| Class | Fields |");
  lines.push("|---|---|");
  for (const [className, fieldNames] of [...byClass.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`| \`${className}\` | ${fieldNames.join(", ")} |`);
  }
  return lines;
}

function generateMarkdown(classes: ClassInfo[]): string {
  const allFields = classes.flatMap((classInfo) => classInfo.fields);
  const classifications = new Map<FieldInfo, Classification>();
  for (const field of allFields) classifications.set(field, classify(field));
  const natureCounts = countBy(allFields.map((field) => classifications.get(field)!.nature));
  const decisionCounts = countBy(allFields.map((field) => classifications.get(field)!.decision));

  const lines: string[] = [];
  lines.push("# AlphaTab Field Audit");
  lines.push("");
  lines.push("> Auto-generated by `npm run audit:alphatab-fields`. Do not edit manually.");
  lines.push("");
  lines.push(`- AlphaTab package: \`@coderline/alphatab@${alphaTabVersion}\``);
  lines.push(`- Model classes scanned: \`${classes.length}\``);
  lines.push(`- Fields/accessors scanned: \`${allFields.length}\``);
  lines.push(`- Fields with verified identical MIDI output: \`${noMidiDifferenceKeys.size}\``);
  lines.push("");
  lines.push("## Field Nature Legend");
  lines.push("");
  lines.push("| Nature | Meaning |");
  lines.push("|---|---|");
  lines.push("| `document-structure` | Score graph, rhythm structure, containers, or core score identity. |");
  lines.push("| `metadata` | Human-readable song, track, lyrics, or section metadata. |");
  lines.push("| `playback-audible` | Confirmed or candidate field affecting synthesized sound, pitch, timing, or articulations. |");
  lines.push("| `playback-control` | Playback/mixer/backing-track routing or synchronization data. |");
  lines.push("| `notation-semantic` | Meaningful notation/fingering/score symbol that may not change audio. |");
  lines.push("| `layout-style` | Rendering, layout, color, font, display mode, or style customization. |");
  lines.push("| `roundtrip-compat` | Persistent compatibility field outside current core editing scope. |");
  lines.push("| `runtime-derived` | Computed/cache/index value that should be regenerated. |");
  lines.push("| `runtime-link` | Parent/previous/next/origin/destination object reference rebuilt from graph links. |");
  lines.push("| `deprecated` | Deprecated AlphaTab API surface. |");
  lines.push("");
  lines.push("## CoTab Decision Legend");
  lines.push("");
  lines.push("| Decision | Meaning |");
  lines.push("|---|---|");
  lines.push("| `core-edit-v0` | Belongs in the initial logical editor state/action protocol. |");
  lines.push("| `preserve-roundtrip` | Preserve on import/export, but do not expose in core editor UI/action protocol v0. |");
  lines.push("| `needs-midi-diff` | Do not claim player support yet; verify by generating and diffing MIDI events. |");
  lines.push("| `regenerate-runtime` | Do not persist/edit; rebuild from the document graph or AlphaTab finish/render passes. |");
  lines.push("| `drop-deprecated` | Do not model new code around this; keep importer shims only if required. |");
  lines.push("");
  lines.push("## Counts");
  lines.push("");
  lines.push("### By Nature");
  lines.push("");
  lines.push("| Nature | Count |");
  lines.push("|---|---:|");
  for (const nature of natureOrder) {
    lines.push(`| \`${nature}\` | ${natureCounts.get(nature) ?? 0} |`);
  }
  lines.push("");
  lines.push("### By CoTab Decision");
  lines.push("");
  lines.push("| Decision | Count |");
  lines.push("|---|---:|");
  for (const decision of decisionOrder) {
    lines.push(`| \`${decision}\` | ${decisionCounts.get(decision) ?? 0} |`);
  }

  for (const classInfo of classes) {
    lines.push("");
    lines.push(`## ${classInfo.name}`);
    lines.push("");
    lines.push("| Field | Type | Kind | Field Nature | CoTab Decision | MIDI refs | Reason | Notes | Source |");
    lines.push("|---|---|---|---|---|---:|---|---|---|");

    for (const field of classInfo.fields) {
      const classification = classifications.get(field)!;
      const type = field.type || "(derived)";
      const kind = [...field.kinds].sort().join("/");
      const relPath = "node_modules/@coderline/alphatab/dist/alphaTab.d.ts";
      lines.push(
        [
          `\`${field.name}\``,
          `\`${escapeCell(type)}\``,
          `\`${kind}\``,
          `\`${classification.nature}\``,
          `\`${classification.decision}\``,
          String(midiReferences(field)),
          escapeCell(classification.reason),
          shortDoc(field),
          `\`${relPath}:${field.line}\``
        ].join(" | ").replace(/^/, "| ") + " |"
      );
    }
  }

  lines.push("");
  return lines.join("\n");
}

function generateCoreSelectionMarkdown(classes: ClassInfo[]): string {
  const allFields = classes.flatMap((classInfo) => classInfo.fields);
  const fieldsByDecision = new Map<CotabDecision, FieldInfo[]>();
  for (const decision of decisionOrder) fieldsByDecision.set(decision, []);
  for (const field of allFields) {
    fieldsByDecision.get(classify(field).decision)!.push(field);
  }
  const noMidiDifferenceFields = allFields.filter((field) => noMidiDifferenceKeys.has(key(field)));

  const lines: string[] = [];
  lines.push("# Core Field Selection");
  lines.push("");
  lines.push("> Auto-generated by `npm run audit:alphatab-fields`. Do not edit manually.");
  lines.push("");
  lines.push(`- AlphaTab package: \`@coderline/alphatab@${alphaTabVersion}\``);
  lines.push(`- Model fields/accessors scanned: \`${allFields.length}\``);
  lines.push(`- Fields with verified identical MIDI output: \`${noMidiDifferenceFields.length}\``);
  lines.push("");
  lines.push("## Standard");
  lines.push("");
  lines.push("- `core-edit-v0`: score/document fields and confirmed AlphaTab player inputs that CoTab should expose in the initial logical editor.");
  lines.push("- `preserve-roundtrip`: persistent AlphaTab fields that should survive import/export but stay out of core editor UI/action protocol v0.");
  lines.push("- `needs-midi-diff`: musical playback candidates that need generated-MIDI comparison before being promoted.");
  lines.push("- `regenerate-runtime`: runtime links, indexes, caches, and computed values rebuilt from the document graph.");
  lines.push("- `drop-deprecated`: deprecated AlphaTab facade fields.");
  lines.push("");
  lines.push("## Core Edit V0");
  lines.push("");
  lines.push(...groupedFieldsTable(fieldsByDecision.get("core-edit-v0")!));
  lines.push("");
  lines.push("## Needs MIDI Diff");
  lines.push("");
  lines.push(...groupedFieldsTable(fieldsByDecision.get("needs-midi-diff")!));
  lines.push("");
  lines.push("## Verified No MIDI Difference");
  lines.push("");
  lines.push("These fields produced identical normalized AlphaSynth MIDI events in the installed AlphaTab version and therefore remain roundtrip-only.");
  lines.push("");
  lines.push(...groupedFieldsTable(noMidiDifferenceFields));
  lines.push("");
  lines.push("## Preserve Roundtrip Only");
  lines.push("");
  lines.push(...groupedFieldsTable(fieldsByDecision.get("preserve-roundtrip")!));
  lines.push("");
  lines.push("## Regenerate Runtime");
  lines.push("");
  lines.push(...groupedFieldsTable(fieldsByDecision.get("regenerate-runtime")!));
  lines.push("");
  lines.push("## Drop Deprecated");
  lines.push("");
  lines.push(...groupedFieldsTable(fieldsByDecision.get("drop-deprecated")!));
  lines.push("");
  lines.push("## Source Of Truth");
  lines.push("");
  lines.push("The detailed field nature and decision rationale is in `docs/ALPHATAB-FIELD-AUDIT.tmp.md`.");
  lines.push("");
  return lines.join("\n");
}

const modelExports = getModelExports();
const classes = extractClasses(modelExports);
const mode = process.argv.includes("--selection") ? "selection" : "audit";
process.stdout.write(mode === "selection" ? generateCoreSelectionMarkdown(classes) : generateMarkdown(classes));
