# CoTab

[![CI](https://github.com/Xp-speit2018/cotab/actions/workflows/ci.yml/badge.svg)](https://github.com/Xp-speit2018/cotab/actions/workflows/ci.yml)

**Work in progress.** This repo is under active development; scope and APIs may change.

A tablature and notation editor with peer-to-peer collaboration. The goal is to make co-working with tabs easier—for example, to facilitate band rehearsal.

## Tech stack

- **Framework:** React 18, Vite 6, TypeScript (strict)
- **UI:** Tailwind CSS 4, shadcn/ui (Radix UI), Lucide React
- **Rendering:** [@coderline/alphatab](https://github.com/CoderLine/alphaTab)
- **State & collaboration:** Zustand, Yjs
- **Web collaboration adapter:** `y-webrtc`, `y-indexeddb`
- **i18n:** i18next, react-i18next

Audio is planned around Web Audio API (AudioWorklet) and WASM/Faust for effects.

## Architecture

CoTab is currently decentralized: collaboration is CRDT-based peer-to-peer over
Yjs, with a signaling server only used to help peers discover each other.
`EditorEngine` in `src/core` owns the shared score model, editing actions, and
p2p collaboration lifecycle. Host targets provide runtime-specific adapters for
transport, persistence, rendering, and protocol surfaces. These targets should
not become sync authorities.

Action naming is domain-based. `src/app-actions` is the UI/shortcut action
entrypoint for AppActions such as `transport.playPause`; existing
`src/core/actions` are DocumentActions for renderer-independent document
editing. Their definition-owned runtime schemas generate the TypeScript, MCP,
CLI, generic UI-form, and documentation contracts. See
[docs/ACTIONS.md](docs/ACTIONS.md) for the action taxonomy.

Current target boundaries:

- `src/core` is the shared logical engine.
- `src/protocol` contains the transport-independent minimal MCP tools and the
  headless core-edit host used by every agent surface.
- `src/agent` contains the Desktop Codex adapter and its headless logical peer.
  These modules run in the Tauri WebView and are not exposed as a Web product
  capability.
- `src/adapters/web` contains browser/WebView collaboration wiring such as
  WebRTC signaling and IndexedDB persistence.
- Desktop remains a Tauri shell over the Web build. Its native layer is limited
  to host capabilities such as launching the local Codex app-server; score and
  collaboration logic stays in the Web/core targets.
- `src/adapters/local` is the local headless engine host used by the CLI and MCP
  stdio targets.
- `src/cli` and `src/mcp` are command/stdio protocol surfaces over the local
  adapter. The Tauri native layer may launch local agent processes, but score
  operations remain in the shared Web/protocol implementation.
  In this repo, "command" refers to CLI subcommands, not UI actions.
- A normal browser build exposes no Agent UI, model adapter, or LLM credential
  path.

## What’s done

- [x] **Virtual snap-grid note selection** — Click-to-select beats/notes on the score with a snap grid aligned to the notation.
- [x] **Programmatic note/bar/track editing** — Add/delete tracks, bars, beats, and notes; percussion articulations; apply note/beat effects from the sidebar.
- [x] **Score and track metadata editing** — Edit song title, tempo, artist, etc.; per-track name, tuning (presets + custom), capo, transposition, MIDI program/channel.
- [x] **Sidebar editor** — Bar, Note, Effects, and Articulations sections (Notes tab); Song and Tracks (Meta tab); debug tools.
- [x] **Playback** — Load GP/GPX, play/pause, zoom, track volume/mute/solo, SoundFont-based playback.
- [x] **Collaboration plumbing** — Yjs doc, WebRTC room connection, signaling server, IndexedDB persistence; CRDT schema aligned with the score model (DocumentActions for metadata, tempo, tracks, bars, beats, notes).
- [x] **Shortcuts system** — Customisable keyboard shortcuts with platform-adaptive modifiers, multi-digit fret input, percussion digit mapping, cycle/toggle behaviours, and browser conflict detection.
- [x] **CRDT-style p2p coop** — Full real-time collaboration over the Yjs score doc.
- [x] **Tests** — Unit and integration tests covering CRDT schema, sync, actions, and converters.
- [x] **Drag selection and copy/paste** — Multi-bar drag selection with visual overlay, copy/cut/paste single or range of bars (clamped to score bounds), structured clipboard with full beat/note fidelity.
- [x] **Undo/redo coop stack** — Collaborative undo/redo with per-client undo managers, toolbar buttons, and keyboard shortcuts.
- [x] **GP export** — Export scores to GP7 format via toolbar button (unbound shortcut, user-configurable), with export/reimport round-trip tests. Compatibility with other GP7 editors is not verified yet.

## Roadmap

- [x] **Action Protocol v0 and minimal MCP** — Remove the transitional action
  boundaries and expose the `core-edit-v0` semantics through one
  transport-independent MCP tool implementation. The stdio MCP server and
  in-app runtimes must execute the same logical operations; v0 does not promise
  advanced or fluent agent workflows.
- [x] **Desktop Codex connection** — Add a Bot menu to the Tauri title bar that
  detects and connects a locally installed Codex client to CoTab's shared MCP
  surface. Tauri owns Codex's stdio JSONL transport, while tool calls run
  through an on-demand logical peer in the WebView. The peer follows the Codex
  connection lifecycle; the browser target has no corresponding Agent or LLM
  surface.
- [ ] **Server-Authoritative Sync** - Optional future mode in which a
  websocket-backed server owns the authoritative room state and may provide
  persistence. This is distinct from STUN/TURN connectivity fallback: TURN may
  relay encrypted WebRTC traffic while the current collaboration model remains
  p2p CRDT.
- [x] **Layout-independent snap grid** — Remove the snap grid's historical
  single-system technical debt. This is a prerequisite for dual layout support
  and fixed-system incremental rendering.
- [x] **Rendered-stave-aware snap grid** — Split a logical Staff's standard and
  tablature render surfaces so pointer and keyboard snapping target the visible
  stave that the user is editing.
- [x] **Fixed-system incremental rendering** — Reuse unchanged parchment
  systems before the first master bar affected by a document edit.
- [x] **Engineering verification baseline** — Consolidate maintained tests,
  target type checks, generated documentation checks, Web/server builds,
  desktop validation, and browser collaboration tests into one documented CI
  matrix.
- [ ] **UI/UX improvements and unification** — Polish, consistency, and accessibility.
- [ ] **Cloud storage support** — Optional sync/storage in the cloud.
- [ ] **Media synchronization** — Sync backing track with the score playback. Personally I don't think there's a silver bullet for this (e.g. [Taijin Kyofusho](https://the-evpatoria-report.bandcamp.com/track/taijin-kyofusho) has a very dynamic tempo that is hard to perfectly synchronize with the score playback), but a [solution](https://alphatab.net/docs/guides/media-sync-editor) is planned.
- [ ] **High-quality soundfont and effects** — Better default soundfont and audio effects (e.g. AudioWorklet/WASM).

## Getting started

```bash
npm install
npm install --prefix server
npm run dev      # Development server
npm run build    # Production build
npm run desktop:build # Tauri desktop shell over the Web build
npm run preview  # Serve production build
```

Signaling server (for p2p): see `server/README.md`.

## Target Verification

```bash
npm run verify          # types, unit tests, docs, Web and server builds
npm run check:desktop   # locked Rust/Tauri check
npm run test:e2e        # maintained Chromium workflows; requires Docker
npm run verify:all      # complete local equivalent of the CI matrix
npm run cotab:cli -- list-actions
```

See [docs/TESTING.md](docs/TESTING.md) for test layers, directory conventions,
targeted commands, and CI behavior.

## Disclaimer

Sample tablature files included in this repository are transcribed by ear for personal use. All compositions remain the property of their respective copyright holders. If you are a rights holder and would like a file removed, feel free to open an issue.

## License

AGPL-3.0-only. See [LICENSE](LICENSE).
