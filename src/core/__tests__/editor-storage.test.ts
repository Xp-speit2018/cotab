import { describe, expect, it, vi } from "vitest";

import { EditorEngine } from "@/core/engine";

describe("EditorEngine storage state", () => {
  it("owns local storage state and publishes it through editor hooks", () => {
    const engine = new EditorEngine();
    const listener = vi.fn();
    engine.registerHooks({ onLocalStorageChange: listener });

    const next = {
      ...engine.storage,
      available: true,
      status: "saved" as const,
      binding: {
        providerId: "local-disk",
        locator: "/tmp/score.cotab",
        displayName: "score.cotab",
        revision: "revision-1",
      },
      lastSavedAt: 123,
    };
    engine.localSetStorageState(next);

    expect(engine.storage).toBe(next);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(next);
  });
});
