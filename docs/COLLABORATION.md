# Collaboration Architecture

## Status

CoTab uses a server-relayed WebSocket service running on Cloudflare Workers,
with one Durable Object per collaboration room. The product adapter and
maintained collaboration tests use this service. Docker runs the same Workers
runtime locally; it is not a production container deployment.

The infrastructure foundation now has a Worker room API, capability-protected
WebSockets, bidirectional state-vector exchange, bounded document admission,
and chunked SQLite snapshots. The production browser adapter uses this protocol
with fixed-window batching, IndexedDB recovery, reconnect, and live membership.

Offline editing and session-local Undo/Redo semantics are specified separately
in [Collaborative History](COLLABORATIVE-HISTORY.md). The current history
baseline includes a pitch-field preservation guard for interleaved Undo/Redo;
transport migration alone does not establish history semantics.

## Ownership Boundaries

- Y.Doc is the shared score model. Network and storage adapters transport or
  recover Yjs updates; they do not introduce another score representation.
- A room is the unit of routing, ordering, authorization, and recovery. One
  room maps to one Durable Object.
- Collaboration recovery storage is not a user file binding. It must never
  select or overwrite local disk or WebDAV storage.
- Awareness is ephemeral. Names, cursors, selections, connection statistics,
  and live membership are never written into the durable room snapshot.
- Anonymous access uses an unguessable room code plus a capability token. Only
  a token hash is stored server-side, and the token must not be put in Y.Doc.

## Synchronization and Persistence

Interactive visibility and durable storage use different batching policies:

1. A browser merges small Yjs updates for roughly 100–200 ms, with a maximum
   network delay of 500 ms.
2. The room broadcasts accepted document updates immediately.
3. The room merges dirty state and persists after two seconds of inactivity,
   with a hard maximum dirty interval of ten seconds.
4. IndexedDB retains the browser's Y.Doc so a reconnect can repair any update
   that was broadcast but not yet persisted.
5. Hiding the page, switching documents, or deliberately leaving a room should
   request an immediate client flush. Browser shutdown delivery remains best
   effort.

A pure trailing debounce is forbidden: continuous editing must still reach
durable storage at the maximum interval. Presence traffic may be throttled but
is never persisted.

The room store keeps a compact merged Yjs update in 64 KiB SQLite chunks.
Snapshot replacement deletes old chunks and increments the room revision in
one synchronous transaction. A `durable` notification is sent only after the
storage sync completes. Write failures report `persistence-error` and schedule
a retry. Long-lived append-only update logs are not used.

The foundation caps an encoded document at 1,000,000 bytes so a complete
reconnect update fits inside the 1 MiB frame limit. Each update is validated on
a temporary Y.Doc before replacing the live room document; invalid and
over-capacity updates are rejected before broadcast. This bounded validation
copies the current document per update and should be profiled before raising
the demo's size or traffic limits.

The first implementation uses a short in-memory persistence timer. A runtime
reset before that timer completes may discard the server's dirty buffer, so the
client adapter must resynchronize from its local Y.Doc on reconnect. A later
durable acknowledgement protocol may retain unacknowledged batches explicitly
in IndexedDB if product requirements demand server-confirmed saves.

## Wire Protocol Foundation

The Cloudflare service starts with protocol `cotab-yjs-v1`:

- The WebSocket handshake carries the capability in a secondary
  `Sec-WebSocket-Protocol` value prefixed with `cotab-auth.`. This avoids putting
  the secret in a URL or routine request logs.
- Binary frame type `0` carries a Yjs document update. The room applies it,
  broadcasts it to other sockets, and schedules durable persistence.
- Binary frame type `1` is reserved for awareness and is broadcast without
  persistence.
- Binary frame type `2` carries a Yjs state vector. The server sends its vector
  on connection. The client answers with a type `0` update containing its
  missing state and sends its own type `2` vector. The server answers that
  vector with a type `0` update. Receiving a document update does not trigger
  another vector response. This repairs missing state in both directions.
- Text frames are control messages only. The foundation accepts `ping` and
  reports durable revisions after a successful snapshot write.

After answering a state-vector request, the server sends `sync-complete` with
its current vector. The browser sends any remaining local difference, including
edits made during the handshake, and marks the session synchronized. This is a
transport handshake, not a durable-save acknowledgement.

