import { isMac } from "./platform";

export type TransportModifier = "alt" | "shift" | "mod";

export const DEFAULT_TRANSPORT_MODIFIER: TransportModifier = "alt";

const STORAGE_KEY = "cotab:transport-modifier";
const VALID_MODIFIERS = new Set<TransportModifier>(["alt", "shift", "mod"]);

function parseTransportModifier(value: string | null): TransportModifier {
  return value && VALID_MODIFIERS.has(value as TransportModifier)
    ? (value as TransportModifier)
    : DEFAULT_TRANSPORT_MODIFIER;
}

let currentTransportModifier = (() => {
  if (typeof localStorage === "undefined") return DEFAULT_TRANSPORT_MODIFIER;
  return parseTransportModifier(localStorage.getItem(STORAGE_KEY));
})();

export function getTransportModifier(): TransportModifier {
  return currentTransportModifier;
}

export function setTransportModifier(modifier: TransportModifier): void {
  currentTransportModifier = modifier;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, modifier);
  }
}

export function resetTransportModifier(): TransportModifier {
  setTransportModifier(DEFAULT_TRANSPORT_MODIFIER);
  return DEFAULT_TRANSPORT_MODIFIER;
}

export function eventMatchesTransportModifier(
  event: Pick<MouseEvent | KeyboardEvent, "altKey" | "shiftKey" | "metaKey" | "ctrlKey">,
  modifier: TransportModifier = currentTransportModifier,
): boolean {
  switch (modifier) {
    case "alt":
      return event.altKey;
    case "shift":
      return event.shiftKey;
    case "mod":
      return isMac() ? event.metaKey : event.ctrlKey;
  }
}

export function transportModifierToKeyCombo(modifier: TransportModifier): string {
  return modifier;
}
