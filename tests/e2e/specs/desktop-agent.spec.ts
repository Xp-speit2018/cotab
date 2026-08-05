import { expect, test, type Locator, type Page } from "@playwright/test";

interface RuntimeResult {
  ok: boolean;
  value?: unknown;
  error?: { code: string; message: string };
}

interface AlphaTabWindow extends Window {
  __ALPHATAB_API__: {
    score?: { tracks?: unknown[] };
  };
  __COTAB_AGENT_RUNTIME__?: unknown;
  __COTAB_TEST_SETTINGS__?: Record<string, unknown>;
}

const CONTINUE_DRUMS_PROMPT = "从57小节开始续写4小节鼓组";

type TauriMockScenario = "set-title" | "continue-drums";

async function installTauriMock(
  page: Page,
  scenario: TauriMockScenario = "set-title",
) {
  await page.addInitScript(({ scenario }) => {
    let nextCallbackId = 1;
    let codexChannelId: number | null = null;
    let channelMessageIndex = 0;
    let threadCounter = 0;
    let historyIndex = { version: 1, bindings: [] as unknown[] };
    const models = [
      {
        id: "gpt-5.6-sol",
        model: "gpt-5.6-sol",
        displayName: "GPT-5.6-Sol",
        description: "Frontier coding model",
        hidden: false,
        isDefault: true,
        defaultReasoningEffort: "medium",
        supportedReasoningEfforts: [
          { reasoningEffort: "low", description: "Fast" },
          { reasoningEffort: "medium", description: "Balanced" },
          { reasoningEffort: "high", description: "Deep" },
        ],
      },
      {
        id: "gpt-5.6-terra",
        model: "gpt-5.6-terra",
        displayName: "GPT-5.6-Terra",
        description: "Balanced coding model",
        hidden: false,
        isDefault: false,
        defaultReasoningEffort: "medium",
        supportedReasoningEfforts: [
          { reasoningEffort: "low", description: "Fast" },
          { reasoningEffort: "medium", description: "Balanced" },
          { reasoningEffort: "high", description: "Deep" },
        ],
      },
    ];
    (window as unknown as AlphaTabWindow).__COTAB_TEST_SETTINGS__ = {};
    let thread: {
      id: string;
      preview: string;
      name: string | null;
      createdAt: number;
      updatedAt: number;
      turns: unknown[];
    } | null = null;
    const callbacks = new Map<number, (payload: unknown) => void>();
    const toolRequestBase = 900;
    let activeToolCalls: Array<{
      tool: string;
      arguments: Record<string, unknown>;
    }> = [];
    let activeToolResults: Array<{ success: boolean }> = [];

    const runCallback = (id: number, payload: unknown) => {
      callbacks.get(id)?.(payload);
    };
    const sendCodexEvent = (event: unknown) => {
      if (codexChannelId === null) return;
      const id = codexChannelId;
      const index = channelMessageIndex++;
      setTimeout(() => runCallback(id, { index, message: event }), 0);
    };
    const sendRpc = (message: unknown) => {
      sendCodexEvent({ type: "message", message: JSON.stringify(message) });
    };

    const buildContinueDrumsToolCalls = () => {
      const calls: Array<{
        tool: string;
        arguments: Record<string, unknown>;
      }> = [];
      const select = (barIndex: number, beatIndex: number) => ({
        tool: "set_selection",
        arguments: {
          trackIndex: 5,
          staffIndex: 0,
          voiceIndex: 0,
          barIndex,
          beatIndex,
          string: null,
        },
      });
      const execute = (id: string, args: Record<string, unknown>) => ({
        tool: "execute_action",
        arguments: { id, args },
      });

      calls.push(
        select(57, 0),
        execute("document.bar.insertAfter", {}),
        select(58, 0),
        execute("document.bar.insertAfter", {}),
      );

      // Repeat the source score's bars 53-56 drum phrase into bars 57-60.
      const patterns = [
        [[36, 42], [42], [42], [36, 42], [38, 42], [36, 42], [42], [36, 42]],
        [[36, 42], [42], [42], [42], [42], [36, 42], [46, 36], []],
        [[36, 42], [42], [42], [36, 42], [38, 42], [36, 42], [42], [36, 42]],
        [[42, 36], [42], [42], [42], [42], [42, 36], [46, 38], []],
      ];

      patterns.forEach((pattern, patternIndex) => {
        const barIndex = 56 + patternIndex;
        calls.push(
          select(barIndex, 0),
          execute("document.beat.setDuration", { value: 8 }),
        );
        for (const gp7Id of pattern[0]) {
          calls.push(execute(
            "document.beat.togglePercussionArticulation",
            { gp7Id },
          ));
        }
        for (let beatIndex = 1; beatIndex < pattern.length; beatIndex++) {
          calls.push(
            execute("document.beat.insertRestAfter", { duration: 8 }),
            select(barIndex, beatIndex),
          );
          for (const gp7Id of pattern[beatIndex]) {
            calls.push(execute(
              "document.beat.togglePercussionArticulation",
              { gp7Id },
            ));
          }
        }
      });
      return calls;
    };

    const toolItemId = (index: number) => `tool-test-${index}`;
    const startToolCall = (index: number) => {
      const call = activeToolCalls[index];
      if (!call) return;
      sendRpc({
        method: "item/started",
        params: {
          threadId: thread?.id,
          turnId: "turn-test",
          item: {
            id: toolItemId(index),
            type: "dynamicToolCall",
            tool: call.tool,
            status: "inProgress",
            arguments: call.arguments,
          },
        },
      });
      sendRpc({
        id: toolRequestBase + index,
        method: "item/tool/call",
        params: call,
      });
    };

    const completeTurn = () => {
      const succeeded = activeToolResults.length === activeToolCalls.length
        && activeToolResults.every((result) => result.success);
      const answer = !succeeded
        ? "**Score edit failed.**"
        : scenario === "continue-drums"
          ? "**已从第57小节起续写4小节鼓组。**"
          : "**Score updated.**";
      (window as unknown as AlphaTabWindow).__COTAB_TEST_SETTINGS__ = {
        ...((window as unknown as AlphaTabWindow).__COTAB_TEST_SETTINGS__ ?? {}),
        toolResults: activeToolResults,
      };
      if (thread) {
        thread.turns = [{
          id: "turn-test",
          status: "completed",
          items: [
            ...activeToolCalls.map((call, index) => ({
              id: toolItemId(index),
              type: "dynamicToolCall",
              tool: call.tool,
              status: activeToolResults[index]?.success ? "completed" : "failed",
              arguments: call.arguments,
            })),
            { id: "answer-test", type: "agentMessage", text: answer },
          ],
        }];
      }
      sendRpc({
        method: "item/agentMessage/delta",
        params: {
          threadId: thread?.id,
          turnId: "turn-test",
          itemId: "answer-test",
          delta: answer,
        },
      });
      sendRpc({
        method: "turn/completed",
        params: {
          threadId: thread?.id,
          turn: { id: "turn-test", status: "completed", items: [] },
        },
      });
    };

    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: {
        transformCallback: (callback: (payload: unknown) => void) => {
          const id = nextCallbackId++;
          callbacks.set(id, callback);
          return id;
        },
        unregisterCallback: (id: number) => callbacks.delete(id),
        runCallback,
        invoke: async (command: string, args?: Record<string, unknown>) => {
          if (command === "get_codex_status") {
            return {
              installed: true,
              connected: codexChannelId !== null,
              executable: "codex",
              version: "codex-cli test",
            };
          }
          if (command === "load_agent_history") return historyIndex;
          if (command === "save_agent_history") {
            historyIndex = args?.index as typeof historyIndex;
            return null;
          }
          if (command === "connect_local_codex") {
            codexChannelId = (args?.onEvent as { id: number }).id;
            channelMessageIndex = 0;
            const previousConnectCount = (window as unknown as AlphaTabWindow)
              .__COTAB_TEST_SETTINGS__?.codexConnectCount;
            (window as unknown as AlphaTabWindow).__COTAB_TEST_SETTINGS__ = {
              ...((window as unknown as AlphaTabWindow).__COTAB_TEST_SETTINGS__ ?? {}),
              codexConnectCount: typeof previousConnectCount === "number"
                ? previousConnectCount + 1
                : 1,
              localResources: args?.localResources,
              webResources: args?.webResources,
              proxyUrl: args?.proxyUrl,
            };
            return {
              installed: true,
              connected: true,
              executable: "codex",
              version: "codex-cli test",
            };
          }
          if (command === "pick_agent_write_root") return "/tmp/cotab-agent-write-test";
          if (command === "send_codex_message") {
            const message = args?.message as {
              id?: number;
              method?: string;
              params?: Record<string, unknown>;
              result?: unknown;
            };
            if (message.method === "initialize") {
              sendRpc({ id: message.id, result: {} });
            } else if (message.method === "model/list") {
              sendRpc({ id: message.id, result: { data: models, nextCursor: null } });
            } else if (message.method === "thread/list") {
              sendRpc({
                id: message.id,
                result: { data: thread ? [thread] : [], nextCursor: null },
              });
            } else if (message.method === "thread/start") {
              const now = Math.floor(Date.now() / 1000);
              thread = {
                id: `thread-test-${++threadCounter}`,
                preview: "",
                name: null,
                createdAt: now,
                updatedAt: now,
                turns: [],
              };
              (window as unknown as AlphaTabWindow).__COTAB_TEST_SETTINGS__ = {
                ...((window as unknown as AlphaTabWindow).__COTAB_TEST_SETTINGS__ ?? {}),
                threadStart: message.params,
              };
              sendRpc({
                id: message.id,
                result: {
                  thread,
                  model: message.params?.model ?? "gpt-5.6-sol",
                  reasoningEffort: "medium",
                },
              });
            } else if (message.method === "thread/resume") {
              sendRpc({ id: message.id, result: { thread } });
            } else if (message.method === "thread/settings/update") {
              const existingSettings = (window as unknown as AlphaTabWindow)
                .__COTAB_TEST_SETTINGS__?.threadSettingsHistory;
              (window as unknown as AlphaTabWindow).__COTAB_TEST_SETTINGS__ = {
                ...((window as unknown as AlphaTabWindow).__COTAB_TEST_SETTINGS__ ?? {}),
                threadSettings: message.params,
                threadSettingsHistory: [
                  ...(Array.isArray(existingSettings) ? existingSettings : []),
                  message.params,
                ],
              };
              sendRpc({ id: message.id, result: {} });
            } else if (message.method === "thread/name/set") {
              if (thread && typeof message.params?.name === "string") {
                thread.name = message.params.name;
              }
              sendRpc({ id: message.id, result: {} });
            } else if (message.method === "thread/archive") {
              thread = null;
              sendRpc({ id: message.id, result: {} });
            } else if (message.method === "turn/start") {
              const input = message.params?.input as Array<{ text?: string }> | undefined;
              if (thread) {
                thread.preview = input?.[0]?.text ?? "";
                thread.updatedAt = Math.floor(Date.now() / 1000);
              }
              sendRpc({ id: message.id, result: { turn: { id: "turn-test" } } });
              sendRpc({
                method: "item/started",
                params: {
                  threadId: thread?.id,
                  turnId: "turn-test",
                  item: {
                    id: "user-test",
                    type: "userMessage",
                    content: [{ type: "text", text: input?.[0]?.text ?? "" }],
                  },
                },
              });
              activeToolCalls = scenario === "continue-drums"
                ? buildContinueDrumsToolCalls()
                : [{
                    tool: "execute_action",
                    arguments: {
                      id: "document.score.setTitle",
                      args: { value: "Codex Transport Score" },
                    },
                  }];
              activeToolResults = [];
              startToolCall(0);
            } else if (
              typeof message.id === "number"
              && message.id >= toolRequestBase
              && message.result
            ) {
              const index = message.id - toolRequestBase;
              const call = activeToolCalls[index];
              if (!call) return null;
              const toolResult = message.result as { success?: boolean };
              const success = toolResult.success === true;
              activeToolResults[index] = { success };
              sendRpc({
                method: "item/completed",
                params: {
                  threadId: thread?.id,
                  turnId: "turn-test",
                  item: {
                    id: toolItemId(index),
                    type: "dynamicToolCall",
                    tool: call.tool,
                    status: success ? "completed" : "failed",
                    arguments: call.arguments,
                    durationMs: 25,
                  },
                },
              });
              if (!success || index === activeToolCalls.length - 1) completeTurn();
              else startToolCall(index + 1);
            }
            return null;
          }
          if (command === "disconnect_local_codex") {
            codexChannelId = null;
            return null;
          }
          return null;
        },
      },
    });
  }, { scenario });
}

