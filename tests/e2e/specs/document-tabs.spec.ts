import { expect, test } from "@playwright/test";

async function waitForDemoScore(page) {
  await page.waitForFunction(async () => {
    const { getRendererDiagnostics } = await import(
      "/src/stores/renderer-bridge.ts"
    );
    const { engine } = await import("/src/core/engine.ts");
    const diagnostics = getRendererDiagnostics();
    return window.__ALPHATAB_API__?.score?.title === "Taijin Kyofusho"
      && engine.getScoreMap()?.get("title") === "Taijin Kyofusho"
      && !diagnostics.rendererBusy
      && !diagnostics.rebuildPending
      && !diagnostics.sourceLoadPending;
  });
}

async function openDemoFromEmptyWorkspace(page) {
  await page.getByTestId("empty-workspace")
    .getByRole("button", { name: "Open file" })
    .click();
  await page.getByRole("button", { name: /Examples/ }).click();
  await page.getByRole("button", { name: /Taijin Kyofusho/ }).click();
  await waitForDemoScore(page);
}

async function openAnotherDemo(page) {
  await page.getByTestId("file-menu").click();
  await page.getByRole("menuitem", { name: "Open file" }).click();
  await page.getByRole("button", { name: /Examples/ }).click();
  await page.getByRole("button", { name: /Taijin Kyofusho/ }).click();
  await waitForDemoScore(page);
}

test("document tabs isolate Y.Doc state and restore the selected document", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("empty-workspace")).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
  expect(await page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    return engine.getDoc() === null;
  })).toBe(true);
  await openDemoFromEmptyWorkspace(page);

  const firstDocumentId = await page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    engine.getDoc()?.getMap("score").set("title", "First document");
    return engine.getDocumentId();
  });
  await expect.poll(() => page.evaluate(() => window.__ALPHATAB_API__?.score?.title))
    .toBe("First document");
  await page.evaluate(() => {
    window.__PLAYER_STORE__.getState().setZoom(0.9);
  });
  await page.waitForTimeout(400);
  const firstTickPosition = await page.evaluate(() => {
    window.__PLAYER_STORE__.getState().setTransportPlayhead({
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      barIndex: 3,
      beatIndex: 0,
    });
    return window.__PLAYER_STORE__.getState().transport.tickPosition;
  });
  expect(firstTickPosition).toBeGreaterThan(0);
  await page.evaluate(() => {
    const viewport = document.querySelector(".at-viewport");
    viewport.scrollTop = 420;
  });
  const firstScrollTop = await page.evaluate(() =>
    document.querySelector(".at-viewport").scrollTop
  );
  expect(firstScrollTop).toBeGreaterThan(0);

  await openAnotherDemo(page);

  await expect(page.getByRole("tab")).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => window.__ALPHATAB_API__?.score?.title))
    .toBe("Taijin Kyofusho");
  const secondDocumentId = await page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    return engine.getDocumentId();
  });
  expect(secondDocumentId).not.toBe(firstDocumentId);
  expect(await page.evaluate(() => window.__PLAYER_STORE__.getState().zoom))
    .toBe(1);
  const secondTransport = await page.evaluate(() => ({
    playhead: window.__PLAYER_STORE__.getState().transport.playhead,
    tickPosition: window.__PLAYER_STORE__.getState().transport.tickPosition,
  }));
  expect(secondTransport.playhead).toBeNull();
  expect(secondTransport.tickPosition).toBeLessThan(firstTickPosition);

  await page.getByRole("tab", { name: /First document/ })
    .getByRole("button")
    .first()
    .click();
  await expect.poll(() => page.evaluate(() => window.__ALPHATAB_API__?.score?.title))
    .toBe("First document");
  await expect.poll(() => page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    return engine.getDocumentId();
  })).toBe(firstDocumentId);
  await expect.poll(() => page.evaluate(() => ({
    zoom: window.__PLAYER_STORE__.getState().zoom,
    scrollTop: document.querySelector(".at-viewport").scrollTop,
  }))).toEqual({ zoom: 0.9, scrollTop: firstScrollTop });
  await expect.poll(() => page.evaluate(() => ({
    barIndex: window.__PLAYER_STORE__.getState().transport.playhead?.barIndex,
  }))).toMatchObject({ barIndex: 3 });
  const restoredTransport = await page.evaluate(() => ({
    tickPosition: window.__PLAYER_STORE__.getState().transport.tickPosition,
  }));
  expect(Math.abs(restoredTransport.tickPosition - firstTickPosition))
    .toBeLessThanOrEqual(1);
});

test("closing a dirty document requires confirmation and activates its neighbor", async ({
  page,
}) => {
  await page.goto("/");
  await openDemoFromEmptyWorkspace(page);
  await page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    engine.getDoc()?.getMap("score").set("title", "Dirty document");
  });

  await openAnotherDemo(page);
  await expect(page.getByRole("tab")).toHaveCount(2);

  const dirtyTab = page.getByRole("tab", { name: /Dirty document/ });
  await dirtyTab.hover();
  page.once("dialog", (dialog) => void dialog.accept());
  await dirtyTab.getByRole("button", { name: /Close Dirty document/ }).click();

  await expect(page.getByRole("tab")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.__ALPHATAB_API__?.score?.title))
    .toBe("Taijin Kyofusho");

  const remainingTab = page.getByRole("tab", { name: /Taijin Kyofusho/ });
  await remainingTab.getByRole("button", { name: /Close Taijin Kyofusho/ }).click();
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.getByTestId("empty-workspace")).toBeVisible();
  expect(await page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    return engine.getDoc() === null;
  })).toBe(true);

  await openDemoFromEmptyWorkspace(page);
  await expect(page.getByRole("tab")).toHaveCount(1);
  expect(await page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    return engine.getDoc() !== null;
  })).toBe(true);
});

