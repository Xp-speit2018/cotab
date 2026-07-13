/**
 * Shared Playwright helpers for multi-user collaboration E2E tests.
 *
 * Each helper targets the RoomDialog UI elements and the Zustand stores
 * exposed on the window via page.evaluate().
 */

import { type Page, expect } from "@playwright/test";

// ─── Navigation ──────────────────────────────────────────────────────────────

/** Navigate to the app and wait for the score viewport to be visible. */
export async function waitForScoreLoaded(page: Page): Promise<void> {
  await page.goto("/");
  // AlphaTab renders into .at-main; wait for it to appear
  await page.waitForSelector(".at-main", { timeout: 30_000 });
}

// ─── Room Dialog ─────────────────────────────────────────────────────────────

/** Open the collaboration room dialog via the toolbar button. */
export async function openRoomDialog(page: Page): Promise<void> {
  // If dialog is already open, nothing to do
  const dialog = page.locator("[role='dialog']");
  if (await dialog.isVisible().catch(() => false)) return;

  // The Collaborate button contains the Users icon and text
  const collaborateBtn = page.locator("button", {
    has: page.locator("svg.lucide-users"),
  });
  await collaborateBtn.click();
  // Wait for the dialog to appear
  await page.waitForSelector("[role='dialog']", { timeout: 5_000 });
}

/** Create a room: open dialog -> fill name -> click Create -> wait for connected. Returns room code. */
export async function createRoom(
  page: Page,
  userName: string = "User A",
): Promise<string> {
  await openRoomDialog(page);

  // Fill display name
  const nameInput = page.locator("[role='dialog'] input").first();
  await nameInput.fill(userName);

  // Click "Create Room" button
  const createBtn = page.locator("[role='dialog'] button", {
    hasText: /create room/i,
  });
  await createBtn.click();

  // Wait for connected state — green dot appears
  await page.waitForSelector("[role='dialog'] .bg-green-500", {
    timeout: 15_000,
  });

  // Extract room code
  const code = await getRoomCode(page);
  return code;
}

/** Join a room: open dialog -> switch to Join tab -> fill name + code -> click Join -> wait for connected. */
export async function joinRoom(
  page: Page,
  roomCode: string,
  userName: string = "User B",
): Promise<void> {
  await openRoomDialog(page);

  // Switch to Join tab
  const joinTab = page.locator("[role='dialog'] button", {
    hasText: /^join$/i,
  });
  await joinTab.click();

  // Fill display name (first input)
  const inputs = page.locator("[role='dialog'] input");
  const nameInput = inputs.first();
  await nameInput.fill(userName);

  // Fill room code (second input)
  const codeInput = inputs.nth(1);
  await codeInput.fill(roomCode);

  // Click "Join Room" button
  const joinBtn = page.locator("[role='dialog'] button", {
    hasText: /join room/i,
  });
  await joinBtn.click();

  // Wait for connected state
  await page.waitForSelector("[role='dialog'] .bg-green-500", {
    timeout: 15_000,
  });
}

/** Extract the room code from the connected dialog. */
export async function getRoomCode(page: Page): Promise<string> {
  const codeEl = page.locator("[role='dialog'] code");
  const code = await codeEl.textContent();
  if (!code) throw new Error("Could not extract room code from dialog");
  return code.trim();
}

/** Close the room dialog through its explicit close control. */
export async function closeRoomDialog(page: Page): Promise<void> {
  const dialog = page.locator("[role='dialog']");
  if (!(await dialog.isVisible().catch(() => false))) return;
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 3_000 });
}

// ─── Peer Presence ───────────────────────────────────────────────────────────

/** Wait until the peer list in the store has exactly `count` peers. */
export async function waitForPeerCount(
  page: Page,
  count: number,
): Promise<void> {
  await page.waitForFunction(
    (expected) => {
      const store = (window as unknown as Record<string, unknown>).__COTAB_TAB_STORE__ as
        { getState: () => { peers: unknown[] } } | undefined;
      return store?.getState().peers?.length === expected;
    },
    count,
    { timeout: 15_000 },
  );
}

