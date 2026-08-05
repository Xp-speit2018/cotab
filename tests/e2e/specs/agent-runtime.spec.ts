import { expect, test } from "@playwright/test";

interface RuntimeResult {
  ok: boolean;
  value?: unknown;
  error?: { code: string; message: string };
  diagnostics?: {
    document: {
      changed: boolean;
      workerUpdateCount: number;
      mainUpdateCount: number;
    };
    renderer: {
      status: "succeeded" | "failed";
      revision: number;
      stage: string;
      error: { message: string } | null;
    } | null;
  };
}

test("agent logical peer synchronizes bidirectionally with EditorEngine", async ({ page }) => {
  await page.goto("/?demo=taijin-kyofusho");
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
      args: { value: "Agent Synchronized Score" },
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
  expect(result.edit.diagnostics).toMatchObject({
    document: {
      changed: true,
      workerUpdateCount: 1,
      mainUpdateCount: 1,
    },
    renderer: { status: "succeeded", stage: "render" },
  });
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

for (const layout of ["horizontal", "parchment"] as const) {
  test(`agent bar insertion is visible in ${layout} layout`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/?demo=taijin-kyofusho");
    await page.waitForFunction(() => {
      const runtime = window as unknown as {
        __ALPHATAB_API__?: { score?: { masterBars?: unknown[] } };
      };
      return runtime.__ALPHATAB_API__?.score?.masterBars?.length === 58;
    });
    if (layout === "horizontal") {
      await page.getByTestId("layout-menu").click();
      await page.getByRole("menuitemcheckbox", { name: "Horizontal layout" }).click();
      await page.waitForFunction(() => {
        const runtime = window as unknown as {
          __ALPHATAB_API__?: {
            settings?: { display?: { layoutMode?: number } };
            boundsLookup?: { isFinished?: boolean };
          };
        };
        return runtime.__ALPHATAB_API__?.settings?.display?.layoutMode === 1
          && runtime.__ALPHATAB_API__?.boundsLookup?.isFinished === true;
      });
    }

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
        engine: { getScoreMap(): import("yjs").Map<unknown> | null };
      };

      await agentPeerRuntime.start();
      const select = (barIndex: number) => agentPeerRuntime.callTool("set_selection", {
        trackIndex: 5,
        staffIndex: 0,
        voiceIndex: 0,
        barIndex,
        beatIndex: 0,
        string: null,
      });
      await select(57);
      const firstInsert = await agentPeerRuntime.callTool("execute_action", {
        id: "document.bar.insertAfter",
        args: {},
      });
      await select(58);
      const secondInsert = await agentPeerRuntime.callTool("execute_action", {
        id: "document.bar.insertAfter",
        args: {},
      });
      await agentPeerRuntime.callTool("set_selection", {
        trackIndex: 5,
        staffIndex: 0,
        voiceIndex: 0,
        barIndex: 59,
        beatIndex: 0,
        string: 3,
      });
      const placeDrumNote = await agentPeerRuntime.callTool("execute_action", {
        id: "document.beat.placeNote",
        args: {},
      });
      const yMasterBars = core.engine.getScoreMap()?.get("masterBars") as
        | import("yjs").Array<unknown>
        | undefined;
      const yMasterBarCount = yMasterBars?.length ?? 0;
      agentPeerRuntime.stop();
      return { firstInsert, secondInsert, placeDrumNote, yMasterBarCount };
    });

    await page.waitForFunction(() => {
      const runtime = window as unknown as {
        __ALPHATAB_API__?: {
          score?: {
            masterBars?: unknown[];
            tracks?: Array<{
              staves: Array<{
                bars: Array<{
                  voices: Array<{ beats: Array<{ notes: unknown[] }> }>;
                }>;
              }>;
            }>;
          };
          boundsLookup?: {
            isFinished?: boolean;
            findBeat(beat: unknown): unknown;
          };
        };
      };
      const api = runtime.__ALPHATAB_API__;
      const beat = api?.score?.tracks?.[5].staves[0].bars[59]
        .voices[0].beats[0];
      return api?.score?.masterBars?.length === 60
        && beat?.notes.length === 1
        && api.boundsLookup?.isFinished === true
        && Boolean(api.boundsLookup?.findBeat(beat));
    });
    const rendered = await page.evaluate(() => {
      const runtime = window as unknown as {
        __ALPHATAB_API__: {
          score: {
            masterBars: unknown[];
            tracks: Array<{
              staves: Array<{
                bars: Array<{
                  voices: Array<{ beats: Array<{ notes: unknown[] }> }>;
                }>;
              }>;
            }>;
          };
          boundsLookup: {
            staffSystems: Array<{
              realBounds: { x: number; y: number; w: number; h: number };
            }>;
            findBeat(beat: unknown): {
              visualBounds: { x: number; y: number; w: number; h: number };
            } | null;
          };
        };
      };
      const api = runtime.__ALPHATAB_API__;
      const beat = api.score.tracks[5]
        .staves[0].bars[59].voices[0].beats[0];
      return {
        masterBars: api.score.masterBars.length,
        staffBarCounts: api.score.tracks.flatMap((track) =>
          track.staves.map((staff) => staff.bars.length),
        ),
        addedDrumNotes: beat.notes.length,
        addedBeatBounds: api.boundsLookup.findBeat(beat)?.visualBounds ?? null,
        distinctStaffSystemCount: new Set(
          api.boundsLookup.staffSystems.map(({ realBounds }) =>
            `${realBounds.x}:${realBounds.y}:${realBounds.w}:${realBounds.h}`
          ),
        ).size,
      };
    });

    expect(result.firstInsert.ok).toBe(true);
    expect(result.secondInsert.ok).toBe(true);
    expect(result.placeDrumNote.ok).toBe(true);
    expect(result.yMasterBarCount).toBe(60);
    expect(rendered.masterBars).toBe(60);
    expect(rendered.staffBarCounts.every((count) => count === 60)).toBe(true);
    expect(rendered.addedDrumNotes).toBe(1);
    expect(rendered.addedBeatBounds).toEqual({
      x: expect.any(Number),
      y: expect.any(Number),
      w: expect.any(Number),
      h: expect.any(Number),
    });
    expect(rendered.addedBeatBounds?.h).toBeGreaterThan(0);
    if (layout === "horizontal") {
      expect(rendered.distinctStaffSystemCount).toBe(1);
    } else {
      expect(rendered.distinctStaffSystemCount).toBeGreaterThan(1);
    }
    expect(pageErrors).toEqual([]);
  });
}

