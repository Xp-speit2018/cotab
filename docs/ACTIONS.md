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

- `document.beat.placeNote`
- `selector.set`
- `transport.playPause`
- `view.toggleSidebar`

AppAction lookup composes native selector/transport/view actions with the
DocumentAction registry. DocumentActions are resolved directly rather than
copied into a proxy registry. Shortcut bindings reference AppAction IDs, not
React callbacks or CLI commands.

### DocumentAction

A DocumentAction is a headless action over `EditorEngine` and the score
document. Modules under `src/core/actions` define an immutable catalog of
`DocumentActionDefinition` values.

Each definition owns one strict-object `argsSchema`. The schema is the only
argument contract: TypeScript argument types are inferred from it, and runtime
validation happens before an action can execute. Empty-argument actions accept
`{}`. Scalar, array, or null top-level arguments are invalid and are never
coerced into object arguments.

Most DocumentActions mutate the Y.Doc score and are undoable. History and
clipboard actions remain renderer-independent document operations. Selector
actions are local AppActions and do not live in the DocumentAction registry.

DocumentActions are safe for CLI and MCP surfaces because they do not depend on
React, the browser DOM, or the AlphaTab renderer instance.

### TransportAction

A TransportAction controls local playback behavior.

Examples:

- `transport.playPause`
- `transport.stop`
- `transport.setPlayheadToSelector`
- `transport.toggleLoop`

TransportActions are local editor/application state. They must not write to the
Y.Doc and must not be synchronized through the shared score document. They may
call renderer/player APIs, so they belong above `src/core/actions`.

### ViewAction

A ViewAction controls local UI presentation.

Examples:

- `view.setTrackVisible`

ViewActions are local UI state. They must not be exposed as score-editing
operations through CLI/MCP unless a target explicitly provides equivalent view
state.

## Naming Rules

- Use `*.action` terminology for app behavior, shortcut bindings, and UI
  triggers.
- Use `command` only for CLI subcommands.
- Keep transport and view actions out of `src/core/actions`.
- Keep Y.Doc mutations and renderer-independent document editing in
  `src/core/actions`.
- Prefer domain-first IDs: `document.*`, `selector.*`, `transport.*`,
  `view.*`.

## Protocol v0

Public IDs are domain-first: DocumentActions use `document.*`, selector actions
use `selector.*`, and local transport/view actions retain their own domains.
Protocol v0 may still change these IDs and argument shapes without compatibility
aliases.

The action catalog is projected into runtime validation, `list_actions`, MCP
JSON Schema, CLI action descriptions, generic UI form definitions, and the
[generated action reference](DOCUMENT-ACTIONS.generated.md). Run
`npm run docs:actions` after changing a definition; `npm run check:action-docs`
detects stale generated output.

Production UI, shortcut handling, and local app-state entrypoints dispatch
through AppAction. Direct DocumentAction execution is reserved for the core
action implementation, headless target adapters such as CLI/MCP/local engine,
and focused DocumentAction tests.

The boundary is guarded by `src/core/__tests__/target-boundaries.test.ts`, which
fails if UI, shortcut, or local app-state code imports `@/core/actions`
directly.

## Minimal MCP

`src/protocol/minimal-mcp.ts` is the single tool definition and dispatch layer
for protocol v0. It exposes score inspection, DocumentAction execution,
peer-local selector control, and peer-local undo/redo. Every `execute_action`
call carries `{ id, args }`, where `args` is the strict object defined by that
action's schema. Invalid arguments fail before the host invokes the action and
therefore cannot update the Y.Doc.

The stdio MCP server and the browser Agent Worker both execute this dispatcher.
Tauri connects Codex dynamic tools to the browser worker, so local Codex edits
the current logical peer instead of an unrelated headless document.
