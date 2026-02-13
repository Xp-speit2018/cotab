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

import type {
  AccentuationType,
  BendType,
  BendStyle,
  VibratoType,
  SlideInType,
  SlideOutType,
  HarmonicType,
  Fingers,
  NoteAccidentalMode,
  NoteOrnament,
  Duration,
  DynamicValue,
  GraceType,
  PickStroke,
  BrushType,
  CrescendoType,
  FadeType,
  WhammyType,
  GolpeType,
  WahPedal,
  FermataType,
  Ottavia,
  TripletFeel,
  KeySignatureType,
  BendPointSchema,
} from "@/core/schema";

// ─── Internal State ──────────────────────────────────────────────────────────

let api: alphaTab.AlphaTabApi | null = null;

/**
 * Captures the last mousedown coordinates (in AlphaTab rendering space)
 * so the beatMouseDown handler can use boundsLookup for precise per-track
 * and per-note resolution.  AlphaTab's built-in beat/note events sometimes
 * resolve to the wrong track in multi-track horizontal layout.
 */
let lastMouseDownX = 0;
let lastMouseDownY = 0;

/** References to DOM elements needed for coordinate conversion. */
let mainElement: HTMLElement | null = null;
let viewportElement: HTMLElement | null = null;

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

// ─── Selected Element Info (read from AlphaTab model) ────────────────────────

export interface SelectedNoteInfo {
  index: number;
  fret: number;
  string: number;
  isDead: boolean;
  isGhost: boolean;
  isStaccato: boolean;
  isLetRing: boolean;
  isPalmMute: boolean;
  isTieDestination: boolean;
  isHammerPullOrigin: boolean;
  isLeftHandTapped: boolean;
  accentuated: AccentuationType;
  vibrato: VibratoType;
  slideInType: SlideInType;
  slideOutType: SlideOutType;
  harmonicType: HarmonicType;
  harmonicValue: number;
  bendType: BendType;
  bendStyle: BendStyle;
  bendPoints: BendPointSchema[];
  leftHandFinger: Fingers;
  rightHandFinger: Fingers;
  dynamics: DynamicValue;
  ornament: NoteOrnament;
  accidentalMode: NoteAccidentalMode;
  trillValue: number;
  trillSpeed: Duration;
  durationPercent: number;
}

export interface SelectedBeatInfo {
  index: number;
  duration: Duration;
  dots: number;
  isRest: boolean;
  isEmpty: boolean;
  tupletNumerator: number;
  tupletDenominator: number;
  graceType: GraceType;
  pickStroke: PickStroke;
  brushType: BrushType;
  dynamics: DynamicValue;
  crescendo: CrescendoType;
  vibrato: VibratoType;
  fade: FadeType;
  ottava: Ottavia;
  golpe: GolpeType;
  wahPedal: WahPedal;
  whammyBarType: WhammyType;
  whammyBarPoints: BendPointSchema[];
  text: string | null;
  chordId: string | null;
  tap: boolean;
  slap: boolean;
  pop: boolean;
  slashed: boolean;
  hasFermata: boolean;
  fermataType: FermataType | null;
  notes: SelectedNoteInfo[];
}

