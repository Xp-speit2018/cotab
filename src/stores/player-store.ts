/**
 * player-store.ts — Zustand store wrapping the AlphaTab API.
 *
 * Follows the same module-level imperative pattern as core/store.ts:
 * a module-scoped `api` reference, with AlphaTab events wired into
 * reactive Zustand state. Components read via selectors and dispatch
 * actions through store methods.
 *
 * Track visibility: AlphaTab is the single source of truth.
 * `visibleTrackIndices` is derived from `api.tracks` on every
 * renderFinished. `setTrackVisible` tells AlphaTab what to render;
 * the event flow updates our state automatically.
 */

import * as alphaTab from "@coderline/alphatab";
import { create } from "zustand";

// ─── Internal State ──────────────────────────────────────────────────────────

let api: alphaTab.AlphaTabApi | null = null;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TrackInfo {
  index: number;
  name: string;
  volume: number;
  isMuted: boolean;
  isSolo: boolean;
}

export interface SelectedBeat {
  trackIndex: number;
  barIndex: number;
  beatIndex: number;
}

export interface TrackBounds {
  y: number;
  height: number;
}

export interface PlayerState {
  // Loading
  isLoading: boolean;
  isPlayerReady: boolean;
  soundFontProgress: number;

  // Playback
  playerState: "stopped" | "playing" | "paused";
  currentTime: number;
  endTime: number;
  playbackSpeed: number;
  isLooping: boolean;
  masterVolume: number;

  // Score info
  scoreTitle: string;
  scoreArtist: string;

  // Tracks
  tracks: TrackInfo[];
  /** Derived from api.tracks on every renderFinished — single source of truth. */
  visibleTrackIndices: number[];
  trackBounds: TrackBounds[];

  // Cursors
  selectedBeat: SelectedBeat | null;

  // View
  zoom: number;

