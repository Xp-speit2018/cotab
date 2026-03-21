import * as Y from "yjs";
import { actionRegistry } from "./registry";
import type { ActionDefinition } from "./types";
import { engine } from "@/core/engine";
import { useEditorStore } from "@/stores/editor-store";
import { setPendingSelection } from "@/stores/render-internals";
import { debugLog } from "@/core/editor/action-log";
import {
  createBeat,
  createNote,
  snapshotBeat,
  type BeatSchema,
} from "@/core/schema";

const transact = (fn: () => void) => engine.localEditYDoc(fn);
const getScoreMap = () => engine.getScoreMap();

// ─── Internal clipboard buffer ───────────────────────────────────────────────

let clipboardBuffer: {
  bars: BeatSchema[][]; // each element = one bar's beats
  trackUuid: string;
  staffUuid: string;
} | null = null;

/** Exposed for testing. */
export function getClipboardBuffer() {
  return clipboardBuffer;
}

/** Exposed for testing. */
export function clearClipboardBuffer() {
  clipboardBuffer = null;
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
  yBeat.set("isRest", schema.isRest);
  yBeat.set("tupletNumerator", schema.tupletNumerator);
  yBeat.set("tupletDenominator", schema.tupletDenominator);
  yBeat.set("graceType", schema.graceType);
  yBeat.set("pickStroke", schema.pickStroke);
  yBeat.set("brushType", schema.brushType);
  yBeat.set("dynamics", schema.dynamics);
  yBeat.set("crescendo", schema.crescendo);
  yBeat.set("vibrato", schema.vibrato);
  yBeat.set("fade", schema.fade);
  yBeat.set("ottava", schema.ottava);
  yBeat.set("golpe", schema.golpe);
  yBeat.set("wahPedal", schema.wahPedal);
  yBeat.set("whammyBarType", schema.whammyBarType);
  yBeat.set("text", schema.text);
  yBeat.set("chordId", schema.chordId);
  yBeat.set("tap", schema.tap);
  yBeat.set("slap", schema.slap);
  yBeat.set("pop", schema.pop);
  yBeat.set("slashed", schema.slashed);
  yBeat.set("deadSlapped", schema.deadSlapped);
  yBeat.set("isLegatoOrigin", schema.isLegatoOrigin);

  // Whammy bar points
  if (schema.whammyBarPoints.length > 0) {
    const yPoints = yBeat.get("whammyBarPoints") as Y.Array<Y.Map<unknown>>;
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
    if (noteSchema.bendPoints.length > 0) {
      const yBendPoints = intNote.get("bendPoints") as Y.Array<Y.Map<unknown>>;
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
  const state = useEditorStore.getState();
  const sel = state.selectedBeat;
  if (!sel) {
    debugLog("debug", "edit.clipboard", "copy: no selection");
    return false;
  }

  const yTrack = engine.resolveYTrack(sel.trackIndex);
  const yStaff = engine.resolveYStaff(sel.trackIndex, sel.staffIndex);
  if (!yTrack || !yStaff) {
    debugLog("debug", "edit.clipboard", "copy: no Y.Track/Staff resolved");
    return false;
  }

  const range = state.selectionRange;
  const startBar = range ? range.startBarIndex : sel.barIndex;
  const endBar = range ? range.endBarIndex : sel.barIndex;

  const bars: BeatSchema[][] = [];
  for (let barIdx = startBar; barIdx <= endBar; barIdx++) {
    const yVoice = engine.resolveYVoice(
      sel.trackIndex,
      sel.staffIndex,
      barIdx,
      sel.voiceIndex,
    );
    if (!yVoice) {
      debugLog("debug", "edit.clipboard", `copy: no Y.Voice at bar ${barIdx}`);
      return false;
    }
    const yBeats = yVoice.get("beats") as Y.Array<Y.Map<unknown>>;
    bars.push(yBeats.map((b) => snapshotBeat(b)));
  }

  clipboardBuffer = {
    bars,
    trackUuid: yTrack.get("uuid") as string,
    staffUuid: yStaff.get("uuid") as string,
  };

  debugLog("info", "edit.clipboard", `copied bars ${startBar}–${endBar} (${bars.length} bar${bars.length > 1 ? "s" : ""})`, {
    trackIndex: sel.trackIndex,
    staffIndex: sel.staffIndex,
    voiceIndex: sel.voiceIndex,
    startBarIndex: startBar,
    endBarIndex: endBar,
    barCount: bars.length,
    barSummaries: bars.map((b, i) => ({ barIndex: startBar + i, ...summariseBar(b) })),
  });

  // Fire-and-forget system clipboard write
  try {
    navigator?.clipboard?.writeText(JSON.stringify(clipboardBuffer)).catch(() => {});
  } catch {
    // System clipboard not available (e.g. in tests)
  }

  return true;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

const copyAction: ActionDefinition<void> = {
  id: "edit.copy",
  i18nKey: "shortcuts.clipboard.copy",
  category: "edit.clipboard",
  execute: () => {
    copyToBuffer();
  },
};

const cutAction: ActionDefinition<void> = {
  id: "edit.cut",
  i18nKey: "shortcuts.clipboard.cut",
  category: "edit.clipboard",
  execute: () => {
    const state = useEditorStore.getState();
    const sel = state.selectedBeat;
    if (!sel) {
      debugLog("debug", "edit.clipboard", "cut: no selection");
      return;
    }

    if (!copyToBuffer()) return;

    const range = state.selectionRange;
    const startBar = range ? range.startBarIndex : sel.barIndex;
    const endBar = range ? range.endBarIndex : sel.barIndex;

    setPendingSelection({
      trackIndex: sel.trackIndex,
      barIndex: startBar,
      beatIndex: 0,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      string: sel.string,
    });

    transact(() => {
      for (let barIdx = startBar; barIdx <= endBar; barIdx++) {
        const yVoice = engine.resolveYVoice(
          sel.trackIndex,
          sel.staffIndex,
          barIdx,
          sel.voiceIndex,
        );
        if (!yVoice) continue;
        const yBeats = yVoice.get("beats") as Y.Array<Y.Map<unknown>>;
        yBeats.delete(0, yBeats.length);
        yBeats.push([createBeat()]);
      }
    });

    debugLog("info", "edit.clipboard", `cut bars ${startBar}–${endBar} (${endBar - startBar + 1} bar${startBar !== endBar ? "s" : ""}) → cleared`, {
      trackIndex: sel.trackIndex,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      startBarIndex: startBar,
      endBarIndex: endBar,
      barCount: endBar - startBar + 1,
    });
  },
};

const pasteAction: ActionDefinition<void> = {
  id: "edit.paste",
  i18nKey: "shortcuts.clipboard.paste",
  category: "edit.clipboard",
  execute: () => {
    if (!clipboardBuffer) {
      debugLog("debug", "edit.clipboard", "paste: no buffer");
      return;
    }

    const sel = useEditorStore.getState().selectedBeat;
    if (!sel) {
      debugLog("debug", "edit.clipboard", "paste: no selection");
      return;
    }

    // Same-staff guard by UUID
    const yTrack = engine.resolveYTrack(sel.trackIndex);
    const yStaff = engine.resolveYStaff(sel.trackIndex, sel.staffIndex);
    if (!yTrack || !yStaff) {
      debugLog("debug", "edit.clipboard", "paste: no Y.Track/Staff resolved");
      return;
    }

    if (
      (yTrack.get("uuid") as string) !== clipboardBuffer.trackUuid ||
      (yStaff.get("uuid") as string) !== clipboardBuffer.staffUuid
    ) {
      debugLog("warn", "edit.clipboard", "paste: track/staff UUID mismatch — buffer from a different track", {
        bufferTrackUuid: clipboardBuffer.trackUuid,
        bufferStaffUuid: clipboardBuffer.staffUuid,
        targetTrackUuid: yTrack.get("uuid"),
        targetStaffUuid: yStaff.get("uuid"),
      });
      return;
    }

    const totalBars = getBarCount();
    const barsInBuffer = clipboardBuffer.bars.length;
    const barsWritten = Math.min(barsInBuffer, totalBars - sel.barIndex);

    if (barsWritten < barsInBuffer) {
      debugLog("warn", "edit.clipboard", `paste: clamped ${barsInBuffer} buffered bars to ${barsWritten} (score has ${totalBars} bars, target starts at bar ${sel.barIndex})`, {
        barsInBuffer,
        barsWritten,
        totalBars,
        targetBarIndex: sel.barIndex,
      });
    }

    setPendingSelection({
      trackIndex: sel.trackIndex,
      barIndex: sel.barIndex,
      beatIndex: 0,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      string: sel.string,
    });

    transact(() => {
      for (let i = 0; i < barsWritten; i++) {
        const targetBarIndex = sel.barIndex + i;

        const yVoice = engine.resolveYVoice(
          sel.trackIndex,
          sel.staffIndex,
          targetBarIndex,
          sel.voiceIndex,
        );
        if (!yVoice) continue;

        const yBeats = yVoice.get("beats") as Y.Array<Y.Map<unknown>>;
        yBeats.delete(0, yBeats.length);
        for (const beatSchema of clipboardBuffer!.bars[i]) {
          yBeats.push([createBeat(beatSchema.duration)]);
          const intBeat = yBeats.get(yBeats.length - 1);
          populateBeatFromSnapshot(intBeat, beatSchema);
        }
      }
    });

    const lastTargetBar = sel.barIndex + barsWritten - 1;
    debugLog("info", "edit.clipboard", `pasted ${barsWritten} bar${barsWritten > 1 ? "s" : ""} into bars ${sel.barIndex}–${lastTargetBar}`, {
      trackIndex: sel.trackIndex,
      staffIndex: sel.staffIndex,
      voiceIndex: sel.voiceIndex,
      targetStartBar: sel.barIndex,
      targetEndBar: lastTargetBar,
      barsWritten,
      barSummaries: clipboardBuffer.bars.slice(0, barsWritten).map((b, i) => ({
        targetBarIndex: sel.barIndex + i,
        ...summariseBar(b),
      })),
    });
  },
};

actionRegistry.register(copyAction);
actionRegistry.register(cutAction);
actionRegistry.register(pasteAction);

declare global {
  interface ActionMap {
    "edit.copy": { args: void; result: void };
    "edit.cut": { args: void; result: void };
    "edit.paste": { args: void; result: void };
  }
}

export {};
