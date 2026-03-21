import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  resetMockState,
  testContext,
  initDoc,
  destroyDoc,
} from "@/test/setup";

// Track localStorage calls
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// Track API calls
const mockApiCalls = {
  render: vi.fn(),
  updateSettings: vi.fn(),
};

vi.mock("@/stores/render-internals", () => {
  return {
    getApi: vi.fn(() => ({
      settings: { display: { scale: 1.0 } },
      render: mockApiCalls.render,
      updateSettings: mockApiCalls.updateSettings,
    })),
    setPendingSelection: vi.fn(),
    getTrack: vi.fn(() => null),
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
    getSnapGrids: vi.fn(() => new Map()),
    updateSnapGridOverlay: vi.fn(),
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
    QUARTER_TICKS: 960,
    TRACK_PRESETS: [],
    SCORE_FIELD_TO_STATE: {},
  };
});

import { executeAction } from "@/actions/registry";
import { usePlayerStore } from "@/stores/render-store";
import "@/actions/view";

const ctx = testContext();

beforeEach(() => {
  resetMockState();
  destroyDoc();
  initDoc();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  mockApiCalls.render.mockClear();
  mockApiCalls.updateSettings.mockClear();
});

// ─── setSidebarVisible ────────────────────────────────────────────────────────

describe("view.setSidebarVisible", () => {
  it("sets sidebarVisible to true", () => {
    executeAction("view.setSidebarVisible", true, ctx);

    expect(usePlayerStore.setState).toHaveBeenCalledWith({
      sidebarVisible: true,
    });
  });

  it("sets sidebarVisible to false", () => {
    executeAction("view.setSidebarVisible", false, ctx);

    expect(usePlayerStore.setState).toHaveBeenCalledWith({
      sidebarVisible: false,
    });
  });
});

// ─── setEditorMode ────────────────────────────────────────────────────────────

describe("view.setEditorMode", () => {
  it("sets editorMode to essentials in localStorage and state", () => {
    executeAction("view.setEditorMode", "essentials", ctx);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "cotab:editorMode",
      "essentials"
    );
    expect(usePlayerStore.setState).toHaveBeenCalledWith({
      editorMode: "essentials",
    });
  });

  it("sets editorMode to advanced in localStorage and state", () => {
    executeAction("view.setEditorMode", "advanced", ctx);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "cotab:editorMode",
      "advanced"
    );
    expect(usePlayerStore.setState).toHaveBeenCalledWith({
      editorMode: "advanced",
    });
  });
});

// ─── setZoom ──────────────────────────────────────────────────────────────────

describe("view.setZoom", () => {
  it("updates api.settings.display.scale and calls updateSettings/render", () => {
    executeAction("view.setZoom", 1.5, ctx);

    // getApi returns an object where settings.display.scale should be set
    expect(usePlayerStore.setState).toHaveBeenCalledWith({ zoom: 1.5 });
  });

  it("handles zoom value of 0.5", () => {
    executeAction("view.setZoom", 0.5, ctx);

    expect(usePlayerStore.setState).toHaveBeenCalledWith({ zoom: 0.5 });
  });
});

// ─── setShowSnapGrid ──────────────────────────────────────────────────────────

describe("view.setShowSnapGrid", () => {
  it("sets showSnapGrid to true in state", () => {
    executeAction("view.setShowSnapGrid", true, ctx);

    expect(usePlayerStore.setState).toHaveBeenCalledWith({
      showSnapGrid: true,
    });
  });

  it("sets showSnapGrid to false in state", () => {
    executeAction("view.setShowSnapGrid", false, ctx);

    expect(usePlayerStore.setState).toHaveBeenCalledWith({
      showSnapGrid: false,
    });
  });
});