  // Actions
  initialize: (mainEl: HTMLElement, viewportEl: HTMLElement) => void;
  destroy: () => void;
  loadFile: (data: File | ArrayBuffer | Uint8Array) => void;
  loadUrl: (url: string) => void;
  playPause: () => void;
  stop: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setMasterVolume: (volume: number) => void;
  toggleLoop: () => void;
  setTrackVolume: (trackIndex: number, volume: number) => void;
  setTrackMute: (trackIndex: number, muted: boolean) => void;
  setTrackSolo: (trackIndex: number, solo: boolean) => void;
  setTrackVisible: (trackIndex: number, visible: boolean) => void;
  setZoom: (zoom: number) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTrack(index: number): alphaTab.model.Track | undefined {
  return api?.score?.tracks[index];
}

/** Read which track indices AlphaTab is currently rendering. */
function readVisibleIndices(): number[] {
  if (!api?.tracks) return [];
  return api.tracks.map((t) => t.index);
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const usePlayerStore = create<PlayerState>((set, get) => ({
  // Initial state
  isLoading: false,
  isPlayerReady: false,
  soundFontProgress: 0,
  playerState: "stopped",
  currentTime: 0,
  endTime: 0,
  playbackSpeed: 1,
  isLooping: false,
  masterVolume: 1,
  scoreTitle: "",
  scoreArtist: "",
  tracks: [],
  visibleTrackIndices: [],
  trackBounds: [],
  selectedBeat: null,
  zoom: 1,

  // ── Lifecycle ────────────────────────────────────────────────────────────

  initialize: (mainEl, viewportEl) => {
    // Tear down any previous instance
    get().destroy();

    set({ isLoading: true });

    const settings = new alphaTab.Settings();
    settings.core.fontDirectory = "/font/";
    settings.player.enablePlayer = true;
    settings.player.soundFont = "/soundfont/sonivox.sf2";
    settings.player.scrollElement = viewportEl;
    settings.player.enableCursor = true;
    settings.player.enableElementHighlighting = true;
    settings.player.enableUserInteraction = true;
    settings.display.layoutMode = alphaTab.LayoutMode.Horizontal;

    api = new alphaTab.AlphaTabApi(mainEl, settings);

    // ── Wire Events ──────────────────────────────────────────────────────

    api.renderStarted.on(() => {
      set({ isLoading: true });
    });

    // IMPORTANT: use postRenderFinished, NOT renderFinished.
    // boundsLookup is only guaranteed populated after postRenderFinished.
    // Using renderFinished causes a "one step behind" bug where trackBounds
    // contains data from the previous render.
    api.postRenderFinished.on(() => {
      // 1. Derive visibility from AlphaTab (single source of truth)
      const visibleTrackIndices = readVisibleIndices();

      // 2. Extract per-track Y positions from boundsLookup
      const lookup = api?.boundsLookup;
      const newTrackBounds: TrackBounds[] = [];
      if (lookup && lookup.staffSystems.length > 0) {
        const firstSystem = lookup.staffSystems[0];
        if (firstSystem.bars.length > 0) {
          const firstMasterBar = firstSystem.bars[0];
          for (const barBounds of firstMasterBar.bars) {
            newTrackBounds.push({
              y: barBounds.realBounds.y,
              height: barBounds.realBounds.h,
            });
          }
        }
      }

      set({
        isLoading: false,
        visibleTrackIndices,
        trackBounds: newTrackBounds,
      });
    });

    api.scoreLoaded.on((score: alphaTab.model.Score) => {
      const existing = get().tracks;
      const tracks: TrackInfo[] = score.tracks.map((t, i) => ({
        index: i,
        name: t.name,
        volume: existing[i]?.volume ?? 1,
        isMuted: existing[i]?.isMuted ?? false,
        isSolo: existing[i]?.isSolo ?? false,
      }));

      set({
        scoreTitle: score.title || "Untitled",
        scoreArtist: score.artist || "",
        tracks,
      });

      // Render ALL tracks by default so visibility list matches
      api!.renderTracks(score.tracks);
    });

    api.playerReady.on(() => {
      set({ isPlayerReady: true });
    });

    api.soundFontLoad.on((e: alphaTab.ProgressEventArgs) => {
      const progress = e.total > 0 ? e.loaded / e.total : 0;
      set({ soundFontProgress: progress });
    });

    api.playerStateChanged.on(
      (e: alphaTab.synth.PlayerStateChangedEventArgs) => {
        const state =
          e.state === alphaTab.synth.PlayerState.Playing
            ? "playing"
            : "paused";
        set({ playerState: state });
      },
    );

    api.playerPositionChanged.on(
      (e: alphaTab.synth.PositionChangedEventArgs) => {
        set({
          currentTime: e.currentTime,
          endTime: e.endTime,
        });
      },
    );

    api.playerFinished.on(() => {
      set({ playerState: "stopped", currentTime: 0 });
    });

    api.beatMouseDown.on((beat: alphaTab.model.Beat) => {
      set({
        selectedBeat: {
          trackIndex: beat.voice.bar.staff.track.index,
          barIndex: beat.voice.bar.index,
          beatIndex: beat.index,
        },
      });
    });

    // Load the demo file
    api.load("/demos/Taijin_kyofusho.gp");
  },

  destroy: () => {
    if (api) {
      api.destroy();
      api = null;
    }
    set({
      isLoading: false,
      isPlayerReady: false,
      soundFontProgress: 0,
      playerState: "stopped",
      currentTime: 0,
      endTime: 0,
      scoreTitle: "",
      scoreArtist: "",
      tracks: [],
      visibleTrackIndices: [],
      trackBounds: [],
      selectedBeat: null,
    });
  },

  // ── File Loading ─────────────────────────────────────────────────────────

  loadFile: (data) => {
    if (!api) return;
    if (data instanceof File) {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          api!.load(new Uint8Array(reader.result));
        }
      };
      reader.readAsArrayBuffer(data);
    } else {
      api.load(data instanceof ArrayBuffer ? new Uint8Array(data) : data);
    }
  },

  loadUrl: (url) => {
    if (!api) return;
    api.load(url);
  },

  // ── Playback Controls ────────────────────────────────────────────────────

  playPause: () => {
    api?.playPause();
  },

  stop: () => {
    api?.stop();
    set({ playerState: "stopped", currentTime: 0 });
  },

  setPlaybackSpeed: (speed) => {
    if (!api) return;
    api.playbackSpeed = speed;
    set({ playbackSpeed: speed });
  },

  setMasterVolume: (volume) => {
    if (!api) return;
    api.masterVolume = volume;
    set({ masterVolume: volume });
  },

  toggleLoop: () => {
    if (!api) return;
    const newLooping = !get().isLooping;
    api.isLooping = newLooping;
    set({ isLooping: newLooping });
  },

  // ── Track Controls ───────────────────────────────────────────────────────

  setTrackVolume: (trackIndex, volume) => {
    const track = getTrack(trackIndex);
    if (!api || !track) return;
    api.changeTrackVolume([track], volume);
    set({
      tracks: get().tracks.map((t) =>
        t.index === trackIndex ? { ...t, volume } : t,
      ),
    });
  },

  setTrackMute: (trackIndex, muted) => {
    const track = getTrack(trackIndex);
    if (!api || !track) return;
    api.changeTrackMute([track], muted);
    set({
      tracks: get().tracks.map((t) =>
        t.index === trackIndex ? { ...t, isMuted: muted } : t,
      ),
    });
  },

  setTrackSolo: (trackIndex, solo) => {
    const track = getTrack(trackIndex);
    if (!api || !track) return;
    api.changeTrackSolo([track], solo);
    set({
      tracks: get().tracks.map((t) =>
        t.index === trackIndex ? { ...t, isSolo: solo } : t,
      ),
    });
  },

  setTrackVisible: (trackIndex, visible) => {
    if (!api?.score) return;

    // Compute the new set of visible indices
    const current = new Set(get().visibleTrackIndices);
    if (visible) {
      current.add(trackIndex);
    } else {
      current.delete(trackIndex);
    }

    // Must keep at least one track visible
    if (current.size === 0) return;

    // Tell AlphaTab to render exactly these tracks.
    // renderFinished will update visibleTrackIndices + trackBounds.
    const tracksToRender = [...current]
      .sort((a, b) => a - b)
      .map((i) => api!.score!.tracks[i])
      .filter(Boolean);

    api.renderTracks(tracksToRender);
  },

  // ── View Controls ────────────────────────────────────────────────────────

  setZoom: (zoom) => {
    if (!api) return;
    api.settings.display.scale = zoom;
    api.updateSettings();
    api.render();
    set({ zoom });
  },
}));
