import * as Y from "yjs";

export interface DocumentChange {
  /** `null` means the change can affect content before every master bar. */
  readonly firstChangedMasterBar: number | null;
}

export const FULL_DOCUMENT_CHANGE: DocumentChange = {
  firstChangedMasterBar: null,
};

function firstChangedArrayIndex(
  event: Y.YEvent<Y.AbstractType<unknown>>,
): number | null {
  let index = 0;
  for (const change of event.changes.delta) {
    index += change.retain ?? 0;
    if (change.insert !== undefined || (change.delete ?? 0) > 0) {
      return index;
    }
  }
  return null;
}

function collectionChangeIndex(
  event: Y.YEvent<Y.AbstractType<unknown>>,
  collection: "masterBars" | "bars",
): number | null {
  const collectionPathIndex = event.path.indexOf(collection);
  if (collectionPathIndex < 0) return null;

  const itemIndex = event.path[collectionPathIndex + 1];
  if (typeof itemIndex === "number") return Math.max(0, itemIndex);

  return firstChangedArrayIndex(event) ?? 0;
}

/**
 * Finds the earliest master bar that can be affected by a Yjs transaction.
 * Score- or track-level edits conservatively request a full render.
 */
export function documentChangeFromYEvents(
  events: readonly Y.YEvent<Y.AbstractType<unknown>>[],
): DocumentChange {
  let firstChangedMasterBar = Number.POSITIVE_INFINITY;

  for (const event of events) {
    const masterBarIndex = collectionChangeIndex(event, "masterBars");
    const trackBarIndex = collectionChangeIndex(event, "bars");
    const eventIndex = masterBarIndex ?? trackBarIndex;
    if (eventIndex === null) return FULL_DOCUMENT_CHANGE;
    firstChangedMasterBar = Math.min(firstChangedMasterBar, eventIndex);
  }

  return {
    firstChangedMasterBar: Number.isFinite(firstChangedMasterBar)
      ? firstChangedMasterBar
      : null,
  };
}
