/**
 * Multi-user collaboration E2E tests.
 *
 * Each test creates isolated browser contexts (separate cookies, storage,
 * WebRTC peers) to simulate different users collaborating in real-time.
 *
 * Prerequisites: Vite dev server + signaling server must be running
 * (configured in playwright.config.ts webServer entries).
 */

import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
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
      expect(roomCode).toHaveLength(6);

      // Verify User A is connected
      expect(await isConnected(userA.page)).toBe(true);
      await closeRoomDialog(userA.page);

      // User B joins the room
      await joinRoom(userB.page, roomCode, "Bob");
      expect(await isConnected(userB.page)).toBe(true);
      await closeRoomDialog(userB.page);

      // Presence alone is insufficient: require a connected and synced data channel.
      await waitForNetworkSynced(userB.page);
      await waitForNetworkSynced(userA.page);

      // Verify in UI dialog
      await assertPeerCountInDialog(userA.page, 1);
      await closeRoomDialog(userA.page);

      const sidebar = userA.page.locator('[data-sidebar-side="left"]');
      await sidebar.getByRole("button", { name: "Debug", exact: true }).click();
      const syncMonitor = sidebar.locator('[data-debug-section="sync-state"]');
      await expect(syncMonitor.getByText("Sync State", { exact: true })).toBeVisible();
      await expect(syncMonitor.getByText("networkPeerCount", { exact: true })).toBeVisible();
      await syncMonitor.getByText("transport", { exact: true }).click();
      await expect(syncMonitor.getByText("signalingConnected", { exact: true })).toBeVisible();
      await expect(syncMonitor.getByText("webRtcPeerCount", { exact: true })).toBeVisible();
      await syncMonitor.getByText("yjs", { exact: true }).click();
      await expect(syncMonitor.getByText("recentUpdates", { exact: true })).toBeVisible();
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

      // B leaves by closing the browser context (this closes the WebSocket,
      // triggering the server's peer-left broadcast — y-webrtc's provider.destroy()
      // alone does not close the signaling WS connection)
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

      // A creates a full score and modifies the title
      // (connectProviders creates an empty Y.Doc, so we need to populate it)
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

      // A creates a full score (room starts with empty Y.Doc)
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
