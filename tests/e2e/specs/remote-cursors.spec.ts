import { expect, test, type Page, type WebSocketRoute } from "@playwright/test";
import { closeRoomDialog, createRoom, joinRoom, disconnect, waitForNetworkSynced, waitForScoreLoaded } from "../helpers/coop";

async function select(page: Page, barIndex: number) {
  return page.evaluate(async (barIndex) => {
    const { usePlayerStore, waitForActiveRenderer } = await import("/src/stores/render-store.ts");
    const { engine } = await import("/src/core/engine.ts");
    await waitForActiveRenderer();
    usePlayerStore.getState().setSelection({ trackIndex: 0, staffIndex: 0, voiceIndex: 0, barIndex, beatIndex: 0, string: 1, renderedStave: "tablature" });
    return engine.selector.beatUuid;
  }, barIndex);
}
async function documentState(page: Page) {
  return page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    const { getRendererDiagnostics } = await import("/src/stores/renderer-bridge.ts");
    const { usePlayerStore } = await import("/src/stores/render-store.ts");
    const state = getRendererDiagnostics();
    return { bars: engine.getScoreMap()?.toJSON().masterBars?.length ?? 0, score: JSON.stringify(engine.getDoc()!.toJSON()), settled: state.requestedRevision === state.lastSuccessfulRevision && !usePlayerStore.getState().isRendering };
  });
}