test("agent reports a selection-scoped action that did not mutate Y.Doc", async ({ page }) => {
  await page.goto("/?demo=taijin-kyofusho");
  await page.waitForFunction(() => {
    const core = (window as unknown as Record<string, unknown>).__COTAB_STORE__ as {
      engine?: { getScoreMap: () => import("yjs").Map<unknown> | null };
    } | undefined;
    return Boolean(core?.engine?.getScoreMap()?.get("tracks"));
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
    await agentPeerRuntime.start();
    const action = await agentPeerRuntime.callTool("execute_action", {
      id: "document.bar.insertAfter",
      args: {},
    });
    agentPeerRuntime.stop();
    return action;
  });

  expect(result.ok).toBe(false);
  expect(result.error).toMatchObject({ code: "execution_failed" });
  expect(result.error?.message).toContain("without a Y.Doc update");
  expect(result.diagnostics).toEqual({
    document: {
      changed: false,
      workerUpdateCount: 0,
      mainUpdateCount: 0,
    },
    renderer: null,
  });
});

test("agent receives AlphaTab model-build failures as tool diagnostics", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/?demo=taijin-kyofusho");
  await page.waitForFunction(() => {
    const runtime = window as unknown as {
      __ALPHATAB_API__?: { score?: { masterBars?: unknown[] } };
    };
    return runtime.__ALPHATAB_API__?.score?.masterBars?.length === 58;
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
    const {
      getRendererDiagnostics,
      waitForRendererRevision,
    } = await import("/src/stores/renderer-bridge.ts") as {
      getRendererDiagnostics(): {
        requestedRevision: number;
        failedCount: number;
        lastError: { message: string; stack: string | null } | null;
      };
      waitForRendererRevision(revision: number): Promise<{
        status: "succeeded" | "failed";
      }>;
    };
    const core = (window as unknown as Record<string, unknown>).__COTAB_STORE__ as {
      engine: {
        getScoreMap(): import("yjs").Map<unknown> | null;
        localEditYDoc(callback: () => void): void;
      };
    };

    await agentPeerRuntime.start();
    core.engine.localEditYDoc(() => {
      const score = core.engine.getScoreMap()!;
      const tracks = score.get("tracks") as import("yjs").Array<import("yjs").Map<unknown>>;
      const staves = tracks.get(0).get("staves") as import("yjs").Array<import("yjs").Map<unknown>>;
      const bars = staves.get(0).get("bars") as import("yjs").Array<import("yjs").Map<unknown>>;
      const voices = bars.get(57).get("voices") as import("yjs").Array<import("yjs").Map<unknown>>;
      voices.delete(1, voices.length - 1);
    });
    const brokenRevision = getRendererDiagnostics().requestedRevision;
    await waitForRendererRevision(brokenRevision);

    const action = await agentPeerRuntime.callTool("execute_action", {
      id: "document.score.setTitle",
      args: { value: "This render must fail" },
    });
    const diagnostics = getRendererDiagnostics();
    agentPeerRuntime.stop();
    return { action, diagnostics };
  });

  expect(result.action.ok).toBe(false);
  expect(result.action.error).toMatchObject({ code: "execution_failed" });
  expect(result.action.error?.message).toContain("AlphaTab renderer revision");
  expect(result.action.diagnostics).toMatchObject({
    document: { changed: true, workerUpdateCount: 1, mainUpdateCount: 1 },
    renderer: {
      status: "failed",
      stage: "model-build",
      error: { message: expect.stringContaining("beats") },
    },
  });
  expect(result.diagnostics.failedCount).toBeGreaterThanOrEqual(2);
  expect(result.diagnostics.lastError?.message).toContain("beats");
  expect(result.diagnostics.lastError?.stack).toContain("_chain");
  expect(pageErrors).toEqual([]);

  const sidebar = page.locator('[data-sidebar-side="left"]');
  await sidebar.getByRole("button", { name: "Debug", exact: true }).click();
  const alphaTabMonitor = sidebar.locator('[data-debug-section="alphatab-state"]');
  await expect(alphaTabMonitor.getByText("rendererBridge", { exact: true })).toBeVisible();
  await expect(alphaTabMonitor.getByText("lastFailedRevision", { exact: true })).toBeVisible();
  await expect(alphaTabMonitor.getByText("recentOutcomes", { exact: true })).toBeVisible();
  await alphaTabMonitor.getByText("lastOutcome", { exact: true }).click();
  await expect(alphaTabMonitor.getByText('"model-build"', { exact: true })).toBeVisible();
});
