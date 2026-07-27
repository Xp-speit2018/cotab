import * as Y from "yjs";

import { readDocumentId } from "@/core/schema";

const MAGIC = new Uint8Array([0x43, 0x4f, 0x54, 0x41, 0x42, 0x0d, 0x0a, 0x1a]);
const FORMAT_VERSION = 1;
const HEADER_SIZE = MAGIC.length + 8;

export interface CotabDocumentMetadata {
  readonly formatVersion: 1;
  readonly documentId: string | null;
  readonly title: string;
  readonly savedAt: number;
}

export interface DecodedCotabDocument {
  readonly metadata: CotabDocumentMetadata;
  readonly update: Uint8Array;
}

function validateMetadata(value: unknown): CotabDocumentMetadata {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("CoTab metadata must be an object.");
  }
  const metadata = value as Record<string, unknown>;
  if (metadata.formatVersion !== FORMAT_VERSION) {
    throw new Error(`Unsupported CoTab document version: ${String(metadata.formatVersion)}.`);
  }
  if (metadata.documentId !== null && typeof metadata.documentId !== "string") {
    throw new Error("CoTab documentId must be a string or null.");
  }
  if (typeof metadata.title !== "string") {
    throw new Error("CoTab title must be a string.");
  }
  if (typeof metadata.savedAt !== "number" || !Number.isFinite(metadata.savedAt)) {
    throw new Error("CoTab savedAt must be a finite number.");
  }
  return {
    formatVersion: FORMAT_VERSION,
    documentId: metadata.documentId,
    title: metadata.title,
    savedAt: metadata.savedAt,
  };
}

export function encodeCotabDocument(
  doc: Y.Doc,
  savedAt: number = Date.now(),
): Uint8Array {
  const score = doc.getMap("score");
  const title = score.get("title");
  const metadata: CotabDocumentMetadata = {
    formatVersion: FORMAT_VERSION,
    documentId: readDocumentId(doc),
    title: typeof title === "string" ? title : "",
    savedAt,
  };
  const metadataBytes = new TextEncoder().encode(JSON.stringify(metadata));
  const update = Y.encodeStateAsUpdate(doc);
  const bytes = new Uint8Array(HEADER_SIZE + metadataBytes.length + update.length);
  bytes.set(MAGIC, 0);
  const header = new DataView(bytes.buffer, bytes.byteOffset, HEADER_SIZE);
  header.setUint32(MAGIC.length, FORMAT_VERSION, true);
  header.setUint32(MAGIC.length + 4, metadataBytes.length, true);
  bytes.set(metadataBytes, HEADER_SIZE);
  bytes.set(update, HEADER_SIZE + metadataBytes.length);
  return bytes;
}

export function decodeCotabDocument(data: Uint8Array): DecodedCotabDocument {
  if (data.length < HEADER_SIZE) {
    throw new Error("CoTab document is truncated.");
  }
  for (let index = 0; index < MAGIC.length; index++) {
    if (data[index] !== MAGIC[index]) {
      throw new Error("File is not a CoTab document.");
    }
  }
  const header = new DataView(data.buffer, data.byteOffset, HEADER_SIZE);
  const version = header.getUint32(MAGIC.length, true);
  if (version !== FORMAT_VERSION) {
    throw new Error(`Unsupported CoTab document version: ${version}.`);
  }
  const metadataLength = header.getUint32(MAGIC.length + 4, true);
  const updateOffset = HEADER_SIZE + metadataLength;
  if (metadataLength === 0 || updateOffset >= data.length) {
    throw new Error("CoTab document payload is truncated.");
  }
  let metadataValue: unknown;
  try {
    metadataValue = JSON.parse(
      new TextDecoder().decode(data.subarray(HEADER_SIZE, updateOffset)),
    );
  } catch {
    throw new Error("CoTab document metadata is invalid JSON.");
  }
  return {
    metadata: validateMetadata(metadataValue),
    update: data.slice(updateOffset),
  };
}

export function createDocumentFromCotab(data: Uint8Array): Y.Doc {
  const decoded = decodeCotabDocument(data);
  const doc = new Y.Doc();
  Y.applyUpdate(doc, decoded.update);
  const score = doc.getMap("score");
  if (score.size === 0) {
    doc.destroy();
    throw new Error("CoTab document does not contain a score.");
  }
  return doc;
}
