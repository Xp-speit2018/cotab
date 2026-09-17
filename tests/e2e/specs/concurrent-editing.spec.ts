import { expect, test, type Page } from "@playwright/test";
import {
  closeRoomDialog, createRoom, joinRoom, openRoomDialog, waitForNetworkSynced, waitForScoreLoaded,
} from "../helpers/coop";

// Hold inbound frames so both users edit the same observed state. Real Worker
// sockets and the production adapter still handle delivery and reconciliation.
async function holdableConnection(page: Page) {
  const gate = { paused: false, queued: [] as Array<() => void> };
  await page.routeWebSocket("**/api/rooms/*/sync", (client) => {
    const server = client.connectToServer();
    server.onMessage((message) => {
      const deliver = () => client.send(message);
      if (gate.paused) gate.queued.push(deliver);
      else deliver();
    });
  });
  return {
    pause() { gate.paused = true; },
    resume() {
      gate.paused = false;
      for (const deliver of gate.queued.splice(0)) deliver();
    },
  };
}

type EditRequest = { id: string; args?: unknown; note?: boolean };
const runners = new WeakMap<Page, Awaited<ReturnType<typeof createActionRunner>>>();

async function createActionRunner(page: Page) {
  return page.evaluateHandle(async () => {
    const { engine } = await import("/src/core/engine.ts");
    const { executeAppAction } = await import("/src/app-actions/registry.ts");
    const { default: i18n } = await import("/src/i18n/index.ts");
    return (operation: EditRequest) => {
      if (operation.note) {
        const tracks = engine.getScoreMap()!.toJSON().tracks;
        search: for (const [trackIndex, track] of tracks.entries()) {
          for (const [staffIndex, staff] of track.staves.entries()) {
            for (const [barIndex, bar] of staff.bars.entries()) {
              for (const [voiceIndex, voice] of bar.voices.entries()) {
                for (const [beatIndex, beat] of voice.beats.entries()) {
                  const noteIndex = beat.notes.findIndex((note: { fret: number; string: number }) => note.fret >= 0 && note.string > 0);
                  if (noteIndex < 0) continue;
                  engine.localSetSelection({ trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string: beat.notes[noteIndex].string }, noteIndex);
                  break search;
                }
              }
            }
          }
        }
      } else {
        engine.localSetSelection({ trackIndex: 0, staffIndex: 0, voiceIndex: 0, barIndex: 0, beatIndex: 0, string: 1 });
      }
      executeAppAction(operation.id, operation.args ?? {}, { t: i18n.t.bind(i18n) });
    };
  });
}

async function edit(page: Page, operation: EditRequest) {
  await runners.get(page)!.evaluate((run, operation) => run(operation), operation);
}

async function editMetadata(page: Page, label: string, value: string) {
  await page.locator('[data-sidebar-side="right"]').getByRole("button", { name: label, exact: true }).click();
  const input = page.getByRole("textbox", { name: label, exact: true });
  await input.fill(value);
  await input.press("Enter");
}

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    const { usePlayerStore } = await import("/src/stores/render-store.ts");
    const { getRendererDiagnostics } = await import("/src/stores/renderer-bridge.ts");
    const data = engine.getScoreMap()!.toJSON();
    const api = (window as unknown as { __ALPHATAB_API__: {
      score: { title: string; artist: string; masterBars: unknown[];
        tracks: Array<{ staves: Array<{ bars: any[] }> }> };
    } }).__ALPHATAB_API__;
    const firstNote = (tracks: any[]) => {
      for (const track of tracks) for (const staff of track.staves) {
        for (const bar of staff.bars) for (const voice of bar.voices) {
          for (const beat of voice.beats) for (const note of beat.notes) {
            if (note.fret >= 0 && note.string > 0) return { fret: note.fret, isGhost: note.isGhost ?? false };
          }
        }
      }
      throw new Error("Demo has no tablature note");
    };
    return {
      data,
      note: firstNote(data.tracks),
      rendered: {
        note: firstNote(api.score.tracks),
        title: api.score.title, artist: api.score.artist,
        bars: api.score.masterBars.length,
        staffBars: api.score.tracks.flatMap((track) => track.staves.map((staff) => staff.bars.length)),
      },
      rendering: usePlayerStore.getState().isRendering,
      settled: getRendererDiagnostics().requestedRevision === getRendererDiagnostics().lastSuccessfulRevision,
    };
  });
}

