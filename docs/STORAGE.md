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

`.cotab` files contain versioned metadata followed by a full Yjs update.
Providers perform conditional writes against a revision. The local disk
provider uses a content hash; WebDAV will project the same contract onto ETags.
When a revision changes, CoTab offers Yjs merge, save-copy, and explicit
overwrite instead of guessing which file is authoritative.

The provider-neutral implementation is in `src/storage/`. Tauri filesystem
commands are in `src-tauri/src/lib.rs`, and desktop behavior is covered by
`tests/e2e/specs/desktop-storage.spec.ts`.
