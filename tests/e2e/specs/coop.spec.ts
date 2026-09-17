/**
 * Multi-user collaboration E2E tests.
 *
 * Each test creates isolated browser contexts (separate cookies, storage,
 * WebSocket connections) to simulate different users collaborating in real-time.
 *
 * Prerequisites: Vite dev server + Worker room service must be running
 * (configured in playwright.config.ts webServer entries).
 */

import { test, expect, type Browser, type BrowserContext, type Page, type WebSocketRoute } from "@playwright/test";
import {
  waitForScoreLoaded,
  createRoom,
  joinRoom,
  closeRoomDialog,
  openRoomDialog,
  waitForPeerCount,
  waitForNetworkSynced,
  assertPeerCountInDialog,
  setScoreTitle,
  getScoreTitle,
  getBarCount,
  addBar,
  ensureScoreExists,
  isConnected,
  disconnect,
  waitForScoreTitle,
  waitForBarCount,
} from "../helpers/coop";

// ─── Helpers ─────────────────────────────────────────────────────────────────


type CollaborationWindow = Window & {
  __COTAB_STORE__: { engine: { getScoreMap(): { get(key: string): unknown } } };
  __COTAB_TAB_STORE__: { getState(): { syncState: { transport: { webSocketConnected: boolean } } } };
  __ALPHATAB_API__?: { score?: { title: string; artist: string } };
  __PLAYER_STORE__: { getState(): { isRendering: boolean } };
};

interface UserSession {
  context: BrowserContext;
  page: Page;
  pageErrors: string[];
}

/** Create an isolated browser context + page, navigate to the app, and wait for it to load. */
async function createUser(browser: Browser): Promise<UserSession> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.stack ?? error.message);
  });
  await waitForScoreLoaded(page);
  // Wait for the dev-mode store exposure to be ready
  await page.waitForFunction(
    () => !!(window as unknown as Record<string, unknown>).__COTAB_TAB_STORE__,
    undefined,
    { timeout: 10_000 },
  );
  return { context, page, pageErrors };
}

