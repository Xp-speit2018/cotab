# CoTab

**Work in progress.** This repo is under active development; scope and APIs may change.

A tablature and notation editor with peer-to-peer collaboration. The goal is to make co-working with tabs easier—for example, to facilitate band rehearsal.

Copilot with [Cursor](https://cursor.com) and [Claude Code](https://claude.ai/code).

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
editing. See [docs/ACTIONS.md](docs/ACTIONS.md) for the action taxonomy.

Current target boundaries:

- `src/core` is the shared logical engine.
- `src/adapters/web` contains browser/WebView collaboration wiring such as
  WebRTC signaling and IndexedDB persistence.
- Desktop is a Tauri shell over the Web build, so it uses the Web target
  boundary unless a future native Tauri adapter is added.
- `src/adapters/local` is the local headless engine host used by the CLI and MCP
  stdio targets.
- `src/cli` and `src/mcp` are command/protocol surfaces over the local adapter.
  In this repo, "command" refers to CLI subcommands, not UI actions.

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

- [ ] **Server-Assisted Sync** - Optional future mode for NAT-hostile networks. This may add a websocket-backed room with server authority, but the current architecture remains p2p CRDT.
- [ ] **Agentic score editing** — Expose score editing functions (add/delete tracks, bars, notes, metadata, etc.) through an MCP stdio adapter or skills, so AI agents and external tools can drive the editor programmatically without becoming sync authorities.
- [ ] **UI/UX improvements and unification** — Polish, consistency, and accessibility.
- [ ] **Cloud storage support** — Optional sync/storage in the cloud.
- [ ] **Media synchronization** — Sync backing track with the score playback. Personally I don't think there's a silver bullet for this (e.g. [Taijin Kyofusho](https://the-evpatoria-report.bandcamp.com/track/taijin-kyofusho) has a very dynamic tempo that is hard to perfectly synchronize with the score playback), but a [solution](https://alphatab.net/docs/guides/media-sync-editor) is planned.
- [ ] **High-quality soundfont and effects** — Better default soundfont and audio effects (e.g. AudioWorklet/WASM).

## Getting started

```bash
npm install
npm run dev      # Development server
npm run build    # Production build
npm run desktop:build # Tauri desktop shell over the Web build
npm run preview  # Serve production build
```

Signaling server (for p2p): see `server/README.md`.

## Target Verification

```bash
npm run typecheck:targets  # core, adapters, CLI, MCP
npm run typecheck:adapters # local headless + Web/WebView adapters
npm run verify:targets     # target typechecks, tests, Web/Tauri build
npm run cotab:cli -- list-actions
```

## Disclaimer

Sample tablature files included in this repository are transcribed by ear for personal use. All compositions remain the property of their respective copyright holders. If you are a rights holder and would like a file removed, feel free to open an issue.

## License

AGPL-3.0-only. See [LICENSE](LICENSE).
