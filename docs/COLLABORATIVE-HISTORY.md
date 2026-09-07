# Collaborative History Semantics

## Status and scope

This is an executable baseline and a design specification, not a proof of
arbitrary collaborative histories. Production Undo/Redo uses the conservative
pitch-field deletion guard described below and enables
`ignoreRemoteMapChanges: true` for Google Sheets/Slides-style field history.
The baseline uses the repository's installed Yjs 13.6.29 and the real
`EditorEngine` UndoManager configuration. Re-run the suite on Yjs upgrades.

Offline editing is a requirement. A room relays and recovers shared state;
it does not grant permission for each local edit or own a global undo stack.
Document storage bindings remain independent of collaboration and history.

Required-field preservation (H9) has a passing regression for an upstream
UndoManager failure: interleaved Undo/Redo could remove a required note field.
The engine retains a pitch deletion guard as defense in depth; the selected
overwriting history policy now completes the original regression with a value.
This is bounded evidence, not a guarantee of general score validity.

## Product precedents and design implications

Research reviewed on 2026-09-07. Historical engineering descriptions and
published experiments are evidence at their publication dates, not verification
of today's proprietary implementations. No live Google Docs account experiment
was performed for this review.

Google's [2013 Realtime API announcement](https://gsuite-developers.googleblog.com/2013/04/new-features-for-google-drive-realtime.html)
describes undoing local changes while resolving overlapping collaborative edits,
using technology shared with Docs, Sheets, and Slides. It does not specify the
current Docs editor's table, object-deletion, or offline Undo/Redo edge cases.
Google separately documents [offline editing](https://support.google.com/docs/answer/6388102?hl=en)
and [version recovery](https://support.google.com/docs/answer/190843?hl=en).
These are separate capabilities; neither documents a universal promise that
undoing creation preserves subsequent foreign edits inside the object.

Stewen and Kleppmann's 2024 [register Undo/Redo study, section 2](https://arxiv.org/html/2404.11308v1#S2)
reports sequential, immediately synchronized tests of Google Sheets, Slides,
Excel Online, PowerPoint Online, Figma, and Miro. For most tested products,
local undo can overwrite later foreign assignments to the same register; redo
restores the value immediately before undo. Miro instead blocked undo after a
remote assignment. The study did not test Google Docs body text or object
creation/deletion. Its register algorithm is not a drop-in Yjs tree solution.

For example, given `3 -> A:5 -> B:7`, the reported mainstream register policy
produces `A:undo -> 3; A:redo -> 7`. CoTab now adopts this behavior with
Yjs's `ignoreRemoteMapChanges: true` option. **Local history ownership and remote
value protection are distinct policy choices.** This option is marked
experimental in the installed Yjs version; the named round-trip regressions and
offline schedules are required evidence when upgrading it.

Figma's [2019 engineering description](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)
explains that undo updates redo history, and vice versa, to preserve a round trip
back to the pre-undo document. It also separates explicit object creation/deletion
from property writes: a property write cannot create an absent object; deleted
properties are retained in the deleting client's undo buffer for restoration.
This supports treating object lifetime separately from field history. It does
not specify every interleaving of undo-creation and remote child edits. Its
server-ordered protocol and reconnect strategy differ from CoTab's Yjs merge.

ProseMirror's [history documentation](https://prosemirror.net/docs/ref/#history)
and Liveblocks' [multiplayer undo guide](https://liveblocks.io/docs/guides/how-to-use-liveblocks-multiplayer-undo-redo-with-redux)
also distinguish selective local history from replacing the document with an
older snapshot. Independent-field examples do not establish same-field or
parent-deletion guarantees.

### Selected field policy and remaining structural scope

Keep session-local history and offline edits. Undo a field assignment to its
pre-edit value even after a received foreign overwrite. Redo restores its
pre-undo value. A new foreign edit between Undo and Redo may itself be
overwritten by Redo; the next Undo restores that newly overwritten value.
This intervening-edit behavior is an explicit CoTab policy tested locally, not
a claim of verified Google Docs parity. H9 remains a separate data-integrity
regression. Independent-field, same-field, multi-field, multiple-entry round
trips, and bounded offline delivery tests cover the selected implementation.

Treat undoing creation as an object-lifetime operation that may hide subsequent
child edits. Consider allowing that removal with an explicit recovery path,
instead of automatically refusing it whenever a foreign edit is observed.
Observed-only protection behaves differently online and offline. Recovery must
specify how late offline child edits are retained and restored; the current
UndoManager and room restart snapshot do not provide durable version history.
Durable recovery remains a proposal, not an implemented guarantee or a claim
about Docs. Existing creation Undo still removes the object.

Maintain and extend the behavior matrix (durable recovery remains unimplemented):

- Independent fields and sequential overwrites of one field.
- Undo then redo with no intervening edits: return to the pre-undo visible state.
- A new peer edit between undo and redo, including delayed offline delivery.
- Undo creation after observed and unobserved foreign child edits.
- Restore a deleted object after reconnect and after local history is lost.
- Multi-field musical constraints and structural validity after partial undo.

For any direct Google Docs comparison, test text insertions, formatting, and
container deletion separately with two accounts, explicit gesture boundaries,
and recorded connectivity. Until measured, those cells remain unknown.

## State and identities

For an editing session `s`, model the local state as `R_s = (D_s, U_s, V_s)`:

- `D_s`: its Y.Doc, including CRDT structure and deletion information.
- `U_s`: its local undo stack; `V_s`: its local redo stack.
- `visible(D_s)`: the score projection consumed by conversion/rendering.

A score entity has a domain UUID and is represented by nested Y.Map/Y.Array
nodes. Array position is not identity. A restored entity may retain its UUID
without retaining the same JavaScript reference or internal CRDT item identity.
Tests resolve entities again after structural undo rather than retaining old
Y.Map references.

The history owner is an editing session, not a human account. Two tabs or an
Agent peer may have separate histories even when operated by the same person.
Currently `EditorEngine.localEditYDoc` uses its document's clientID as the local
transaction origin. This is runtime provenance, not a stable account ID or a
wire-format authorization claim. Remote and persistence updates use distinct,
untracked origins. UndoManager itself is a tracked origin for inverse edits.

Write `a -> b` when b is executed after its session has observed a, including
same-session program order; take the transitive closure. If neither `a -> b`
nor `b -> a`, the operations are concurrent. Wall-clock time and server arrival
order do not define this relation. Offline replicas may have different visible
states and different knowledge when they choose an operation.

## Transitions

| Transition | Meaning |
|------------|---------|
| `Edit_s(g)` | Apply a gesture's mutations in a local Y.Doc transaction; record it in local history. A new tracked edit clears local redo. |
| `Receive_s(update)` | Apply the CRDT update with an untracked origin. Do not add it to local undo or clear local redo. Duplicate delivery is allowed. |
| `Undo_s` | Ask Y.UndoManager to reverse an effective captured local entry against the current document. Queue any resulting CRDT update for ordinary synchronization. |
| `Redo_s` | Reverse an effective undo entry against the current document; do not replay a stale application command or replace the document with a snapshot. |
| `Reload_s(snapshot)` | Recover document state into a new Y.Doc and attach a new UndoManager. Local stacks start empty. |

Undo/Redo may have no effect, skip ineffective entries, or reverse only the
still-effective parts of an entry. A nonempty stack is not proof that the next
call will visibly change the score. `UndoManager.undo()/redo()` returning a
StackItem is distinct from the application's current command response:
DocumentActions return no effect result, and the core-edit host currently
returns true whenever a manager exists, even when no entry is effective.
A future UI/API effect result needs a separate implementation change.

The executable model calls `stopCapturing()` around gestures. Production still
uses Yjs's default 500 ms capture window. Therefore this specification does not
claim production already separates gestures by user intent. Bulk editing,
continuous input, and dragging need explicit grouping boundaries before that
can become a product guarantee. A captured transaction is an undo unit, not a
promise of all-or-nothing reversal after remote edits.

## Properties and evidence

| ID | Property | Evidence/status |
|----|----------|-----------------|
| H1 | Once all generated updates are delivered, replicas have equal visible score projections and state vectors, despite reordered/duplicate delivery. | Bounded generated schedules pass; not a proof for all histories. |
| H2 | Applying received updates, including another session's Undo/Redo, leaves the receiver's local history entries unchanged. | Asserted at every modeled delivery. |
| H3 | Undo of one field preserves a remote edit to an independent field of the same surviving object. | Named note-field test and rendered browser metadata test. |
| H4 | Field Undo restores the pre-edit value despite a later remote assignment; Redo restores the pre-undo value. Independent fields remain unaffected. | Named same-key, intervening-edit, multi-field, and multiple-entry tests; browser test checks both replicas and rendered metadata. |
| H5 | Remote edits do not clear local redo; a new local tracked edit does. | Named stack lifecycle test. |
| H6 | Undo of a field edit does not resurrect its remotely deleted note. | Named structural test. |
| H7 | Without conflicting edits, delete/undo restores a note's domain UUID and fields, and redo removes it again. | Named structural round-trip test. |
| H8 | Reload recovers score data without restoring local undo/redo stacks. | Named engine document-replacement test; no persistent history claim. |
| H9 | Surviving notes retain their pitch fields after the modeled history operations. | `fret` checked throughout the bounded schedules; named regression for `fret`, `string`, `octave`, `tone`, and `percussionArticulation`. General score validity is not established. |

No-conflict round trips compare visible content, not binary snapshot identity:
Undo/Redo creates CRDT history rather than rewinding the document's internal
clock. A stronger definition of score validity must also cover parent/child
relationships, aligned bar counts, references, and notation-specific fields.
Those structural properties are outside this small model's coverage.

## Known limitations and counterexamples

### L1: undoing creation can hide another person's edits

A inserts note N; B receives it and modifies N; A undoes insertion. N is removed,
including B's visible contribution. The same outcome occurs if A has not yet
received B's modification. Both traces are executable characterization tests,
not an endorsement of this UX.

A preflight check can protect only edits A has observed. While offline, A
cannot distinguish an unobserved B edit from no B edit. Unconditional offline
undo of creation, immediate final deletion, and preservation of all unseen
remote child edits cannot all be promised together. Protecting such edits
requires additional merge-time semantics or a recoverable deletion model.

### L2: one call can skip an entry

A edits the score title, then a note's fret. B deletes the note. A's next
Undo skips the unavailable note-field entry and reverses the older title edit.
A same-field overwrite alone no longer causes skipping. A UI displaying only
the most recent action label can still be misleading after structural deletion.

### L3: a transaction can be partially reversed

A changes the score title and a note's fret in one transaction. B deletes the
note. A's Undo reverses the title but does not resurrect the note. Logical
constraints spanning multiple entities need explicit validation; transaction
grouping alone does not provide that validation. Ordinary same-field overwrites
no longer cause partial reversal in the named multi-field regression.

### H9 regression: convergence does not imply required-field preservation

Initial shared note: `fret = 3`. Each numbered edit/history call is a separate
gesture. A has clientID 10; B has clientID 11 in the reproducible fixture.

1. B sets fret to 7; deliver to A.
2. A sets fret to 5, undoes it, then redoes it; hold these updates from B.
3. B undoes its own write without observing A's three operations.
4. Exchange the queued updates; both replicas show fret 3.
5. Under the original protective configuration without the guard, B redoes;
   exchange updates. Both replicas have **no fret key**.

`src/core/editor/history.ts` supplies the engine UndoManager
`deleteFilter`. Yjs attempts restorations before calling this filter. If the
current map entry would be deleted without a replacement, the filter protects
these note fields: `fret`, `string`, `octave`, `tone`, and
`percussionArticulation`. Under the former protective policy, the guarded step 5
was ineffective and fret stayed 3. With the selected overwriting policy, step 5
restores fret 7. All five fields retain passing regressions.
No default is guessed, and no snapshot or application command is replayed.

The filter depends on the Yjs Item metadata exposed to this hook; retain the
regressions when upgrading Yjs. Sentinel values remain ordinary values.
Optional-field removal and whole-note insertion/deletion history still work.
The guard does not repair already-invalid documents, validate cross-field
musical constraints, or protect against deletions received from unguarded peers.
It does not change partial reversal or skipped-entry behavior.

## Executable coverage

`src/core/__tests__/collaborative-history.test.ts` uses real engines, the real
score hierarchy, and raw Yjs updates. Each session runs `set; undo; redo`.
It enumerates all 20 interleavings preserving each session's order, all 64
choices of delivery boundaries, both relative clientID orders, and same-field
versus different-field writes: **5,120 deterministic schedules**. Final delivery
replays updates in reverse order and again in forward order. Failures identify
the trace, delivery mask, field, and clientID order.

This bounds two sessions, one existing note, two fields, and six local calls.
It checks H1/H2/H9 and visible UUID uniqueness. It does not exhaust arbitrary
packet permutations, arbitrary program lengths, creation/deletion schedules,
GC settings, devices, or every score invariant. Structural conflicts and the
H9 counterexample have separate named tests.

`tests/e2e/specs/collaborative-history.spec.ts` exercises production AppActions
in two isolated browser contexts over the current WebRTC provider. It checks
both Y.Doc metadata and the settled AlphaTab model after selective Undo/Redo.
It does not establish WebSocket-provider parity or cursor restoration.

Run:

```sh
npm run test:unit -- src/core/__tests__/collaborative-history.test.ts
npm run test:e2e -- tests/e2e/specs/collaborative-history.spec.ts
```

## Decisions before stronger product guarantees

1. Extend validity checks beyond pitch-key presence to cross-field musical and
   structural constraints, retaining the H9 regression and generated schedules.
2. Choose deletion semantics: current removal, protection for observed foreign
   edits, or a recoverable/merge-aware deletion model. The latter two are not
   implemented by this document.
3. Define whether partial reversal and skipped entries are acceptable, then
   implement truthful action labels and effect results through existing actions.
4. Define gesture boundaries and history ownership for Agent work; retain
   session-local stacks unless cross-session history is explicitly designed.
5. If cross-restart Undo/Redo is required, design durable local provenance and
   retention/GC together. Saving Y.Doc alone does not save UndoManager stacks.

References: [Yjs selective UndoManager](https://docs.yjs.dev/api/undo-manager),
[transaction origins and document updates](https://docs.yjs.dev/api/document-updates).
Repository source and executable tests take precedence over assumptions about
other Yjs versions.
