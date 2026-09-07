import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { EditorEngine } from "@/core/engine";
import { createNote, initializeScore, snapshotScore } from "@/core/schema";

// Executable baseline for docs/COLLABORATIVE-HISTORY.md. No network, clock,
// renderer, or Yjs mocks: delivery order is controlled explicitly by each test.
const REMOTE = Symbol("history-test-network");
const seed = new Y.Doc();
seed.clientID = 1;
const seedScore = initializeScore(seed);
EditorEngine.createNewScore(seedScore);
function notes(score: Y.Map<unknown>): Y.Array<Y.Map<unknown>> {
  const first = (parent: Y.Map<unknown>, key: string) => (
    parent.get(key) as Y.Array<Y.Map<unknown>>
  ).get(0);
  const beat = first(first(first(first(first(score, "tracks"), "staves"), "bars"), "voices"), "beats");
  return beat.get("notes") as Y.Array<Y.Map<unknown>>;
}
notes(seedScore).push([createNote(3, 1)]);
const seedUpdate = Y.encodeStateAsUpdate(seed);
seed.destroy();

function pair(reverseIds = false) {
  const engines = [new EditorEngine(), new EditorEngine()] as const;
  const updates: Array<{ sender: number; data: Uint8Array }> = [];
  for (const [index, engine] of engines.entries()) {
    const doc = new Y.Doc();
    doc.clientID = (reverseIds ? 1 - index : index) + 10;
    Y.applyUpdate(doc, seedUpdate, REMOTE);
    engine.replaceDoc(doc, doc.getMap("score"));
    doc.on("update", (data: Uint8Array, origin: unknown) => {
      if (origin !== REMOTE) updates.push({ sender: index, data });
    });
  }
  const [a, b] = engines;
  const um = (engine: EditorEngine) => engine.getUndoManager()!;
  const doc = (engine: EditorEngine) => engine.getDoc()!;
  const score = (engine: EditorEngine) => engine.getScoreMap()!;
  const note = (engine: EditorEngine) => notes(score(engine)).get(0);
  const edit = (engine: EditorEngine, mutate: () => void) => {
    // Explicit gesture boundaries for the model; production still uses the
    // default capture timeout. This suite does not claim production grouping.
    um(engine).stopCapturing();
    engine.localEditYDoc(mutate);
    um(engine).stopCapturing();
  };
  const set = (engine: EditorEngine, key: string, value: unknown) => edit(engine, () => note(engine).set(key, value));
  const deliver = (receiver: EditorEngine, data: Uint8Array) => {
    const undo = [...um(receiver).undoStack];
    const redo = [...um(receiver).redoStack];
    Y.applyUpdate(doc(receiver), data, REMOTE);
    // H2: receiving even another user's undo is not a new local history item.
    expect(um(receiver).undoStack).toEqual(undo);
    expect(um(receiver).redoStack).toEqual(redo);
  };
  const flush = (reverse = false) => {
    const messages = reverse ? [...updates].reverse() : [...updates];
    for (const message of messages) deliver(engines[1 - message.sender], message.data);
  };
  const converge = () => {
    // Replay all updates out of order and twice, including undo/redo updates.
    flush(true);
    flush();
    expect(snapshotScore(score(a))).toEqual(snapshotScore(score(b)));
    expect(Y.encodeStateVector(doc(a))).toEqual(Y.encodeStateVector(doc(b)));
    const visible = notes(score(a)).toArray();
    const ids = visible.map((entry) => entry.get("uuid"));
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of visible) {
      expect(typeof entry.get("uuid")).toBe("string");
      expect([1, 2, 3]).toContain(entry.get("string"));
      expect(entry.has("fret")).toBe(true);
      expect([3, 5, 7]).toContain(entry.get("fret"));
    }
  };
  const destroy = () => engines.forEach((engine) => engine.destroyDoc());
  return { a, b, um, doc, score, note, edit, set, flush, converge, destroy, updates };
}

type Pair = ReturnType<typeof pair>;
function withPair(run: (p: Pair) => void, reverseIds = false) {
  const p = pair(reverseIds);
  try { run(p); } finally { p.destroy(); }
}