async function dragBetween(source: Locator, destination: Locator, page: Page) {
  const from = await source.boundingBox();
  const to = await destination.boundingBox();
  if (!from || !to) throw new Error("Drag source or destination is not visible.");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
}

async function openAgentSidebar(page: Page): Promise<Locator> {
  const sidebar = page.locator('[data-sidebar-side="right"]');
  await sidebar.getByRole("button", { name: "Agent", exact: true }).click();
  return sidebar;
}

test("Web build exposes no Agent product surface", async ({ page }) => {
  await page.goto("/?demo=taijin-kyofusho");

  await expect(page.getByRole("button", { name: "Agent", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Agents", exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      (window as unknown as AlphaTabWindow).__COTAB_AGENT_RUNTIME__,
    ),
  ).toBeUndefined();
});

test("Zoom rebuilds CoTab overlays on AlphaTab's new cursor layer", async ({ page }) => {
  await page.goto("/?demo=taijin-kyofusho");
  await page.waitForFunction(() =>
    Boolean((window as unknown as AlphaTabWindow).__ALPHATAB_API__?.score?.tracks?.length),
  );

  await page.evaluate(async () => {
    const { usePlayerStore } = await import("/src/stores/render-store.ts");
    usePlayerStore.getState().setTransportPlayhead({
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      barIndex: 0,
      beatIndex: 0,
    });
  });

  const playhead = page.locator(".at-transport-playhead");
  await expect(playhead).toBeVisible();
  await playhead.evaluate((element) => element.setAttribute("data-before-zoom", ""));

  await page.evaluate(async () => {
    const { usePlayerStore } = await import("/src/stores/render-store.ts");
    usePlayerStore.getState().setZoom(1.25);
  });
  await expect(page.locator("[data-before-zoom]")).toHaveCount(0);
  await expect(playhead).toBeVisible();
  expect(await playhead.evaluate((element) =>
    element.parentElement?.classList.contains("at-cursors"),
  )).toBe(true);
});

test("Desktop agent peer edits through an isolated logical Yjs peer", async ({ page }) => {
  await installTauriMock(page);
  await page.goto("/?demo=taijin-kyofusho");
  await page.waitForFunction(() =>
    Boolean((window as unknown as AlphaTabWindow).__ALPHATAB_API__?.score?.tracks?.length),
  );

  const results = await page.evaluate(async () => {
    const modulePath = "/src/agent/agent-peer-runtime.ts";
    const { agentPeerRuntime } = await import(modulePath) as {
      agentPeerRuntime: {
        getSnapshot(): { clientId: number | null };
        start(): Promise<void>;
        stop(): void;
        callTool(tool: string, args?: unknown): Promise<RuntimeResult>;
      };
    };
    await agentPeerRuntime.start();
    const selection = await agentPeerRuntime.callTool("set_selection", {
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      barIndex: 8,
      beatIndex: 0,
      string: 1,
      noteIndex: 0,
    });
    const edit = await agentPeerRuntime.callTool("execute_action", {
      id: "document.score.setTitle",
      args: { value: "Desktop Agent Score" },
    });
    const score = await agentPeerRuntime.callTool("get_score");
    const result = {
      clientId: agentPeerRuntime.getSnapshot().clientId,
      selection,
      edit,
      title: (score.value as { title?: unknown }).title,
    };
    agentPeerRuntime.stop();
    return result;
  });

  expect(results.clientId).not.toBeNull();
  expect(results.selection).toMatchObject({
    ok: true,
    value: { barIndex: 8, noteIndex: 0 },
  });
  expect(results.edit.ok).toBe(true);
  expect(results.title).toBe("Desktop Agent Score");
  await expect(
    page.locator('[data-sidebar-side="right"]')
      .getByRole("button", { name: "Title", exact: true }),
  ).toContainText("Desktop Agent Score");
});

test("Desktop Agent is a right sidebar tab that reduces score width", async ({ page }) => {
  await installTauriMock(page);
  await page.goto("/?demo=taijin-kyofusho");

  const score = page.locator("[data-score-viewport]");
  const rightSidebar = page.locator('[data-sidebar-side="right"]');
  await expect(rightSidebar.getByRole("button", { name: "Agent", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Agents", exact: true })).toHaveCount(0);

  const openScoreBox = await score.boundingBox();
  const openSidebarBox = await rightSidebar.boundingBox();
  expect(openScoreBox).not.toBeNull();
  expect(openSidebarBox).not.toBeNull();
  expect(Math.abs(
    openScoreBox!.x + openScoreBox!.width - openSidebarBox!.x,
  )).toBeLessThanOrEqual(1);
  expect(openSidebarBox!.width).toBeGreaterThan(300);

  await rightSidebar.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect.poll(async () => (await score.boundingBox())?.width ?? 0).toBeGreaterThan(
    openScoreBox!.width + 300,
  );
  await expect.poll(async () => (await rightSidebar.boundingBox())?.width ?? 0).toBeLessThan(50);
});

test("Sidebar tabs move in both directions", async ({ page }) => {
  await installTauriMock(page);
  await page.goto("/?demo=taijin-kyofusho");

  const leftSidebar = page.locator('[data-sidebar-side="left"]');
  const rightSidebar = page.locator('[data-sidebar-side="right"]');
  const agentTab = rightSidebar.getByRole("button", { name: "Agent", exact: true });
  const notesTab = leftSidebar.getByRole("button", { name: "Notes", exact: true });

  await dragBetween(agentTab, notesTab, page);
  await expect(leftSidebar.getByRole("button", { name: "Agent", exact: true })).toBeVisible();
  await expect(rightSidebar.getByRole("button", { name: "Agent", exact: true })).toHaveCount(0);

  await dragBetween(
    leftSidebar.getByRole("button", { name: "Notes", exact: true }),
    rightSidebar,
    page,
  );
  await expect(rightSidebar.getByRole("button", { name: "Notes", exact: true })).toBeVisible();
  await expect(leftSidebar.getByRole("button", { name: "Notes", exact: true })).toHaveCount(0);

  expect(await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cotab:sidebar-tab-placement-v2") ?? "null"),
  )).toEqual({
    left: ["agent", "debug"],
    right: ["meta", "notes"],
  });
});

test("Desktop Local Codex connects from Agent tab and executes a tool call", async ({ page }) => {
  await installTauriMock(page);
  await page.goto("/?demo=taijin-kyofusho");
  await page.waitForFunction(() =>
    Boolean((window as unknown as AlphaTabWindow).__ALPHATAB_API__?.score?.tracks?.length),
  );

  const rightSidebar = await openAgentSidebar(page);
  await expect(rightSidebar.getByText("Local Codex", { exact: true })).toBeVisible();
  await expect(rightSidebar.getByText("codex-cli test", { exact: true }).first()).toBeVisible();
  await rightSidebar.getByRole("button", { name: "Connect", exact: true }).click();

  await expect(rightSidebar.getByRole("button", { name: "Disconnect", exact: true })).toBeVisible();
  await rightSidebar.getByPlaceholder("Edit the current score...").fill("Update the score title");
  await rightSidebar.getByRole("button", { name: "Send", exact: true }).click();

  await expect.poll(() => page.evaluate(() => {
    const threadStart = (window as unknown as AlphaTabWindow)
      .__COTAB_TEST_SETTINGS__?.threadStart as
      | { developerInstructions?: unknown }
      | undefined;
    return threadStart?.developerInstructions;
  })).toContain("first materialize a complete rest rhythm");

  await expect(rightSidebar.getByText("Score updated.", { exact: true })).toBeVisible();
  await expect(rightSidebar.locator("strong", { hasText: "Score updated." })).toBeVisible();
  await expect(rightSidebar.getByText("Update the score title", { exact: true })).toHaveCount(1);
  await expect(rightSidebar.getByText("Edit score", { exact: true })).toBeVisible();
  await expect(page.getByText("Codex Transport Score", { exact: true }).first()).toBeVisible();

  await rightSidebar.getByRole("button", { name: "Conversation history" }).click();
  await expect(rightSidebar.getByRole("tab", { name: "Current Score" })).toBeVisible();
  await expect(rightSidebar.getByText("Update the score title", { exact: true })).toBeVisible();
  await rightSidebar.getByRole("button", { name: "Disconnect", exact: true }).click();
});

test("Agent drum continuation matches Y.Doc, AlphaTab, and rendered geometry", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await installTauriMock(page, "continue-drums");
  await page.goto("/?demo=taijin-kyofusho");
  await page.waitForFunction(() => {
    const api = (window as unknown as {
      __ALPHATAB_API__?: { score?: { masterBars?: unknown[] } };
    }).__ALPHATAB_API__;
    return api?.score?.masterBars?.length === 58;
  });
  await page.getByTestId("layout-menu").click();
  await page.getByRole("menuitemcheckbox", { name: "Horizontal layout" }).click();
  await page.waitForFunction(() =>
    (window as unknown as { __ALPHATAB_API__?: {
      settings?: { display?: { layoutMode?: number } };
    } }).__ALPHATAB_API__?.settings?.display?.layoutMode === 1,
  );

  const rightSidebar = await openAgentSidebar(page);
  await rightSidebar.getByRole("button", { name: "Connect", exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const viewport = document.querySelector<HTMLElement>(".at-viewport");
    return viewport ? viewport.scrollWidth - viewport.clientWidth : 0;
  })).toBeGreaterThan(0);
  const initialViewport = await page.evaluate(() => {
    const viewport = document.querySelector<HTMLElement>(".at-viewport");
    if (!viewport) throw new Error("AlphaTab viewport is unavailable.");
    viewport.scrollLeft = viewport.scrollWidth - viewport.clientWidth;
    const start = viewport.scrollLeft;
    const trace = {
      start,
      minimum: start,
      samples: [start],
    };
    const sample = () => {
      trace.minimum = Math.min(trace.minimum, viewport.scrollLeft);
      trace.samples.push(viewport.scrollLeft);
    };
    viewport.addEventListener("scroll", sample);
    (window as unknown as {
      __COTAB_VIEWPORT_TRACE__?: {
        trace: typeof trace;
        stop(): void;
      };
    }).__COTAB_VIEWPORT_TRACE__ = {
      trace,
      stop: () => viewport.removeEventListener("scroll", sample),
    };
    return {
      scrollLeft: start,
      maxScrollLeft: viewport.scrollWidth - viewport.clientWidth,
    };
  });
  expect(initialViewport.scrollLeft).toBeGreaterThan(0);
  await rightSidebar.getByPlaceholder("Edit the current score...").fill(
    CONTINUE_DRUMS_PROMPT,
  );
  await rightSidebar.getByRole("button", { name: "Send", exact: true }).click();

  await expect(
    rightSidebar.getByText("已从第57小节起续写4小节鼓组。", { exact: true }),
  ).toBeVisible({ timeout: 90_000 });
  await expect(
    rightSidebar.getByText(CONTINUE_DRUMS_PROMPT, { exact: true }),
  ).toHaveCount(1);
  // AlphaTab's default playback scroll uses a 300ms animation. Waiting past
  // that boundary ensures a delayed jump to the first playback tick is caught.
  await page.waitForTimeout(400);

  const viewportTrace = await page.evaluate(() => {
    const viewport = document.querySelector<HTMLElement>(".at-viewport");
    const monitor = (window as unknown as {
      __COTAB_VIEWPORT_TRACE__?: {
        trace: { start: number; minimum: number; samples: number[] };
        stop(): void;
      };
    }).__COTAB_VIEWPORT_TRACE__;
    if (!viewport || !monitor) throw new Error("Viewport trace is unavailable.");
    monitor.stop();
    return {
      ...monitor.trace,
      final: viewport.scrollLeft,
    };
  });

  const result = await page.evaluate(() => {
    interface YMapLike {
      get(key: string): unknown;
    }
    interface YArrayLike {
      readonly length: number;
      get(index: number): YMapLike;
    }
    interface AlphaBeatLike {
      readonly duration: number;
      readonly isEmpty: boolean;
      readonly notes: Array<{ readonly percussionArticulation: number }>;
    }
    interface BoundsLike {
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
    }
    interface BeatBoundsLike {
      readonly visualBounds: BoundsLike;
      readonly realBounds: BoundsLike;
      readonly onNotesX: number;
      readonly notes: Array<{ readonly noteHeadBounds: BoundsLike }> | null;
      readonly barBounds: {
        readonly realBounds: BoundsLike;
        readonly masterBarBounds: { readonly realBounds: BoundsLike };
      };
    }

    const runtime = window as unknown as {
      __ALPHATAB_API__: {
        readonly score: {
          readonly masterBars: unknown[];
          readonly tracks: Array<{
            readonly staves: Array<{
              readonly bars: Array<{
                readonly voices: Array<{ readonly beats: AlphaBeatLike[] }>;
              }>;
            }>;
          }>;
        };
        readonly boundsLookup: {
          readonly isFinished: boolean;
          findBeat(beat: AlphaBeatLike): BeatBoundsLike | null;
        };
      };
      __COTAB_STORE__: {
        readonly engine: { getScoreMap(): YMapLike | null };
      };
      __COTAB_TEST_SETTINGS__?: {
        readonly toolResults?: Array<{ readonly success?: boolean }>;
      };
    };
    const api = runtime.__ALPHATAB_API__;
    const alphaScore = api.score;
    const alphaBars = alphaScore.tracks[5].staves[0].bars;

    const yScore = runtime.__COTAB_STORE__.engine.getScoreMap()!;
    const yTracks = yScore.get("tracks") as YArrayLike;
    const yStaves = yTracks.get(5).get("staves") as YArrayLike;
    const yBars = yStaves.get(0).get("bars") as YArrayLike;

    const yPhrase = [56, 57, 58, 59].map((barIndex) => {
      const voices = yBars.get(barIndex).get("voices") as YArrayLike;
      const beats = voices.get(0).get("beats") as YArrayLike;
      return Array.from({ length: beats.length }, (_, beatIndex) => {
        const beat = beats.get(beatIndex);
        const notes = beat.get("notes") as YArrayLike;
        return {
          duration: beat.get("duration"),
          isEmpty: beat.get("isEmpty"),
          notes: Array.from(
            { length: notes.length },
            (_, noteIndex) => notes.get(noteIndex).get("percussionArticulation"),
          ),
        };
      });
    });

    const alphaPhrase = [56, 57, 58, 59].map((barIndex) =>
      alphaBars[barIndex].voices[0].beats.map((beat) => ({
        duration: beat.duration,
        isEmpty: beat.isEmpty,
        notes: beat.notes.map((note) => note.percussionArticulation),
      })),
    );

    const geometry = [56, 57, 58, 59].flatMap((barIndex) =>
      alphaBars[barIndex].voices[0].beats.map((beat) => {
        const bounds = api.boundsLookup.findBeat(beat);
        if (!bounds) return { valid: false, height: Number.POSITIVE_INFINITY };
        const values = [
          bounds.visualBounds.x,
          bounds.visualBounds.y,
          bounds.visualBounds.w,
          bounds.visualBounds.h,
          bounds.realBounds.x,
          bounds.realBounds.y,
          bounds.realBounds.w,
          bounds.realBounds.h,
          bounds.onNotesX,
        ];
        const bar = bounds.barBounds.realBounds;
        const masterBar = bounds.barBounds.masterBarBounds.realBounds;
        const heads = bounds.notes?.map((note) => note.noteHeadBounds) ?? [];
        const headsAreInside = heads.every((head) =>
          head.x >= bar.x - 1
          && head.x + head.w <= bar.x + bar.w + 1
          && head.y >= masterBar.y - 1
          && head.y + head.h <= masterBar.y + masterBar.h + 1
          && head.w > 0
          && head.h > 0,
        );
        return {
          valid: values.every(Number.isFinite)
            && bounds.onNotesX >= bar.x
            && bounds.onNotesX <= bar.x + bar.w
            && bounds.visualBounds.h > 0
            && bounds.visualBounds.h < 100
            && headsAreInside,
          height: bounds.visualBounds.h,
        };
      }),
    );

    return {
      yMasterBarCount: (yScore.get("masterBars") as YArrayLike).length,
      yStaffBarCounts: Array.from({ length: yTracks.length }, (_, trackIndex) => {
        const staves = yTracks.get(trackIndex).get("staves") as YArrayLike;
        return Array.from({ length: staves.length }, (_, staffIndex) =>
          (staves.get(staffIndex).get("bars") as YArrayLike).length,
        );
      }).flat(),
      alphaMasterBarCount: alphaScore.masterBars.length,
      alphaStaffBarCounts: alphaScore.tracks.flatMap((track) =>
        track.staves.map((staff) => staff.bars.length),
      ),
      yPhrase,
      alphaPhrase,
      boundsFinished: api.boundsLookup.isFinished,
      geometry,
      toolResults: runtime.__COTAB_TEST_SETTINGS__?.toolResults ?? [],
    };
  });

  const expectedPhrase = [
    [[8, 3], [3], [3], [8, 3], [0, 3], [8, 3], [3], [8, 3]],
    [[8, 3], [3], [3], [3], [3], [8, 3], [5, 8], []],
    [[8, 3], [3], [3], [8, 3], [0, 3], [8, 3], [3], [8, 3]],
    [[3, 8], [3], [3], [3], [3], [3, 8], [5, 0], []],
  ].map((bar) => bar.map((notes) => ({
    duration: 8,
    isEmpty: false,
    notes,
  })));

  expect(result.yMasterBarCount).toBe(60);
  expect(result.alphaMasterBarCount).toBe(60);
  expect(result.yStaffBarCounts.every((count) => count === 60)).toBe(true);
  expect(result.alphaStaffBarCounts.every((count) => count === 60)).toBe(true);
  expect(result.yPhrase).toEqual(expectedPhrase);
  expect(result.alphaPhrase).toEqual(expectedPhrase);
  expect(result.boundsFinished).toBe(true);
  expect(result.geometry).toHaveLength(32);
  expect(result.geometry.every(({ valid }) => valid)).toBe(true);
  expect(result.toolResults.length).toBeGreaterThan(0);
  expect(result.toolResults.every(({ success }) => success)).toBe(true);
  expect(viewportTrace.minimum).toBe(viewportTrace.start);
  expect(viewportTrace.final).toBe(viewportTrace.start);
  expect(pageErrors).toEqual([]);
});

test("Agent composer configures the Codex model and reasoning effort", async ({ page }) => {
  await installTauriMock(page);
  await page.goto("/?demo=taijin-kyofusho");

  const rightSidebar = await openAgentSidebar(page);
  await rightSidebar.getByRole("button", { name: "Connect", exact: true }).click();
  const composer = rightSidebar.getByPlaceholder("Edit the current score...");

  await rightSidebar.getByRole("button", { name: "Model and reasoning effort" }).click();
  await page.getByRole("button", { name: /GPT-5.6-Terra/ }).click();
  await page.getByRole("button", { name: "high", exact: true }).click();

  await composer.fill("Update the score title");
  await composer.press("Enter");
  await expect(rightSidebar.getByText("Score updated.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() =>
    (window as unknown as AlphaTabWindow).__COTAB_TEST_SETTINGS__?.threadStart,
  )).toMatchObject({ model: "gpt-5.6-terra" });
  await expect.poll(() => page.evaluate(() => {
    const history = (window as unknown as AlphaTabWindow)
      .__COTAB_TEST_SETTINGS__?.threadSettingsHistory;
    return Array.isArray(history) && history.some((setting) =>
      typeof setting === "object"
      && setting !== null
      && (setting as { collaborationMode?: { settings?: { reasoning_effort?: string } } })
        .collaborationMode?.settings?.reasoning_effort === "high",
    );
  })).toBe(true);

});

test("Agent composer toggles the native Codex plan mode", async ({ page }) => {
  await installTauriMock(page);
  await page.goto("/?demo=taijin-kyofusho");

  const rightSidebar = await openAgentSidebar(page);
  await rightSidebar.getByRole("button", { name: "Connect", exact: true }).click();
  const composer = rightSidebar.getByPlaceholder("Edit the current score...");
  await composer.fill("Inspect the score");
  await composer.press("Enter");
  await expect(rightSidebar.getByText("Score updated.", { exact: true })).toBeVisible();
  const planMode = rightSidebar.getByRole("button", { name: "Plan mode" });
  await planMode.click();
  await expect(planMode).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as AlphaTabWindow).__COTAB_TEST_SETTINGS__?.threadSettings,
  )).toMatchObject({
    collaborationMode: { mode: "plan" },
  });
});

