# CoTab collaboration server

The Cloudflare Worker in `worker/` routes each room to a Durable Object. Yjs
updates and chunked room snapshots provide synchronization and recovery;
live membership remains separate from the durable document.

Protocol, ownership, and deployment requirements are documented in
[`docs/COLLABORATION.md`](../docs/COLLABORATION.md).

## Local development

From the repository root:

```bash
docker compose up --build collaboration
```

The container runs Wrangler's local Workers runtime on port **8787** and keeps
recovery data in the `collaboration-data` volume. The browser defaults to
`VITE_COLLABORATION_URL=http://localhost:8787`. Invitations contain a room ID
and a private capability; the complete invitation is required to join.

For development without Docker, from this directory using the repository's
Node version:

```bash
npm ci
npm run dev
```

## Verification and deployment

```bash
npm run build
```

This typechecks the Worker and performs a Wrangler dry-run bundle in `dist/`.
The maintained browser suite uses Docker to verify runtime restart recovery.
Production deployment uses `wrangler deploy`, not the local Docker image;
public deployment guardrails remain listed in the architecture document.
