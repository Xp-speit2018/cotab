import { describe, expect, it } from "vitest";
import { parsePeerSelection } from "../../../../server/worker/protocol";

describe("untrusted peer selection", () => {
  it("accepts only a bounded beat anchor and strips extra fields", () => {
    expect(parsePeerSelection({ beatUuid: "beat", string: 1, renderedStave: "tablature", password: "secret" }))
      .toEqual({ beatUuid: "beat", string: 1, renderedStave: "tablature" });
    expect(parsePeerSelection({ beatUuid: "drums", string: -12, renderedStave: "standard" })).not.toBeNull();
    expect(parsePeerSelection({ beatUuid: "beat", string: null, renderedStave: null }))
      .toEqual({ beatUuid: "beat", string: null, renderedStave: null });
  });
  it.each([null, {}, [], { beatUuid: "" },
    { beatUuid: "x".repeat(129), string: 1, renderedStave: null },
    { beatUuid: "beat", string: 1.5, renderedStave: null },
    { beatUuid: "beat", string: -13, renderedStave: null },
    { beatUuid: "beat", string: 33, renderedStave: null },
    { beatUuid: "beat", string: "1", renderedStave: null },
    { beatUuid: "beat", string: null, renderedStave: "html" },
  ])("rejects malformed presence %j", (value) => {
    expect(parsePeerSelection(value)).toBeNull();
  });
});
