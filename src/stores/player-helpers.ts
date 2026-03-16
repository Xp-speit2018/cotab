/**
 * Model manipulation helpers: resolveBeat, formatPitch, insertBarAtIndex,
 * createTrackFromPreset, extractors, applyBarWarningStyles.
 * Depends on player-api (getApi), player-types (QUARTER_TICKS, TrackPreset, Selected*), percussion-data (none for these).
 */

import * as alphaTab from "@coderline/alphatab";
import type {
  KeySignatureType,
  TripletFeel,
} from "@/core/schema";
import { debugLog } from "./debug-log-store";
import { getApi } from "./player-api";
import type { TrackPreset } from "./player-types";
import type {
  SelectedBarInfo,
  SelectedStaffInfo,
  SelectedTrackInfo,
  SelectedVoiceInfo,
} from "./player-types";
import { QUARTER_TICKS } from "./player-types";

// ─── API / beat resolution ───────────────────────────────────────────────────

export function getTrack(index: number): alphaTab.model.Track | undefined {
  return getApi()?.score?.tracks[index];
}

export function resolveBeat(
  trackIndex: number,
  barIndex: number,
  beatIndex: number,
  staffIndex: number = 0,
  voiceIndex: number = 0,
): alphaTab.model.Beat | null {
  const api = getApi();
  const score = api?.score;
  if (!score) return null;
  const track = score.tracks[trackIndex];
  if (!track) return null;
  const staff = track.staves[staffIndex];
  if (!staff) return null;
  const bar = staff.bars[barIndex];
  if (!bar) return null;
  const voice = bar.voices[voiceIndex];
  if (!voice) return null;
  const beat = voice.beats[beatIndex];
  return beat ?? null;
}

// ─── Note placement / pitch ──────────────────────────────────────────────────

const DEGREE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

/**
 * Mirrors AlphaTab AccidentalHelper._octaveSteps:
 * the number of diatonic steps from the top of the rendering space
 * down to note-value 0 for each clef.
 * Index order: [Neutral=0, C3=1, C4=2, F4=3, G2=4]
 */
const CLEF_OCTAVE_STEPS: Record<number, number> = {
  0: 38,
  1: 32,
  2: 30,
  3: 26,
  4: 38,
};

export function formatPitch(
  octave: number | null | undefined,
  tone: number | null | undefined,
): string {
  if (octave === null || octave === undefined || tone === null || tone === undefined) {
    return "n/a";
  }
  const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const idx = ((tone % 12) + 12) % 12;
  const name = NAMES[idx] ?? "?";
  return `${name}${octave}`;
}

/**
 * Convert a snap-grid position to AlphaTab note.octave / note.tone,
 * using the exact same diatonic maths as AlphaTab's AccidentalHelper.
 *
 * Grid positions: string = staffStep + 7, where staffStep 0 = top staff
 * line and each increment = one half-space downward.
 *
 * AlphaTab formula (AccidentalHelper.calculateNoteSteps):
 *   staffStep = octaveSteps[clef] − spellingOctave × 7 − degree
 *
 * We invert it to recover spellingOctave & degree, then convert to
 * the note-model convention where note.octave = spellingOctave + 1.
 */
export function snapPositionToPitch(
  clef: alphaTab.model.Clef,
  position: number,
): { octave: number; tone: number } {
  const clefValue = clef as unknown as number;
  const staffStep = position - 7;
  const octaveSteps = CLEF_OCTAVE_STEPS[clefValue] ?? 38;

  const total = octaveSteps - staffStep;
  const spellingOctave = Math.floor(total / 7);
  const degree = ((total % 7) + 7) % 7;

  return { octave: spellingOctave + 1, tone: DEGREE_SEMITONES[degree] };
}

// ─── Duration helpers (internal for applyBarWarningStyles) ────────────────────

function durationToTicks(duration: number): number {
  let denom = duration;
  if (denom < 0) {
    denom = 1 / -denom;
  }
  return (QUARTER_TICKS * (4 / denom)) | 0;
}

function beatDurationTicks(beat: alphaTab.model.Beat): number {
  if (beat.graceType !== (0 as unknown as alphaTab.model.GraceType)) return 0;
  let ticks = durationToTicks(beat.duration as unknown as number);
  if (beat.dots === 1) {
    ticks = ticks + ((ticks / 2) | 0);
  } else if (beat.dots === 2) {
    ticks = ticks + (((ticks / 4) | 0) * 3);
  }
  if (beat.tupletDenominator > 0 && beat.tupletNumerator > 0) {
    ticks = ((ticks * beat.tupletDenominator) / beat.tupletNumerator) | 0;
  }
  return ticks;
}

