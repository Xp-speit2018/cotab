import { expect, test, type Page } from "@playwright/test";
import {
  closeRoomDialog,
  createRoom,
  ensureScoreExists,
  getScoreTitle,
  joinRoom,
  waitForNetworkSynced,
  waitForScoreLoaded,
} from "../helpers/coop";

type HistoryWindow = Window & {
  __COTAB_STORE__: { engine: {
    getScoreMap(): { get(key: string): unknown };
    getUndoManager(): { clear(): void; stopCapturing(): void };
  } };
  __ALPHATAB_API__?: { score?: { title: string; artist: string } };
  __PLAYER_STORE__?: { getState(): { isRendering: boolean } };
};

async function action(page: Page, id: string, value?: string) {
  await page.evaluate(async ({ id, value }) => {
    const { executeAppAction } = await import("/src/app-actions/registry.ts");
    const { default: i18n } = await import("/src/i18n/index.ts");
    const manager = (window as unknown as HistoryWindow).__COTAB_STORE__.engine.getUndoManager();
    manager.stopCapturing();
    executeAppAction(id, value === undefined ? {} : { value }, { t: i18n.t.bind(i18n) });
    manager.stopCapturing();
  }, { id, value });
}

async function expectScore(page: Page, title: string, artist: string) {
  await expect.poll(() => page.evaluate(() => {
    const runtime = window as unknown as HistoryWindow;
    const score = runtime.__COTAB_STORE__.engine.getScoreMap();
    return {
      title: score.get("title"),
      artist: score.get("artist"),
      renderedTitle: runtime.__ALPHATAB_API__?.score?.title,
      renderedArtist: runtime.__ALPHATAB_API__?.score?.artist,
      rendering: runtime.__PLAYER_STORE__?.getState().isRendering,
    };
  }), { timeout: 15_000 }).toEqual({
    title, artist, renderedTitle: title, renderedArtist: artist, rendering: false,
  });
}

test("local undo/redo preserves peer edits in Y.Doc and the settled renderer", async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const [a, b] = await Promise.all(contexts.map((context) => context.newPage()));
  const errors: string[] = [];
  for (const page of [a, b]) page.on("pageerror", (error) => errors.push(error.message));
  try {
    await Promise.all([waitForScoreLoaded(a), waitForScoreLoaded(b)]);
    const room = await createRoom(a, "Alice");
    await closeRoomDialog(a);
    await ensureScoreExists(a);
    await joinRoom(b, room, "Bob");
    await closeRoomDialog(b);
    await Promise.all([waitForNetworkSynced(a), waitForNetworkSynced(b)]);
    const initialTitle = await getScoreTitle(a);
    await action(b, "document.score.setArtist", "Shared baseline");
    await Promise.all([a, b].map((page) => expectScore(page, initialTitle, "Shared baseline")));
    for (const page of [a, b]) {
      await page.evaluate(() => (window as unknown as HistoryWindow).__COTAB_STORE__.engine.getUndoManager().clear());
    }

    await action(a, "document.score.setTitle", "Alice title");
    await Promise.all([a, b].map((page) => expectScore(page, "Alice title", "Shared baseline")));
    await action(b, "document.score.setArtist", "Bob artist");
    await Promise.all([a, b].map((page) => expectScore(page, "Alice title", "Bob artist")));
    await action(a, "document.undo");
    await Promise.all([a, b].map((page) => expectScore(page, initialTitle, "Bob artist")));
    await action(a, "document.redo");
    await Promise.all([a, b].map((page) => expectScore(page, "Alice title", "Bob artist")));

    await action(b, "document.score.setTitle", "Bob replacement");
    await Promise.all([a, b].map((page) => expectScore(page, "Bob replacement", "Bob artist")));
    await action(a, "document.undo");
    await Promise.all([a, b].map((page) => expectScore(page, initialTitle, "Bob artist")));
    await action(a, "document.redo");
    await Promise.all([a, b].map((page) => expectScore(page, "Bob replacement", "Bob artist")));
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