/** Wait for all discovered network peers to finish their initial Yjs sync. */
export async function waitForNetworkSynced(
  page: Page,
  peerCount: number = 1,
): Promise<void> {
  await page.waitForFunction(
    (expectedPeerCount) => {
      const store = (window as unknown as Record<string, unknown>).__COTAB_TAB_STORE__ as
        { getState: () => {
          peers: Array<{ kind: string; status: string }>;
          syncState: {
            phase: string;
            networkPeerCount: number;
            transport: {
              webRtcPeerCount: number;
              connectedPeerCount: number;
              syncedPeerCount: number;
            };
          };
        } } | undefined;
      const state = store?.getState();
      const networkPeers = state?.peers.filter((peer) => peer.kind === "human") ?? [];
      return state?.syncState.phase === "synced"
        && state.syncState.networkPeerCount === expectedPeerCount
        && state.syncState.transport.webRtcPeerCount >= expectedPeerCount
        && state.syncState.transport.connectedPeerCount >= expectedPeerCount
        && state.syncState.transport.syncedPeerCount >= expectedPeerCount
        && networkPeers.length === expectedPeerCount
        && networkPeers.every((peer) => peer.status === "synced");
    },
    peerCount,
    { timeout: 20_000 },
  );
}

/**
 * Verify peer count is displayed in the dialog UI.
 * Opens dialog if needed, checks the peer list <li> count.
 */
export async function assertPeerCountInDialog(
  page: Page,
  count: number,
): Promise<void> {
  await openRoomDialog(page);
  const dialog = page.locator("[role='dialog']");

  if (count === 0) {
    await expect(dialog.locator("text=/no other peers/i")).toBeVisible({
      timeout: 15_000,
    });
  } else {
    await expect(dialog.locator("ul > li")).toHaveCount(count, {
      timeout: 15_000,
    });
  }
}

// ─── Store Interactions ──────────────────────────────────────────────────────

/**
 * Get the score title from the TabStore.
 */
export async function getScoreTitle(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const storeModule = (window as unknown as Record<string, unknown>).__COTAB_STORE__;
    const scoreMap = (storeModule as { engine?: { getScoreMap: () => { get: (key: string) => unknown } | null } })
      ?.engine?.getScoreMap();
    const title = scoreMap?.get("title");
    return typeof title === "string" ? title : null;
  });
}

/**
 * Set the score title via the Y.Doc (triggers CRDT sync).
 */
export async function setScoreTitle(
  page: Page,
  title: string,
): Promise<void> {
  await page.evaluate((newTitle) => {
    const storeModule = (window as unknown as Record<string, unknown>).__COTAB_STORE__;
    if (!storeModule) throw new Error("Engine module not exposed");
    const engine = (storeModule as {
      engine: {
        localEditYDoc: (fn: () => void) => void;
        getScoreMap: () => { set: (key: string, val: unknown) => void } | null;
      };
    }).engine;
    const scoreMap = engine.getScoreMap();
    if (!scoreMap) throw new Error("No scoreMap");
    engine.localEditYDoc(() => {
      scoreMap.set("title", newTitle);
    });
  }, title);
}

/**
 * Get the number of bars in the first track's first staff.
 */
export async function getBarCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const module = (window as unknown as Record<string, unknown>).__COTAB_STORE__ as {
      engine?: { getScoreMap: () => import("yjs").Map<unknown> | null };
    } | undefined;
    const scoreMap = module?.engine?.getScoreMap();
    const tracks = scoreMap?.get("tracks") as import("yjs").Array<import("yjs").Map<unknown>> | undefined;
    const track = tracks?.get(0);
    const staves = track?.get("staves") as import("yjs").Array<import("yjs").Map<unknown>> | undefined;
    const staff = staves?.get(0);
    const bars = staff?.get("bars") as import("yjs").Array<unknown> | undefined;
    return bars?.length ?? 0;
  });
}

/**
 * Ensure the Y.Doc has a full score with at least one track/staff/bar.
 * If the score is empty (e.g., after connecting to a room), creates a default one.
 */
export async function ensureScoreExists(page: Page): Promise<void> {
  await page.evaluate(() => {
    const storeModule = (window as unknown as Record<string, unknown>).__COTAB_STORE__;
    const core = storeModule as {
      engine: {
        getScoreMap: () => import("yjs").Map<unknown> | null;
        localEditYDoc: (callback: () => void) => void;
      };
      EditorEngine: {
        createNewScore: (scoreMap: import("yjs").Map<unknown>) => void;
      };
    };

    const scoreMap = core.engine.getScoreMap();
    if (!scoreMap) throw new Error("No scoreMap");

    const tracks = scoreMap.get("tracks") as import("yjs").Array<unknown> | undefined;
    if (!tracks || tracks.length === 0) {
      core.engine.localEditYDoc(() => core.EditorEngine.createNewScore(scoreMap));
    }
  });
}

