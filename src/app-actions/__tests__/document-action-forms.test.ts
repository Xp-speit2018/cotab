import { describe, expect, it } from "vitest";
import {
  createDocumentActionFormArgs,
  getDocumentActionFormDefinition,
  validateDocumentActionFormArgs,
} from "../document-action-forms";

describe("DocumentAction UI form projection", () => {
  it("discovers primitive fields from the runtime action schema", () => {
    expect(getDocumentActionFormDefinition("document.beat.setDuration"))
      .toMatchObject({
        id: "document.beat.setDuration",
        fields: [{
          name: "value",
          kind: "integer",
          required: true,
          nullable: false,
        }],
      });
  });

  it("discovers nested and nullable fields without an action-specific map", () => {
    expect(getDocumentActionFormDefinition("document.note.setBend")?.fields)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "bendType", kind: "integer" }),
        expect.objectContaining({
          name: "bendPoints",
          kind: "json",
          nullable: true,
        }),
      ]));
  });

  it("creates and validates form arguments through the action-owned schema", () => {
    expect(createDocumentActionFormArgs("document.beat.placeNote")).toEqual({});
    expect(validateDocumentActionFormArgs(
      "document.beat.setDuration",
      { value: 8 },
    )).toEqual({ success: true, data: { value: 8 } });
    expect(validateDocumentActionFormArgs(
      "document.beat.setDuration",
      { value: { value: 8 } },
    )).toMatchObject({ success: false });
  });
});