for (const scenario of ["independent fields", "same field", "bar insertion", "note fields"] as const) {
  test(`concurrent ${scenario} converge in both documents and renderers`, async ({ browser }) => {
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    const pages = await Promise.all(contexts.map((context) => context.newPage()));
    const [a, b] = pages;
    const errors: string[] = [];
    for (const page of pages) page.on("pageerror", (error) => errors.push(error.message));
    const gates = await Promise.all(pages.map(holdableConnection));
    try {
      await Promise.all(pages.map(waitForScoreLoaded));
      await expect.poll(async () => (await snapshot(a)).data.masterBars?.length).toBe(58);
      const originalScore = (await snapshot(a)).data;
      const invitation = await createRoom(a, "Alice");
      await closeRoomDialog(a);
      await joinRoom(b, invitation, "Bob");
      await closeRoomDialog(b);
      await Promise.all(pages.map((page) => waitForNetworkSynced(page)));
      await expect.poll(async () => {
        const [left, right] = await Promise.all(pages.map(snapshot));
        return left.data.masterBars.length > 0 && JSON.stringify(left.data) === JSON.stringify(right.data)
          && left.settled && right.settled && !left.rendering && !right.rendering;
      }).toBe(true);
      const initial = await snapshot(a);
      expect(initial.data).toEqual(originalScore);
      for (const page of pages) runners.set(page, await createActionRunner(page));
      gates.forEach((gate) => gate.pause());
      if (scenario === "note fields") {
        await edit(a, { id: "document.note.setFret", args: { value: initial.note.fret + 1 }, note: true });
        await edit(b, { id: "document.note.setIsGhost", args: { value: !initial.note.isGhost }, note: true });
      } else if (scenario === "bar insertion") {
        for (const page of pages) await edit(page, { id: "document.bar.insertAfter" });
      } else {
        await editMetadata(a, "Title", "Alice concurrent title");
        await editMetadata(b, scenario === "same field" ? "Title" : "Artist", "Bob concurrent edit");
      }
      // Verify the frames were actually withheld, not merely two serial edits.
      const local = await Promise.all(pages.map(snapshot));
      if (scenario === "note fields") {
        expect(local[0].note.fret).toBe(initial.note.fret + 1);
        expect(local[1].note.fret).toBe(initial.note.fret);
        expect(local[1].note.isGhost).toBe(!initial.note.isGhost);
        expect(local[0].note.isGhost).toBe(initial.note.isGhost);
      } else if (scenario === "bar insertion") {
        for (const state of local) expect(state.data.masterBars).toHaveLength(initial.data.masterBars.length + 1);
      } else {
        expect(local[0].data.title).toBe("Alice concurrent title");
        expect(local[1].data.title).toBe(scenario === "same field" ? "Bob concurrent edit" : initial.data.title);
      }
      gates.forEach((gate) => gate.resume());
      await expect.poll(async () => {
        const [left, right] = await Promise.all(pages.map(snapshot));
        return JSON.stringify(left.data) === JSON.stringify(right.data)
          && JSON.stringify(left.rendered) === JSON.stringify(right.rendered)
          && left.rendered.title === left.data.title && left.rendered.artist === left.data.artist
          && left.rendered.bars === left.data.masterBars.length
          && left.settled && right.settled && !left.rendering && !right.rendering;
      }, { timeout: 15_000 }).toBe(true);
      const final = await snapshot(a);
      if (scenario === "note fields") {
        expect(final.note).toEqual({ fret: initial.note.fret + 1, isGhost: !initial.note.isGhost });
        expect(final.rendered.note).toEqual(final.note);
      } else if (scenario === "bar insertion") {
        const count = initial.data.masterBars.length + 2;
        expect(final.data.masterBars).toHaveLength(count);
        expect(final.rendered.bars).toBe(count);
        expect(final.rendered.staffBars.every((bars) => bars === count)).toBe(true);
        for (const track of final.data.tracks) {
          for (const staff of track.staves) expect(staff.bars).toHaveLength(count);
        }
      } else if (scenario === "independent fields") {
        expect(final.rendered).toMatchObject({ title: "Alice concurrent title", artist: "Bob concurrent edit" });
      } else {
        expect(["Alice concurrent title", "Bob concurrent edit"]).toContain(final.rendered.title);
      }
      expect(errors).toEqual([]);
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
}

async function localView(page: Page) {
  return page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    const { usePlayerStore } = await import("/src/stores/render-store.ts");
    const state = usePlayerStore.getState();
    const viewport = document.querySelector<HTMLElement>(".at-viewport")!;
    return {
      beatUuid: engine.selector.beatUuid,
      selection: state.selectedBeat,
      zoom: state.zoom,
      layout: state.scoreLayout,
      scrollTop: viewport.scrollTop,
      scrollLeft: viewport.scrollLeft,
    };
  });
}

for (const layout of ["horizontal", "parchment"] as const) {
  test(`remote edits preserve the local draft, focus, selection and ${layout} view`, async ({ browser }) => {
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    const [a, b] = await Promise.all(contexts.map((context) => context.newPage()));
    const errors: string[] = [];
    for (const page of [a, b]) page.on("pageerror", (error) => errors.push(error.message));
    try {
      await Promise.all([a, b].map(waitForScoreLoaded));
      await expect.poll(async () => (await snapshot(a)).data.masterBars?.length).toBe(58);
      const originalScore = (await snapshot(a)).data;
      const invitation = await createRoom(a, "Alice");
      await closeRoomDialog(a);
      await joinRoom(b, invitation, "Bob");
      await closeRoomDialog(b);
      await Promise.all([a, b].map((page) => waitForNetworkSynced(page)));
      await expect.poll(async () => (await snapshot(b)).data).toEqual(originalScore);
      for (const [page, peer] of [[a, "Bob"], [b, "Alice"]] as const) {
        await openRoomDialog(page);
        await expect(page.getByRole("dialog").locator("li")).toHaveText([peer]);
        await closeRoomDialog(page);
      }
      await b.evaluate(async (layout) => {
        const { usePlayerStore, waitForActiveRenderer } = await import("/src/stores/render-store.ts");
        usePlayerStore.getState().setScoreLayout(layout);
        await waitForActiveRenderer();
        usePlayerStore.getState().setZoom(0.9);
        await waitForActiveRenderer();
        usePlayerStore.getState().setSelection({ trackIndex: 0, staffIndex: 0, voiceIndex: 0, barIndex: 8, beatIndex: 0 });
        await waitForActiveRenderer();
        const api = (window as unknown as { __ALPHATAB_API__: import("@coderline/alphatab").AlphaTabApi }).__ALPHATAB_API__;
        api.uiFacade.stopScrolling(api.uiFacade.getScrollContainer());
        // Let the initial selection-focus animation finish before manually
        // positioning the reader's viewport for the remote-update assertion.
        await new Promise<void>((resolve) => {
          let last = "";
          let stableSince = performance.now();
          const check = (now: number) => {
            const element = document.querySelector<HTMLElement>(".at-viewport")!;
            const position = `${element.scrollLeft}:${element.scrollTop}`;
            if (position !== last) { last = position; stableSince = now; }
            if (now - stableSince >= 200) resolve();
            else requestAnimationFrame(check);
          };
          requestAnimationFrame(check);
        });
        const viewport = document.querySelector<HTMLElement>(".at-viewport")!;
        viewport.scrollLeft = layout === "horizontal" ? 300 : 0;
        viewport.scrollTop = layout === "parchment" ? 300 : 0;
      }, layout);
      const titleButton = b.locator('[data-sidebar-side="right"]').getByRole("button", { name: "Title", exact: true });
      await titleButton.click();
      const draft = b.getByRole("textbox", { name: "Title", exact: true });
      await draft.fill("Bob unfinished draft");
      const before = await localView(b);
      expect(before.beatUuid).toBeTruthy();
      expect(layout === "horizontal" ? before.scrollLeft : before.scrollTop).toBeGreaterThan(0);
      await editMetadata(a, "Title", "Alice remote title");
      await expect.poll(async () => {
        const state = await snapshot(b);
        return state.rendered.title === "Alice remote title" && state.settled;
      }).toBe(true);
      await expect(draft).toHaveValue("Bob unfinished draft");
      await expect(draft).toBeFocused();
      expect(await localView(b)).toEqual(before);
      await draft.press("Enter");
      await expect(titleButton).toContainText("Bob unfinished draft");
      for (const page of [a, b]) {
        await expect.poll(async () => {
          const state = await snapshot(page);
          return state.data.title === "Bob unfinished draft" && state.rendered.title === state.data.title && state.settled;
        }).toBe(true);
      }
      expect(errors).toEqual([]);
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
}
