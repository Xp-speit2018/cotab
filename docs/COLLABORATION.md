# Collaboration Architecture

## Status

CoTab is migrating from its legacy signaling transport to a server-relayed
WebSocket service. The target runtime is Cloudflare Workers with one Durable
Object per collaboration room. Docker runs the same Workers runtime locally;
it is not a production container deployment.

The migration is deliberately staged. The legacy server remains available for
the maintained browser suite until the Web client adapter and equivalent tests
move to the new protocol.

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

The initial room store keeps a compact merged Yjs update. Before the demo allows
larger documents, snapshots must be chunked below the Durable Object row/value
limit. Long-lived append-only update logs are not acceptable; updates must be
compacted and obsolete chunks deleted.

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
- Text frames are control messages only. The foundation accepts `ping` and
  reports durable revisions after a successful snapshot write.

The browser provider is not part of the infrastructure foundation. Before it
replaces the legacy adapter, the protocol must add a state-vector handshake or
equivalent reconnect exchange so clients transfer only missing state.

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

1. Add the Worker, Durable Object, local Wrangler container, room API, and
   versioned WebSocket boundary.
2. Add the browser WebSocket provider and state-vector synchronization while
   retaining IndexedDB.
3. Move maintained collaboration E2E tests to the Worker service.
4. Remove the legacy signaling server, its TURN dependency, and obsolete
   transport diagnostics.
5. Add retention, abuse controls, observability, and production deployment.