/**
 * Add a bar via Y.Doc transaction (insert bar after the last one).
 * Ensures a score exists first.
 */
export async function addBar(page: Page): Promise<void> {
  await ensureScoreExists(page);
  await page.evaluate(() => {
    const storeModule = (window as unknown as Record<string, unknown>).__COTAB_STORE__;
    const schema = (window as unknown as Record<string, unknown>).__COTAB_SCHEMA__;

    const core = storeModule as {
      engine: {
        getScoreMap: () => import("yjs").Map<unknown> | null;
        localEditYDoc: (callback: () => void) => void;
      };
      EditorEngine: {
        pushDefaultBar: (bars: import("yjs").Array<import("yjs").Map<unknown>>) => void;
      };
    };

    const scoreMap = core.engine.getScoreMap();
    if (!scoreMap) throw new Error("No scoreMap");

    core.engine.localEditYDoc(() => {
      const tracks = scoreMap.get("tracks") as import("yjs").Array<import("yjs").Map<unknown>>;
      const track = tracks.get(0);
      const staves = track.get("staves") as import("yjs").Array<import("yjs").Map<unknown>>;
      const staff = staves.get(0);
      const bars = staff.get("bars") as import("yjs").Array<import("yjs").Map<unknown>>;
      core.EditorEngine.pushDefaultBar(bars);

      const masterBars = scoreMap.get("masterBars") as import("yjs").Array<import("yjs").Map<unknown>>;
      masterBars.push([(schema as { createMasterBar: () => import("yjs").Map<unknown> }).createMasterBar()]);
    });
  });
}

// ─── Connection State ────────────────────────────────────────────────────────

/** Check if the page's TabStore says it's connected. */
export async function isConnected(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, unknown>).__COTAB_TAB_STORE__;
    if (!store) return false;
    const state = (store as { getState: () => Record<string, unknown> }).getState();
    return state.connected as boolean;
  });
}

/** Disconnect from the room via the UI. */
export async function disconnect(page: Page): Promise<void> {
  await openRoomDialog(page);

  const disconnectBtn = page.locator("[role='dialog'] button", {
    hasText: /disconnect/i,
  });
  await disconnectBtn.click();

  // Wait for store to reflect disconnected state
  await page.waitForFunction(
    () => {
      const store = (window as unknown as Record<string, unknown>).__COTAB_TAB_STORE__ as
        { getState: () => { connected: boolean } } | undefined;
      return store?.getState().connected === false;
    },
    undefined,
    { timeout: 5_000 },
  );
}

// ─── Sync Helpers ────────────────────────────────────────────────────────────

/** Wait for a specific score title to appear in the store. */
export async function waitForScoreTitle(
  page: Page,
  expectedTitle: string,
  timeout: number = 15_000,
): Promise<void> {
  await page.waitForFunction(
    (title) => {
      const storeModule = (window as unknown as Record<string, unknown>).__COTAB_STORE__;
      const scoreMap = (storeModule as { engine?: { getScoreMap: () => { get: (key: string) => unknown } | null } })
        ?.engine?.getScoreMap();
      return scoreMap?.get("title") === title;
    },
    expectedTitle,
    { timeout },
  );
}

/** Wait for a specific bar count in the first track's first staff. */
export async function waitForBarCount(
  page: Page,
  expectedCount: number,
  timeout: number = 15_000,
): Promise<void> {
  await page.waitForFunction(
    (count) => {
      const store = (window as unknown as Record<string, unknown>).__COTAB_TAB_STORE__ as
        { getState: () => unknown } | undefined;
      const core = (window as unknown as Record<string, unknown>).__COTAB_STORE__ as {
        engine?: { getScoreMap: () => import("yjs").Map<unknown> | null };
      } | undefined;
      if (!store) return false;
      const scoreMap = core?.engine?.getScoreMap();
      const tracks = scoreMap?.get("tracks") as import("yjs").Array<import("yjs").Map<unknown>> | undefined;
      const staves = tracks?.get(0)?.get("staves") as import("yjs").Array<import("yjs").Map<unknown>> | undefined;
      const bars = staves?.get(0)?.get("bars") as import("yjs").Array<unknown> | undefined;
      return bars?.length === count;
    },
    expectedCount,
    { timeout },
  );
}
