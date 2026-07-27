import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import { initializeScore, readDocumentId } from "@/core/schema";
import {
  createDocumentFromCotab,
  decodeCotabDocument,
  encodeCotabDocument,
} from "../cotab-file";

function createScore(title: string): Y.Doc {
  const doc = new Y.Doc();
  const score = initializeScore(doc);
  score.set("title", title);
  return doc;
}

describe("CoTab document format", () => {
  it("round-trips the complete Y.Doc and metadata", () => {
    const source = createScore("Stored score");
    const sourceId = readDocumentId(source);
    const bytes = encodeCotabDocument(source, 1234);
    const decoded = decodeCotabDocument(bytes);
    const restored = createDocumentFromCotab(bytes);

    expect(decoded.metadata).toEqual({
      formatVersion: 1,
      documentId: sourceId,
      title: "Stored score",
      savedAt: 1234,
    });
    expect(restored.getMap("score").get("title")).toBe("Stored score");
    expect(readDocumentId(restored)).toBe(sourceId);
    expect(Y.encodeStateVector(restored)).toEqual(Y.encodeStateVector(source));
  });

  it("rejects unrelated and truncated data", () => {
    expect(() => decodeCotabDocument(new Uint8Array([1, 2, 3]))).toThrow(
      "truncated",
    );
    const bytes = encodeCotabDocument(createScore("Valid"));
    bytes[0] = 0;
    expect(() => decodeCotabDocument(bytes)).toThrow(
      "not a CoTab document",
    );
  });
});
