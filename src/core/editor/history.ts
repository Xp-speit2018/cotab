import * as Y from "yjs";

// These scalar fields are initialized by createNote for every notation branch.
// Clearing a pitch uses the schema's sentinel value, never deleting its key.
const NOTE_PITCH_FIELDS = new Set([
  "fret", "string", "octave", "tone", "percussionArticulation",
]);

/**
 * Yjs may refuse to restore a map value after a remote overwrite but still
 * delete the inverse operation's current value. Do not leave a surviving note
 * without its pitch fields in that case.
 *
 * UndoManager calls deleteFilter after attempting replacements. An integrated
 * map item's rightmost entry is its current value; a successful replacement
 * deletes the previous item. Keep the current entry if no replacement exists.
 * This relies on the Item metadata exposed to Yjs's deleteFilter hook, isolated
 * here and covered by the bounded collaborative-history schedules.
 *
 * Array items are unaffected: undoing note insertion can still delete the
 * whole note, and nested content is removed with its parent by Yjs.
 */
export function allowHistoryDeletion(item: Y.Item): boolean {
  if (
    item.parentSub === null
    || !NOTE_PITCH_FIELDS.has(item.parentSub)
    || !(item.parent instanceof Y.Map)
    || !item.parent.has("uuid")
    || !item.parent.has("fret")
    || !item.parent.has("string")
  ) return true;

  return item.deleted || item.right !== null;
}