for (const layout of ["horizontal", "parchment"] as const) {
  test(`remote cursors follow stable beats and clean up in ${layout}`, async ({ browser }) => {
    test.setTimeout(120_000);
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    const [a, b] = await Promise.all(contexts.map((context) => context.newPage()));
    let offline = false;
    const sockets: WebSocketRoute[] = [];
    await a.routeWebSocket("**/api/rooms/*/sync", (socket) => {
      if (offline) { void socket.close({ code: 4000 }); return; }
      sockets.push(socket, socket.connectToServer());
    });
    const errors: string[] = [];
    for (const page of [a, b]) page.on("pageerror", (error) => errors.push(error.message));
    try {
      await Promise.all([a, b].map(waitForScoreLoaded));
      await expect.poll(async () => {
        const state = await documentState(a);
        return state.settled && state.bars === 58;
      }).toBe(true);
      const invitation = await createRoom(a, "Alice <b>");
      await closeRoomDialog(a);
      await joinRoom(b, invitation, "Bob");
      await closeRoomDialog(b);
      await Promise.all([a, b].map((page) => waitForNetworkSynced(page)));
      await expect.poll(async () => {
        const [left, right] = await Promise.all([a, b].map(documentState));
        return left.settled && right.settled && left.score === right.score;
      }).toBe(true);
      await b.evaluate(async (layout) => {
        const { usePlayerStore, waitForActiveRenderer } = await import("/src/stores/render-store.ts");
        usePlayerStore.getState().setScoreLayout(layout);
        await waitForActiveRenderer();
      }, layout);
      const before = await documentState(a);
      const aliceBeat = await select(a, 2);
      const bobBeat = await select(b, 4);
      const onA = a.locator(".at-peer-cursor");
      const onB = b.locator(".at-peer-cursor");
      await expect(onA).toHaveCount(1);
      await expect(onB).toHaveCount(1);
      await expect(onA).toHaveText("Bob");
      await expect(onB).toHaveText("Alice <b>");
      await expect(onB.locator("b")).toHaveCount(0);
      await expect(onA).toHaveAttribute("data-beat-uuid", bobBeat!);
      await expect(onB).toHaveAttribute("data-beat-uuid", aliceBeat!);
      await expect(onB).toHaveCSS("pointer-events", "none");
      const title = b.locator('[data-sidebar-side="right"]').getByRole("button", { name: "Title", exact: true });
      await title.click();
      const input = b.getByRole("textbox", { name: "Title", exact: true });
      await input.focus();
      const viewBefore = await b.evaluate(async () => {
        const { engine } = await import("/src/core/engine.ts");
        const viewport = document.querySelector(".at-viewport")!;
        return { uuid: engine.selector.beatUuid, top: viewport.scrollTop, left: viewport.scrollLeft };
      });
      const firstLeft = await onB.evaluate((element) => element.style.left);
      const moved = await select(a, 3);
      await expect(onB).toHaveAttribute("data-beat-uuid", moved!);
      await expect.poll(() => onB.evaluate((element) => element.style.left)).not.toBe(firstLeft);
      await expect(input).toBeFocused();
      expect(await b.evaluate(async () => {
        const { engine } = await import("/src/core/engine.ts");
        const viewport = document.querySelector(".at-viewport")!;
        return { uuid: engine.selector.beatUuid, top: viewport.scrollTop, left: viewport.scrollLeft };
      })).toEqual(viewBefore);
      await input.press("Enter");
      expect((await documentState(a)).score).toBe(before.score);
      expect((await documentState(b)).score).toBe(before.score);

      await b.evaluate(async () => {
        const { usePlayerStore, waitForActiveRenderer } = await import("/src/stores/render-store.ts");
        usePlayerStore.getState().setZoom(0.8);
        await waitForActiveRenderer();
      });
      await expect(onB).toHaveAttribute("data-beat-uuid", moved!);
      // Validate actual fresh AlphaTab bounds, not just an unchanged DOM label.
      await expect.poll(() => b.evaluate(async () => {
        const { getApi } = await import("/src/stores/render-api.ts");
        const { getProjectedBeatUuid } = await import("/src/core/converters.ts");
        const { getSnapGridForBar, getRenderedStaveForBarBounds } = await import("/src/stores/snap-grid.ts");
        const cursor = document.querySelector<HTMLElement>(".at-peer-cursor")!;
        for (const system of getApi()!.boundsLookup.staffSystems) for (const master of system.bars) for (const bar of master.bars) {
          if (getRenderedStaveForBarBounds(bar) !== "tablature") continue;
          for (const bounds of bar.beats) if (getProjectedBeatUuid(bounds.beat) === cursor.dataset.beatUuid) {
            const model = bounds.beat.voice.bar;
            const grid = getSnapGridForBar(model.staff.track.index, model.staff.index, model.index, "tablature")!;
            const y = grid.positions.find((position) => position.string === 1)!.y;
            return Math.abs(parseFloat(cursor.style.left) - (bounds.onNotesX - grid.noteWidth / 2)) < 0.1
              && Math.abs(parseFloat(cursor.style.top) - (y - grid.noteHeight / 2)) < 0.1
              && Math.abs(parseFloat(cursor.style.width) - grid.noteWidth) < 0.1
              && Math.abs(parseFloat(cursor.style.height) - grid.noteHeight) < 0.1;
          }
        }
        return false;
      })).toBe(true);

      await b.getByRole("button", { name: "Hide Lead Guitar", exact: true }).click();
      await expect(onB).toHaveCount(0);
      await b.getByRole("button", { name: "Show Lead Guitar", exact: true }).click();
      await expect(onB).toHaveAttribute("data-beat-uuid", moved!);
      // Percussion uses signed snap positions on its standard stave.
      const drumBeat = await a.evaluate(async () => {
        const { engine } = await import("/src/core/engine.ts");
        const { usePlayerStore } = await import("/src/stores/render-store.ts");
        usePlayerStore.getState().setSelection({ trackIndex: 5, staffIndex: 0, voiceIndex: 0, barIndex: 0, beatIndex: 0, string: -3, renderedStave: "standard" });
        return engine.selector.beatUuid;
      });
      await expect(onB).toHaveAttribute("data-beat-uuid", drumBeat!);
      await select(a, 3);
      await expect(onB).toHaveAttribute("data-beat-uuid", moved!);

      // Another user inserts before the anchor. Its UUID, not old bar index,
      // must continue to identify Alice's cursor after both renderers settle.
      await select(b, 0);
      await b.evaluate(async () => {
        const { executeAppAction } = await import("/src/app-actions/registry.ts");
        const { default: i18n } = await import("/src/i18n/index.ts");
        await executeAppAction("document.bar.insertBefore", {}, { t: i18n.t.bind(i18n) });
      });
      await expect.poll(async () => {
        const [left, right] = await Promise.all([a, b].map(documentState));
        return left.settled && right.settled && left.score === right.score;
      }).toBe(true);
      await expect(onB).toHaveAttribute("data-beat-uuid", moved!);
      expect(await b.evaluate(async (uuid) => {
        const { engine } = await import("/src/core/engine.ts");
        return engine.resolveSelectionByUuid(uuid!)?.barIndex;
      }, moved)).toBe(4);

      await a.evaluate(async () => {
        const { engine } = await import("/src/core/engine.ts");
        engine.localClearSelection();
        const { usePlayerStore, waitForActiveRenderer } = await import("/src/stores/render-store.ts");
        usePlayerStore.getState().setZoom(0.9);
        await waitForActiveRenderer();
      });
      await expect(onB).toHaveCount(0);
      await select(a, 4);
      await expect(onB).toHaveCount(1);
      offline = true;
      await Promise.all(sockets.map((socket) => socket.close({ code: 4000 })));
      await expect(onB).toHaveCount(0, { timeout: 25_000 });
      offline = false;
      await waitForNetworkSynced(a);
      await expect(onB).toHaveAttribute("data-beat-uuid", moved!);
      // Delete the newly inserted empty bar while Alice is selecting it.
      await select(a, 0);
      await select(b, 0);
      await b.evaluate(async () => {
        const { executeAppAction } = await import("/src/app-actions/registry.ts");
        const { default: i18n } = await import("/src/i18n/index.ts");
        executeAppAction("document.bar.delete", {}, { t: i18n.t.bind(i18n) });
      });
      await expect(onB).toHaveCount(0);
      await expect.poll(() => a.evaluate(async () => {
        const { engine } = await import("/src/core/engine.ts");
        return engine.selector.beatUuid;
      })).toBeNull();
      await select(a, 2);
      await expect(onB).toHaveCount(1);
      await disconnect(a);
      await expect(onB).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
}
