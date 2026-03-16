# cotab-signaling-server

A lightweight WebSocket signaling server for **CoTab**, the peer-to-peer collaborative guitar tab editor. It coordinates WebRTC connections between peers using a protocol compatible with [y-webrtc](https://github.com/yjs/y-webrtc) and manages room-based sessions.

## Quick Start

### Prerequisites

- Node.js 22+
- npm

### Install & Run

```bash
npm ci
npm run build
npm start
```

The server starts on port **4444** by default. Override with the `PORT` environment variable.

### Development

```bash
npm run dev
```

Runs TypeScript in watch mode alongside a Node.js file watcher for automatic rebuilds.

## Docker

```bash
docker build -t cotab-signaling-server .
docker run -p 4444:4444 cotab-signaling-server
```

Override the port:

```bash
docker run -p 8080:8080 -e PORT=8080 cotab-signaling-server
```

## API Reference

See the [Signaling Server API](https://github.com/Xp-speit2018/cotab/wiki/Signaling-Server-API) wiki page for full documentation of REST endpoints, WebSocket protocol, and configuration constants.

## License

Private — see the root repository for license details.