test("Agent resource permissions configure local, web, and writable roots", async ({ page }) => {
  await installTauriMock(page);
  await page.goto("/?demo=taijin-kyofusho");

  const rightSidebar = await openAgentSidebar(page);
  await rightSidebar.getByRole("button", { name: "Connect", exact: true }).click();
  const resourcesButton = rightSidebar.getByRole("button", { name: "External resources" });
  const disconnectButton = rightSidebar.getByRole("button", { name: "Disconnect", exact: true });
  const openResources = async (control: Locator) => {
    await expect(disconnectButton).toBeVisible();
    await expect(resourcesButton).toBeEnabled();
    if (!await control.isVisible()) await resourcesButton.click();
    await expect(control).toBeVisible();
  };

  const localResources = page.getByLabel("Local resources");
  await openResources(localResources);
  await page.getByText("Local resources", { exact: true }).click();
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as AlphaTabWindow).__COTAB_TEST_SETTINGS__,
  )).toMatchObject({ codexConnectCount: 2, localResources: true, webResources: false });
  await openResources(localResources);
  await expect(localResources).toBeChecked();

  const webResources = page.getByLabel("Web resources");
  await page.getByText("Web resources", { exact: true }).click();
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as AlphaTabWindow).__COTAB_TEST_SETTINGS__,
  )).toMatchObject({ codexConnectCount: 3, localResources: true, webResources: true });
  await openResources(webResources);
  await expect(webResources).toBeChecked();

  const localWrite = page.getByLabel("Local write");
  await localWrite.click();
  await expect(localWrite).toBeChecked();
  await resourcesButton.click();

  const composer = rightSidebar.getByPlaceholder("Edit the current score...");
  await composer.fill("Inspect the score");
  await composer.press("Enter");
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as AlphaTabWindow).__COTAB_TEST_SETTINGS__?.threadSettings,
  )).toMatchObject({
    sandboxPolicy: {
      type: "workspaceWrite",
      networkAccess: false,
      writableRoots: ["/tmp/cotab-agent-write-test"],
    },
  });
});

