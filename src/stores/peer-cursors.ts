import type { PeerInfo } from "@/core/editor/collaboration";
import { getProjectedBeatUuid } from "@/core/converters";
import { getApi, getMainElement } from "./render-api";
import { getRenderedStaveForBarBounds, getSnapGridForBar } from "./snap-grid";

export function clearPeerCursors(): void {
  getMainElement()?.querySelectorAll(".at-peer-cursor").forEach((cursor) => cursor.remove());
}

/** A passive projection of presence. Never changes local selection or scroll. */
export function updatePeerCursors(peers: readonly PeerInfo[]): void {
  clearPeerCursors();
  const api = getApi();
  const wrapper = getMainElement()?.querySelector<HTMLElement>(".at-cursors");
  if (!api?.boundsLookup || !wrapper) return;
  const pending = new Map(peers.filter((peer) => peer.selection && peer.status === "synced").map((peer) => [peer.id, peer]));
  if (!pending.size) return;
  for (const system of api.boundsLookup.staffSystems) {
    for (const masterBar of system.bars) {
      for (const bar of masterBar.bars) {
        const stave = getRenderedStaveForBarBounds(bar);
        for (const bounds of bar.beats) {
          const uuid = getProjectedBeatUuid(bounds.beat);
          if (!uuid) continue;
          for (const [id, peer] of pending) {
            const selection = peer.selection!;
            if (selection.beatUuid !== uuid) continue;
            const modelBar = bounds.beat.voice.bar;
            const selectedStave = selection.renderedStave
              ?? (modelBar.staff.showTablature ? "tablature" : "standard");
            if (selectedStave !== stave) continue;
            const grid = getSnapGridForBar(modelBar.staff.track.index, modelBar.staff.index, modelBar.index, stave ?? undefined);
            if (!grid) continue;
            const snap = selection.string === null ? undefined : grid.positions.find((position) => position.string === selection.string);
            if (selection.string !== null && !snap) continue;
            const cursor = document.createElement("div");
            cursor.className = "at-peer-cursor";
            cursor.dataset.peerId = id;
            cursor.dataset.beatUuid = uuid;
            // Names are untrusted presence text, never markup.
            const label = document.createElement("span");
            label.textContent = peer.name;
            let hash = 0;
            for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) | 0;
            const color = `hsl(${Math.abs(hash) % 360} 70% 38%)`;
            Object.assign(cursor.style, {
              position: "absolute", pointerEvents: "none", zIndex: "5", boxSizing: "border-box",
              left: `${bounds.onNotesX - grid.noteWidth / 2}px`,
              top: `${(snap?.y ?? bounds.visualBounds.y + bounds.visualBounds.h / 2) - grid.noteHeight / 2}px`,
              width: `${grid.noteWidth}px`, height: `${grid.noteHeight}px`,
              border: `2px solid ${color}`, borderRadius: "3px",
            });
            Object.assign(label.style, {
              position: "absolute", bottom: "100%", left: "-2px", padding: "1px 4px",
              background: color, color: "white", font: "11px/16px sans-serif", borderRadius: "3px 3px 3px 0",
              maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            });
            cursor.append(label);
            wrapper.append(cursor);
            pending.delete(id);
          }
        }
      }
    }
  }
}