export interface SelectedBarInfo {
  index: number;
  timeSignatureNumerator: number;
  timeSignatureDenominator: number;
  keySignature: number;
  keySignatureType: KeySignatureType;
  isRepeatStart: boolean;
  repeatCount: number;
  alternateEndings: number;
  tripletFeel: TripletFeel;
  isFreeTime: boolean;
  isDoubleBar: boolean;
  hasSection: boolean;
  sectionText: string;
  sectionMarker: string;
  tempo: number | null;
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
  /** Detailed note-level properties of the selected beat's notes (from AlphaTab model). */
  selectedBeatInfo: SelectedBeatInfo | null;
  /** Detailed bar-level properties of the selected bar (from AlphaTab model). */
  selectedBarInfo: SelectedBarInfo | null;
  /** Index into selectedBeatInfo.notes[] for the actively selected note, or -1 if none. */
  selectedNoteIndex: number;

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

/** Extract detailed note info from an AlphaTab Note model object. */
function extractNoteInfo(note: alphaTab.model.Note): SelectedNoteInfo {
  return {
    index: note.index,
    fret: note.fret,
    string: note.string,
    isDead: note.isDead,
    isGhost: note.isGhost,
    isStaccato: note.isStaccato,
    isLetRing: note.isLetRing,
    isPalmMute: note.isPalmMute,
    isTieDestination: note.isTieDestination,
    isHammerPullOrigin: note.isHammerPullOrigin,
    isLeftHandTapped: note.isLeftHandTapped,
    accentuated: note.accentuated as unknown as AccentuationType,
    vibrato: note.vibrato as unknown as VibratoType,
    slideInType: note.slideInType as unknown as SlideInType,
    slideOutType: note.slideOutType as unknown as SlideOutType,
    harmonicType: note.harmonicType as unknown as HarmonicType,
    harmonicValue: note.harmonicValue,
    bendType: note.bendType as unknown as BendType,
    bendStyle: note.bendStyle as unknown as BendStyle,
    bendPoints: note.bendPoints
      ? note.bendPoints.map((p) => ({ offset: p.offset, value: p.value }))
      : [],
    leftHandFinger: note.leftHandFinger as unknown as Fingers,
    rightHandFinger: note.rightHandFinger as unknown as Fingers,
    dynamics: note.dynamics as unknown as DynamicValue,
    ornament: note.ornament as unknown as NoteOrnament,
    accidentalMode: note.accidentalMode as unknown as NoteAccidentalMode,
    trillValue: note.trillValue,
    trillSpeed: note.trillSpeed as unknown as Duration,
    durationPercent: note.durationPercent,
  };
}

/** Extract detailed beat info from an AlphaTab Beat model object. */
function extractBeatInfo(beat: alphaTab.model.Beat): SelectedBeatInfo {
  const fermata = beat.fermata;
  return {
    index: beat.index,
    duration: beat.duration as unknown as Duration,
    dots: beat.dots,
    isRest: beat.isRest,
    isEmpty: beat.isEmpty,
    tupletNumerator: beat.tupletNumerator,
    tupletDenominator: beat.tupletDenominator,
    graceType: beat.graceType as unknown as GraceType,
    pickStroke: beat.pickStroke as unknown as PickStroke,
    brushType: beat.brushType as unknown as BrushType,
    dynamics: beat.dynamics as unknown as DynamicValue,
    crescendo: beat.crescendo as unknown as CrescendoType,
    vibrato: beat.vibrato as unknown as VibratoType,
    fade: beat.fade as unknown as FadeType,
    ottava: beat.ottava as unknown as Ottavia,
    golpe: beat.golpe as unknown as GolpeType,
    wahPedal: beat.wahPedal as unknown as WahPedal,
    whammyBarType: beat.whammyBarType as unknown as WhammyType,
    whammyBarPoints: beat.whammyBarPoints
      ? beat.whammyBarPoints.map((p) => ({ offset: p.offset, value: p.value }))
      : [],
    text: beat.text ?? null,
    chordId: beat.chordId ?? null,
    tap: beat.tap,
    slap: beat.slap,
    pop: beat.pop,
    slashed: beat.slashed,
    hasFermata: fermata !== null,
    fermataType: fermata ? (fermata.type as unknown as FermataType) : null,
    notes: beat.notes.map(extractNoteInfo),
  };
}

/** Extract detailed bar info from an AlphaTab Bar + MasterBar. */
function extractBarInfo(bar: alphaTab.model.Bar): SelectedBarInfo {
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
  selectedBeatInfo: null,
  selectedBarInfo: null,
  selectedNoteIndex: -1,
  zoom: 1,

  // ── Lifecycle ────────────────────────────────────────────────────────────

  initialize: (mainEl, viewportEl) => {
    // Tear down any previous instance
    get().destroy();

    set({ isLoading: true });

    mainElement = mainEl;
    viewportElement = viewportEl;

    const settings = new alphaTab.Settings();
    settings.core.fontDirectory = "/font/";
    settings.core.includeNoteBounds = true; // Enable per-note hit testing
    settings.player.enablePlayer = true;
    settings.player.soundFont = "/soundfont/sonivox.sf2";
    settings.player.scrollElement = viewportEl;
    settings.player.enableCursor = true;
    settings.player.enableElementHighlighting = true;
    settings.player.enableUserInteraction = true;
    settings.display.layoutMode = alphaTab.LayoutMode.Horizontal;

    api = new alphaTab.AlphaTabApi(mainEl, settings);

    // ── Capture mousedown coordinates for custom hit-testing ─────────
    // AlphaTab's beatMouseDown/noteMouseDown events don't always resolve
    // to the correct track in multi-track horizontal layout.  We capture
    // coordinates here and use boundsLookup in the beatMouseDown handler
    // for accurate per-track resolution.
    const onMouseDown = (e: MouseEvent) => {
      if (!api || !mainElement) return;
      // .at-main's getBoundingClientRect already accounts for the viewport
      // scroll, so we just need the offset from its top-left corner,
      // divided by the display scale.
      const rect = mainElement.getBoundingClientRect();
      const scale = api.settings.display.scale;
      lastMouseDownX = (e.clientX - rect.left) / scale;
      lastMouseDownY = (e.clientY - rect.top) / scale;
    };
    viewportEl.addEventListener("mousedown", onMouseDown, { capture: true });

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

    // ── Note-level selection via boundsLookup ───────────────────────────
    // AlphaTab's beatMouseDown/noteMouseDown sometimes resolve to the
    // wrong track in multi-track horizontal layout.  We use the captured
    // mousedown coordinates + boundsLookup for accurate per-track,
    // per-note resolution.  AlphaTab's event is still used as the trigger
    // and as a fallback if boundsLookup fails.

    api.beatMouseDown.on((eventBeat: alphaTab.model.Beat) => {
      let targetBeat = eventBeat;
      let noteIndex = -1;
      let hitSource = "event";

      // ── Custom per-track hit-testing ───────────────────────────────
      // AlphaTab's getBeatAtPos() ignores Y in horizontal layout, so we
      // walk the boundsLookup structure manually for correct per-track
      // resolution.
      const lookup = api?.boundsLookup;
      if (lookup) {
        const x = lastMouseDownX;
        const y = lastMouseDownY;

        // 1. Find the staff system that contains the Y position
        for (const system of lookup.staffSystems) {
          const sb = system.realBounds;
          if (y < sb.y || y > sb.y + sb.h) continue;

          // 2. Find the master bar whose X range contains the click
          for (const masterBar of system.bars) {
            const mb = masterBar.realBounds;
            if (x < mb.x || x > mb.x + mb.w) continue;

            // 3. Find the bar (= track) whose Y range contains the click
            for (const barBounds of masterBar.bars) {
              const bb = barBounds.realBounds;
              if (y < bb.y || y > bb.y + bb.h) continue;

              // 4. Find the beat whose X range contains the click
              let bestBeat: alphaTab.model.Beat | null = null;
              let bestNote: alphaTab.model.Note | null = null;
              let bestBeatDist = Infinity;

              for (const beatBounds of barBounds.beats) {
                const bx = beatBounds.realBounds;
                const dist = Math.abs(
                  x - (bx.x + bx.w / 2),
                );
                if (dist < bestBeatDist) {
                  bestBeatDist = dist;
                  bestBeat = beatBounds.beat;

                  // 5. Check for per-note hit within this beat
                  bestNote = null;
                  if (beatBounds.notes) {
                    const noteHit = beatBounds.findNoteAtPos(x, y);
                    if (noteHit) bestNote = noteHit;
                  }
                }
              }

              if (bestBeat) {
                targetBeat = bestBeat;
                hitSource = "bounds";
                if (bestNote) {
                  noteIndex = bestBeat.notes.indexOf(bestNote);
                  if (noteIndex < 0) noteIndex = 0;
                  hitSource = "note";
                } else if (bestBeat.notes.length > 0) {
                  noteIndex = 0;
                }
              }
              break; // found the matching bar
            }
            break; // found the matching master bar
          }
          break; // found the matching system
        }
      }

      // Fallback: if custom hit-testing didn't resolve, use the event beat
      if (hitSource === "event" && targetBeat.notes.length > 0) {
        noteIndex = 0;
      }

      // Expose debug info for e2e tests
      if (import.meta.env.DEV) {
        const bar = targetBeat.voice.bar;
        (window as unknown as Record<string, unknown>).__SELECTION_DEBUG__ = {
          mouseX: lastMouseDownX,
          mouseY: lastMouseDownY,
          hitSource,
          trackIndex: bar.staff.track.index,
          barIndex: bar.index,
          beatIndex: targetBeat.index,
          noteCount: targetBeat.notes.length,
          noteIndex,
        };
      }

      const bar = targetBeat.voice.bar;
      set({
        selectedBeat: {
          trackIndex: bar.staff.track.index,
          barIndex: bar.index,
          beatIndex: targetBeat.index,
        },
        selectedBeatInfo: extractBeatInfo(targetBeat),
        selectedBarInfo: extractBarInfo(bar),
        selectedNoteIndex: noteIndex,
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
    mainElement = null;
    viewportElement = null;
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
      selectedBeatInfo: null,
      selectedBarInfo: null,
      selectedNoteIndex: -1,
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

// Expose store on window for e2e diagnostics (dev only)
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__PLAYER_STORE__ =
    usePlayerStore;
}
