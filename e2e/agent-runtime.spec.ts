import { expect, test } from "@playwright/test";

interface RuntimeResult {
  ok: boolean;
  value?: unknown;
}

test("agent logical peer synchronizes bidirectionally with EditorEngine", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => {
    const core = (window as unknown as Record<string, unknown>).__COTAB_STORE__ as {
      engine?: { getScoreMap: () => import("yjs").Map<unknown> | null };
    } | undefined;
    const tracks = core?.engine?.getScoreMap()?.get("tracks") as
      import("yjs").Array<unknown> | undefined;
    return (tracks?.length ?? 0) > 0;
  });

  const result = await page.evaluate(async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: {},
      configurable: true,
    });

    const { agentPeerRuntime } = await import("/src/agent/agent-peer-runtime.ts") as {
      agentPeerRuntime: {
        start(): Promise<void>;
        stop(): void;
        callTool(tool: string, args?: unknown): Promise<RuntimeResult>;
      };
    };
    const core = (window as unknown as Record<string, unknown>).__COTAB_STORE__ as {
      engine: {
        peers: Array<{ id: string; kind: string; status: string }>;
        syncState: {
          logicalPeerCount: number;
          logicalPeers: Record<string, {
            resetCount: number;
            sentUpdates: number;
            receivedUpdates: number;
          }>;
          yjs: { bySource: { agent: { updates: number } } };
        };
        getScoreMap(): import("yjs").Map<unknown> | null;
        localEditYDoc(callback: () => void): void;
      };
    };

    await agentPeerRuntime.start();
    const startedPeers = core.engine.peers.map((peer) => ({ ...peer }));
    const resetCount = core.engine.syncState.logicalPeers["agent:local-codex"]?.resetCount ?? 0;

    const edit = await agentPeerRuntime.callTool("execute_action", {
      id: "document.score.setTitle",
      args: "Agent Synchronized Score",
    });

    core.engine.localEditYDoc(() => {
      core.engine.getScoreMap()?.set("artist", "Main Editor");
    });
    const score = await agentPeerRuntime.callTool("get_score");
    const profile = {
      ...core.engine.syncState.logicalPeers["agent:local-codex"],
      agentUpdates: core.engine.syncState.yjs.bySource.agent.updates,
    };
    const mainTitle = core.engine.getScoreMap()?.get("title");

    agentPeerRuntime.stop();
    return {
      startedPeers,
      resetCount,
      edit,
      mainTitle,
      agentArtist: (score.value as { artist?: unknown }).artist,
      profile,
      stoppedPeers: core.engine.peers.map((peer) => ({ ...peer })),
      stoppedLogicalPeerCount: core.engine.syncState.logicalPeerCount,
    };
  });

  expect(result.startedPeers).toContainEqual({
    id: "agent:local-codex",
    kind: "agent",
    name: "Local Codex",
    status: "synced",
  });
  expect(result.resetCount).toBe(1);
  expect(result.edit.ok).toBe(true);
  expect(result.mainTitle).toBe("Agent Synchronized Score");
  expect(result.agentArtist).toBe("Main Editor");
  expect(result.profile.sentUpdates).toBeGreaterThan(0);
  expect(result.profile.receivedUpdates).toBeGreaterThan(0);
  expect(result.profile.agentUpdates).toBeGreaterThan(0);
  expect(result.stoppedPeers).not.toContainEqual(
    expect.objectContaining({ id: "agent:local-codex" }),
  );
  expect(result.stoppedLogicalPeerCount).toBe(0);
});