describe("collaborative history baseline", () => {
  it("H3: undoes one field while retaining a remote field on the same note", () => withPair((p) => {
    p.set(p.a, "fret", 5);
    p.flush();
    p.set(p.b, "isGhost", true);
    p.flush();
    expect(p.um(p.a).undo()).not.toBeNull();
    p.converge();
    expect(p.note(p.a).get("fret")).toBe(3);
    expect(p.note(p.a).get("isGhost")).toBe(true);
    p.um(p.a).redo();
    p.converge();
    expect(p.note(p.b).get("fret")).toBe(5);
    expect(p.note(p.b).get("isGhost")).toBe(true);
  }));

  it("H4: same-field undo restores the pre-edit value and redo restores the pre-undo value", () => withPair((p) => {
    p.set(p.a, "fret", 5);
    p.flush();
    p.set(p.b, "fret", 7);
    p.flush();
    expect(p.um(p.a).undo()).not.toBeNull();
    p.converge();
    expect(p.note(p.a).get("fret")).toBe(3);
    expect(p.um(p.a).redo()).not.toBeNull();
    p.converge();
    expect(p.note(p.a).get("fret")).toBe(7);
  }));

  it("H4: redo after a new remote assignment restores its target and the next undo recovers the remote value", () => withPair((p) => {
    p.set(p.a, "fret", 5);
    p.um(p.a).undo();
    p.flush();
    p.set(p.b, "fret", 7);
    p.flush();
    expect(p.um(p.a).redoStack).toHaveLength(1);
    expect(p.um(p.a).redo()).not.toBeNull();
    p.converge();
    expect(p.note(p.a).get("fret")).toBe(5);
    p.um(p.a).undo();
    p.converge();
    expect(p.note(p.a).get("fret")).toBe(7);
  }));

  it("H5: a new local edit clears redo while received edits do not", () => withPair((p) => {
    p.set(p.a, "fret", 5);
    p.um(p.a).undo();
    p.set(p.b, "isGhost", true);
    p.flush();
    expect(p.um(p.a).redoStack).toHaveLength(1);
    p.set(p.a, "fret", 7);
    expect(p.um(p.a).redoStack).toHaveLength(0);
    p.converge();
  }));

  it("H6: field undo does not resurrect a remotely deleted note", () => withPair((p) => {
    p.set(p.a, "fret", 5);
    p.flush();
    p.edit(p.b, () => notes(p.score(p.b)).delete(0, 1));
    p.flush();
    expect(p.um(p.a).undo()).toBeNull();
    p.converge();
    expect(notes(p.score(p.a)).length).toBe(0);
  }));

  it("H7: isolated delete/undo/redo restores the domain UUID and fields", () => withPair((p) => {
    const before = p.note(p.a).toJSON();
    p.edit(p.a, () => notes(p.score(p.a)).delete(0, 1));
    p.um(p.a).undo();
    p.converge();
    expect(p.note(p.a).toJSON()).toEqual(before);
    p.um(p.a).redo();
    p.converge();
    expect(notes(p.score(p.a)).length).toBe(0);
  }));

  it("L1: undoing creation removes a note even after a received remote child edit", () => withPair((p) => {
    p.edit(p.a, () => notes(p.score(p.a)).push([createNote(5, 1)]));
    p.flush();
    p.edit(p.b, () => notes(p.score(p.b)).get(1).set("fret", 7));
    p.flush();
    p.um(p.a).undo();
    p.converge();
    expect(notes(p.score(p.a)).length).toBe(1);
  }));

  it("L1: offline undo of creation also hides an unobserved remote child edit", () => withPair((p) => {
    p.edit(p.a, () => notes(p.score(p.a)).push([createNote(5, 1)]));
    p.flush();
    p.edit(p.b, () => notes(p.score(p.b)).get(1).set("fret", 7));
    // No delivery: A cannot distinguish this history from no remote edit.
    p.um(p.a).undo();
    p.converge();
    expect(notes(p.score(p.a)).length).toBe(1);
  }));

  it("H4: a remote overwrite does not cause undo to skip to an older local entry", () => withPair((p) => {
    p.set(p.a, "isGhost", true);
    p.set(p.a, "fret", 5);
    p.flush();
    p.set(p.b, "fret", 7);
    p.flush();
    expect(p.um(p.a).undoStack).toHaveLength(2);
    expect(p.um(p.a).undo()).not.toBeNull();
    expect(p.um(p.a).undoStack).toHaveLength(1);
    p.converge();
    expect(p.note(p.a).get("fret")).toBe(3);
    expect(p.note(p.a).get("isGhost")).toBe(true);
    p.um(p.a).undo();
    p.converge();
    expect(p.note(p.a).get("isGhost")).toBe(false);
    p.um(p.a).redo();
    p.um(p.a).redo();
    p.converge();
    expect(p.note(p.a).get("fret")).toBe(7);
    expect(p.note(p.a).get("isGhost")).toBe(true);
  }));

  it("H4: a multi-field transaction round trip retains the remote pre-undo value", () => withPair((p) => {
    p.edit(p.a, () => { p.note(p.a).set("fret", 5); p.note(p.a).set("isGhost", true); });
    p.flush();
    p.set(p.b, "fret", 7);
    p.flush();
    p.um(p.a).undo();
    p.converge();
    expect(p.note(p.a).get("fret")).toBe(3);
    expect(p.note(p.a).get("isGhost")).toBe(false);
    p.um(p.a).redo();
    p.converge();
    expect(p.note(p.a).get("fret")).toBe(7);
    expect(p.note(p.a).get("isGhost")).toBe(true);
  }));

  it("L2: undo can still skip a field entry whose note was remotely deleted", () => withPair((p) => {
    p.edit(p.a, () => p.score(p.a).set("title", "Local title"));
    p.set(p.a, "fret", 5);
    p.flush();
    p.edit(p.b, () => notes(p.score(p.b)).delete(0, 1));
    p.flush();
    p.um(p.a).undo();
    p.converge();
    expect(p.um(p.a).undoStack).toHaveLength(0);
    expect(p.score(p.a).get("title")).not.toBe("Local title");
    expect(notes(p.score(p.a)).length).toBe(0);
  }));

  it("L3: structural deletion can still make transaction reversal partial", () => withPair((p) => {
    const title = p.score(p.a).get("title");
    p.edit(p.a, () => { p.score(p.a).set("title", "Local title"); p.note(p.a).set("fret", 5); });
    p.flush();
    p.edit(p.b, () => notes(p.score(p.b)).delete(0, 1));
    p.flush();
    p.um(p.a).undo();
    p.converge();
    expect(p.score(p.a).get("title")).toBe(title);
    expect(notes(p.score(p.a)).length).toBe(0);
  }));

  it.each(["fret", "string", "octave", "tone", "percussionArticulation"])("H9: %s survives interleaved undo/redo", (field) => withPair((p) => {
    const initial = p.note(p.a).get(field);
    p.set(p.b, field, field === "fret" ? 7 : 3);
    p.flush();
    p.set(p.a, field, field === "fret" ? 5 : 2);
    p.um(p.a).undo();
    p.um(p.a).redo();
    // B has not received A's three operations when it undoes its own write.
    p.um(p.b).undo();
    p.flush();
    expect(p.note(p.b).get(field)).toBe(initial);
    expect(p.um(p.b).redo()).not.toBeNull();
    p.converge();
    expect(p.note(p.a).has(field)).toBe(true);
    expect(p.note(p.a).get(field)).toBe(field === "fret" ? 7 : 3);
  }));

  it("keeps ordinary optional-field removal and pitch sentinel round trips", () => withPair((p) => {
    p.set(p.a, "customOptional", "value");
    p.um(p.a).undo();
    expect(p.note(p.a).has("customOptional")).toBe(false);
    p.um(p.a).redo();
    expect(p.note(p.a).get("customOptional")).toBe("value");
    p.set(p.a, "fret", -1);
    p.um(p.a).undo();
    expect(p.note(p.a).get("fret")).toBe(3);
    p.um(p.a).redo();
    expect(p.note(p.a).get("fret")).toBe(-1);
  }));

  it("undo/redo of insertion restores all pitch fields and the note UUID", () => withPair((p) => {
    p.edit(p.a, () => notes(p.score(p.a)).push([createNote(5, 1)]));
    const inserted = notes(p.score(p.a)).get(1).toJSON();
    p.um(p.a).undo();
    expect(notes(p.score(p.a)).length).toBe(1);
    p.um(p.a).redo();
    p.converge();
    expect(notes(p.score(p.b)).get(1).toJSON()).toEqual(inserted);
  }));

  it("H8: document reload restores data but starts with empty local history", () => withPair((p) => {
    p.set(p.a, "fret", 5);
    const oldDoc = p.doc(p.a);
    const restored = new Y.Doc();
    Y.applyUpdate(restored, Y.encodeStateAsUpdate(oldDoc), REMOTE);
    p.a.replaceDoc(restored, restored.getMap("score"));
    oldDoc.destroy();
    expect(p.note(p.a).get("fret")).toBe(5);
    expect(p.um(p.a).undoStack).toHaveLength(0);
    expect(p.um(p.a).redoStack).toHaveLength(0);
  }));
});

