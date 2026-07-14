import { describe, expect, it } from "vitest";
import { DOCUMENT_ACTIONS } from "../catalog";
import {
  DOCUMENT_ACTION_DESCRIPTORS,
  EXECUTE_DOCUMENT_ACTION_JSON_SCHEMA,
} from "../projections";

describe("DocumentActionDefinition contract", () => {
  it("uses one unique strict object schema for every action", () => {
    const ids = DOCUMENT_ACTIONS.map((action) => action.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const action of DOCUMENT_ACTIONS) {
      expect(action.argsSchema.safeParse(null).success, action.id).toBe(false);
      expect(action.argsSchema.safeParse([]).success, action.id).toBe(false);
      expect(action.argsSchema.safeParse(8).success, action.id).toBe(false);
      expect(action.argsSchema.safeParse("value").success, action.id).toBe(false);
    }
  });

  it("projects the complete catalog into strict JSON Schema and MCP cases", () => {
    expect(DOCUMENT_ACTION_DESCRIPTORS).toHaveLength(DOCUMENT_ACTIONS.length);
    for (const descriptor of DOCUMENT_ACTION_DESCRIPTORS) {
      expect(descriptor.argsSchema, descriptor.id).toMatchObject({
        type: "object",
        additionalProperties: false,
      });
    }

    const cases = EXECUTE_DOCUMENT_ACTION_JSON_SCHEMA.oneOf;
    expect(Array.isArray(cases)).toBe(true);
    expect(cases).toHaveLength(DOCUMENT_ACTIONS.length);
  });
});
