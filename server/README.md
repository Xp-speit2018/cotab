# CoTab collaboration server

CoTab uses the Cloudflare Workers room service in `worker/`, with a Durable
Object per room. The legacy signaling service remains available during cleanup
but is no longer used by the product adapter.

The engineering decisions and migration phases are recorded in
[`docs/COLLABORATION.md`](../docs/COLLABORATION.md).

## Legacy Node service

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

## Cloudflare-compatible local service

Run the Worker and its local Durable Object storage:

```bash
docker compose up --build collaboration
```

The container runs Wrangler's local Workers runtime and persists its development
state in the `collaboration-data` volume. The browser uses
`VITE_COLLABORATION_URL=http://localhost:8787` by default. Run the Compose command
from the repository root. Room invitations contain both a room ID and a private
capability; the complete invitation is required to join. Production deployment uses
`wrangler deploy`, not this image.

## Legacy signaling service

From the repository root, start the signaling server:

```bash
docker compose up --build signaling
```

To run only the signaling image:

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
