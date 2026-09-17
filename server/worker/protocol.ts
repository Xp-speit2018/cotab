export const COTAB_PROTOCOL = "cotab-yjs-v1";
export const AUTH_PROTOCOL_PREFIX = "cotab-auth.";

export const DOCUMENT_UPDATE_FRAME = 0;
export const AWARENESS_FRAME = 1;
export const STATE_VECTOR_FRAME = 2;

export const MAX_FRAME_BYTES = 1_048_576;
// A complete reconnect update must fit inside a document frame.
export const MAX_SNAPSHOT_BYTES = 1_000_000;
export const SNAPSHOT_CHUNK_BYTES = 64 * 1024;
export const MAX_CONNECTIONS_PER_ROOM = 16;

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const ROOM_CODE_LENGTH = 12;
const TOKEN_BYTES = 32;

function randomString(alphabet: string, length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let result = "";
  for (const byte of bytes) result += alphabet[byte % alphabet.length];
  return result;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function createRoomCode(): string {
  return randomString(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH);
}

export function createCapabilityToken(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
}

export async function hashCapability(token: string): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))));
}

export function requestedProtocols(header: string | null): string[] {
  return (header ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function capabilityFromProtocols(header: string | null): string | null {
  const auth = requestedProtocols(header)
    .find((protocol) => protocol.startsWith(AUTH_PROTOCOL_PREFIX));
  return auth ? auth.slice(AUTH_PROTOCOL_PREFIX.length) : null;
}

export function hasSupportedProtocol(header: string | null): boolean {
  return requestedProtocols(header).includes(COTAB_PROTOCOL);
}

export function timingSafeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export function frame(type: number, payload: Uint8Array): Uint8Array {
  const result = new Uint8Array(payload.byteLength + 1);
  result[0] = type;
  result.set(payload, 1);
  return result;
}
