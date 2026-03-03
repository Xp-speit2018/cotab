/**
 * Snap grid computation and debug overlay.
 * Depends on player-api (getApi, getMainElement, getViewportElement), player-types (SnapGrid, SnapPosition), percussion-data (GP7_ARTICULATION_MAP).
 */

import { getApi, getMainElement, getViewportElement } from "./player-api";
import { GP7_ARTICULATION_MAP } from "./percussion-data";
import type { SnapGrid, SnapPosition } from "./player-types";

const snapGrids = new Map<string, SnapGrid>();

let snapGridOverlayContainer: HTMLDivElement | null = null;
let snapGridLabelContainer: HTMLDivElement | null = null;
let snapGridEntries: { marker: HTMLElement; label: HTMLElement; string: number; y: number; trackIndex: number; staffIndex: number }[] = [];
let snapGridScrollHandler: (() => void) | null = null;

export function getSnapGrids(): Map<string, SnapGrid> {
  return snapGrids;
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

function clusterYPositions(ys: number[], tolerance: number): number[] {
  if (ys.length === 0) return [];
  const sorted = [...ys].sort((a, b) => a - b);
  const clusters: number[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const last = clusters[clusters.length - 1];
    if (sorted[i] - last[last.length - 1] <= tolerance) {
      last.push(sorted[i]);
    } else {
      clusters.push([sorted[i]]);
    }
  }
  return clusters.map((c) => c.reduce((a, b) => a + b, 0) / c.length);
}

export function buildSnapGrids(): void {
  snapGrids.clear();
  const api = getApi();
  const lookup = api?.boundsLookup;
  const score = api?.score;
  if (!lookup || !score || lookup.staffSystems.length === 0) return;

  const collected = new Map<
    string,
    {
      stringYs: Map<number, number>;
      allYPositions: number[];
      percYArticulations: { y: number; artic: number }[];
      widths: number[];
      heights: number[];
      trackIndex: number;
      staffIndex: number;
      isTab: boolean;
      barRealBounds: { y: number; h: number } | null;
    }
  >();

  for (const system of lookup.staffSystems) {
    for (const masterBar of system.bars) {
      for (const barBounds of masterBar.bars) {
        if (barBounds.beats.length === 0) continue;
        const refBar = barBounds.beats[0].beat.voice.bar;
        const ti = refBar.staff.track.index;
        const si = refBar.staff.index;
        const key = `${ti}:${si}`;
        let entry = collected.get(key);
        if (!entry) {
          const trackObj = score.tracks[ti];
          const staffObj = trackObj?.staves[si];
          entry = {
            stringYs: new Map(),
            allYPositions: [],
            percYArticulations: [],
            widths: [],
            heights: [],
            trackIndex: ti,
            staffIndex: si,
            isTab: staffObj?.showTablature ?? true,
            barRealBounds: null,
          };
          collected.set(key, entry);
        }

        if (!entry.barRealBounds) {
          entry.barRealBounds = {
            y: barBounds.realBounds.y,
            h: barBounds.realBounds.h,
          };
        }

        for (const beatBounds of barBounds.beats) {
          if (!beatBounds.notes) continue;
          for (const nb of beatBounds.notes) {
            const centerY = nb.noteHeadBounds.y + nb.noteHeadBounds.h / 2;
            const s = nb.note.string;
            if (!entry.stringYs.has(s)) {
              entry.stringYs.set(s, centerY);
            }
            const trackObj = score.tracks[ti];
            if (!entry.isTab || trackObj?.isPercussion) {
              entry.allYPositions.push(centerY);
              if (trackObj?.isPercussion) {
                entry.percYArticulations.push({
                  y: centerY,
                  artic: nb.note.percussionArticulation,
                });
              }
            }
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

  for (const [key, entry] of collected) {
    const track = score.tracks[entry.trackIndex];
    if (!track) continue;
    const staff = track.staves[entry.staffIndex];
    if (!staff) continue;

    const medianW = median(entry.widths);
    const medianH = median(entry.heights);
    const positions: SnapPosition[] = [];

    if (entry.stringYs.size === 0 && entry.allYPositions.length === 0) {
      if (!entry.barRealBounds) continue;
      const br = entry.barRealBounds;
      const lineBase = br.y - slt / 2;

      if (entry.isTab && !track.isPercussion) {
        const numStrings = staff.tuning.length || 6;
        for (let s = 1; s <= numStrings; s++) {
          positions.push({
            string: s,
            y: lineBase + tabLineSpacing * (numStrings - s),
          });
        }
        positions.sort((a, b) => a.y - b.y);
        snapGrids.set(key, {
          positions,
          noteWidth: medianW > 0 ? medianW : tabLineSpacing,
          noteHeight: medianH > 0 ? medianH : tabLineSpacing,
        });
      } else {
        const halfSpace = oneStaffSpace / 2;
        const centerY = lineBase + 2 * oneStaffSpace;
        if (track.isPercussion) {
          for (let i = -10; i <= 10; i++) {
            positions.push({ string: 3 + i, y: centerY + i * halfSpace });
          }
        } else {
          for (let i = -10; i <= 10; i++) {
            positions.push({ string: i + 11, y: centerY + i * halfSpace });
          }
        }
        positions.sort((a, b) => a.y - b.y);
        snapGrids.set(key, {
          positions,
          noteWidth: medianW > 0 ? medianW : oneStaffSpace,
          noteHeight: medianH > 0 ? medianH : oneStaffSpace,
        });
      }
      continue;
    }

    if (entry.isTab && !track.isPercussion) {
      const numStrings = staff.tuning.length || 6;
      if (entry.stringYs.size >= 2) {
        const sorted = [...entry.stringYs.entries()].sort((a, b) => a[0] - b[0]);
        const firstS = sorted[0][0];
        const firstY = sorted[0][1];
        const lastS = sorted[sorted.length - 1][0];
        const lastY = sorted[sorted.length - 1][1];
        const spacing = (lastY - firstY) / (lastS - firstS);
        for (let s = 1; s <= numStrings; s++) {
          positions.push({ string: s, y: firstY + (s - firstS) * spacing });
        }
      } else {
        const [knownS, knownY] = [...entry.stringYs.entries()][0];
        for (let s = 1; s <= numStrings; s++) {
          positions.push({
            string: s,
            y: knownY + (s - knownS) * tabLineSpacing,
          });
        }
      }
    } else if (track.isPercussion) {
      const distinctYs = clusterYPositions(entry.allYPositions, 1.0);
      const refHalfSpace = medianH > 0 ? medianH / 2 : 0;
      let halfSpace: number;
      if (distinctYs.length >= 2) {
        let minGap = Infinity;
        for (let i = 1; i < distinctYs.length; i++) {
          const gap = distinctYs[i] - distinctYs[i - 1];
          if (gap > 0.5 && gap < minGap) minGap = gap;
        }
        if (!isFinite(minGap)) minGap = medianH * 1.2;
        halfSpace = minGap;
        if (refHalfSpace > 0) {
          const ratio = minGap / refHalfSpace;
          if (ratio > 1.4) {
            const n = Math.round(ratio);
            if (n >= 2 && Math.abs(ratio - n) < 0.5) {
              halfSpace = minGap / n;
            } else {
              halfSpace = refHalfSpace;
            }
          }
        }
      } else {
        halfSpace = oneStaffSpace / 2;
      }

      const anchorY =
        distinctYs.length > 0
          ? distinctYs[Math.floor(distinctYs.length / 2)]
          : entry.barRealBounds
            ? entry.barRealBounds.y + entry.barRealBounds.h / 2
            : 0;

      let anchorStaffLine = 3;
      const artics = track.percussionArticulations;
      for (const pa of entry.percYArticulations) {
        const gp7Id =
          artics?.length > 0 && pa.artic >= 0 && pa.artic < artics.length
            ? artics[pa.artic].id
            : pa.artic;
        const sl = GP7_ARTICULATION_MAP.get(gp7Id);
        if (sl !== undefined) {
          const stepsFromAnchor = Math.round((pa.y - anchorY) / halfSpace);
          anchorStaffLine = sl - stepsFromAnchor;
          break;
        }
      }
      for (let i = -10; i <= 10; i++) {
        positions.push({ string: anchorStaffLine + i, y: anchorY + i * halfSpace });
      }
    } else {
      if (!entry.barRealBounds) continue;
      const br = entry.barRealBounds;
      const lineBase = br.y - slt / 2;
      const halfSpace = oneStaffSpace / 2;
      const centerY = lineBase + 2 * oneStaffSpace;
      for (let i = -10; i <= 10; i++) {
        positions.push({ string: i + 11, y: centerY + i * halfSpace });
      }
    }

    positions.sort((a, b) => a.y - b.y);

    let percussionMap: Map<number, number> | undefined;
    if (track.isPercussion && entry.percYArticulations.length > 0) {
      percussionMap = new Map();
      const artics = track.percussionArticulations;
      for (const pa of entry.percYArticulations) {
        const gp7Id =
          artics?.length > 0 && pa.artic >= 0 && pa.artic < artics.length
            ? artics[pa.artic].id
            : pa.artic;
        const sl = GP7_ARTICULATION_MAP.get(gp7Id);
        if (sl !== undefined && !percussionMap.has(sl)) {
          percussionMap.set(sl, pa.artic);
        }
      }
    }

    snapGrids.set(key, {
      positions,
      noteWidth: medianW,
      noteHeight: medianH,
      percussionMap,
    });
  }
}

export type SnapGridSelection = {
  selectedString: number | null;
  trackIndex: number | null;
  staffIndex: number | null;
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

  const mainWidth = mainElement.scrollWidth;
  const wrapper = viewportElement?.parentElement;

  if (wrapper && viewportElement) {
    snapGridLabelContainer = document.createElement("div");
    snapGridLabelContainer.classList.add("at-snap-grid-labels");
  }

  for (const [gridKey, grid] of snapGrids) {
    const [trackIndex, staffIndex] = gridKey.split(":").map(Number);

    for (let i = 0; i < grid.positions.length; i++) {
      const pos = grid.positions[i];
      const isLine = i % 2 === 0;

      const marker = document.createElement("div");
      marker.classList.add("at-snap-grid-marker");
      marker.classList.add(
        isLine ? "at-snap-grid-marker--line" : "at-snap-grid-marker--space",
      );
      marker.style.top = `${pos.y}px`;
      marker.style.width = `${mainWidth}px`;
      snapGridOverlayContainer.appendChild(marker);

      const label = document.createElement("div");
      label.classList.add("at-snap-grid-label");
      label.classList.add(
        isLine ? "at-snap-grid-label--line" : "at-snap-grid-label--space",
      );
      label.textContent = String(pos.string);
      snapGridLabelContainer?.appendChild(label);

      snapGridEntries.push({ marker, label, string: pos.string, y: pos.y, trackIndex, staffIndex });
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
    );
  }
}

export function setSnapGridSelection(
  selectedString: number | null,
  trackIndex: number | null = null,
  staffIndex: number | null = null,
): void {
  for (const entry of snapGridEntries) {
    const stringMatches = selectedString === null || entry.string === selectedString;
    const trackMatches = trackIndex === null || entry.trackIndex === trackIndex;
    const staffMatches = staffIndex === null || entry.staffIndex === staffIndex;
    const active = stringMatches && trackMatches && staffMatches;
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
}
