# Document Storage

CoTab document storage and collaboration rooms are independent:

- A storage binding belongs to one app session and is never written to Y.Doc.
- Opening the same file does not join a room. Joining a room does not create or
  select a storage binding.
- Every room participant may save the shared Y.Doc state to a different
  provider or remain unbound.
- Auto-save is debounced per session. It includes local, peer, and Agent Y.Doc
  updates because storage observes the document rather than the edit source.

The runtime binding and save status are local Editor State. Their single source
of truth is `EditorEngine.storage`; the storage controller owns operations and
timers, not a second state snapshot.

Providers are registered by stable ID. A binding's `providerId` routes every
later Save and auto-save; a transient UI selection must never redirect a bound
document. Save As may target another provider and replaces the binding only
after the new provider successfully writes the document. An unbound Save may
skip provider selection only when exactly one provider is available.

`.cotab` files contain versioned metadata followed by a full Yjs update.
Providers perform conditional writes against a revision. The local disk
provider uses a content hash. WebDAV reads an ETag and writes with `If-Match`,
or uses `If-None-Match: *` for a new object. Missing ETags fail instead of
silently weakening conflict detection.
When a revision changes, CoTab offers Yjs merge, save-copy, and explicit
overwrite instead of guessing which file is authoritative.

The provider-neutral implementation is in `src/storage/`. Tauri filesystem
commands are in `src-tauri/src/lib.rs`, and desktop behavior is covered by
`tests/e2e/specs/desktop-storage.spec.ts`.

WebDAV server URL and username may be remembered locally. The password remains
in runtime memory and is never written to localStorage, Editor State, Y.Doc, or
the `.cotab` payload. Browser builds use Fetch and therefore require the WebDAV
server to allow CORS. Tauri sends the same GET, HEAD, and PUT protocol through
its native HTTP bridge so desktop storage does not depend on WebView CORS.

For local integration testing, start the development WebDAV service and run the
opt-in test against it:

```sh
docker compose up -d webdav
COTAB_WEBDAV_INTEGRATION_URL=http://127.0.0.1:6065/ npm run test:unit -- \
  --run src/storage/__tests__/webdav-container.test.ts
```

The development credentials are `cotab` / `cotab-dev`. The container stores
test files in a temporary filesystem and exposes the CORS and strong ETag
headers used by the browser provider.
