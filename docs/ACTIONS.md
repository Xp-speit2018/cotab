# Action Terminology

CoTab uses **action** as the user-facing word for behavior that can be invoked
from UI controls, shortcuts, automation, or protocol surfaces.

Do not use `command` to distinguish UI behavior from editor behavior. In this
repo, **command** is reserved for command-line subcommands such as
`cotab:cli list-actions`.

## Action Layers

### AppAction

An AppAction is the top-level action namespace that shortcuts and UI controls
should bind to.

Current implementation: `src/app-actions`.

Examples:

- `document.edit.beat.placeNote`
- `selector.nextBeat`
- `transport.playPause`
- `view.toggleSidebar`

The AppAction namespace may delegate to lower-level registries. Shortcut
bindings reference AppAction IDs, not React callbacks or CLI commands.

### DocumentAction

A DocumentAction is a headless action over `EditorEngine` and the score
document. Existing modules under `src/core/actions` are the current
DocumentAction implementation, although the code still uses the generic
`Action*` type names.

Most DocumentActions mutate the Y.Doc score and are undoable. Some existing
headless actions manage local editor state needed for document editing, such as
selector navigation, history, clipboard, or pending selection. These actions
must remain renderer-independent.

DocumentActions are safe for CLI and MCP surfaces because they do not depend on
React, the browser DOM, or the AlphaTab renderer instance.

### TransportAction

A TransportAction controls local playback behavior.

Examples:

- `transport.playPause`
- `transport.play`
- `transport.pause`
- `transport.stop`
- `transport.setPlayheadToSelector`
- `transport.seekToStart`
- `transport.toggleLoop`

TransportActions are local editor/application state. They must not write to the
Y.Doc and must not be synchronized through the shared score document. They may
call renderer/player APIs, so they belong above `src/core/actions`.

### ViewAction

A ViewAction controls local UI presentation.

Examples:

- `view.toggleSidebar`
- `view.toggleDebugPanel`
- `view.zoomIn`
- `view.zoomOut`

ViewActions are local UI state. They must not be exposed as score-editing
operations through CLI/MCP unless a target explicitly provides equivalent view
state.

## Naming Rules

- Use `*.action` terminology for app behavior, shortcut bindings, and UI
  triggers.
- Use `command` only for CLI subcommands.
- Keep transport and view actions out of `src/core/actions`.
- Keep Y.Doc mutations and renderer-independent document editing in
  `src/core/actions` until that registry is renamed or split.
- Prefer domain-first IDs: `document.*`, `selector.*`, `transport.*`,
  `view.*`.

## Current Transitional State

The codebase still has historical IDs such as `edit.beat.placeNote` and
`nav.setSelection`. Do not rename them mechanically. `src/app-actions` currently
registers these DocumentActions as AppActions through a proxy, while native
transport actions use IDs such as `transport.playPause`.

Shortcuts and the transport toolbar already dispatch through AppAction. Some
editor panels still call DocumentActions directly and can be migrated
incrementally.
