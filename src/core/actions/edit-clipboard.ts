import * as Y from "yjs";
import {
  defineDocumentAction,
  emptyActionArgs,
} from "@/core/actions/definition";
import { engine } from "@/core/engine";
import { debugLog } from "@/core/editor/action-log";
import {
  createBeat,
  createNote,
  snapshotBeat,
  type BeatSchema,
} from "@/core/schema";

const transact = (fn: () => void) => engine.localEditYDoc(fn);
const getScoreMap = () => engine.getScoreMap();

/** Clipboard data structure (JSON-serializable). */
interface ClipboardData {
  bars: BeatSchema[][]; // each element = one bar's beats
  trackUuid: string;
  staffUuid: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Populate an already-integrated Y.Map beat from a BeatSchema snapshot.
 * The beat must be integrated into a Y.Doc before calling this
 * (Yjs requires integration before nested Y.Types can be read).
 */
function populateBeatFromSnapshot(yBeat: Y.Map<unknown>, schema: BeatSchema): void {
  yBeat.set("isEmpty", schema.isEmpty);
  yBeat.set("dots", schema.dots);
  yBeat.set("tupletNumerator", schema.tupletNumerator);
  yBeat.set("tupletDenominator", schema.tupletDenominator);
  yBeat.set("graceType", schema.graceType);
  yBeat.set("pickStroke", schema.pickStroke);
  yBeat.set("brushType", schema.brushType);
  yBeat.set("brushDuration", schema.brushDuration);
  yBeat.set("dynamics", schema.dynamics);
  yBeat.set("crescendo", schema.crescendo);
  yBeat.set("vibrato", schema.vibrato);
  yBeat.set("fade", schema.fade);
  yBeat.set("ottava", schema.ottava);
  yBeat.set("golpe", schema.golpe);
  yBeat.set("wahPedal", schema.wahPedal);
  yBeat.set("whammyStyle", schema.whammyStyle);
  yBeat.set("isContinuedWhammy", schema.isContinuedWhammy);
  yBeat.set("whammyBarType", schema.whammyBarType);
  yBeat.set("rasgueado", schema.rasgueado);
  yBeat.set("text", schema.text);
  yBeat.set("chordId", schema.chordId);
  yBeat.set("tap", schema.tap);
  yBeat.set("slap", schema.slap);
  yBeat.set("pop", schema.pop);
  yBeat.set("slashed", schema.slashed);
  yBeat.set("deadSlapped", schema.deadSlapped);
  yBeat.set("isLegatoOrigin", schema.isLegatoOrigin);

  const yAutomations = yBeat.get("automations") as Y.Array<Y.Map<unknown>>;
  for (const automation of schema.automations) {
    const yAutomation = new Y.Map<unknown>();
    yAutomation.set("isLinear", automation.isLinear);
    yAutomation.set("type", automation.type);
    yAutomation.set("value", automation.value);
    yAutomation.set("ratioPosition", automation.ratioPosition);
    yAutomation.set("text", automation.text);
    yAutomation.set("isVisible", automation.isVisible);
    yAutomations.push([yAutomation]);
  }

  if (schema.lyrics) {
    const yLyrics = new Y.Array<string>();
    yLyrics.push(schema.lyrics);
    yBeat.set("lyrics", yLyrics);
  }
  if (schema.tremoloPicking) {
    const yTremolo = new Y.Map<unknown>();
    yTremolo.set("marks", schema.tremoloPicking.marks);
    yTremolo.set("style", schema.tremoloPicking.style);
    yBeat.set("tremoloPicking", yTremolo);
  }

  // Whammy bar points
  if (schema.whammyBarPoints) {
    const yPoints = new Y.Array<Y.Map<unknown>>();
    yBeat.set("whammyBarPoints", yPoints);
    for (const pt of schema.whammyBarPoints) {
      const yPt = new Y.Map<unknown>();
      yPt.set("offset", pt.offset);
      yPt.set("value", pt.value);
      yPoints.push([yPt]);
    }
  }

  // Notes
  const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
  for (const noteSchema of schema.notes) {
    const yNote = createNote(noteSchema.fret, noteSchema.string);
    yNotes.push([yNote]);
    // Read back the integrated note to populate nested types
    const intNote = yNotes.get(yNotes.length - 1);

    intNote.set("octave", noteSchema.octave);
    intNote.set("tone", noteSchema.tone);
    intNote.set("percussionArticulation", noteSchema.percussionArticulation);
    intNote.set("isDead", noteSchema.isDead);
    intNote.set("isGhost", noteSchema.isGhost);
    intNote.set("isStaccato", noteSchema.isStaccato);
    intNote.set("isLetRing", noteSchema.isLetRing);
    intNote.set("isPalmMute", noteSchema.isPalmMute);
    intNote.set("isTieDestination", noteSchema.isTieDestination);
    intNote.set("isHammerPullOrigin", noteSchema.isHammerPullOrigin);
    intNote.set("isLeftHandTapped", noteSchema.isLeftHandTapped);
    intNote.set("isContinuedBend", noteSchema.isContinuedBend);
    intNote.set("accentuated", noteSchema.accentuated);
    intNote.set("vibrato", noteSchema.vibrato);
    intNote.set("slideInType", noteSchema.slideInType);
    intNote.set("slideOutType", noteSchema.slideOutType);
    intNote.set("harmonicType", noteSchema.harmonicType);
    intNote.set("harmonicValue", noteSchema.harmonicValue);
    intNote.set("bendType", noteSchema.bendType);
    intNote.set("bendStyle", noteSchema.bendStyle);
    intNote.set("leftHandFinger", noteSchema.leftHandFinger);
    intNote.set("rightHandFinger", noteSchema.rightHandFinger);
    intNote.set("dynamics", noteSchema.dynamics);
    intNote.set("ornament", noteSchema.ornament);
    intNote.set("accidentalMode", noteSchema.accidentalMode);
    intNote.set("trillValue", noteSchema.trillValue);
    intNote.set("trillSpeed", noteSchema.trillSpeed);
    intNote.set("durationPercent", noteSchema.durationPercent);

    // Bend points
    if (noteSchema.bendPoints) {
      const yBendPoints = new Y.Array<Y.Map<unknown>>();
      intNote.set("bendPoints", yBendPoints);
      for (const bp of noteSchema.bendPoints) {
        const yBp = new Y.Map<unknown>();
        yBp.set("offset", bp.offset);
        yBp.set("value", bp.value);
        yBendPoints.push([yBp]);
      }
    }
  }
}

/** Get the total number of bars in the score. */
function getBarCount(): number {
  const scoreMap = getScoreMap();
  if (!scoreMap) return 0;
  const masterBars = scoreMap.get("masterBars") as Y.Array<unknown> | undefined;
  return masterBars ? masterBars.length : 0;
}

/** Summarise a bar snapshot for logging: beat count and total note count. */
function summariseBar(beats: BeatSchema[]): { beats: number; notes: number } {
  return {
    beats: beats.length,
    notes: beats.reduce((sum, b) => sum + b.notes.length, 0),
  };
}

/**
 * Copy bar(s) into the clipboard buffer.
 * If selectionRange is set, copies all bars in range.
 * Otherwise copies the single bar at selectedBeat.
 * Returns true if successful.
 */
function copyToBuffer(): boolean {
  const { trackIndex, staffIndex, barIndex, voiceIndex } = engine.selector;
  if (
    trackIndex === null ||
    staffIndex === null ||
    barIndex === null ||
    voiceIndex === null
  ) {
    debugLog("debug", "document.clipboard", "copy: no selection");
    return false;
  }

  const yTrack = engine.resolveYTrack(trackIndex);
  const yStaff = engine.resolveYStaff(trackIndex, staffIndex);
  if (!yTrack || !yStaff) {
    debugLog("debug", "document.clipboard", "copy: no Y.Track/Staff resolved");
    return false;
  }

  const range = engine.selector.selectionRange;
  const startBar = range ? range.startBarIndex : barIndex;
  const endBar = range ? range.endBarIndex : barIndex;

  const bars: BeatSchema[][] = [];
  for (let barIdx = startBar; barIdx <= endBar; barIdx++) {
    const yVoice = engine.resolveYVoice(
      trackIndex,
      staffIndex,
      barIdx,
      voiceIndex,
    );
    if (!yVoice) {
      debugLog("debug", "document.clipboard", `copy: no Y.Voice at bar ${barIdx}`);
      return false;
    }
    const yBeats = yVoice.get("beats") as Y.Array<Y.Map<unknown>>;
    bars.push(yBeats.map((b) => snapshotBeat(b)));
  }

  const clipboardData: ClipboardData = {
    bars,
    trackUuid: yTrack.get("uuid") as string,
    staffUuid: yStaff.get("uuid") as string,
  };

  // Store in engine (triggers hook for system clipboard sync)
  engine.setClipboard(JSON.stringify(clipboardData));

  debugLog("info", "document.clipboard", `copied bars ${startBar}–${endBar} (${bars.length} bar${bars.length > 1 ? "s" : ""})`, {
    trackIndex,
    staffIndex,
    voiceIndex,
    startBarIndex: startBar,
    endBarIndex: endBar,
    barCount: bars.length,
    barSummaries: bars.map((b, i) => ({ barIndex: startBar + i, ...summariseBar(b) })),
  });

  return true;
}

/** Parse clipboard data from engine. Returns null if invalid or missing. */
function getClipboardData(): ClipboardData | null {
  const text = engine.getClipboard();
  if (!text) return null;
  try {
    return JSON.parse(text) as ClipboardData;
  } catch {
    return null;
  }
}

// ─── Actions ─────────────────────────────────────────────────────────────────

const copyAction = defineDocumentAction({
  id: "document.copy",
  i18nKey: "shortcuts.clipboard.copy",
  category: "document.clipboard",
  argsSchema: emptyActionArgs,
  execute: () => {
    copyToBuffer();
  },
});

const cutAction = defineDocumentAction({
  id: "document.cut",
  i18nKey: "shortcuts.clipboard.cut",
  category: "document.clipboard",
  argsSchema: emptyActionArgs,
  execute: () => {
    const { trackIndex, staffIndex, barIndex, voiceIndex } = engine.selector;
    if (
      trackIndex === null ||
      staffIndex === null ||
      barIndex === null ||
      voiceIndex === null
    ) {
      debugLog("debug", "document.clipboard", "cut: no selection");
      return;
    }

    if (!copyToBuffer()) return;

    const range = engine.selector.selectionRange;
    const startBar = range ? range.startBarIndex : barIndex;
    const endBar = range ? range.endBarIndex : barIndex;

    transact(() => {
      for (let barIdx = startBar; barIdx <= endBar; barIdx++) {
        const yVoice = engine.resolveYVoice(
          trackIndex,
          staffIndex,
          barIdx,
          voiceIndex,
        );
        if (!yVoice) continue;
        const yBeats = yVoice.get("beats") as Y.Array<Y.Map<unknown>>;
        yBeats.delete(0, yBeats.length);
        yBeats.push([createBeat()]);
      }
    });

    debugLog("info", "document.clipboard", `cut bars ${startBar}–${endBar} (${endBar - startBar + 1} bar${startBar !== endBar ? "s" : ""}) → cleared`, {
      trackIndex,
      staffIndex,
      voiceIndex,
      startBarIndex: startBar,
      endBarIndex: endBar,
      barCount: endBar - startBar + 1,
    });
  },
});

const pasteAction = defineDocumentAction({
  id: "document.paste",
  i18nKey: "shortcuts.clipboard.paste",
  category: "document.clipboard",
  argsSchema: emptyActionArgs,
  execute: () => {
    const clipboardData = getClipboardData();
    if (!clipboardData) {
      debugLog("debug", "document.clipboard", "paste: no buffer");
      return;
    }

    const { trackIndex, staffIndex, barIndex, voiceIndex } = engine.selector;
    if (
      trackIndex === null ||
      staffIndex === null ||
      barIndex === null ||
      voiceIndex === null
    ) {
      debugLog("debug", "document.clipboard", "paste: no selection");
      return;
    }

    // Same-staff guard by UUID
    const yTrack = engine.resolveYTrack(trackIndex);
    const yStaff = engine.resolveYStaff(trackIndex, staffIndex);
    if (!yTrack || !yStaff) {
      debugLog("debug", "document.clipboard", "paste: no Y.Track/Staff resolved");
      return;
    }

    if (
      (yTrack.get("uuid") as string) !== clipboardData.trackUuid ||
      (yStaff.get("uuid") as string) !== clipboardData.staffUuid
    ) {
      debugLog("warn", "document.clipboard", "paste: track/staff UUID mismatch — buffer from a different track", {
        bufferTrackUuid: clipboardData.trackUuid,
        bufferStaffUuid: clipboardData.staffUuid,
        targetTrackUuid: yTrack.get("uuid"),
        targetStaffUuid: yStaff.get("uuid"),
      });
      return;
    }

    const totalBars = getBarCount();
    const barsInBuffer = clipboardData.bars.length;
    const barsWritten = Math.min(barsInBuffer, totalBars - barIndex);

    if (barsWritten < barsInBuffer) {
      debugLog("warn", "document.clipboard", `paste: clamped ${barsInBuffer} buffered bars to ${barsWritten} (score has ${totalBars} bars, target starts at bar ${barIndex})`, {
        barsInBuffer,
        barsWritten,
        totalBars,
        targetBarIndex: barIndex,
      });
    }

    transact(() => {
      for (let i = 0; i < barsWritten; i++) {
        const targetBarIndex = barIndex + i;

        const yVoice = engine.resolveYVoice(
          trackIndex,
          staffIndex,
          targetBarIndex,
          voiceIndex,
        );
        if (!yVoice) continue;

        const yBeats = yVoice.get("beats") as Y.Array<Y.Map<unknown>>;
        yBeats.delete(0, yBeats.length);
        for (const beatSchema of clipboardData.bars[i]) {
          yBeats.push([createBeat(beatSchema.duration)]);
          const intBeat = yBeats.get(yBeats.length - 1);
          populateBeatFromSnapshot(intBeat, beatSchema);
        }
      }
    });

    const lastTargetBar = barIndex + barsWritten - 1;
    debugLog("info", "document.clipboard", `pasted ${barsWritten} bar${barsWritten > 1 ? "s" : ""} into bars ${barIndex}–${lastTargetBar}`, {
      trackIndex,
      staffIndex,
      voiceIndex,
      targetStartBar: barIndex,
      targetEndBar: lastTargetBar,
      barsWritten,
      barSummaries: clipboardData.bars.slice(0, barsWritten).map((b, i) => ({
        targetBarIndex: barIndex + i,
        ...summariseBar(b),
      })),
    });
  },
});

export const clipboardDocumentActions = [
  copyAction,
  cutAction,
  pasteAction,
] as const;
