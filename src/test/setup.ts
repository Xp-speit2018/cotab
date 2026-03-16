/**
 * Shared test helpers for the CRDT / action test suite.
 *
 * Mocking strategy:
 *   - `@/stores/player-api`     → getApi() returns null (makes rebuildFromYDoc a no-op)
 *   - `@/stores/player-helpers` → resolveBeat, isBarEmptyAllTracks are vi.fn()
 *   - `@/stores/player-store`   → usePlayerStore with configurable getState/setState
 *
 * The real Y.Doc layer (sync.ts, schema.ts, store.ts) is NOT mocked.
 */

import { vi, expect } from "vitest";
import * as Y from "yjs";
import type { TFunction } from "i18next";
import type { ActionExecutionContext } from "@/actions/types";
import type { SelectedBeat, SelectionRange } from "@/stores/player-types";
import {
  initDoc,
  destroyDoc,
  getDoc,
  getScoreMap,
  getUndoManager,
} from "@/core/sync";
import { snapshotScore } from "@/core/schema";
import type { ScoreSchema } from "@/core/schema";
import {
  pushDefaultBar,
  pushDefaultTrack,
} from "@/core/store";
import {
  createMasterBar,
  createTrack,
  createStaff,
  createNote,
  createBeat,
} from "@/core/schema";

// ─── Mock state ──────────────────────────────────────────────────────────────

let _selectedBeat: SelectedBeat | null = null;
let _selectionRange: SelectionRange | null = null;
let _selectedNoteIndex = -1;
let _visibleTrackIndices: number[] = [0];
let _addTrackDialogOpen = false;
const _storeOverrides: Record<string, unknown> = {};

/** Minimal mock for getApi().score with configurable tracks */
let _mockApiScore: unknown = null;

/**
 * When set, getApi() returns this instead of null.
 * Used by action-alphatab-integration tests to verify rebuildFromYDoc → api.load.
 */
let _integrationApi: {
  load: ReturnType<typeof vi.fn>;
  settings: unknown;
} | null = null;

// ─── Module mocks (call before importing action modules) ─────────────────────

vi.mock("@/stores/player-api", () => ({
  getApi: vi.fn(() => {
    if (_integrationApi) {
      return {
        score: null,
        settings: _integrationApi.settings,
        load: _integrationApi.load,
        render: vi.fn(),
        renderTracks: vi.fn(),
      };
    }
    return _mockApiScore
      ? {
          score: _mockApiScore,
          settings: { notation: {}, display: {}, player: {} },
          load: vi.fn(),
          render: vi.fn(),
          renderTracks: vi.fn(),
        }
      : null;
  }),
  setApi: vi.fn(),
  setPendingSelection: vi.fn(),
  getPendingSelection: vi.fn(() => null),
  getMainElement: vi.fn(() => null),
  setMainElement: vi.fn(),
  getViewportElement: vi.fn(() => null),
  setViewportElement: vi.fn(),
  getCursorElement: vi.fn(() => null),
  setCursorElement: vi.fn(),
}));

vi.mock("@/stores/player-helpers", () => ({
  resolveBeat: vi.fn(() => null),
  isBarEmptyAllTracks: vi.fn(() => true),
  getTrack: vi.fn(() => null),
  formatPitch: vi.fn((o: number, t: number) => `${t}/${o}`),
  snapPositionToPitch: vi.fn((_clef: number, pos: number) => ({
    octave: 4,
    tone: pos,
  })),
  insertBarAtIndex: vi.fn(),
  createTrackFromPreset: vi.fn(),
  applyBarWarningStyles: vi.fn(),
  extractTrackInfo: vi.fn(() => ({})),
  extractStaffInfo: vi.fn(() => ({})),
  extractVoiceInfo: vi.fn(() => ({})),
  extractBarInfo: vi.fn(() => ({})),
}));

vi.mock("@/stores/percussion-data", () => ({
  ALPHATAB_PERCUSSION_DEFS: [],
  DRUM_STAFFLINE_DEFAULTS: {} as Record<number, number>,
  PERC_SNAP_GROUPS: [],
  ESSENTIAL_ARTICULATION_GROUPS: [],
  ESSENTIAL_GP7_IDS: [],
  GP7_ARTICULATION_MAP: new Map(),
  GP7_DEF_BY_ID: new Map(),
  GP7_STAFF_LINE_MAP: new Map(),
  gp7IdToPercussionArticulation: vi.fn((_track: unknown, gp7Id: number) => gp7Id),
  resolveGp7Id: vi.fn(() => -1),
}));

vi.mock("@/stores/snap-grid", () => ({
  getSnapGrids: vi.fn(() => new Map()),
  updateSnapGridOverlay: vi.fn(),
}));

