/**
 * Drum articulation icons for the sidebar: notation symbols (SVG) or
 * instrument icons (react-icons). Used in essentials mode only.
 */

import type { ReactNode } from "react";
import {
  GiDrum,
  GiDrumKit,
} from "react-icons/gi";
import { GP7_DEF_BY_ID } from "@/stores/player-store";
import type { DrumCategoryId } from "@/stores/player-store";

const SIZE = 16;

// ─── Notation symbol SVGs (standard drum notation) ───────────────────────────

export function NoteHeadX({ className }: { className?: string }) {
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 16 16" className={className}>
      <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" />
      <line x1="14" y1="2" x2="2" y2="14" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function NoteHeadCircleX({ className }: { className?: string }) {
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 16 16" className={className}>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1" />
      <line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" strokeWidth="1.2" />
      <line x1="12" y1="4" x2="4" y2="12" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function NoteHeadNormal({ className }: { className?: string }) {
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 16 16" className={className}>
      <ellipse cx="8" cy="8" rx="5" ry="4" fill="currentColor" />
    </svg>
  );
}

export function NoteHeadDiamond({ className }: { className?: string }) {
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 16 16" className={className}>
      <path d="M8 2 L14 8 L8 14 L2 8 Z" fill="currentColor" />
    </svg>
  );
}

export function NoteHeadTriangle({ className }: { className?: string }) {
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 16 16" className={className}>
      <path d="M8 3 L13 13 L3 13 Z" fill="currentColor" />
    </svg>
  );
}

// ─── Notation symbol by GP7 ID ───────────────────────────────────────────────

/** Map GP7 ID to notation symbol type for essentials display. */
function getNotationSymbolForGp7(gp7Id: number): ReactNode {
  const def = GP7_DEF_BY_ID.get(gp7Id);
  if (!def) return <NoteHeadNormal />;
  const el = def.elementType.toLowerCase();
  const tech = def.technique.toLowerCase();
  // Cymbals: x note head
  if (el.includes("charley") || el.includes("ride") || el.includes("crash") || el.includes("china") || el.includes("splash")) {
    if (tech === "open") return <NoteHeadCircleX />;
    return <NoteHeadX />;
  }
  // Snare rim shot, ride bell: diamond
  if (tech === "rim shot" || tech === "bell") return <NoteHeadDiamond />;
  // Snare side stick: circle-x
  if (tech === "side stick") return <NoteHeadCircleX />;
  // Drums (snare hit, toms, kick): normal
  return <NoteHeadNormal />;
}

// ─── Instrument icon by GP7 ID (react-icons) ──────────────────────────────────

function getInstrumentIconForGp7(gp7Id: number): ReactNode {
  const def = GP7_DEF_BY_ID.get(gp7Id);
  if (!def) return <GiDrum size={SIZE} />;
  const el = def.elementType.toLowerCase();
  // Cymbals: kit (has cymbals)
  if (el.includes("charley") || el.includes("ride") || el.includes("crash") || el.includes("china") || el.includes("splash")) {
    return <GiDrumKit size={SIZE} />;
  }
  // Kick
  if (el.includes("kick")) return <GiDrumKit size={SIZE} />;
  // Snare, toms
  return <GiDrum size={SIZE} />;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export type DrumIconStyle = "notation" | "instrument";

/**
 * Returns the icon React node for a percussion articulation in essentials mode.
 */
export function getDrumIcon(gp7Id: number, style: DrumIconStyle): ReactNode {
  return style === "instrument"
    ? getInstrumentIconForGp7(gp7Id)
    : getNotationSymbolForGp7(gp7Id);
}

/** Category label key for i18n (sidebar.articulation.category.*). */
export function getCategoryLabelKey(category: DrumCategoryId): string {
  return `sidebar.articulation.category.${category}`;
}
