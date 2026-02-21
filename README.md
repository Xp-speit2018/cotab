# CoTab

**Work in progress.** This repo is under active development; scope and APIs may change.

A tablature and notation editor with peer-to-peer collaboration. The goal is to make co-working with tabs easier—for example, to facilitate band rehearsal.

Copilot with [Cursor](https://cursor.com).

## Tech stack

- **Framework:** React 18, Vite 6, TypeScript (strict)
- **UI:** Tailwind CSS 4, shadcn/ui (Radix UI), Lucide React
- **Rendering:** [@coderline/alphatab](https://github.com/CoderLine/alphaTab)
- **State & collaboration:** Zustand, Yjs, `y-webrtc`, `y-indexeddb`
- **i18n:** i18next, react-i18next

Audio is planned around Web Audio API (AudioWorklet) and WASM/Faust for effects.

## What’s done

- [x] **Virtual snap-grid note selection** — Click-to-select beats/notes on the score with a snap grid aligned to the notation.
- [x] **Programmatic note/bar/track editing** — Add/delete tracks, bars, beats, and notes; percussion articulations; apply note/beat effects from the sidebar.
- [x] **Score and track metadata editing** — Edit song title, tempo, artist, etc.; per-track name, tuning (presets + custom), capo, transposition, MIDI program/channel.
- [x] **Sidebar editor** — Bar, Note, Effects, and Articulations sections (Notes tab); Song and Tracks (Meta tab); debug tools.
- [x] **Playback** — Load GP/GPX, play/pause, zoom, track volume/mute/solo, SoundFont-based playback.
- [x] **Collaboration plumbing** — Yjs doc, WebRTC room connection, signaling server, IndexedDB persistence; CRDT schema aligned with the score model (commands for metadata, tempo, tracks, bars, beats, notes).

## Roadmap

- [ ] **Shortcuts system** — Keyboard shortcuts and command palette (e.g. `react-hotkeys-hook`, `cmdk`).
- [ ] **Drag selection and copy/paste** — Selection ranges and copy/paste using alphatex data.
- [ ] **Undo/redo local stack** — Local history for score edits.
- [ ] **CRDT-style p2p coop** — Full real-time collaboration over the Yjs score doc.
- [ ] **Undo/redo coop stack** — Collaborative undo/redo.
- [ ] **Local GP saving, import/export** — Save/load .gp/.gpx and related formats.
- [ ] **Cloud storage support** — Optional sync/storage in the cloud.
- [ ] **Media synchronization** — Sync backing track with the score playback. Personally I don't think there's a silver bullet for this (e.g. [Taijin Kyofusho](https://the-evpatoria-report.bandcamp.com/track/taijin-kyofusho) has a very dynamic tempo that is hard to perfectly synchronize with the score playback), but a [solution](https://alphatab.net/docs/guides/media-sync-editor) is planned.
- [ ] **UI/UX improvements and unification** — Polish, consistency, and accessibility.
- [ ] **MCP server** — Expose score editing functions (add/delete tracks, bars, notes, metadata, etc.) as an MCP server so AI agents and external tools can drive the editor programmatically.
- [ ] **High-quality soundfont and effects** — Better default soundfont and audio effects (e.g. AudioWorklet/WASM).

## Getting started

```bash
npm install
npm run dev      # Development server
npm run build    # Production build
npm run preview  # Serve production build
```

Signaling server (for p2p): see `server/README.md`.

## Disclaimer

Sample tablature files included in this repository are transcribed by ear for personal use. All compositions remain the property of their respective copyright holders. If you are a rights holder and would like a file removed, feel free to open an issue.

## License

AGPL-3.0-only. See [LICENSE](LICENSE).
