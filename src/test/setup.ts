/**
 * Shared test helpers for the CRDT / action test suite.
 *
 * Mocking strategy (Vitest-only):
 *   - `@/stores/render-api`     → getApi() returns null (makes rebuildFromYDoc a no-op)
 *   - `@/stores/render-helpers` → resolveBeat, isBarEmptyAllTracks are vi.fn()
 *   - `@/stores/render-store`   → usePlayerStore with configurable getState/setState
 *
 * The real Y.Doc layer (schema.ts) is NOT mocked.
 * Engine mocks are defined in each test file using vi.mock("@/core/engine", ...)
 * with refs on globalThis.__testEngineRefs for hoisting compatibility.
 */

import { vi, expect } from "vitest";
import * as Y from "yjs";
import type { TFunction } from "i18next";
import type { ActionExecutionContext } from "@/actions/types";
import type { SelectedBeat, SelectionRange } from "@/core/engine";
import {
  initializeScore,
  snapshotScore,
} from "@/core/schema";
import type { ScoreSchema } from "@/core/schema";
import {
  createMasterBar,
  createTrack,
  createStaff,
  createNote,
  createBeat,
  createBar,
  createVoice,
} from "@/core/schema";

// ─── Real Y.Doc lifecycle (used by test helpers) ─────────────────────────────

let _doc: Y.Doc | null = null;
let _scoreMap: Y.Map<unknown> | null = null;
let _undoManager: Y.UndoManager | null = null;

function initDoc(): void {
  if (_engineRefs.doc) return;
  _engineRefs.doc = new Y.Doc();
  _engineRefs.scoreMap = initializeScore(_engineRefs.doc);
  _engineRefs.undoManager = new Y.UndoManager([_engineRefs.scoreMap], {
    trackedOrigins: new Set([_engineRefs.doc.clientID]),
  });
  // Also set the old variables for backward compatibility
  _doc = _engineRefs.doc;
  _scoreMap = _engineRefs.scoreMap;
  _undoManager = _engineRefs.undoManager;
}

function destroyDoc(): void {
  if (_engineRefs.undoManager) {
    _engineRefs.undoManager.destroy();
    _engineRefs.undoManager = null;
  }
  if (_engineRefs.doc) {
    _engineRefs.doc.destroy();
    _engineRefs.doc = null;
  }
  _engineRefs.scoreMap = null;
  // Also clear the old variables
  _undoManager = null;
  _doc = null;
  _scoreMap = null;
}

function getDoc(): Y.Doc | null { return _engineRefs.doc; }
function getScoreMap(): Y.Map<unknown> | null { return _engineRefs.scoreMap; }
function getUndoManager(): Y.UndoManager | null { return _engineRefs.undoManager; }
function transact(fn: () => void): void {
  if (!_engineRefs.doc) return;
  _engineRefs.doc.transact(fn, _engineRefs.doc.clientID);
}

// ─── Builder helpers (inline — avoids circular dep with engine mock) ─────────

function pushDefaultBar(
  yBars: Y.Array<Y.Map<unknown>>,
  index?: number,
  clef?: number,
): Y.Map<unknown> {
  const bar = createBar(clef);
  if (index !== undefined) {
    yBars.insert(index, [bar]);
  } else {
    yBars.push([bar]);
  }
  const intBar = yBars.get(index ?? yBars.length - 1);
  const voices = intBar.get("voices") as Y.Array<Y.Map<unknown>>;
  voices.push([createVoice()]);
  const intVoice = voices.get(0);
  (intVoice.get("beats") as Y.Array<Y.Map<unknown>>).push([createBeat()]);
  return intBar;
}

function pushDefaultTrack(
  yTracks: Y.Array<Y.Map<unknown>>,
  yMasterBars: Y.Array<Y.Map<unknown>>,
  name: string = "Track 1",
): { track: Y.Map<unknown>; masterBar: Y.Map<unknown> } {
  yTracks.push([createTrack(name)]);
  const intTrack = yTracks.get(yTracks.length - 1);
  const staves = intTrack.get("staves") as Y.Array<Y.Map<unknown>>;
  staves.push([createStaff()]);
  const intStaff = staves.get(0);
  const yBars = intStaff.get("bars") as Y.Array<Y.Map<unknown>>;
  pushDefaultBar(yBars);
  yMasterBars.push([createMasterBar()]);
  const intMb = yMasterBars.get(yMasterBars.length - 1);
  return { track: intTrack, masterBar: intMb };
}

