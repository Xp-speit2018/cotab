import { beforeEach, describe, expect, it } from "vitest";
import { engine } from "@/core/engine";
import { runCliCommand } from "../commands";

describe("CLI target adapter", () => {
  beforeEach(() => {
    engine.destroyDoc();
  });

  it("lists shared action schemas without importing a renderer host", () => {
    const result = runCliCommand(["list-actions"]);

    expect(result.actions?.find((action) => action.id === "document.score.setTitle"))
      .toMatchObject({
        argsSchema: {
          type: "object",
          required: ["value"],
        },
      });
    expect(result.actions?.some((action) => action.id === "document.track.add"))
      .toBe(true);
  });

  it("creates a default score through the shared engine", () => {
    const result = runCliCommand(["new"]);
    const snapshot = result.snapshot as { title: string; tracks: unknown[]; masterBars: unknown[] };

    expect(snapshot.title).toBe("Untitled");
    expect(snapshot.tracks).toHaveLength(1);
    expect(snapshot.masterBars).toHaveLength(1);
  });

  it("executes a shared action and returns a score snapshot", () => {
    const result = runCliCommand([
      "exec",
      "document.score.setTitle",
      JSON.stringify({ value: "CLI Song" }),
    ]);
    const snapshot = result.snapshot as { title: string };

    expect(snapshot.title).toBe("CLI Song");
  });

  it("runs a JSON operation batch against one engine instance", () => {
    const result = runCliCommand([
      "run",
      JSON.stringify([
        { type: "new" },
        {
          type: "execute",
          id: "document.score.setTitle",
          args: { value: "Batch Song" },
        },
        {
          type: "execute",
          id: "document.track.add",
          args: { presetId: "drumkit" },
        },
      ]),
    ]);
    const snapshot = result.snapshot as {
      title: string;
      tracks: Array<{
        name: string;
        playbackInfo: { primaryChannel: number };
      }>;
    };

    expect(snapshot.title).toBe("Batch Song");
    expect(snapshot.tracks.map((track) => track.name)).toEqual(["Acoustic Guitar", "Drums"]);
    expect(snapshot.tracks[1].playbackInfo.primaryChannel).toBe(9);
  });
});
