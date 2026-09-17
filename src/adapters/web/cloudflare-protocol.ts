export const COTAB_YJS_PROTOCOL = "cotab-yjs-v1";
export const COTAB_AUTH_PROTOCOL_PREFIX = "cotab-auth.";

export const DOCUMENT_UPDATE_FRAME = 0;
export const AWARENESS_FRAME = 1;
export const STATE_VECTOR_FRAME = 2;

export interface CollaborationFrame {
  type: typeof DOCUMENT_UPDATE_FRAME | typeof AWARENESS_FRAME | typeof STATE_VECTOR_FRAME;
  payload: Uint8Array;
}

export function cloudflareWebSocketProtocols(accessToken: string): [string, string] {
  if (!/^[A-Za-z0-9_-]{43}$/.test(accessToken)) {
    throw new Error("Invalid collaboration capability token.");
  }
  return [COTAB_YJS_PROTOCOL, `${COTAB_AUTH_PROTOCOL_PREFIX}${accessToken}`];
}

export function encodeCollaborationFrame(
  type: CollaborationFrame["type"],
  payload: Uint8Array,
): Uint8Array {
  const encoded = new Uint8Array(payload.byteLength + 1);
  encoded[0] = type;
  encoded.set(payload, 1);
  return encoded;
}

export function decodeCollaborationFrame(data: ArrayBuffer): CollaborationFrame {
  const encoded = new Uint8Array(data);
  if (encoded.byteLength < 2) throw new Error("Invalid collaboration frame.");
  const type = encoded[0];
  if (type !== DOCUMENT_UPDATE_FRAME && type !== AWARENESS_FRAME && type !== STATE_VECTOR_FRAME) {
    throw new Error("Unknown collaboration frame type.");
  }
  return { type, payload: encoded.slice(1) };
}