// ─── Navigate helpers (inline — avoids circular dep with engine mock) ────────

function _resolveYTrack(trackIndex: number): Y.Map<unknown> | null {
  const sm = _scoreMap;
  if (!sm) return null;
  const tracks = sm.get("tracks") as Y.Array<Y.Map<unknown>> | undefined;
  if (!tracks || trackIndex < 0 || trackIndex >= tracks.length) return null;
  return tracks.get(trackIndex);
}
function _resolveYStaff(trackIndex: number, staffIndex: number): Y.Map<unknown> | null {
  const t = _resolveYTrack(trackIndex); if (!t) return null;
  const staves = t.get("staves") as Y.Array<Y.Map<unknown>>;
  if (!staves || staffIndex < 0 || staffIndex >= staves.length) return null;
  return staves.get(staffIndex);
}
function _resolveYBar(trackIndex: number, staffIndex: number, barIndex: number): Y.Map<unknown> | null {
  const s = _resolveYStaff(trackIndex, staffIndex); if (!s) return null;
  const bars = s.get("bars") as Y.Array<Y.Map<unknown>>;
  if (!bars || barIndex < 0 || barIndex >= bars.length) return null;
  return bars.get(barIndex);
}
function _resolveYVoice(trackIndex: number, staffIndex: number, barIndex: number, voiceIndex: number): Y.Map<unknown> | null {
  const b = _resolveYBar(trackIndex, staffIndex, barIndex); if (!b) return null;
  const voices = b.get("voices") as Y.Array<Y.Map<unknown>>;
  if (!voices || voiceIndex < 0 || voiceIndex >= voices.length) return null;
  return voices.get(voiceIndex);
}
function _resolveYBeat(trackIndex: number, staffIndex: number, barIndex: number, voiceIndex: number, beatIndex: number): Y.Map<unknown> | null {
  const v = _resolveYVoice(trackIndex, staffIndex, barIndex, voiceIndex); if (!v) return null;
  const beats = v.get("beats") as Y.Array<Y.Map<unknown>>;
  if (!beats || beatIndex < 0 || beatIndex >= beats.length) return null;
  return beats.get(beatIndex);
}
function _resolveYNote(trackIndex: number, staffIndex: number, barIndex: number, voiceIndex: number, beatIndex: number, noteIndex: number): Y.Map<unknown> | null {
  const b = _resolveYBeat(trackIndex, staffIndex, barIndex, voiceIndex, beatIndex); if (!b) return null;
  const notes = b.get("notes") as Y.Array<Y.Map<unknown>>;
  if (!notes || noteIndex < 0 || noteIndex >= notes.length) return null;
  return notes.get(noteIndex);
}
function _resolveYMasterBar(barIndex: number): Y.Map<unknown> | null {
  const sm = _scoreMap;
  if (!sm) return null;
  const masterBars = sm.get("masterBars") as Y.Array<Y.Map<unknown>> | undefined;
  if (!masterBars || barIndex < 0 || barIndex >= masterBars.length) return null;
  return masterBars.get(barIndex);
}

// ─── Mock state (on globalThis so hoisted vi.mock factories share the same refs) ──

interface TestMockState {
  selectedBeat: SelectedBeat | null;
  selectionRange: SelectionRange | null;
  selectedNoteIndex: number;
  visibleTrackIndices: number[];
  addTrackDialogOpen: boolean;
  storeOverrides: Record<string, unknown>;
  mockApiScore: unknown;
  integrationApi: { load: ReturnType<typeof vi.fn>; settings: unknown } | null;
}

const _mockState = ((globalThis as Record<string, unknown>).__testMockState ??= {
  selectedBeat: null,
  selectionRange: null,
  selectedNoteIndex: -1,
  visibleTrackIndices: [0],
  addTrackDialogOpen: false,
  storeOverrides: {},
  mockApiScore: null,
  integrationApi: null,
}) as TestMockState;

// Convenience aliases for backward compat within this file
const _ms = () => (globalThis as Record<string, unknown>).__testMockState as TestMockState;

// ─── Module mocks (call before importing action modules) ─────────────────────

