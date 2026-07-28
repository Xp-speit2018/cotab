# CoTab Agent Guide

## Codex Workflow

`AGENTS.md` is the only repository-level coding-agent instruction source.
Do not add tool-specific rule files or permission manifests. Keep durable,
non-obvious project contracts here; keep personal permissions, machine paths,
debug logs, and temporary task notes outside the repository.

Read the relevant implementation and tests before changing behavior. Preserve
the existing module boundaries instead of introducing a second path for Agent
workflows. In particular:

- Treat Y.Doc as the source of truth for shared score data and think through
  CRDT ownership before adding score state.
- Put UI and shortcut behavior in AppActions; put renderer-independent,
  synchronized score mutations in DocumentActions.
- Route user-visible strings through i18next and update both
  `src/i18n/locales/en.json` and `src/i18n/locales/zh-CN.json`.
- Keep commits scoped to one coherent change. Do not amend or force-push
  published commits.
- Attribute commits to the human operator. Do not add AI tools as commit
  authors or `Co-authored-by` trailers.

Run `npm run check:codex-guide` after changing this file or repository commands.
The check rejects legacy coding-agent configuration and validates every
`npm run` command referenced by this guide.

## Repository Verification

The maintained test matrix and directory rules are documented in
`docs/TESTING.md`. Use `npm run verify` for deterministic checks and
`npm run verify:all` for the desktop and browser gates as well.

Maintained Playwright tests belong in `tests/e2e/specs/`; shared browser helpers
belong in `tests/e2e/helpers/`. Files at the root of `tests/e2e/` are ignored local
diagnostics and must not be cited as repository coverage. Vitest unit and
integration behavior runs together under `src/**/*.test.{ts,tsx}`; do not add a
second filename-based integration suite.

When a change affects generated DocumentAction projections, run
`npm run check:action-docs`. Rendering, collaboration, or Agent workflow
changes require the corresponding maintained Playwright spec in addition to
Vitest coverage.

## Repository Layout

- `docs/` contains authored and generated documentation, never executable
  generators.
- `tools/docs/` contains documentation generators; `tools/alphatab/` contains
  model audit tools and their evidence.
- `tests/unit/` contains shared Vitest infrastructure. Unit test files remain
  colocated with source under `src/**/__tests__/`.
- `tests/e2e/` contains all Playwright specs, helpers, and local diagnostics.
- `public/demos/` is the sole source for demo score assets used by the app and
  tests.

Do not recreate top-level `scripts/`, `e2e/`, or `demos/` directories.

## Document Storage

Document storage is independent from collaboration identity. Storage bindings,
paths, credentials, revisions, and auto-save preferences are local session
state and must never enter Y.Doc or room awareness. Opening the same storage
object must not automatically join a room; joining a room must not choose a
storage object. Each room participant independently saves the current shared
Y.Doc to its own binding or remains unbound.

The complete runtime storage state is owned by `EditorEngine.storage` and
projected through `useEditorStore` like selector and transport state. Storage
controllers and providers must not create a parallel Zustand store or private
snapshot as a second source of truth.

Keep provider-neutral lifecycle and conflict handling in `src/storage/`.
Providers implement conditional reads and writes using opaque revisions: local
disk uses content hashes and WebDAV uses ETags. A revision mismatch must fail
before replacement and offer explicit Yjs merge, save-copy, or overwrite
behavior. Do not infer identity from path, document ID, or equal content.

## UI Interaction Harness

The app-native UI interaction harness is available in development builds at
`/__ui-harness`. Start Vite with `npm run dev`, then open
`http://localhost:5173/__ui-harness`. The harness uses CoTab's real providers,
styles, i18n setup, and inspector primitives; do not create a parallel mock
component library for UI review.

Before changing inspector or sidebar interactions, inspect this harness and
preserve its interaction contracts:

- Commands, toggles, disclosures, and choices use the default desktop cursor.
- Inline-edit labels use the default cursor; only the editable value uses the
  text cursor. Leaving edit mode commits the current draft.
- Pointer cursors are reserved for links and navigation.
- Drag, resize, and disabled controls use their corresponding semantic cursor.
- Icon-only commands require a tooltip and an accessible label.
- Every preset dropdown, including controls nested in popovers and dialogs,
  uses `PresetCombobox`. Its input is a regular-expression filter, but only a
  chosen preset or one unique exact label match may update state. Free-form,
  ambiguous, unmatched, and invalid-regex input must leave the previous value
  unchanged.

This preset-only rule includes selectors implemented inside custom popovers or
dialogs, not only HTML or Radix select elements. Multi-select checklists and
numeric shortcut grids are not preset dropdowns: they may remain direct
controls because they do not accept text or project free-form input into state.

Add new reusable interaction patterns to the production primitives first, then
render those same primitives in `src/ui-harness/UiHarness.tsx`. Do not duplicate
their markup inside the harness. Run `npm run test:e2e:ui-harness` after changes.
The static interaction test rejects `cursor-pointer` inside the inspector
component tree so ordinary controls cannot silently drift back to web-link
semantics.

## Document Rendering

Y.Doc is the source of truth for score edits. DocumentActions must mutate Y.Doc
and must not patch `api.score` or AlphaTab DOM nodes directly. The renderer
bridge rebuilds the AlphaTab model from Y.Doc and serializes visible updates.

The existing note-placement experience depends on separate mechanisms. Keep
their responsibilities distinct:

- `document.beat.placeNote` passes a `PendingSelection` with its Y.Doc
  transaction. `postRenderFinished` resolves that selection against fresh
  AlphaTab bounds. This preserves the edit cursor; it is not incremental
  rendering.
- `renderer-bridge.ts` coalesces document changes, calls `api.renderScore()`
  with `reuseViewport`, and suppresses AlphaTab's render-time playback-cursor
  scrolling. This avoids source reloads, blank viewport transitions, and
  playback-cursor focus jumps.
- `firstChangedMasterBar` enables partial reuse only in AlphaTab's Parchment
  layout. AlphaTab's Horizontal layout currently ignores this hint and replaces
  every rendered partial's content. Do not claim that Horizontal property edits
  are incremental until that behavior changes.

When adding a score-editing action:

1. Put all logically atomic Y.Doc mutations in one transaction.
2. Pass `PendingSelection` only when the mutation must restore or move the
   selector after fresh bounds are available.
3. Prefer one bulk DocumentAction for Agent workflows that otherwise require
   many per-note calls. Renderer scheduling can coalesce synchronous Y.Doc
   events, but it cannot coalesce separate awaited MCP calls into one render.
4. Keep renderer behavior in the renderer bridge. Do not add UI, DOM, or
   AlphaTab API dependencies to DocumentActions.

## Rendering Tests

AlphaTab's `reuseViewport` keeps partial placeholder elements connected while
replacing their SVG or canvas children. Therefore `partial.isConnected`, stable
placeholder identity, and the absence of an empty frame prove viewport reuse,
not incremental notation rendering.

Rendering regressions must assert the behavior they name:

- Cursor preservation: assert selector identity and cursor bounds after
  `postRenderFinished`.
- Viewport preservation: assert scroll position, no source `load()`, and no
  blank visible partial.
- Incremental rendering: compare partial content identity or
  `partialLayoutFinished` IDs/ranges. Unchanged systems must retain their
  content; connected placeholder shells are insufficient.
- Agent-visible completion: assert the Y.Doc result and the rendered AlphaTab
  score after the renderer revision settles.

Do not generalize a passing `placeNote` cursor test into a property-rendering
claim. Selection restoration, viewport reuse, and notation-content reuse are
three different contracts.
