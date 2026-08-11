/**
 * Snap grid computation and debug overlay.
 * Depends on player-api (getApi, getMainElement, getViewportElement), player-types (SnapGrid, SnapPosition), percussion-data (GP7_ARTICULATION_MAP).
 */

import { getApi, getMainElement, getViewportElement } from "./render-api";
import { GP7_ARTICULATION_MAP } from "./percussion-data";
import type { RenderedStave, SnapGrid, SnapPosition } from "./render-types";

const snapGrids = new Map<string, SnapGrid>();
const snapGridsByBar = new Map<string, SnapGrid>();
const navigablePositions = new Map<string, number[]>();
let renderedStaveByBarBounds = new WeakMap<object, RenderedStave>();

type CollectedSnapGrid = {
  systemIndex: number;
  trackIndex: number;
  staffIndex: number;
  renderedStave: RenderedStave;
  barIndexes: Set<number>;
  systemBounds: { x: number; y: number; w: number; h: number };
  widths: number[];
  heights: number[];
  kind: "tablature" | "notation" | "percussion";
  barRealBounds: { y: number; h: number } | null;
};

type StaffGeometry = {
  topLineY: number;
  lineSpacing: number;
};

const STANDARD_POSITION_MIN = 1;
const STANDARD_POSITION_MAX = 21;
// Preserve the existing editable drum range, but make it identical for every
// rendered system instead of shifting it around the notes found in that system.
const PERCUSSION_POSITION_MIN = -12;
const PERCUSSION_POSITION_MAX = 23;

let snapGridOverlayContainer: HTMLDivElement | null = null;
let snapGridLabelContainer: HTMLDivElement | null = null;
let snapGridEntries: {
  marker: HTMLElement;
  label: HTMLElement;
  string: number;
  y: number;
  trackIndex: number;
  staffIndex: number;
  renderedStave: RenderedStave;
}[] = [];
let snapGridScrollHandler: (() => void) | null = null;

export function getSnapGrids(): Map<string, SnapGrid> {
  return snapGrids;
}

export function getSnapGridForBar(
  trackIndex: number,
  staffIndex: number,
  barIndex: number,
  renderedStave?: RenderedStave,
): SnapGrid | null {
  if (renderedStave) {
    return snapGridsByBar.get(
      `${trackIndex}:${staffIndex}:${barIndex}:${renderedStave}`,
    ) ?? null;
  }
  return getSnapGridsForBar(trackIndex, staffIndex, barIndex)[0] ?? null;
}

export function getSnapGridsForBar(
  trackIndex: number,
  staffIndex: number,
  barIndex: number,
): SnapGrid[] {
  return (["standard", "tablature"] as const)
    .map((renderedStave) => snapGridsByBar.get(
      `${trackIndex}:${staffIndex}:${barIndex}:${renderedStave}`,
    ))
    .filter((grid): grid is SnapGrid => grid !== undefined);
}

export function getRenderedStaveForBarBounds(
  barBounds: object,
): RenderedStave | null {
  return renderedStaveByBarBounds.get(barBounds) ?? null;
}

/**
 * Get the pre-computed navigable string values for a staff.
 * Returns unique string values in Y-sorted order (top to bottom), or null if grid not built.
 */
export function getNavigablePositions(
  trackIndex: number,
  staffIndex: number,
  renderedStave?: RenderedStave,
): number[] | null {
  if (renderedStave) {
    return navigablePositions.get(
      `${trackIndex}:${staffIndex}:${renderedStave}`,
    ) ?? null;
  }
  return navigablePositions.get(`${trackIndex}:${staffIndex}:standard`)
    ?? navigablePositions.get(`${trackIndex}:${staffIndex}:tablature`)
    ?? null;
}