test("Agent proxy can be enabled, persisted, and applied to Codex app-server", async ({ page }) => {
  await installTauriMock(page);
  await page.goto("/?demo=taijin-kyofusho");

  await page.getByTestId("preferences-menu").click();
  await page.getByRole("menuitem", { name: "Codex proxy" }).click();
  await page.getByLabel("Enable proxy").check();
  await page.getByLabel("Proxy URL").fill("http://localhost:9098");
  await page.getByRole("button", { name: "Apply", exact: true }).click();

  expect(await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cotab:codex-proxy-v1") ?? "null"),
  )).toEqual({ enabled: true, url: "http://localhost:9098" });

  const rightSidebar = await openAgentSidebar(page);
  await rightSidebar.getByRole("button", { name: "Connect", exact: true }).click();
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as AlphaTabWindow).__COTAB_TEST_SETTINGS__,
  )).toMatchObject({
    codexConnectCount: 1,
    proxyUrl: "http://localhost:9098",
  });

  await page.getByTestId("preferences-menu").click();
  await page.getByRole("menuitem", { name: "Codex proxy" }).click();
  await page.getByLabel("Proxy URL").fill("http://127.0.0.1:9098");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as AlphaTabWindow).__COTAB_TEST_SETTINGS__,
  )).toMatchObject({
    codexConnectCount: 2,
    proxyUrl: "http://127.0.0.1:9098",
  });
  await expect(
    rightSidebar.getByRole("button", { name: "Disconnect", exact: true }),
  ).toBeVisible();
});