function sumBeatDurationTicks(voice: alphaTab.model.Voice): number {
  let total = 0;
  for (const beat of voice.beats) {
    total += beatDurationTicks(beat);
  }
  return total;
}

type BarDurationStatus = "complete" | "incomplete" | "overfull";

function getBarDurationStatus(
  bar: alphaTab.model.Bar,
  voiceIndex: number,
): BarDurationStatus {
  const voice = bar.voices[voiceIndex];
  if (!voice || voice.isEmpty) return "complete";
  const expected = bar.masterBar.calculateDuration();
  const actual = sumBeatDurationTicks(voice);
  if (actual < expected) return "incomplete";
  if (actual > expected) return "overfull";
  return "complete";
}

// ─── Bar insertion ───────────────────────────────────────────────────────────

export function insertBarAtIndex(
  score: alphaTab.model.Score,
  insertIndex: number,
): void {
  const api = getApi();
  try {
    debugLog("debug", "insertBarAtIndex", "start", {
      insertIndex,
      masterBarCount: score.masterBars.length,
      trackCount: score.tracks.length,
    });

    const refBarIndex = Math.min(insertIndex, score.masterBars.length - 1);
    const refMasterBar = score.masterBars[refBarIndex];

    debugLog("debug", "insertBarAtIndex", "reference bar", {
      refBarIndex,
      timeSignature: `${refMasterBar.timeSignatureNumerator}/${refMasterBar.timeSignatureDenominator}`,
    });

    const mb = new alphaTab.model.MasterBar();
    mb.timeSignatureNumerator = refMasterBar.timeSignatureNumerator;
    mb.timeSignatureDenominator = refMasterBar.timeSignatureDenominator;
    mb.timeSignatureCommon = refMasterBar.timeSignatureCommon;
    mb.score = score;

    score.masterBars.splice(insertIndex, 0, mb);
    debugLog("debug", "insertBarAtIndex", "masterBar inserted", {
      newMasterBarCount: score.masterBars.length,
    });

    for (let i = 0; i < score.masterBars.length; i++) {
      const masterBar = score.masterBars[i];
      masterBar.index = i;
      masterBar.previousMasterBar = i > 0 ? score.masterBars[i - 1] : null;
      masterBar.nextMasterBar = i < score.masterBars.length - 1 ? score.masterBars[i + 1] : null;
    }
    debugLog("debug", "insertBarAtIndex", "masterBar indices and links updated");

    for (const track of score.tracks) {
      for (const staff of track.staves) {
        const refBar = staff.bars[refBarIndex < insertIndex ? refBarIndex : Math.min(insertIndex, staff.bars.length - 1)];
        const voiceCount = refBar ? refBar.voices.length : 1;

        debugLog("debug", "insertBarAtIndex", "creating bar for track/staff", {
          trackIndex: track.index,
          staffIndex: staff.index,
          voiceCount,
        });

        const bar = new alphaTab.model.Bar();
        bar.clef = refBar ? refBar.clef : (4 as unknown as alphaTab.model.Clef);

        for (let vi = 0; vi < voiceCount; vi++) {
          const voice = new alphaTab.model.Voice();
          const restBeat = new alphaTab.model.Beat();
          restBeat.isEmpty = false;
          restBeat.notes = [];
          restBeat.duration = alphaTab.model.Duration.Quarter as number as alphaTab.model.Duration;
          voice.addBeat(restBeat);
          bar.addVoice(voice);
        }

        staff.bars.splice(insertIndex, 0, bar);

        for (let i = 0; i < staff.bars.length; i++) {
          const b = staff.bars[i];
          b.staff = staff;
          b.index = i;
          b.previousBar = i > 0 ? staff.bars[i - 1] : null;
          b.nextBar = i < staff.bars.length - 1 ? staff.bars[i + 1] : null;
        }
      }
    }
    debugLog("debug", "insertBarAtIndex", "bar indices and links updated");

    debugLog("debug", "insertBarAtIndex", "calling score.finish()");
    score.finish(api!.settings);
    debugLog("debug", "insertBarAtIndex", "score.finish() completed");

    debugLog("debug", "insertBarAtIndex", "calling applyBarWarningStyles()");
    applyBarWarningStyles();
    debugLog("info", "insertBarAtIndex", "complete", {
      newMasterBarCount: score.masterBars.length,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    debugLog("error", "insertBarAtIndex", "failed", {
      error: err.message,
      stack: err.stack,
      insertIndex,
    });
    throw err;
  }
}

// ─── Track from preset ───────────────────────────────────────────────────────

export function createTrackFromPreset(
  score: alphaTab.model.Score,
  preset: TrackPreset,
): alphaTab.model.Track {
  debugLog("debug", "createTrackFromPreset", "building track", {
    presetId: preset.id,
    defaultName: preset.defaultName,
    program: preset.program,
    isPercussion: preset.isPercussion,
    stringCount: preset.stringCount,
    clef: preset.clef,
  });

  const track = new alphaTab.model.Track();
  track.score = score;
  track.name = preset.defaultName;
  track.shortName = preset.defaultName.slice(0, 20);

  let channel = preset.channel;
  if (channel === 0) {
    let maxCh = -1;
    for (const t of score.tracks) {
      const ch = t.playbackInfo.primaryChannel;
      if (ch !== 9) maxCh = Math.max(maxCh, ch);
    }
    channel = maxCh + 1;
    if (channel === 9) channel = 10;
  }
  debugLog("debug", "createTrackFromPreset", "channel assigned", {
    channel,
    presetChannel: preset.channel,
  });

  track.playbackInfo.program = preset.program;
  track.playbackInfo.primaryChannel = channel;
  track.playbackInfo.secondaryChannel = channel;
  track.playbackInfo.volume = 15;
  track.playbackInfo.balance = 8;

  const staffs: alphaTab.model.Staff[] = [];

  const makeStaff = (opts: {
    isPercussion: boolean;
    showTablature: boolean;
    showStandardNotation: boolean;
    stringCount: number;
  }): alphaTab.model.Staff => {
    const s = new alphaTab.model.Staff();
    s.track = track;
    s.isPercussion = opts.isPercussion;
    if (opts.stringCount > 0) {
      const tuning = alphaTab.model.Tuning.getDefaultTuningFor(opts.stringCount);
      s.stringTuning =
        tuning ??
        new alphaTab.model.Tuning(undefined, [40, 45, 50, 55, 59, 64], true);
    }
    s.showTablature = opts.showTablature;
    s.showStandardNotation = opts.showStandardNotation;
    return s;
  };

  if (!preset.isPercussion && preset.stringCount === 0) {
    const treble = makeStaff({
      isPercussion: false,
      showTablature: false,
      showStandardNotation: true,
      stringCount: 0,
    });
    const bass = makeStaff({
      isPercussion: false,
      showTablature: false,
      showStandardNotation: true,
      stringCount: 0,
    });
    staffs.push(treble, bass);
  } else {
    const single = makeStaff({
      isPercussion: preset.isPercussion,
      showTablature: preset.stringCount > 0 && !preset.isPercussion,
      showStandardNotation: preset.stringCount === 0 || preset.isPercussion,
      stringCount: preset.stringCount,
    });
    staffs.push(single);
  }

  debugLog("debug", "createTrackFromPreset", "staffs created", {
    staffCount: staffs.length,
    masterBarCount: score.masterBars.length,
  });

  for (let barIndex = 0; barIndex < score.masterBars.length; barIndex++) {
    const mbClef = preset.clef as unknown as alphaTab.model.Clef;
    for (let staffIndex = 0; staffIndex < staffs.length; staffIndex++) {
      const staff = staffs[staffIndex];
      const bar = new alphaTab.model.Bar();
      if (!preset.isPercussion && preset.stringCount === 0) {
        bar.clef =
          (staffIndex === 0 ? 4 : 3) as unknown as alphaTab.model.Clef;
      } else {
        bar.clef = mbClef;
      }
      bar.staff = staff;
      const voice = new alphaTab.model.Voice();
      const restBeat = new alphaTab.model.Beat();
      restBeat.isEmpty = false;
      restBeat.notes = [];
      restBeat.duration =
        alphaTab.model.Duration.Quarter as number as alphaTab.model.Duration;
      voice.addBeat(restBeat);
      bar.addVoice(voice);
      staff.addBar(bar);
    }
  }

  for (const staff of staffs) {
    for (let i = 0; i < staff.bars.length; i++) {
      const b = staff.bars[i];
      b.staff = staff;
      b.index = i;
      b.previousBar = i > 0 ? staff.bars[i - 1] : null;
      b.nextBar = i < staff.bars.length - 1 ? staff.bars[i + 1] : null;
    }
    track.addStaff(staff);
  }

  debugLog("debug", "createTrackFromPreset", "track ready", {
    staffCount: track.staves.length,
    barCount: track.staves[0]?.bars.length ?? 0,
  });
  return track;
}

// ─── Bar empty check ──────────────────────────────────────────────────────────

export function isBarEmptyAllTracks(barIndex: number): boolean {
  const score = getApi()?.score;
  if (!score) return false;
  for (const track of score.tracks) {
    for (const staff of track.staves) {
      const bar = staff.bars[barIndex];
      if (!bar) continue;
      if (!bar.isEmpty && !bar.isRestOnly) return false;
    }
  }
  return true;
}

// ─── Bar warning styles ──────────────────────────────────────────────────────

const BAR_WARN_INCOMPLETE = alphaTab.model.Color.fromJson("#F59E0B");
const BAR_WARN_OVERFULL = alphaTab.model.Color.fromJson("#EF4444");

const BAR_STYLE_ELEMENTS: number[] = [
  alphaTab.model.BarSubElement.StandardNotationBarLines,
  alphaTab.model.BarSubElement.GuitarTabsBarLines,
  alphaTab.model.BarSubElement.SlashBarLines,
  alphaTab.model.BarSubElement.NumberedBarLines,
  alphaTab.model.BarSubElement.StandardNotationStaffLine,
  alphaTab.model.BarSubElement.GuitarTabsStaffLine,
  alphaTab.model.BarSubElement.SlashStaffLine,
  alphaTab.model.BarSubElement.NumberedStaffLine,
  alphaTab.model.BarSubElement.StandardNotationBarNumber,
  alphaTab.model.BarSubElement.GuitarTabsBarNumber,
  alphaTab.model.BarSubElement.SlashBarNumber,
  alphaTab.model.BarSubElement.NumberedBarNumber,
];

export function applyBarWarningStyles(): void {
  const score = getApi()?.score;
  if (!score) return;

  for (const track of score.tracks) {
    for (const staff of track.staves) {
      for (const bar of staff.bars) {
        let worstStatus: BarDurationStatus = "complete";
        for (let vi = 0; vi < bar.voices.length; vi++) {
          const voice = bar.voices[vi];
          if (voice?.isEmpty) continue;
          const s = getBarDurationStatus(bar, vi);
          if (s === "overfull") {
            worstStatus = "overfull";
            break;
          }
          if (s === "incomplete") worstStatus = "incomplete";
        }

        if (worstStatus === "complete") {
          bar.style = null as unknown as alphaTab.model.BarStyle;
          continue;
        }

        const color =
          worstStatus === "incomplete" ? BAR_WARN_INCOMPLETE : BAR_WARN_OVERFULL;

        const style = new alphaTab.model.BarStyle();
        for (const elem of BAR_STYLE_ELEMENTS) {
          style.colors.set(elem, color);
        }
        bar.style = style;
      }
    }
  }
}

// ─── Extractors ───────────────────────────────────────────────────────────────

export function extractTrackInfo(track: alphaTab.model.Track): SelectedTrackInfo {
  const pi = track.playbackInfo;
  const c = track.color;
  return {
    index: track.index,
    name: track.name,
    shortName: track.shortName,
    isPercussion: track.isPercussion,
    staffCount: track.staves.length,
    playbackChannel: pi.primaryChannel,
    playbackProgram: pi.program,
    playbackPort: pi.port,
    color: { r: c.r, g: c.g, b: c.b, a: c.a },
  };
}

export function extractStaffInfo(staff: alphaTab.model.Staff): SelectedStaffInfo {
  return {
    index: staff.index,
    showTablature: staff.showTablature,
    showStandardNotation: staff.showStandardNotation,
    stringCount: staff.showTablature ? staff.tuning.length : 0,
    capo: staff.capo,
    transpositionPitch: staff.transpositionPitch,
    displayTranspositionPitch: staff.displayTranspositionPitch,
    tuningName: staff.tuningName,
    tuningValues: [...staff.tuning],
  };
}

export function extractVoiceInfo(voice: alphaTab.model.Voice): SelectedVoiceInfo {
  return {
    index: voice.index,
    isEmpty: voice.isEmpty,
    beatCount: voice.beats.length,
  };
}

export function extractBarInfo(bar: alphaTab.model.Bar): SelectedBarInfo {
  const mb = bar.masterBar;
  const tempoAuto = mb.tempoAutomation;
  return {
    index: bar.index,
    timeSignatureNumerator: mb.timeSignatureNumerator,
    timeSignatureDenominator: mb.timeSignatureDenominator,
    keySignature: mb.keySignature as unknown as number,
    keySignatureType: mb.keySignatureType as unknown as KeySignatureType,
    isRepeatStart: mb.isRepeatStart,
    repeatCount: mb.repeatCount,
    alternateEndings: mb.alternateEndings,
    tripletFeel: mb.tripletFeel as unknown as TripletFeel,
    isFreeTime: mb.isFreeTime,
    isDoubleBar: mb.isDoubleBar,
    hasSection: mb.section !== null,
    sectionText: mb.section?.text ?? "",
    sectionMarker: mb.section?.marker ?? "",
    tempo: tempoAuto ? tempoAuto.value : null,
  };
}