/** Clean up a user session. */
async function cleanupUser(user: UserSession): Promise<void> {
  await user.page.close();
  await user.context.close();
  expect.soft(user.pageErrors, "collaboration page emitted runtime errors").toEqual([]);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe("Collaboration (multi-user)", () => {
  test.describe.configure({ timeout: 60_000 });

  test("room creation and joining", async ({ browser }) => {
    const userA = await createUser(browser);
    const userB = await createUser(browser);

    try {
      // User A creates a room
      const roomCode = await createRoom(userA.page, "Alice");
      expect(roomCode).toMatch(/^[A-Za-z0-9]{12}\.[A-Za-z0-9_-]{43}$/);
      await userA.context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await userA.page.getByRole("button", { name: "Copy invitation" }).click();
      expect(await userA.page.evaluate(() => navigator.clipboard.readText())).toBe(roomCode);

      // Verify User A is connected
      expect(await isConnected(userA.page)).toBe(true);
      await closeRoomDialog(userA.page);

      // User B joins the room
      await joinRoom(userB.page, roomCode, "Bob");
      expect(await isConnected(userB.page)).toBe(true);
      await closeRoomDialog(userB.page);

      // Presence alone is insufficient: require the completed server handshake.
      await waitForNetworkSynced(userB.page);
      await waitForNetworkSynced(userA.page);

      // Verify in UI dialog
      await assertPeerCountInDialog(userA.page, 1);
      await closeRoomDialog(userA.page);

      const sidebar = userA.page.locator('[data-sidebar-side="left"]');
      await sidebar.getByRole("button", { name: "Debug", exact: true }).click();
      const editorMonitor = sidebar.locator('[data-debug-section="editor-state"]');
      await expect(editorMonitor.getByText("Editor State", { exact: true })).toBeVisible();
      const syncStateNode = editorMonitor.getByRole("button", { name: /^syncState Object/ });
      await expect(syncStateNode).toBeVisible();
      const syncStateTree = syncStateNode.locator("..");
      await expect(syncStateTree.getByText("networkPeerCount", { exact: true })).toBeVisible();
      await syncStateTree.getByRole("button", { name: /^transport Object/ }).click();
      await expect(syncStateTree.getByText("webSocketConnected", { exact: true })).toBeVisible();
      await expect(syncStateTree.getByText("serverSynced", { exact: true })).toBeVisible();
      await syncStateTree.getByRole("button", { name: /^yjs Object/ }).click();
      await expect(syncStateTree.getByText("recentUpdates", { exact: true })).toBeVisible();
    } finally {
      await cleanupUser(userB);
      await cleanupUser(userA);
    }
  });

  test("peer presence: join and leave", async ({ browser }) => {
    const userA = await createUser(browser);
    const userB = await createUser(browser);

    try {
      // A creates room
      const roomCode = await createRoom(userA.page, "Alice");
      await closeRoomDialog(userA.page);

      // B joins
      await joinRoom(userB.page, roomCode, "Bob");
      await closeRoomDialog(userB.page);

      await waitForNetworkSynced(userA.page);
      await waitForNetworkSynced(userB.page);

      // Closing the browser socket removes its ephemeral room membership.
      await cleanupUser(userB);

      // A should see B removed from peer list
      await waitForPeerCount(userA.page, 0);
    } finally {
      await cleanupUser(userA);
    }
  });

  test("late joiner receives existing score state", async ({ browser }) => {
    const userA = await createUser(browser);

    try {
      // A creates a room
      const roomCode = await createRoom(userA.page, "Alice");
      await closeRoomDialog(userA.page);

      // A modifies the score before B joins.
      await ensureScoreExists(userA.page);
      await setScoreTitle(userA.page, "Late Joiner Test");
      await waitForScoreTitle(userA.page, "Late Joiner Test", 5_000);

      // B joins later
      const userB = await createUser(browser);
      try {
        await joinRoom(userB.page, roomCode, "Bob");
        await closeRoomDialog(userB.page);

        await waitForNetworkSynced(userA.page);
        await waitForNetworkSynced(userB.page);
        await waitForScoreTitle(userB.page, "Late Joiner Test");

        // B should have received A's score with tracks
        const barsOnB = await getBarCount(userB.page);
        expect(barsOnB).toBeGreaterThan(0);
      } finally {
        await cleanupUser(userB);
      }
    } finally {
      await cleanupUser(userA);
    }
  });

  test("real-time edit sync between peers", async ({ browser }) => {
    const userA = await createUser(browser);
    const userB = await createUser(browser);

    try {
      // Setup: both in same room
      const roomCode = await createRoom(userA.page, "Alice");
      await closeRoomDialog(userA.page);
      await joinRoom(userB.page, roomCode, "Bob");
      await closeRoomDialog(userB.page);

      await waitForNetworkSynced(userA.page);
      await waitForNetworkSynced(userB.page);

      // A changes the score title
      await setScoreTitle(userA.page, "Synced Title");

      // B should see the title change via CRDT sync
      await waitForScoreTitle(userB.page, "Synced Title");

      const titleOnB = await getScoreTitle(userB.page);
      expect(titleOnB).toBe("Synced Title");
      await userB.page.waitForFunction(() => {
        const store = (window as unknown as Record<string, unknown>).__COTAB_TAB_STORE__ as {
          getState: () => {
            syncState: {
              yjs: { bySource: { network: { updates: number; bytes: number } } };
              transport: {
                bytesSent: number;
                bytesReceived: number;
                messagesSent: number;
                messagesReceived: number;
              };
            };
          };
        } | undefined;
        const sync = store?.getState().syncState;
        return !!sync
          && sync.yjs.bySource.network.updates > 0
          && sync.yjs.bySource.network.bytes > 0
          && sync.transport.bytesSent > 0
          && sync.transport.bytesReceived > 0
          && sync.transport.messagesSent > 0
          && sync.transport.messagesReceived > 0;
      });
    } finally {
      await cleanupUser(userB);
      await cleanupUser(userA);
    }
  });

  test("bidirectional editing", async ({ browser }) => {
    const userA = await createUser(browser);
    const userB = await createUser(browser);

    try {
      // Setup: both in same room
      const roomCode = await createRoom(userA.page, "Alice");
      await closeRoomDialog(userA.page);
      await joinRoom(userB.page, roomCode, "Bob");
      await closeRoomDialog(userB.page);

      await waitForNetworkSynced(userA.page);
      await waitForNetworkSynced(userB.page);

      // Ensure a score is available before testing structural edits.
      await ensureScoreExists(userA.page);

      await userB.page.waitForFunction(() => {
        const core = (window as unknown as Record<string, unknown>).__COTAB_STORE__ as {
          engine?: { getScoreMap: () => import("yjs").Map<unknown> | null };
        } | undefined;
        const tracks = core?.engine?.getScoreMap()?.get("tracks") as
          import("yjs").Array<unknown> | undefined;
        return (tracks?.length ?? 0) > 0;
      });

      // Get bar count after score is synced
      const initialBars = await getBarCount(userA.page);

      // A adds a bar
      await addBar(userA.page);

      // B should see the new bar
      await waitForBarCount(userB.page, initialBars + 1);

      // B also changes the title
      await setScoreTitle(userB.page, "Bob's Edit");

      // A should see B's title change
      await waitForScoreTitle(userA.page, "Bob's Edit");

      // Verify convergence
      const titleOnA = await getScoreTitle(userA.page);
      const titleOnB = await getScoreTitle(userB.page);
      expect(titleOnA).toBe("Bob's Edit");
      expect(titleOnB).toBe("Bob's Edit");

      const barsOnA = await getBarCount(userA.page);
      const barsOnB = await getBarCount(userB.page);
      expect(barsOnA).toBe(initialBars + 1);
      expect(barsOnB).toBe(initialBars + 1);
    } finally {
      await cleanupUser(userB);
      await cleanupUser(userA);
    }
  });

  test("disconnect and reconnect preserves state", async ({ browser }) => {
    const userA = await createUser(browser);
    const userB = await createUser(browser);

    try {
      // Setup: both in same room, A edits the title
      const roomCode = await createRoom(userA.page, "Alice");
      await closeRoomDialog(userA.page);
      await joinRoom(userB.page, roomCode, "Bob");
      await closeRoomDialog(userB.page);

      await waitForNetworkSynced(userA.page);
      await waitForNetworkSynced(userB.page);

      // A edits the title
      await setScoreTitle(userA.page, "Before Disconnect");
      await waitForScoreTitle(userB.page, "Before Disconnect");

      // A disconnects
      await disconnect(userA.page);
      await closeRoomDialog(userA.page);

      expect(await isConnected(userA.page)).toBe(false);
      await waitForPeerCount(userB.page, 0);

      // A reconnects to the same room
      await joinRoom(userA.page, roomCode, "Alice");
      await closeRoomDialog(userA.page);

      expect(await isConnected(userA.page)).toBe(true);
      await waitForNetworkSynced(userA.page);
      await waitForNetworkSynced(userB.page);

      // A should have the score state preserved (via IndexedDB or peer sync)
      await waitForScoreTitle(userA.page, "Before Disconnect");

      const titleAfterReconnect = await getScoreTitle(userA.page);
      expect(titleAfterReconnect).toBe("Before Disconnect");
    } finally {
      await cleanupUser(userB);
      await cleanupUser(userA);
    }
  });
});

test("offline edits and peer edits converge after automatic reconnect", async ({ browser }) => {
  const a = await createUser(browser);
  const b = await createUser(browser);
  let offline = false;
  const sockets: WebSocketRoute[] = [];
  await b.page.routeWebSocket("**/api/rooms/*/sync", (socket) => {
    if (offline) { void socket.close({ code: 4000 }); return; }
    sockets.push(socket, socket.connectToServer());
  });
  await waitForScoreLoaded(b.page);
  try {
    const invitation = await createRoom(a.page, "Alice");
    await closeRoomDialog(a.page);
    await joinRoom(b.page, invitation, "Bob");
    await closeRoomDialog(b.page);
    await Promise.all([waitForNetworkSynced(a.page), waitForNetworkSynced(b.page)]);
    expect(sockets.length).toBeGreaterThanOrEqual(2);
    offline = true;
    await test.step("Interrupt live sockets", () => Promise.all(sockets.map((socket) => socket.close({ code: 4000 }))));
    await b.page.waitForFunction(() => {
      const state = (window as unknown as CollaborationWindow).__COTAB_TAB_STORE__.getState();
      return state.syncState.transport.webSocketConnected === false;
    }, undefined, { timeout: 5_000 });
    await setScoreTitle(b.page, "Written offline");
    await a.page.evaluate(async () => {
      const { executeAppAction } = await import("/src/app-actions/registry.ts");
      const { default: i18n } = await import("/src/i18n/index.ts");
      executeAppAction("document.score.setArtist", { value: "Online peer" }, { t: i18n.t.bind(i18n) });
    });
    offline = false;
    await Promise.all([waitForNetworkSynced(a.page), waitForNetworkSynced(b.page)]);
    for (const page of [a.page, b.page]) {
      await expect.poll(() => page.evaluate(() => {
        const runtime = window as unknown as CollaborationWindow;
        const score = runtime.__COTAB_STORE__.engine.getScoreMap();
        return {
          title: score.get("title"), artist: score.get("artist"),
          renderedTitle: runtime.__ALPHATAB_API__?.score?.title,
          renderedArtist: runtime.__ALPHATAB_API__?.score?.artist,
          rendering: runtime.__PLAYER_STORE__.getState().isRendering,
        };
      })).toEqual({ title: "Written offline", artist: "Online peer", renderedTitle: "Written offline", renderedArtist: "Online peer", rendering: false });
    }
  } finally {
    await cleanupUser(b);
    await cleanupUser(a);
  }
});

test("Agent edits reach the other room participant and its settled renderer", async ({ browser }) => {
  const a = await createUser(browser);
  const b = await createUser(browser);
  try {
    const invitation = await createRoom(a.page, "Alice");
    await closeRoomDialog(a.page);
    await joinRoom(b.page, invitation, "Bob");
    await closeRoomDialog(b.page);
    await Promise.all([waitForNetworkSynced(a.page), waitForNetworkSynced(b.page)]);
    const result = await a.page.evaluate(async () => {
      Object.defineProperty(window, "__TAURI_INTERNALS__", { value: {}, configurable: true });
      const { agentPeerRuntime } = await import("/src/agent/agent-peer-runtime.ts");
      await agentPeerRuntime.start();
      try {
        return await agentPeerRuntime.callTool("execute_action", { id: "document.score.setTitle", args: { value: "Agent room edit" } });
      } finally { agentPeerRuntime.stop(); }
    });
    expect(result.ok).toBe(true);
    expect(result.diagnostics?.renderer?.status).toBe("succeeded");
    await expect.poll(() => b.page.evaluate(() => {
      const runtime = window as unknown as CollaborationWindow;
      return {
        title: runtime.__COTAB_STORE__.engine.getScoreMap().get("title"),
        rendered: runtime.__ALPHATAB_API__?.score?.title,
        rendering: runtime.__PLAYER_STORE__.getState().isRendering,
      };
    })).toEqual({ title: "Agent room edit", rendered: "Agent room edit", rendering: false });
  } finally {
    await cleanupUser(b);
    await cleanupUser(a);
  }
});

test("IndexedDB recovers unsent edits after reopening the room", async ({ browser }) => {
  const a = await createUser(browser);
  const b = await createUser(browser);
  const sockets: WebSocketRoute[] = [];
  let offline = false;
  await b.page.routeWebSocket("**/api/rooms/*/sync", (socket) => {
    if (offline) { void socket.close({ code: 4000 }); return; }
    sockets.push(socket, socket.connectToServer());
  });
  await waitForScoreLoaded(b.page);
  try {
    const invitation = await createRoom(a.page, "Alice");
    await closeRoomDialog(a.page);
    await joinRoom(b.page, invitation, "Bob");
    await closeRoomDialog(b.page);
    await Promise.all([waitForNetworkSynced(a.page), waitForNetworkSynced(b.page)]);
    expect(sockets.length).toBeGreaterThanOrEqual(2);
    offline = true;
    await test.step("Interrupt live sockets", () => Promise.all(sockets.map((socket) => socket.close({ code: 4000 }))));
    await b.page.waitForFunction(() => !(window as unknown as CollaborationWindow).__COTAB_TAB_STORE__.getState().syncState.transport.webSocketConnected, undefined, { timeout: 5_000 });
    await setScoreTitle(b.page, "Recovered from IndexedDB");
    // Wait for actual IndexedDB recovery, not a guessed persistence delay.
    await expect.poll(() => b.page.evaluate(async (invitation) => {
      const { engine } = await import("/src/core/engine.ts");
      const { createWebCollaborationAdapter } = await import("/src/adapters/web/collaboration.ts");
      const Doc = engine.getDoc().constructor as { new(): import("yjs").Doc };
      const recovered = new Doc();
      const adapter = createWebCollaborationAdapter({ serviceUrl: "http://localhost:8787" });
      const persistence = adapter.createPersistence(adapter.resolveRoomCode(invitation), recovered);
      await new Promise<void>((resolve) => persistence.on("synced", resolve));
      const title = recovered.getMap("score").get("title");
      persistence.destroy();
      recovered.destroy();
      return title;
    }, invitation)).toBe("Recovered from IndexedDB");
    expect(await getScoreTitle(a.page)).not.toBe("Recovered from IndexedDB");
    await b.page.close();
    b.page = await b.context.newPage();
    b.page.on("pageerror", (error) => b.pageErrors.push(error.message));
    await waitForScoreLoaded(b.page);
    await joinRoom(b.page, invitation, "Bob reopened");
    await closeRoomDialog(b.page);
    await Promise.all([waitForNetworkSynced(a.page), waitForNetworkSynced(b.page)]);
    await Promise.all([waitForScoreTitle(a.page, "Recovered from IndexedDB"), waitForScoreTitle(b.page, "Recovered from IndexedDB")]);
  } finally {
    await cleanupUser(b);
    await cleanupUser(a);
  }
});

test("oversized local updates report an error and retain the local document", async ({ browser }) => {
  const user = await createUser(browser);
  try {
    await createRoom(user.page, "Alice");
    await user.page.evaluate(async () => {
      const { engine } = await import("/src/core/engine.ts");
      // Exercise transport admission without asking the notation renderer to
      // lay out a megabyte-long score title.
      engine.getDoc().getMap("transport-admission-test").set("payload", "x".repeat(8_400_000));
    });
    await expect(user.page.getByRole("alert")).toContainText("document size limit");
    const retained = await user.page.evaluate(async () => {
      const { engine } = await import("/src/core/engine.ts");
      return engine.getDoc().getMap("transport-admission-test").get("payload").length;
    });
    expect(retained).toBe(8_400_000);
  } finally { await cleanupUser(user); }
});
