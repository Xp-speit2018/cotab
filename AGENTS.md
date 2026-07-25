# CoTab Agent Guide

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
