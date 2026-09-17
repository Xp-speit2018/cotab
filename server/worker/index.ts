import { RoomDurableObject } from "./room";
import {
  COTAB_PROTOCOL,
  createCapabilityToken,
  createRoomCode,
  hashCapability,
} from "./protocol";
import type { Env } from "./env";

export { RoomDurableObject };

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5175",
  "http://127.0.0.1:5175",
];

function allowedOrigins(env: Env): Set<string> {
  return new Set(
    env.COTAB_ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean)
      ?? DEFAULT_ALLOWED_ORIGINS,
  );
}

function isAllowedRequestOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get("Origin");
  return origin === null || allowedOrigins(env).has(origin);
}

function corsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers({ Vary: "Origin" });
  const origin = request.headers.get("Origin");
  if (origin && allowedOrigins(env).has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
  }
  return headers;
}

function withCors(response: Response, request: Request, env: Env): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of corsHeaders(request, env)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function roomCodeFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)(?:\/sync)?$/);
  return match?.[1] ?? null;
}

async function createRoom(env: Env): Promise<Response> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createRoomCode();
    const accessToken = createCapabilityToken();
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    const initialized = await stub.fetch("https://room.internal/internal/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessHash: await hashCapability(accessToken), createdAt: Date.now() }),
    });
    if (initialized.status === 409) continue;
    if (!initialized.ok) return Response.json({ error: "Failed to initialize room" }, { status: 503 });
    return Response.json(
      { code, accessToken, protocol: COTAB_PROTOCOL, websocketPath: `/api/rooms/${code}/sync` },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json({ error: "Failed to allocate room" }, { status: 503 });
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      const headers = corsHeaders(request, env);
      return new Response(null, { status: headers.has("Access-Control-Allow-Origin") ? 204 : 403, headers });
    }
    if (request.method === "GET" && url.pathname === "/") {
      return withCors(Response.json({ status: "ok", runtime: "cloudflare-workers" }), request, env);
    }
    if (request.method === "POST" && url.pathname === "/api/rooms") {
      if (!isAllowedRequestOrigin(request, env)) {
        return Response.json({ error: "Origin not allowed" }, { status: 403 });
      }
      return withCors(await createRoom(env), request, env);
    }

    const code = roomCodeFromPath(url.pathname);
    if (!code) return withCors(Response.json({ error: "Not found" }, { status: 404 }), request, env);
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));

    if (request.method === "GET" && url.pathname.endsWith("/sync")) {
      if (!isAllowedRequestOrigin(request, env)) {
        return Response.json({ error: "Origin not allowed" }, { status: 403 });
      }
      return stub.fetch(new Request("https://room.internal/internal/connect", request));
    }
    if (request.method === "GET") {
      return withCors(
        await stub.fetch("https://room.internal/internal/metadata"),
        request,
        env,
      );
    }
    return withCors(Response.json({ error: "Not found" }, { status: 404 }), request, env);
  },
};

export default worker;
