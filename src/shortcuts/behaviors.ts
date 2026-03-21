import { usePlayerStore } from "@/stores/render-store";
import type { ShortcutBinding } from "./types";

/**
 * Patch live getCurrentValue readers onto bindings whose behavior needs runtime state.
 *
 * Default bindings are defined with stub getCurrentValue functions because they
 * cannot import the store at module parse time (circular deps). This function
 * wires them up once at init.
 */
export function patchBehaviorReaders(bindings: ShortcutBinding[]): void {
  for (const b of bindings) {
    switch (b.id) {
      case "playback.togglePlaying":
        if (b.behavior.type === "toggle") {
          (b.behavior as { getCurrentValue: () => boolean }).getCurrentValue = () =>
            usePlayerStore.getState().playerState === "playing";
        }
        break;

      case "edit.beat.toggleRest":
        if (b.behavior.type === "toggle") {
          (b.behavior as { getCurrentValue: () => boolean }).getCurrentValue = () =>
            usePlayerStore.getState().selectedBeatInfo?.isRest ?? false;
        }
        break;

      case "edit.beat.cycleDurationUp":
      case "edit.beat.cycleDurationDown":
        if (b.behavior.type === "cycle") {
          (b.behavior as { getCurrentValue: () => number }).getCurrentValue = () =>
            (usePlayerStore.getState().selectedBeatInfo?.duration as number) ?? 4;
        }
        break;

      case "edit.beat.cycleDots":
        if (b.behavior.type === "cycle") {
          (b.behavior as { getCurrentValue: () => number }).getCurrentValue = () =>
            usePlayerStore.getState().selectedBeatInfo?.dots ?? 0;
        }
        break;
    }
  }
}

/**
 * Compute the next value in a cycle given a current value, a direction, and an ordered list.
 */
export function getNextCycleValue(
  values: readonly number[],
  current: number,
  direction: "forward" | "backward",
): number {
  const idx = values.indexOf(current);
  if (idx === -1) return values[0];
  if (direction === "forward") {
    return values[(idx + 1) % values.length];
  }
  return values[(idx - 1 + values.length) % values.length];
}
