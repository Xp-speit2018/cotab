import { describe, expect, it, vi } from "vitest";
import {
  executeMinimalMcpTool,
  type CoreEditSelection,
  type MinimalMcpHost,
} from "../minimal-mcp";

function createHost(): MinimalMcpHost {
  let selection: CoreEditSelection | null = null;
  return {
    snapshot: () => ({ title: "Test" }),
    listActions: () => [{
      id: "document.score.setTitle",
      category: "document.score",
      i18nKey: "actions.edit.score.setTitle",
      argsSchema: {
        type: "object",
        properties: { value: { type: "string" } },
        required: ["value"],
        additionalProperties: false,
      },
    }],
    executeDocumentAction: vi.fn((_id: string, args: unknown) => args),
    setSelection: vi.fn((next: CoreEditSelection) => {
      selection = next;
      return selection;
    }),
    getSelection: () => selection,
    undo: () => true,
    redo: () => true,
  };
}

describe("minimal MCP protocol", () => {
  it("passes schema-validated object arguments to the host", () => {
    const host = createHost();
    const result = executeMinimalMcpTool(host, "execute_action", {
      id: "document.score.setTitle",
      args: { value: "Agent title" },
    });

    expect(result).toEqual({
      ok: true,
      value: { value: "Agent title" },
    });
    expect(host.executeDocumentAction).toHaveBeenCalledWith(
      "document.score.setTitle",
      { value: "Agent title" },
    );
  });

  it("rejects scalar action arguments before calling the host", () => {
    const host = createHost();
    const result = executeMinimalMcpTool(host, "execute_action", {
      id: "document.score.setTitle",
      args: "Agent title",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid_arguments" },
    });
    expect(host.executeDocumentAction).not.toHaveBeenCalled();
  });

  it("keeps noteIndex in the peer-local selector", () => {
    const host = createHost();
    const result = executeMinimalMcpTool(host, "set_selection", {
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      barIndex: 8,
      beatIndex: 0,
      string: 1,
      noteIndex: 0,
    });

    expect(result).toMatchObject({
      ok: true,
      value: { barIndex: 8, noteIndex: 0 },
    });
  });

  it("returns protocol errors for malformed calls and unknown tools", () => {
    expect(executeMinimalMcpTool(createHost(), "set_selection", {
      trackIndex: -1,
    })).toMatchObject({ ok: false, error: { code: "invalid_arguments" } });
    expect(executeMinimalMcpTool(createHost(), "missing", {})).toEqual({
      ok: false,
      error: {
        code: "unknown_tool",
        message: "Unknown CoTab MCP tool: missing",
      },
    });
  });
});
