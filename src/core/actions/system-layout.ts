import * as Y from "yjs";

export interface SystemLayoutState {
  readonly defaultSystemsLayout: number;
  readonly systemsLayout: readonly number[];
}

export interface EffectiveSystem {
  readonly index: number;
  readonly startBarIndex: number;
  readonly endBarIndex: number;
  readonly barCount: number;
  readonly declaredBarCount: number;
  readonly explicit: boolean;
}

export type SystemBreakDirection = "left" | "right";

const FALLBACK_BARS_PER_SYSTEM = 3;

function validBarCount(value: number, fallback: number): number {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function sameLayout(
  left: SystemLayoutState,
  right: SystemLayoutState,
): boolean {
  return left.defaultSystemsLayout === right.defaultSystemsLayout
    && left.systemsLayout.length === right.systemsLayout.length
    && left.systemsLayout.every(
      (value, index) => value === right.systemsLayout[index],
    );
}

function changedLayout(
  current: SystemLayoutState,
  systemsLayout: readonly number[],
  defaultSystemsLayout = current.defaultSystemsLayout,
  trimDefaultTail = false,
): SystemLayoutState | null {
  const normalizedSystemsLayout = [...systemsLayout];
  if (trimDefaultTail) {
    while (
      normalizedSystemsLayout.at(-1) === defaultSystemsLayout
    ) {
      normalizedSystemsLayout.pop();
    }
  }
  const next = {
    defaultSystemsLayout,
    systemsLayout: normalizedSystemsLayout,
  };
  return sameLayout(current, next) ? null : next;
}

/** Resolve AlphaTab's explicit-prefix plus default-tail layout for this score. */
export function resolveEffectiveSystems(
  totalBars: number,
  state: SystemLayoutState,
): EffectiveSystem[] {
  if (!Number.isInteger(totalBars) || totalBars <= 0) return [];

  const fallback = validBarCount(
    state.defaultSystemsLayout,
    FALLBACK_BARS_PER_SYSTEM,
  );
  const systems: EffectiveSystem[] = [];
  let startBarIndex = 0;
  let systemIndex = 0;

  while (startBarIndex < totalBars) {
    const explicit = systemIndex < state.systemsLayout.length;
    const declaredBarCount = validBarCount(
      explicit ? state.systemsLayout[systemIndex] : fallback,
      fallback,
    );
    const barCount = Math.min(declaredBarCount, totalBars - startBarIndex);
    systems.push({
      index: systemIndex,
      startBarIndex,
      endBarIndex: startBarIndex + barCount - 1,
      barCount,
      declaredBarCount,
      explicit,
    });
    startBarIndex += barCount;
    systemIndex += 1;
  }

  return systems;
}

function findSystem(
  totalBars: number,
  state: SystemLayoutState,
  barIndex: number,
): { systems: EffectiveSystem[]; system: EffectiveSystem } | null {
  if (!Number.isInteger(barIndex) || barIndex < 0 || barIndex >= totalBars) {
    return null;
  }
  const systems = resolveEffectiveSystems(totalBars, state);
  const system = systems.find(
    (candidate) =>
      barIndex >= candidate.startBarIndex
      && barIndex <= candidate.endBarIndex,
  );
  return system ? { systems, system } : null;
}

function declaredPrefix(
  systems: readonly EffectiveSystem[],
  endIndex: number,
): number[] {
  return systems
    .slice(0, endIndex)
    .map((system) => system.declaredBarCount);
}

/**
 * Apply Guitar Pro's System Layout command. A null start reflows the whole
 * score; otherwise the system containing startBarIndex and every later system
 * are reset while the earlier visible systems keep their current boundaries.
 */
export function reflowSystems(
  totalBars: number,
  current: SystemLayoutState,
  barsPerSystem: number,
  startBarIndex: number | null,
): SystemLayoutState | null {
  if (!Number.isInteger(barsPerSystem) || barsPerSystem <= 0) return null;
  if (startBarIndex === null) {
    return changedLayout(current, [], barsPerSystem);
  }

  const located = findSystem(totalBars, current, startBarIndex);
  if (!located) return null;
  return changedLayout(
    current,
    declaredPrefix(located.systems, located.system.index),
    barsPerSystem,
  );
}

/** Insert a persisted row boundary after barIndex. */
export function forceSystemBreak(
  totalBars: number,
  current: SystemLayoutState,
  barIndex: number,
): SystemLayoutState | null {
  const located = findSystem(totalBars, current, barIndex);
  if (!located) return null;
  const { systems, system } = located;
  const splitCount = barIndex - system.startBarIndex + 1;

  if (splitCount === system.barCount) {
    // An end-of-score break is meaningful in Guitar Pro: it fixes the last
    // row's width instead of leaving it as an automatic, partially filled row.
    if (barIndex !== totalBars - 1) return null;
    const fixed = [
      ...declaredPrefix(systems, system.index),
      system.barCount,
    ];
    return changedLayout(current, fixed);
  }

  const remainder = system.declaredBarCount - splitCount;
  if (remainder <= 0) return null;
  const tail = system.explicit
    ? current.systemsLayout.slice(system.index + 1)
    : [];
  return changedLayout(current, [
    ...declaredPrefix(systems, system.index),
    splitCount,
    remainder,
    ...tail,
  ]);
}

/** Remove the row boundary after barIndex by merging its adjacent rows. */
export function preventSystemBreak(
  totalBars: number,
  current: SystemLayoutState,
  barIndex: number,
): SystemLayoutState | null {
  const located = findSystem(totalBars, current, barIndex);
  if (!located) return null;
  const { systems, system } = located;
  if (system.endBarIndex !== barIndex || barIndex >= totalBars - 1) return null;

  const next = systems[system.index + 1];
  if (!next) return null;
  const tail = next.explicit
    ? current.systemsLayout.slice(next.index + 1)
    : [];
  return changedLayout(current, [
    ...declaredPrefix(systems, system.index),
    system.declaredBarCount + next.declaredBarCount,
    ...tail,
  ], current.defaultSystemsLayout, true);
}

/** Move an existing row boundary by one bar, matching Design Mode +/- controls. */
export function moveSystemBreak(
  totalBars: number,
  current: SystemLayoutState,
  barIndex: number,
  direction: SystemBreakDirection,
): SystemLayoutState | null {
  const located = findSystem(totalBars, current, barIndex);
  if (!located) return null;
  const { systems, system } = located;
  if (system.endBarIndex !== barIndex || barIndex >= totalBars - 1) return null;

  const next = systems[system.index + 1];
  if (!next) return null;
  const prefix = declaredPrefix(systems, system.index);
  const tail = next.explicit
    ? current.systemsLayout.slice(next.index + 1)
    : [];

  if (direction === "left") {
    if (system.declaredBarCount <= 1) return null;
    return changedLayout(current, [
      ...prefix,
      system.declaredBarCount - 1,
      next.declaredBarCount + 1,
      ...tail,
    ], current.defaultSystemsLayout, true);
  }

  if (next.declaredBarCount === 1) {
    return changedLayout(current, [
      ...prefix,
      system.declaredBarCount + 1,
      ...tail,
    ], current.defaultSystemsLayout, true);
  }
  return changedLayout(current, [
    ...prefix,
    system.declaredBarCount + 1,
    next.declaredBarCount - 1,
    ...tail,
  ], current.defaultSystemsLayout, true);
}

export function readYSystemLayout(owner: Y.Map<unknown>): SystemLayoutState {
  return {
    defaultSystemsLayout: validBarCount(
      (owner.get("defaultSystemsLayout") as number | undefined)
        ?? FALLBACK_BARS_PER_SYSTEM,
      FALLBACK_BARS_PER_SYSTEM,
    ),
    systemsLayout:
      (owner.get("systemsLayout") as Y.Array<number> | undefined)?.toArray()
      ?? [],
  };
}

export function writeYSystemLayout(
  owner: Y.Map<unknown>,
  state: SystemLayoutState,
): void {
  owner.set("defaultSystemsLayout", state.defaultSystemsLayout);
  let array = owner.get("systemsLayout") as Y.Array<number> | undefined;
  if (!array) {
    array = new Y.Array<number>();
    owner.set("systemsLayout", array);
  } else if (array.length > 0) {
    array.delete(0, array.length);
  }
  if (state.systemsLayout.length > 0) {
    array.push([...state.systemsLayout]);
  }
}