test("document tabs share the score column and new-tab creates an unbound blank file", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?demo=taijin-kyofusho");
  await waitForDemoScore(page);

  const readBounds = () => page.evaluate(() => {
    const tabBar = document.querySelector('[data-testid="document-tab-bar"]')
      .getBoundingClientRect();
    const score = document.querySelector("[data-score-viewport]")
      .getBoundingClientRect();
    return {
      tabLeft: tabBar.left,
      tabRight: tabBar.right,
      tabWidth: tabBar.width,
      scoreLeft: score.left,
      scoreRight: score.right,
    };
  });

  await page.evaluate(async () => {
    const { useSidebarLayoutStore } = await import(
      "/src/components/NoteEditorSidebar/sidebar-store.ts"
    );
    useSidebarLayoutStore.getState().setCollapsed("left", false);
    useSidebarLayoutStore.getState().setWidth("left", 360);
  });
  const expanded = await readBounds();
  expect(expanded.tabLeft).toBe(expanded.scoreLeft);
  expect(expanded.tabRight).toBe(expanded.scoreRight);

  await page.evaluate(async () => {
    const { useSidebarLayoutStore } = await import(
      "/src/components/NoteEditorSidebar/sidebar-store.ts"
    );
    useSidebarLayoutStore.getState().setCollapsed("left", true);
  });
  await expect.poll(async () => (await readBounds()).tabWidth)
    .toBeGreaterThan(expanded.tabWidth);
  const collapsed = await readBounds();
  expect(collapsed.tabLeft).toBe(collapsed.scoreLeft);
  expect(collapsed.tabRight).toBe(collapsed.scoreRight);

  await page.getByRole("button", { name: "New blank file" }).click();
  await expect(page.getByRole("heading", { name: "Open from" })).toHaveCount(0);
  await expect(page.getByRole("tab")).toHaveCount(2);
  await expect.poll(() => page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    return {
      title: engine.getScoreMap()?.get("title"),
      binding: engine.storage.binding,
    };
  })).toEqual({ title: "Untitled", binding: null });
  await expect(page.getByText("Loading score...")).toHaveCount(0);
  await expect(page.getByText("Loading 0%")).toHaveCount(0);
  await expect(page.getByText("No tracks")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add track" })).toBeVisible();
  await expect(page.getByTestId("empty-score-header")).toHaveText("Untitled");
  await page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    engine.localEditYDoc(() => {
      engine.getScoreMap()?.set("title", "Empty composition");
    });
  });
  await expect(page.getByTestId("empty-score-header"))
    .toHaveText("Empty composition");
  await expect.poll(() => page.evaluate(async () => {
    const { getRendererDiagnostics } = await import(
      "/src/stores/renderer-bridge.ts"
    );
    const diagnostics = getRendererDiagnostics();
    return {
      outcome: diagnostics.lastOutcome?.status,
      renderedTracks: diagnostics.lastOutcome?.score?.trackCount,
      rendererCleared:
        getComputedStyle(document.querySelector(".at-main")).display === "none",
      editorTracks: window.__PLAYER_STORE__.getState().tracks.length,
    };
  })).toEqual({
    outcome: "succeeded",
    renderedTracks: 0,
    rendererCleared: true,
    editorTracks: 0,
  });

  await page.getByRole("button", { name: "Add track" }).click();
  await page.getByRole("menuitem", { name: /Acoustic Guitar/ }).click();
  await expect.poll(() => page.evaluate(() => ({
    alphaTabTracks: window.__ALPHATAB_API__?.score?.tracks.length,
    editorTracks: window.__PLAYER_STORE__.getState().tracks.length,
  }))).toEqual({ alphaTabTracks: 1, editorTracks: 1 });
  await expect(page.getByText("Loading score...")).toHaveCount(0);

  await page.getByRole("button", { name: "Toggle Acoustic Guitar details" })
    .click();
  await page.getByRole("button", { name: "Delete track", exact: true }).click();
  const deleteDialog = page.getByRole("dialog", {
    name: 'Delete "Acoustic Guitar"?',
  });
  await deleteDialog.getByRole("textbox", {
    name: "Track name confirmation",
  }).fill("Acoustic Guitar");
  await deleteDialog.getByRole("button", {
    name: "Delete track",
    exact: true,
  }).click();

  await expect.poll(() => page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    return {
      documentTracks: engine.getScoreMap()?.get("tracks")?.length,
      editorTracks: window.__PLAYER_STORE__.getState().tracks.length,
      rendererCleared:
        getComputedStyle(document.querySelector(".at-main")).display === "none",
    };
  })).toEqual({
    documentTracks: 0,
    editorTracks: 0,
    rendererCleared: true,
  });
  await expect(page.getByTestId("empty-score-header"))
    .toHaveText("Empty composition");
  await expect(page.getByText("No tracks")).toBeVisible();
});