function interleave(a: string[], b: string[]): string[][] {
  if (!a.length) return [b];
  if (!b.length) return [a];
  return [
    ...interleave(a.slice(1), b).map((tail) => [a[0], ...tail]),
    ...interleave(a, b.slice(1)).map((tail) => [b[0], ...tail]),
  ];
}
const traces = interleave(["A:set", "A:undo", "A:redo"], ["B:set", "B:undo", "B:redo"]);

describe("H1/H2/H9: bounded offline history schedules", () => {
  for (const reverseIds of [false, true]) {
    for (const field of ["fret", "isGhost"]) {
      it(`converges for 20 interleavings × 64 delivery masks; B=${field}, reverseIds=${reverseIds}`, () => {
        for (const trace of traces) {
          for (let mask = 0; mask < 64; mask++) {
            withPair((p) => {
              try {
                trace.forEach((step, index) => {
                  const [actor, operation] = step.split(":");
                  const engine = actor === "A" ? p.a : p.b;
                  if (operation === "set") {
                    if (actor === "A") p.set(engine, "fret", 5);
                    else p.set(engine, field, field === "fret" ? 7 : true);
                  } else if (operation === "undo") p.um(engine).undo();
                  else p.um(engine).redo();
                  if (mask & (1 << index)) p.flush(index % 2 === 0);
                });
                p.converge();
              } catch (error) {
                throw new Error(`Trace=${trace.join(",")}; deliveryMask=${mask}; reverseIds=${reverseIds}; field=${field}`, { cause: error });
              }
            }, reverseIds);
          }
        }
      }, 30_000);
    }
  }
});
