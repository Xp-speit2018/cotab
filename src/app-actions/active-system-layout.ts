import type { AppActionExecutionContext } from "./types";
import { executeAppActionUnsafe } from "./registry";
import { getApi } from "@/stores/render-api";
import { usePlayerStore } from "@/stores/render-store";

export type ActiveSystemLayoutTarget =
  | { readonly kind: "score" }
  | {
      readonly kind: "track";
      readonly trackIndex: number;
      readonly trackName: string;
    };

export interface ActiveSystemLayoutSnapshot {
  readonly target: ActiveSystemLayoutTarget;
  readonly totalBars: number;
  readonly defaultSystemsLayout: number;
  readonly systemsLayout: readonly number[];
}

export function getActiveSystemLayoutTarget(): ActiveSystemLayoutTarget {
  const state = usePlayerStore.getState();
  if (state.visibleTrackIndices.length === 1) {
    const trackIndex = state.visibleTrackIndices[0];
    return {
      kind: "track",
      trackIndex,
      trackName: state.tracks[trackIndex]?.name ?? `Track ${trackIndex + 1}`,
    };
  }
  return { kind: "score" };
}

export function getActiveSystemLayoutSnapshot(): ActiveSystemLayoutSnapshot | null {
  const score = getApi()?.score;
  if (!score) return null;
  const target = getActiveSystemLayoutTarget();
  const owner = target.kind === "track"
    ? score.tracks[target.trackIndex]
    : score;
  if (!owner) return null;
  return {
    target,
    totalBars: score.masterBars.length,
    defaultSystemsLayout: owner.defaultSystemsLayout,
    systemsLayout: [...owner.systemsLayout],
  };
}

export function reflowActiveSystems(
  args: { barsPerSystem: number; startBarIndex: number | null },
  context: AppActionExecutionContext,
): boolean {
  const target = getActiveSystemLayoutTarget();
  if (target.kind === "track") {
    return executeAppActionUnsafe(
      "document.track.reflowSystems",
      { trackIndex: target.trackIndex, ...args },
      context,
    ) ?? false;
  }
  return executeAppActionUnsafe(
    "document.score.reflowSystems",
    args,
    context,
  ) ?? false;
}

export function forceActiveSystemBreak(
  barIndex: number,
  context: AppActionExecutionContext,
): boolean {
  const target = getActiveSystemLayoutTarget();
  if (target.kind === "track") {
    return executeAppActionUnsafe(
      "document.track.forceSystemBreak",
      { trackIndex: target.trackIndex, barIndex },
      context,
    ) ?? false;
  }
  return executeAppActionUnsafe(
    "document.score.forceSystemBreak",
    { barIndex },
    context,
  ) ?? false;
}

export function preventActiveSystemBreak(
  barIndex: number,
  context: AppActionExecutionContext,
): boolean {
  const target = getActiveSystemLayoutTarget();
  if (target.kind === "track") {
    return executeAppActionUnsafe(
      "document.track.preventSystemBreak",
      { trackIndex: target.trackIndex, barIndex },
      context,
    ) ?? false;
  }
  return executeAppActionUnsafe(
    "document.score.preventSystemBreak",
    { barIndex },
    context,
  ) ?? false;
}

export function moveActiveSystemBreak(
  barIndex: number,
  direction: "left" | "right",
  context: AppActionExecutionContext,
): boolean {
  const target = getActiveSystemLayoutTarget();
  if (target.kind === "track") {
    return executeAppActionUnsafe(
      "document.track.moveSystemBreak",
      { trackIndex: target.trackIndex, barIndex, direction },
      context,
    ) ?? false;
  }
  return executeAppActionUnsafe(
    "document.score.moveSystemBreak",
    { barIndex, direction },
    context,
  ) ?? false;
}
