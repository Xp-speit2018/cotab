/**
 * Shared mutable state for the AlphaTab player: API instance and DOM references.
 * All other player modules access these via getters/setters to avoid circular deps.
 */

import type * as alphaTab from "@coderline/alphatab";
import type { PendingSelection } from "./player-types";

export type { PendingSelection };

let api: alphaTab.AlphaTabApi | null = null;
let mainElement: HTMLElement | null = null;
let viewportElement: HTMLElement | null = null;
let cursorElement: HTMLDivElement | null = null;
let pendingSelection: PendingSelection | null = null;

export function getApi(): alphaTab.AlphaTabApi | null {
  return api;
}

export function setApi(value: alphaTab.AlphaTabApi | null): void {
  api = value;
}

export function getMainElement(): HTMLElement | null {
  return mainElement;
}

export function setMainElement(value: HTMLElement | null): void {
  mainElement = value;
}

export function getViewportElement(): HTMLElement | null {
  return viewportElement;
}

export function setViewportElement(value: HTMLElement | null): void {
  viewportElement = value;
}

export function getCursorElement(): HTMLDivElement | null {
  return cursorElement;
}

export function setCursorElement(value: HTMLDivElement | null): void {
  cursorElement = value;
}

export function getPendingSelection(): PendingSelection | null {
  return pendingSelection;
}

export function setPendingSelection(selection: PendingSelection | null): void {
  pendingSelection = selection;
}
