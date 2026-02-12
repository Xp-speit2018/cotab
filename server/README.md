# cotab-signaling-server

A lightweight WebSocket signaling server for **CoTab**, the peer-to-peer collaborative guitar tab editor. It coordinates WebRTC connections between peers using a protocol compatible with [y-webrtc](https://github.com/yjs/y-webrtc) and manages room-based sessions.

## Features

- **Room management** — create and query rooms via a simple REST API
- **y-webrtc-compatible signaling** — subscribe/unsubscribe/publish over WebSocket
- **Peer tracking** — broadcasts `peer-joined` / `peer-left` events to room members
- **Heartbeat** — automatic WebSocket ping/pong every 30 seconds
- **Auto-cleanup** — empty rooms are destroyed after a 60-second grace period
- **Docker-ready** — multi-stage Dockerfile for minimal production images

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

The server starts on port **4444** by default.

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

## Configuration

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `PORT` | `4444` | HTTP & WebSocket listen port |

Internal constants (in source):

| Constant | Value | Description |
| -------- | ----- | ----------- |
| `HEARTBEAT_INTERVAL_MS` | 30 000 | WebSocket ping interval |
| `ROOM_CODE_LENGTH` | 6 | Characters in a room code |
| `GRACE_PERIOD_MS` | 60 000 | Delay before an empty room is destroyed |
| `MAX_NAME_LENGTH` | 32 | Maximum display name length |

## REST API

### `GET /`

Health check.

```json
{ "status": "ok", "rooms": 2 }
```

### `POST /api/rooms`

Create a new room. Returns a 6-character room code.

```json
{ "code": "A3K7M2" }
```

### `GET /api/rooms/:code`

Get room info.

```json
{
  "code": "A3K7M2",
  "topic": "room:A3K7M2",
  "peers": [{ "id": "abc123", "name": "Alice" }],
  "peerCount": 1,
  "createdAt": 1718000000000
}
```

## WebSocket Protocol

Connect to `ws://host:port`.

### Authentication (required first)

Send an `auth` message immediately after connecting:

```json
{ "type": "auth", "name": "Alice", "roomCode": "A3K7M2" }
```

For y-webrtc compatibility, you can also pass `roomCode` and `name` as query parameters:

```
ws://host:port?roomCode=A3K7M2&name=Alice
```

**Success:**

```json
{
  "type": "auth-ok",
  "roomTopic": "room:A3K7M2",
  "peers": [{ "id": "xyz", "name": "Bob" }]
}
```

**Failure:**

```json
{ "type": "auth-error", "reason": "Room not found" }
```

### Client Messages

| Type | Fields | Description |
| ---- | ------ | ----------- |
| `subscribe` | `topics: string[]` | Subscribe to signaling topics |
| `unsubscribe` | `topics: string[]` | Unsubscribe from topics |
| `publish` | `topic: string, ...data` | Relay a message to other subscribers on the topic |
| `ping` | — | Keepalive; server replies with `pong` |

### Server Messages

| Type | Fields | Description |
| ---- | ------ | ----------- |
| `auth-ok` | `roomTopic`, `peers` | Authentication succeeded |
| `auth-error` | `reason` | Authentication failed |
| `peer-joined` | `peerId`, `name` | A new peer entered the room |
| `peer-left` | `peerId`, `name` | A peer left the room |
| `pong` | — | Reply to `ping` |

## Project Structure

```
server/
├── Dockerfile
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts        # Entry point — HTTP server, WebSocket upgrade, routing
    ├── auth.ts         # Auth validation and query-param fallback
    ├── rooms.ts        # Room creation, peer join/leave, cleanup timers
    ├── signaling.ts    # Topic-based subscribe/publish relay
    └── types.ts        # Shared TypeScript interfaces for all messages
```

## License

Private — see the root repository for license details.