export function findNearestSnap(grid: SnapGrid, y: number): SnapPosition | null {
  if (grid.positions.length === 0) return null;
  let best: SnapPosition = grid.positions[0];
  let bestDist = Math.abs(y - best.y);
  for (let i = 1; i < grid.positions.length; i++) {
    const d = Math.abs(y - grid.positions[i].y);
    if (d < bestDist) {
      bestDist = d;
      best = grid.positions[i];
    }
  }
  return best;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 10;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function registerSnapGrid(
  entry: CollectedSnapGrid,
  positions: SnapPosition[],
  noteWidth: number,
  noteHeight: number,
  percussionMap?: Map<number, number>,
): void {
  positions.sort((a, b) => a.y - b.y);
  const systemStrings = [...new Set(positions.map((position) => position.string))];
  const barIndexes = [...entry.barIndexes].sort((a, b) => a - b);
  const grid: SnapGrid = {
    systemIndex: entry.systemIndex,
    trackIndex: entry.trackIndex,
    staffIndex: entry.staffIndex,
    renderedStave: entry.renderedStave,
    barIndexes,
    systemBounds: entry.systemBounds,
    positions,
    noteWidth,
    noteHeight,
    percussionMap,
  };

  snapGrids.set(
    `${entry.systemIndex}:${entry.trackIndex}:${entry.staffIndex}:${entry.renderedStave}`,
    grid,
  );
  for (const barIndex of barIndexes) {
    snapGridsByBar.set(
      `${entry.trackIndex}:${entry.staffIndex}:${barIndex}:${entry.renderedStave}`,
      grid,
    );
  }

  const staffKey = `${entry.trackIndex}:${entry.staffIndex}:${entry.renderedStave}`;
  const merged = new Set([
    ...(navigablePositions.get(staffKey) ?? []),
    ...systemStrings,
  ]);
  navigablePositions.set(
    staffKey,
    [...merged].sort(
      entry.kind === "tablature"
        ? (a, b) => b - a
        : (a, b) => a - b,
    ),
  );
}

function getStaffGeometry(
  entry: CollectedSnapGrid,
  lineCount: number,
  staffLineThickness: number,
  fallbackLineSpacing: number,
): StaffGeometry | null {
  const bounds = entry.barRealBounds;
  if (!bounds) return null;
  const heightLineCount = entry.kind === "tablature"
    ? lineCount
    : Math.max(5, lineCount);
  // AlphaTab's LineBarRenderer sets BarBounds.h to the distance covered by
  // heightLineCount and centers reduced-line staves inside that height.
  const lineSpacing = heightLineCount > 1 && bounds.h > 0
    ? bounds.h / (heightLineCount - 1)
    : fallbackLineSpacing;
  const actualLineHeight = Math.max(0, lineCount - 1) * lineSpacing;
  const firstLineOffset = Math.floor((bounds.h - actualLineHeight) / 2);
  return {
    topLineY: bounds.y + firstLineOffset - staffLineThickness / 2,
    lineSpacing,
  };
}

function projectTablaturePositions(
  stringCount: number,
  geometry: StaffGeometry,
): SnapPosition[] {
  return Array.from({ length: stringCount }, (_value, index) => {
    const string = stringCount - index;
    return {
      string,
      y: geometry.topLineY + index * geometry.lineSpacing,
    };
  });
}

function projectNotationPositions(
  geometry: StaffGeometry,
): SnapPosition[] {
  const halfSpace = geometry.lineSpacing / 2;
  return Array.from(
    { length: STANDARD_POSITION_MAX - STANDARD_POSITION_MIN + 1 },
    (_value, index) => {
      const string = STANDARD_POSITION_MIN + index;
      return {
        string,
        y: geometry.topLineY + (string - 7) * halfSpace,
      };
    },
  );
}

function projectPercussionPositions(
  geometry: StaffGeometry,
): SnapPosition[] {
  const halfSpace = geometry.lineSpacing / 2;
  return Array.from(
    { length: PERCUSSION_POSITION_MAX - PERCUSSION_POSITION_MIN + 1 },
    (_value, index) => {
      const string = PERCUSSION_POSITION_MIN + index;
      return {
        string,
        y: geometry.topLineY + string * halfSpace,
      };
    },
  );
}

function buildPercussionMap(
  track: { percussionArticulations?: { id: number }[] },
): Map<number, number> | undefined {
  const articulations = track.percussionArticulations;
  if (!articulations || articulations.length === 0) return undefined;
  const map = new Map<number, number>();
  for (let index = 0; index < articulations.length; index++) {
    const staffLine = GP7_ARTICULATION_MAP.get(articulations[index].id);
    if (
      staffLine !== undefined
      && staffLine >= PERCUSSION_POSITION_MIN
      && staffLine <= PERCUSSION_POSITION_MAX
      && !map.has(staffLine)
    ) {
      map.set(staffLine, index);
    }
  }
  return map.size > 0 ? map : undefined;
}

export function buildSnapGrids(): void {
  snapGrids.clear();
  snapGridsByBar.clear();
  navigablePositions.clear();
  renderedStaveByBarBounds = new WeakMap<object, RenderedStave>();
  const api = getApi();
  const lookup = api?.boundsLookup;
  const score = api?.score;
  if (!lookup || !score || lookup.staffSystems.length === 0) return;

  const collected = new Map<string, CollectedSnapGrid>();
  const canonicalSystemIndexes = new Map<string, number>();

  for (const system of lookup.staffSystems) {
    const firstMasterBarIndex = system.bars[0]?.index ?? -1;
    const lastMasterBarIndex = system.bars.at(-1)?.index ?? -1;
    const systemSignature = [
      firstMasterBarIndex,
      lastMasterBarIndex,
      system.realBounds.x,
      system.realBounds.y,
      system.realBounds.w,
      system.realBounds.h,
    ].join(":");
    let systemIndex = canonicalSystemIndexes.get(systemSignature);
    if (systemIndex === undefined) {
      systemIndex = canonicalSystemIndexes.size;
      canonicalSystemIndexes.set(systemSignature, systemIndex);
    }

    for (const masterBar of system.bars) {
      const groupedBounds = new Map<string, typeof masterBar.bars>();
      for (const barBounds of masterBar.bars) {
        const refBar = barBounds.bar ?? barBounds.beats[0]?.beat.voice.bar;
        if (!refBar) continue;
        const groupKey = [
          refBar.staff.track.index,
          refBar.staff.index,
          refBar.index,
        ].join(":");
        const group = groupedBounds.get(groupKey) ?? [];
        group.push(barBounds);
        groupedBounds.set(groupKey, group);
      }
      // AlphaTab emits one BarBounds per rendered stave, ordered top-to-bottom:
      // standard notation first, then tablature for a dual-notation Staff.
      for (const group of groupedBounds.values()) {
        group.sort((a, b) => a.realBounds.y - b.realBounds.y);
        const refBar = group[0].bar ?? group[0].beats[0]?.beat.voice.bar;
        if (!refBar) continue;
        const staff = score.tracks[refBar.staff.track.index]
          ?.staves[refBar.staff.index];
        const showTablature = staff?.showTablature ?? false;
        const showStandardNotation = staff?.showStandardNotation
          ?? !showTablature;
        for (let index = 0; index < group.length; index++) {
          const renderedStave: RenderedStave = showStandardNotation && showTablature
            ? index === 0 ? "standard" : "tablature"
            : showTablature
              ? "tablature"
              : "standard";
          renderedStaveByBarBounds.set(group[index], renderedStave);
        }
      }

      for (const barBounds of masterBar.bars) {
        const refBar =
          barBounds.bar ?? barBounds.beats[0]?.beat.voice.bar;
        if (!refBar) continue;
        const ti = refBar.staff.track.index;
        const si = refBar.staff.index;
        const renderedStave = renderedStaveByBarBounds.get(barBounds)
          ?? "standard";
        const key = `${systemIndex}:${ti}:${si}:${renderedStave}`;
        let entry = collected.get(key);
        if (!entry) {
          const trackObj = score.tracks[ti];
          const kind = trackObj?.isPercussion
            ? "percussion"
            : renderedStave === "tablature"
              ? "tablature"
              : "notation";
          entry = {
            systemIndex,
            trackIndex: ti,
            staffIndex: si,
            renderedStave,
            barIndexes: new Set(),
            systemBounds: {
              x: system.realBounds.x,
              y: system.realBounds.y,
              w: system.realBounds.w,
              h: system.realBounds.h,
            },
            widths: [],
            heights: [],
            kind,
            barRealBounds: null,
          };
          collected.set(key, entry);
        }

        entry.barIndexes.add(refBar.index);

        if (!entry.barRealBounds) {
          entry.barRealBounds = {
            y: barBounds.realBounds.y,
            h: barBounds.realBounds.h,
          };
        }

        for (const beatBounds of barBounds.beats) {
          if (!beatBounds.notes) continue;
          for (const nb of beatBounds.notes) {
            entry.widths.push(nb.noteHeadBounds.w);
            entry.heights.push(nb.noteHeadBounds.h);
          }
        }
      }
    }
  }

  const eng = api!.settings.display.resources.engravingSettings;
  const tabLineSpacing = eng.tabLineSpacing;
  const oneStaffSpace = eng.oneStaffSpace;
  const slt = eng.staffLineThickness;

  for (const entry of collected.values()) {
    const track = score.tracks[entry.trackIndex];
    if (!track) continue;
    const staff = track.staves[entry.staffIndex];
    if (!staff) continue;

    const medianW = median(entry.widths);
    const medianH = median(entry.heights);
    const lineCount = entry.kind === "tablature"
      ? staff.tuning.length || 6
      : staff.standardNotationLineCount ?? 5;
    const fallbackLineSpacing = entry.kind === "tablature"
      ? tabLineSpacing
      : oneStaffSpace;
    const geometry = getStaffGeometry(
      entry,
      lineCount,
      slt,
      fallbackLineSpacing,
    );
    if (!geometry || !entry.barRealBounds) continue;
    const positions = entry.kind === "tablature"
      ? projectTablaturePositions(
          lineCount,
          geometry,
        )
      : entry.kind === "percussion"
        ? projectPercussionPositions(geometry)
        : projectNotationPositions(geometry);
    const percussionMap = entry.kind === "percussion"
      ? buildPercussionMap(track)
      : undefined;

    registerSnapGrid(
      entry,
      positions,
      medianW > 0 ? medianW : geometry.lineSpacing,
      medianH > 0 ? medianH : geometry.lineSpacing,
      percussionMap,
    );
  }
}

export type SnapGridSelection = {
  selectedString: number | null;
  trackIndex: number | null;
  staffIndex: number | null;
  renderedStave?: RenderedStave | null;
};

/**
 * Update overlay visibility and optionally apply selection dimming.
 * If selection is provided, dimming is applied; otherwise the caller
 * should call setSnapGridSelection afterward.
 */
export function updateSnapGridOverlay(
  show: boolean,
  selection?: SnapGridSelection,
): void {
  const viewportElement = getViewportElement();
  const mainElement = getMainElement();

  if (snapGridOverlayContainer) {
    snapGridOverlayContainer.remove();
    snapGridOverlayContainer = null;
  }
  if (snapGridScrollHandler && viewportElement) {
    viewportElement.removeEventListener("scroll", snapGridScrollHandler);
    snapGridScrollHandler = null;
  }
  if (snapGridLabelContainer) {
    snapGridLabelContainer.remove();
    snapGridLabelContainer = null;
  }
  snapGridEntries = [];

  if (!show || !mainElement) return;

  const cursorsWrapper = mainElement.querySelector(".at-cursors");
  if (!cursorsWrapper) return;

  snapGridOverlayContainer = document.createElement("div");
  snapGridOverlayContainer.classList.add("at-snap-grid-overlay");

  const wrapper = viewportElement?.parentElement;

  if (wrapper && viewportElement) {
    snapGridLabelContainer = document.createElement("div");
    snapGridLabelContainer.classList.add("at-snap-grid-labels");
  }

  for (const grid of snapGrids.values()) {
    for (let i = 0; i < grid.positions.length; i++) {
      const pos = grid.positions[i];
      const isLine = i % 2 === 0;

      const marker = document.createElement("div");
      marker.classList.add("at-snap-grid-marker");
      marker.classList.add(
        isLine ? "at-snap-grid-marker--line" : "at-snap-grid-marker--space",
      );
      marker.style.top = `${pos.y}px`;
      marker.style.left = `${grid.systemBounds.x}px`;
      marker.style.width = `${grid.systemBounds.w}px`;
      snapGridOverlayContainer.appendChild(marker);

      const label = document.createElement("div");
      label.classList.add("at-snap-grid-label");
      label.classList.add(
        isLine ? "at-snap-grid-label--line" : "at-snap-grid-label--space",
      );
      label.textContent = String(pos.string);
      snapGridLabelContainer?.appendChild(label);

      snapGridEntries.push({
        marker,
        label,
        string: pos.string,
        y: pos.y,
        trackIndex: grid.trackIndex,
        staffIndex: grid.staffIndex,
        renderedStave: grid.renderedStave,
      });
    }
  }

  cursorsWrapper.appendChild(snapGridOverlayContainer);

  if (snapGridLabelContainer && wrapper && viewportElement) {
    wrapper.appendChild(snapGridLabelContainer);

    const repositionLabels = () => {
      if (!viewportElement) return;
      const scrollTop = viewportElement.scrollTop;
      const vpHeight = viewportElement.clientHeight;
      for (const entry of snapGridEntries) {
        const top = entry.y - scrollTop;
        entry.label.style.top = `${top}px`;
        entry.label.style.display =
          top < -12 || top > vpHeight + 12 ? "none" : "";
      }
    };

    snapGridScrollHandler = repositionLabels;
    viewportElement.addEventListener("scroll", repositionLabels, { passive: true });
    repositionLabels();
  }

  if (selection) {
    setSnapGridSelection(
      selection.selectedString,
      selection.trackIndex,
      selection.staffIndex,
      selection.renderedStave,
    );
  }
}

export function setSnapGridSelection(
  selectedString: number | null,
  trackIndex: number | null = null,
  staffIndex: number | null = null,
  renderedStave: RenderedStave | null = null,
): void {
  for (const entry of snapGridEntries) {
    const stringMatches = selectedString === null || entry.string === selectedString;
    const trackMatches = trackIndex === null || entry.trackIndex === trackIndex;
    const staffMatches = staffIndex === null || entry.staffIndex === staffIndex;
    const renderedStaveMatches = renderedStave === null
      || entry.renderedStave === renderedStave;
    const active = stringMatches && trackMatches && staffMatches
      && renderedStaveMatches;
    entry.marker.classList.toggle("at-snap-grid--dim", !active);
    entry.label.classList.toggle("at-snap-grid--dim", !active);
  }
}

/** Tear down overlay DOM and clear state. Call from store destroy(). */
export function destroySnapGridOverlay(): void {
  const viewportElement = getViewportElement();
  if (snapGridOverlayContainer) {
    snapGridOverlayContainer.remove();
    snapGridOverlayContainer = null;
  }
  if (snapGridScrollHandler && viewportElement) {
    viewportElement.removeEventListener("scroll", snapGridScrollHandler);
    snapGridScrollHandler = null;
  }
  if (snapGridLabelContainer) {
    snapGridLabelContainer.remove();
    snapGridLabelContainer = null;
  }
  snapGridEntries = [];
  snapGrids.clear();
  snapGridsByBar.clear();
  navigablePositions.clear();
  renderedStaveByBarBounds = new WeakMap<object, RenderedStave>();
}