vi.mock("@/stores/player-store", () => ({
  usePlayerStore: {
    getState: vi.fn(() => ({
      selectedBeat: _selectedBeat,
      selectionRange: _selectionRange,
      selectedNoteIndex: _selectedNoteIndex,
      visibleTrackIndices: _visibleTrackIndices,
      addTrackDialogOpen: _addTrackDialogOpen,
      ..._storeOverrides,
    })),
    setState: vi.fn((partial: Record<string, unknown>) => {
      if ("selectedBeat" in partial) _selectedBeat = partial.selectedBeat as SelectedBeat | null;
      if ("selectionRange" in partial) _selectionRange = partial.selectionRange as SelectionRange | null;
      if ("selectedNoteIndex" in partial) _selectedNoteIndex = partial.selectedNoteIndex as number;
      if ("visibleTrackIndices" in partial) _visibleTrackIndices = partial.visibleTrackIndices as number[];
      if ("addTrackDialogOpen" in partial) _addTrackDialogOpen = partial.addTrackDialogOpen as boolean;
      Object.assign(_storeOverrides, partial);
    }),
    subscribe: vi.fn(() => vi.fn()),
  },
}));

vi.mock("@/stores/debug-log-store", () => ({
  debugLog: vi.fn(),
}));

vi.mock("y-webrtc", () => ({
  WebrtcProvider: vi.fn(),
}));

vi.mock("y-indexeddb", () => ({
  IndexeddbPersistence: vi.fn(),
}));

vi.mock("@coderline/alphatab", () => ({
  model: {
    Score: vi.fn(),
    Track: vi.fn(),
    Staff: vi.fn(),
    Bar: vi.fn(),
    Voice: vi.fn(),
    Beat: vi.fn(),
    Note: vi.fn(),
  },
  Settings: vi.fn(() => ({ notation: {}, display: {}, player: {} })),
}));

