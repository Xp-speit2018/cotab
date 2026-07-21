# CoTab Agent Guide

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