The browser sends `presence` controls with its display name and synchronization
status. The server assigns a connection ID and broadcasts an authoritative
`members` roster on presence changes and socket close/error. Identity lives in
live socket attachments, which survive hibernation but are not room snapshots.
Frame type `1` remains an ephemeral relay; it is not the membership mechanism.

## Browser Provider

Set `VITE_COLLABORATION_URL` to the Worker HTTP origin (local default:
`http://localhost:8787`). The adapter derives the WebSocket endpoint. The room
UI copies and accepts a `roomId.capability` invitation. Keep the entire invitation
private to intended participants. Capabilities stay in the adapter's memory;
EditorEngine exposes only the room ID in its ordinary state. Invitations must be
pasted again after reopening the app and are never written into Y.Doc or
IndexedDB keys. Legacy six-character room codes are not Worker invitations.

IndexedDB recovery keys include the service origin and room ID. Late cache
updates follow the same outbound document path as edits. A fixed 150 ms batch
window bounds delay during continuous editing. Hidden pages, document switches,
and deliberate room departure request an immediate flush. Disconnected changes
remain in Y.Doc and IndexedDB rather than an unbounded network queue.

A heartbeat detects silent sockets, and reconnect repeats the bidirectional
state-vector exchange with exponential backoff capped at eight seconds. Once a
session has synchronized, transient outages keep retrying. Initial connections
stop after eight failed attempts while online; malformed and oversized updates
stop immediately with an error. Capacity and persistence failures are visible
in the room dialog. Local edits remain available when the server rejects them.
`webSocketConnected` and `serverSynced` distinguish transport readiness from
membership.

## Storage and Scaling

Durable Object SQLite is the hot room store for the merged snapshot, capability
hash, timestamps, and recovery metadata. It is intentionally not the global
document catalogue or permanent version archive.

Scaling is per room: different room IDs distribute across different Durable
Objects, while one room remains a single ordered execution unit. This matches
small band and editing sessions. A single very large public room can still
become a hotspot and is outside the initial product target.

Introduce other services only when their access pattern exists:

- D1 for global document indexes, administrative expiry queries, or abuse
  controls.
- R2 for cold history, exported `.cotab` copies, audio, and large assets.
- Per-room alarms for anonymous-room expiry and idempotent cleanup.

Keep Durable Object storage calls behind the server adapter boundary and keep
the payloads as standard Yjs updates. This preserves a migration path to a
different WebSocket host without changing score semantics.

## Initial Demo Guardrails

- Reject oversized WebSocket frames and cap the recoverable Yjs snapshot.
- Limit sockets per room and rate-limit room creation before public launch.
- Validate WebSocket origins; do not use wildcard credentialed CORS.
- Never log capability tokens, full handshake headers, or document payloads.
- Expire inactive anonymous rooms and expose explicit error states when free
  plan storage or request limits are reached.
- Test room isolation, unauthorized connection rejection, concurrent relay,
  reconnect repair, persistence after runtime eviction, and expiry cleanup.

## Migration Phases

| Phase | Status | Exit criteria |
|-------|--------|---------------|
| Worker foundation | Implemented | Room authorization, concurrent merge, isolation, bounded admission, continuous-edit persistence, offline repair, and nonempty snapshot recovery after a Docker runtime restart pass in the maintained foundation spec. |
| Browser provider | Implemented | Existing engine adapter uses the WebSocket exchange; IndexedDB, bounded batching, capability sharing, reconnect, and ephemeral membership work through the product UI. |
| Product verification | Implemented | Maintained collaboration and Agent workflows run against the Worker and assert shared Y.Doc results and settled rendering. |
| Legacy removal | Complete | Signaling, TURN, WebRTC dependencies, and obsolete transport diagnostics have been removed. |
| Public deployment | Pending | Retention, abuse controls, observability, explicit capacity errors, and a deployment/rollback procedure are verified. |

The foundation spec is `tests/e2e/specs/cloudflare-collaboration-foundation.spec.ts`.
It restarts the local `collaboration` container against its existing volume;
run it against a development service, not a shared production endpoint.
It does not establish production failover guarantees. Product behavior is
covered separately by `coop.spec.ts` and `collaborative-history.spec.ts`,
including offline/cache recovery, Agent edits, and settled rendering. Protocol
unit tests also verify client/server frame compatibility using real Yjs state
vectors and updates.