vi.mock("@/stores/render-api", () => {
  const ms = () => (globalThis as Record<string, unknown>).__testMockState as TestMockState | undefined;
  return {
    getApi: vi.fn(() => {
      const s = ms();
      if (s?.integrationApi) {
        return {
          score: null,
          settings: s.integrationApi.settings,
          load: s.integrationApi.load,
          render: vi.fn(),
          renderTracks: vi.fn(),
        };
      }
      return s?.mockApiScore
        ? {
            score: s.mockApiScore,
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
  };
});

vi.mock("@/stores/render-helpers", () => ({
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

// ─── Mutable refs for engine mock (avoids hoisting issues) ──────────────────
// Use globalThis so the mock factory and test helpers share the same object
const _engineRefs = ((globalThis as Record<string, unknown>).__testEngineRefs ??= {
  doc: null as Y.Doc | null,
  scoreMap: null as Y.Map<unknown> | null,
  undoManager: null as Y.UndoManager | null,
}) as {
  doc: Y.Doc | null;
  scoreMap: Y.Map<unknown> | null;
  undoManager: Y.UndoManager | null;
};


vi.mock("@/stores/editor-store", () => {
  const ms = () => (globalThis as Record<string, unknown>).__testMockState as Record<string, unknown> | undefined;
  return {
    useEditorStore: {
      getState: vi.fn(() => {
        const s = ms();
        return {
          selectedBeat: s?.selectedBeat ?? null,
          selectionRange: s?.selectionRange ?? null,
          selectedNoteIndex: s?.selectedNoteIndex ?? -1,
          canUndo: false,
          canRedo: false,
          connected: false,
          roomCode: null,
          peers: [],
          connectionStatus: "idle",
          connectionError: null,
          userName: "",
        };
      }),
      setState: vi.fn((partial: Record<string, unknown>) => {
        const s = ms();
        if (!s) return;
        if ("selectedBeat" in partial) s.selectedBeat = partial.selectedBeat;
        if ("selectionRange" in partial) s.selectionRange = partial.selectionRange;
        if ("selectedNoteIndex" in partial) s.selectedNoteIndex = partial.selectedNoteIndex;
      }),
      subscribe: vi.fn(() => vi.fn()),
    },
  };
});

vi.mock("@/stores/render-store", () => {
  const ms = () => (globalThis as Record<string, unknown>).__testMockState as TestMockState;
  const mockSetState = vi.fn((partial: Record<string, unknown>) => {
    const s = ms();
    if ("selectedBeat" in partial) s.selectedBeat = partial.selectedBeat as SelectedBeat | null;
    if ("selectionRange" in partial) s.selectionRange = partial.selectionRange as SelectionRange | null;
    if ("selectedNoteIndex" in partial) s.selectedNoteIndex = partial.selectedNoteIndex as number;
    if ("visibleTrackIndices" in partial) s.visibleTrackIndices = partial.visibleTrackIndices as number[];
    if ("addTrackDialogOpen" in partial) s.addTrackDialogOpen = partial.addTrackDialogOpen as boolean;
    if ("playerState" in partial) s.storeOverrides.playerState = partial.playerState;
    if ("currentTime" in partial) s.storeOverrides.currentTime = partial.currentTime;
    if ("zoom" in partial) s.storeOverrides.zoom = partial.zoom;
    if ("showSnapGrid" in partial) s.storeOverrides.showSnapGrid = partial.showSnapGrid;
    if ("sidebarVisible" in partial) s.storeOverrides.sidebarVisible = partial.sidebarVisible;
    if ("editorMode" in partial) s.storeOverrides.editorMode = partial.editorMode;
    Object.assign(s.storeOverrides, partial);
  });
  const mockGetState = vi.fn(() => {
    const s = ms();
    return {
      selectedBeat: s.selectedBeat,
      selectionRange: s.selectionRange,
      selectedNoteIndex: s.selectedNoteIndex,
      visibleTrackIndices: s.visibleTrackIndices,
      editorMode: s.storeOverrides.editorMode ?? "essentials",
      roomDialogOpen: false,
      addTrackDialogOpen: s.addTrackDialogOpen,
      zoom: s.storeOverrides.zoom ?? 1.0,
      showSnapGrid: s.storeOverrides.showSnapGrid ?? false,
      sidebarVisible: s.storeOverrides.sidebarVisible ?? true,
      playerState: s.storeOverrides.playerState ?? "stopped",
      currentTime: s.storeOverrides.currentTime ?? 0,
      ...s.storeOverrides,
    };
  });
  const mockSubscribe = vi.fn(() => vi.fn());
  const mockGetInitialState = vi.fn(() => ({}));

  return {
    usePlayerStore: Object.assign(
      vi.fn(() => mockGetState()),
      {
        getState: mockGetState,
        setState: mockSetState,
        subscribe: mockSubscribe,
        getInitialState: mockGetInitialState,
      }
    ),
  };
});

vi.mock("@/stores/render-internals", () => {
  const ms = () => (globalThis as Record<string, unknown>).__testMockState as TestMockState | undefined;
  return {
    // re-exports from render-api
    getApi: vi.fn(() => {
      const s = ms();
      if (s?.integrationApi) {
        return {
          score: null,
          settings: s.integrationApi.settings,
          load: s.integrationApi.load,
          render: vi.fn(),
          renderTracks: vi.fn(),
        };
      }
      return s?.mockApiScore
        ? {
            score: s.mockApiScore,
            settings: { notation: {}, display: {}, player: {} },
            load: vi.fn(),
            render: vi.fn(),
            renderTracks: vi.fn(),
          }
        : null;
    }),
    setPendingSelection: vi.fn(),
    getTrack: vi.fn(() => null),
    // re-exports from render-helpers
    resolveBeat: vi.fn(() => null),
    isBarEmptyAllTracks: vi.fn(() => true),
    applyBarWarningStyles: vi.fn(),
    createTrackFromPreset: vi.fn(),
    insertBarAtIndex: vi.fn(),
    extractTrackInfo: vi.fn(() => ({})),
    extractStaffInfo: vi.fn(() => ({})),
    extractVoiceInfo: vi.fn(() => ({})),
    extractBarInfo: vi.fn(() => ({})),
    formatPitch: vi.fn((o: number, t: number) => `${t}/${o}`),
    snapPositionToPitch: vi.fn((_clef: number, pos: number) => ({
      octave: 4,
      tone: pos,
    })),
    // re-exports from snap-grid
    getSnapGrids: vi.fn(() => new Map()),
    updateSnapGridOverlay: vi.fn(),
    // re-exports from percussion-data
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
    // re-exports from render-types
    QUARTER_TICKS: 960,
    TRACK_PRESETS: [],
    SCORE_FIELD_TO_STATE: {},
  };
});

vi.mock("@/core/editor/action-log", () => ({
  debugLog: vi.fn(),
}));

vi.mock("y-webrtc", () => ({
  WebrtcProvider: vi.fn(),
}));

vi.mock("y-indexeddb", () => ({
  IndexeddbPersistence: vi.fn(),
}));

// Note: @coderline/alphatab and @/core/converters are NOT mocked here.
// Converters have their own test files that need real implementations.
// Action tests import these through the engine or local mocks as needed.

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
  _mockState.selectedBeat = sel;
}

export function setSelectionRange(range: SelectionRange | null): void {
  _mockState.selectionRange = range;
}

export function setSelectedNoteIndex(idx: number): void {
  _mockState.selectedNoteIndex = idx;
}

export function setMockApiScore(score: unknown): void {
  _mockState.mockApiScore = score;
}

export function clearMockApiScore(): void {
  _mockState.mockApiScore = null;
}

/**
 * Set getApi() to return an API with real Settings and a load spy.
 * Used by action-alphatab-integration tests to verify rebuildFromYDoc → api.load.
 */
export function setIntegrationApi(api: {
  load: ReturnType<typeof vi.fn>;
  settings: unknown;
}): void {
  _mockState.integrationApi = api;
}

export function clearIntegrationApi(): void {
  _mockState.integrationApi = null;
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
  _mockState.selectedBeat = null;
  _mockState.selectionRange = null;
  _mockState.selectedNoteIndex = -1;
  _mockState.visibleTrackIndices = [0];
  _mockState.addTrackDialogOpen = false;
  _mockState.mockApiScore = null;
  _mockState.integrationApi = null;
  for (const key of Object.keys(_mockState.storeOverrides)) {
    delete _mockState.storeOverrides[key];
  }
}

export {
  getDoc,
  getScoreMap,
  getUndoManager,
  destroyDoc,
  initDoc,
  transact,
  // Local builder helpers (used by mock, not EditorEngine static methods)
  pushDefaultBar as pushDefaultBarHelper,
  pushDefaultTrack as pushDefaultTrackHelper,
  createMasterBar,
  createTrack,
  createStaff,
  createNote,
  createBeat,
  // Navigator helpers for tests that bypass the engine mock
  _resolveYTrack as resolveYTrackHelper,
  _resolveYStaff as resolveYStaffHelper,
  _resolveYBar as resolveYBarHelper,
  _resolveYVoice as resolveYVoiceHelper,
  _resolveYBeat as resolveYBeatHelper,
  _resolveYNote as resolveYNoteHelper,
  _resolveYMasterBar as resolveYMasterBarHelper,
};