vi.mock("@/core/converters", () => ({
  importScoreToYDoc: vi.fn(),
  buildAlphaTabScore: vi.fn(),
  importTrack: vi.fn(),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function createTestDoc(): { doc: Y.Doc; scoreMap: Y.Map<unknown> } {
  initDoc();
  return { doc: getDoc()!, scoreMap: getScoreMap()! };
}

export function resetTestDoc(): { doc: Y.Doc; scoreMap: Y.Map<unknown> } {
  destroyDoc();
  return createTestDoc();
}

export function selectBeat(sel: SelectedBeat | null): void {
  _selectedBeat = sel;
}

export function setSelectionRange(range: SelectionRange | null): void {
  _selectionRange = range;
}

export function setSelectedNoteIndex(idx: number): void {
  _selectedNoteIndex = idx;
}

export function setMockApiScore(score: unknown): void {
  _mockApiScore = score;
}

export function clearMockApiScore(): void {
  _mockApiScore = null;
}

/**
 * Set getApi() to return an API with real Settings and a load spy.
 * Used by action-alphatab-integration tests.
 */
export function setIntegrationApi(api: {
  load: ReturnType<typeof vi.fn>;
  settings: unknown;
}): void {
  _integrationApi = api;
}

export function clearIntegrationApi(): void {
  _integrationApi = null;
}

export function snapshotDoc(): ScoreSchema {
  return snapshotScore(getScoreMap()!);
}

/**
 * Build a minimal mock AlphaTab score object that `getApi().score` can return.
 * Mirrors just the properties actions read.
 */
export function buildMockAlphaTabScore(opts: {
  tracks: Array<{
    isPercussion?: boolean;
    staves: Array<{
      showTablature?: boolean;
      tuning?: number[];
      bars?: Array<{
        clef?: number;
        voices?: Array<{
          beats: Array<{
            notes: Array<{ string?: number; fret?: number; percussionArticulation?: number }>;
            duration?: number;
            isEmpty?: boolean;
            isRest?: boolean;
            voice?: unknown;
          }>;
        }>;
      }>;
    }>;
  }>;
}) {
  return {
    tracks: opts.tracks.map((t) => ({
      isPercussion: t.isPercussion ?? false,
      staves: t.staves.map((s) => ({
        showTablature: s.showTablature ?? true,
        showStandardNotation: true,
        tuning: s.tuning ?? [40, 45, 50, 55, 59, 64],
        bars: (s.bars ?? []).map((b) => ({
          clef: b.clef ?? 4,
          voices: (b.voices ?? []).map((v) => ({
            beats: v.beats.map((bt) => ({
              notes: bt.notes.map((n) => ({
                string: n.string ?? 1,
                fret: n.fret ?? 0,
              })),
              duration: bt.duration ?? 4,
              isEmpty: bt.isEmpty ?? false,
              isRest: bt.isRest ?? false,
              voice: { bar: { clef: b.clef ?? 4 } },
            })),
          })),
        })),
      })),
    })),
  };
}

/**
 * Populate the Y.Doc with a single track, one staff, and `barCount` bars.
 * Each bar has one voice with one empty beat.
 * Returns the scoreMap for convenience.
 */
export function seedOneTrackScore(
  scoreMap: Y.Map<unknown>,
  barCount: number = 1,
  timeSignature: [number, number] = [4, 4],
): void {
  const doc = scoreMap.doc!;
  doc.transact(() => {
    const yMasterBars = scoreMap.get("masterBars") as Y.Array<Y.Map<unknown>>;
    const yTracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;

    yTracks.push([createTrack("Test Guitar")]);
    const intTrack = yTracks.get(yTracks.length - 1);

    const stavesArr = intTrack.get("staves") as Y.Array<Y.Map<unknown>>;
    stavesArr.push([createStaff()]);
    const intStaff = stavesArr.get(0);
    const yBars = intStaff.get("bars") as Y.Array<Y.Map<unknown>>;

    for (let i = 0; i < barCount; i++) {
      yMasterBars.push([createMasterBar(timeSignature[0], timeSignature[1])]);
      pushDefaultBar(yBars);
    }
  });
}

/** Violin GDAE tuning (G3 D4 A4 E5) in MIDI note numbers. */
export const VIOLIN_TUNING = [55, 62, 69, 76];

export interface TrackSeedConfig {
  name?: string;
  showTablature?: boolean;
  tuning?: number[];
  isPercussion?: boolean;
}

/**
 * Populate the Y.Doc with a single track using custom staff config.
 * Use for violin (4-string tab), piano (notation only), or drumkit (percussion).
 */
export function seedTrackWithConfig(
  scoreMap: Y.Map<unknown>,
  barCount: number = 1,
  config: TrackSeedConfig = {},
): void {
  const doc = scoreMap.doc!;
  const name = config.name ?? "Test Track";
  const tuning = config.tuning ?? [40, 45, 50, 55, 59, 64];

  doc.transact(() => {
    const yMasterBars = scoreMap.get("masterBars") as Y.Array<Y.Map<unknown>>;
    const yTracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;

    const track = createTrack(name);
    if (config.isPercussion) {
      track.set("playbackProgram", 0);
      track.set("playbackPrimaryChannel", 9);
    }
    yTracks.push([track]);
    const intTrack = yTracks.get(yTracks.length - 1);

    const staff = createStaff(tuning);
    if (config.showTablature === false) {
      staff.set("showTablature", false);
    }
    if (config.isPercussion) {
      staff.set("isPercussion", true);
    }
    const stavesArr = intTrack.get("staves") as Y.Array<Y.Map<unknown>>;
    stavesArr.push([staff]);
    const intStaff = stavesArr.get(0);
    const yBars = intStaff.get("bars") as Y.Array<Y.Map<unknown>>;

    for (let i = 0; i < barCount; i++) {
      yMasterBars.push([createMasterBar(4, 4)]);
      pushDefaultBar(yBars);
    }
  });
}

/** Place a note into the Y.Doc directly (bypassing actions). */
export function placeNoteDirectly(
  scoreMap: Y.Map<unknown>,
  trackIndex: number,
  barIndex: number,
  beatIndex: number,
  fret: number,
  stringNum: number,
  staffIndex = 0,
  voiceIndex = 0,
): void {
  const doc = scoreMap.doc!;
  doc.transact(() => {
    const yTracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;
    const yStaves = yTracks.get(trackIndex).get("staves") as Y.Array<Y.Map<unknown>>;
    const yBars = yStaves.get(staffIndex).get("bars") as Y.Array<Y.Map<unknown>>;
    const yVoices = yBars.get(barIndex).get("voices") as Y.Array<Y.Map<unknown>>;
    const yBeats = yVoices.get(voiceIndex).get("beats") as Y.Array<Y.Map<unknown>>;
    const yBeat = yBeats.get(beatIndex);
    const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
    yNotes.push([createNote(fret, stringNum)]);
    yBeat.set("isEmpty", false);
  }, doc.clientID);
}

/** Place a percussion note into the Y.Doc directly (bypassing actions). */
export function placePercussionNoteDirectly(
  scoreMap: Y.Map<unknown>,
  trackIndex: number,
  barIndex: number,
  beatIndex: number,
  percussionArticulation: number,
  staffIndex = 0,
  voiceIndex = 0,
): void {
  const doc = scoreMap.doc!;
  doc.transact(() => {
    const yTracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;
    const yStaves = yTracks.get(trackIndex).get("staves") as Y.Array<Y.Map<unknown>>;
    const yBars = yStaves.get(staffIndex).get("bars") as Y.Array<Y.Map<unknown>>;
    const yVoices = yBars.get(barIndex).get("voices") as Y.Array<Y.Map<unknown>>;
    const yBeats = yVoices.get(voiceIndex).get("beats") as Y.Array<Y.Map<unknown>>;
    const yBeat = yBeats.get(beatIndex);
    const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
    const yNote = createNote(-1, -1);
    yNote.set("percussionArticulation", percussionArticulation);
    yNotes.push([yNote]);
    yBeat.set("isEmpty", false);
  }, doc.clientID);
}

/** Place a piano note (octave/tone) into the Y.Doc directly (bypassing actions). */
export function placePianoNoteDirectly(
  scoreMap: Y.Map<unknown>,
  trackIndex: number,
  barIndex: number,
  beatIndex: number,
  octave: number,
  tone: number,
  staffIndex = 0,
  voiceIndex = 0,
): void {
  const doc = scoreMap.doc!;
  doc.transact(() => {
    const yTracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;
    const yStaves = yTracks.get(trackIndex).get("staves") as Y.Array<Y.Map<unknown>>;
    const yBars = yStaves.get(staffIndex).get("bars") as Y.Array<Y.Map<unknown>>;
    const yVoices = yBars.get(barIndex).get("voices") as Y.Array<Y.Map<unknown>>;
    const yBeats = yVoices.get(voiceIndex).get("beats") as Y.Array<Y.Map<unknown>>;
    const yBeat = yBeats.get(beatIndex);
    const yNotes = yBeat.get("notes") as Y.Array<Y.Map<unknown>>;
    const yNote = createNote(-1, -1);
    yNote.set("octave", octave);
    yNote.set("tone", tone);
    yNotes.push([yNote]);
    yBeat.set("isEmpty", false);
  }, doc.clientID);
}

/** Add additional empty beats to a voice in the Y.Doc. */
export function addBeatsDirectly(
  scoreMap: Y.Map<unknown>,
  trackIndex: number,
  barIndex: number,
  count: number,
  duration: number = 4,
  staffIndex = 0,
  voiceIndex = 0,
): void {
  const doc = scoreMap.doc!;
  doc.transact(() => {
    const yTracks = scoreMap.get("tracks") as Y.Array<Y.Map<unknown>>;
    const yStaves = yTracks.get(trackIndex).get("staves") as Y.Array<Y.Map<unknown>>;
    const yBars = yStaves.get(staffIndex).get("bars") as Y.Array<Y.Map<unknown>>;
    const yVoices = yBars.get(barIndex).get("voices") as Y.Array<Y.Map<unknown>>;
    const yBeats = yVoices.get(voiceIndex).get("beats") as Y.Array<Y.Map<unknown>>;
    for (let i = 0; i < count; i++) {
      yBeats.push([createBeat(duration)]);
    }
  }, doc.clientID);
}

/**
 * Assert that a Y.Map note has the correct percussion note structure:
 * fret=-1, string=-1, and the expected percussionArticulation value.
 *
 * Percussion notes must use fret=-1/string=-1 so AlphaTab positions
 * them by percussionArticulation rather than by string/fret mapping.
 */
export function expectPercussionNote(
  yNote: Y.Map<unknown>,
  expectedArticulation: number,
): void {
  expect(yNote.get("fret"), "percussion note fret must be -1").toBe(-1);
  expect(yNote.get("string"), "percussion note string must be -1").toBe(-1);
  expect(yNote.get("percussionArticulation")).toBe(expectedArticulation);
}

/**
 * Reset all mock state between tests.
 * Call in beforeEach after resetTestDoc().
 */
/** Create a minimal ActionExecutionContext for tests. */
export function testContext(): ActionExecutionContext {
  return { t: ((key: string) => key) as unknown as TFunction };
}

export function resetMockState(): void {
  _selectedBeat = null;
  _selectionRange = null;
  _selectedNoteIndex = -1;
  _visibleTrackIndices = [0];
  _addTrackDialogOpen = false;
  _mockApiScore = null;
  _integrationApi = null;
  for (const key of Object.keys(_storeOverrides)) {
    delete _storeOverrides[key];
  }
}

export {
  getDoc,
  getScoreMap,
  getUndoManager,
  destroyDoc,
  pushDefaultBar,
  pushDefaultTrack,
  createMasterBar,
  createTrack,
  createStaff,
  createNote,
  createBeat,
};
