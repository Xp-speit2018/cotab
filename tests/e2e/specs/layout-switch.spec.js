// @ts-check
import { expect, test } from "@playwright/test";

async function waitForScore(page) {
  await expect(
    page
      .locator("span.font-mono")
      .filter({ hasText: /\d{2}:\d{2}\s*\/\s*\d{2}:\d{2}/ }),
  ).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__ALPHATAB_API__?.boundsLookup?.staffSystems?.length ?? 0,
      ),
    )
    .toBeGreaterThan(0);
}

async function waitForLayout(page, layout, alphaTabLayoutMode) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        layout: window.__PLAYER_STORE__.getState().scoreLayout,
        alphaTabLayoutMode:
          window.__ALPHATAB_API__?.settings?.display?.layoutMode ?? null,
      })),
    )
    .toMatchObject({ layout, alphaTabLayoutMode });

  const renderedRowCount = () =>
    page.evaluate(() =>
      new Set(
        (window.__ALPHATAB_API__?.boundsLookup?.staffSystems ?? []).map(
          (system) => {
            const bounds = system.realBounds;
            return `${bounds.x}:${bounds.y}:${bounds.w}:${bounds.h}`;
          },
        ),
      ).size,
    );
  if (layout === "parchment") {
    await expect.poll(renderedRowCount).toBeGreaterThan(1);
  } else {
    await expect.poll(renderedRowCount).toBe(1);
  }
}

async function openLayoutMenu(page) {
  const trigger = page.getByTestId("layout-menu");
  if (await trigger.getAttribute("aria-expanded") !== "true") {
    await trigger.click();
  }
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
}

async function chooseLayout(page, name) {
  await openLayoutMenu(page);
  await page.getByRole("menuitemcheckbox", { name }).click();
}

test("uses parchment as the default score layout", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await waitForScore(page);
  await waitForLayout(page, "parchment", 2);
  await openLayoutMenu(page);
  await expect(page.getByRole("menuitemcheckbox", { name: "Edit score layout" }))
    .toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Layout settings" }))
    .toBeVisible();

  await page.getByRole("menuitemcheckbox", { name: "Horizontal layout" }).click();
  await waitForLayout(page, "horizontal", 1);
  await openLayoutMenu(page);
  await expect(page.getByRole("menuitemcheckbox", { name: "Edit score layout" }))
    .toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Layout settings" }))
    .toHaveCount(0);
});

async function waitForSystemRows(page, expectedRows) {
  await expect
    .poll(() =>
      page.evaluate((count) =>
        window.__PLAYER_STORE__.getState().systemLayoutRows
          .slice(0, count)
          .map((row) => [row.startBarIndex, row.endBarIndex]),
      expectedRows.length),
    )
    .toEqual(expectedRows);
}

async function selectBar(page, barIndex) {
  await page.evaluate((targetBarIndex) => {
    const beat = window.__ALPHATAB_API__.score.tracks[0].staves[0]
      .bars[targetBarIndex].voices[0].beats[0];
    window.__PLAYER_STORE__.getState().setSelection({
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      barIndex: targetBarIndex,
      beatIndex: 0,
      string: beat.notes[0]?.string ?? 1,
    });
  }, barIndex);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__PLAYER_STORE__.getState().selector.barIndex,
      ),
    )
    .toBe(barIndex);
}

async function openLayoutSettings(page) {
  await openLayoutMenu(page);
  await page.getByRole("menuitem", { name: "Layout settings" }).click();
  await expect(page.getByText("Score layout", { exact: true })).toBeVisible();
}

async function expectEditorOverlays(page) {
  for (const selector of [
    ".at-edit-cursor",
    ".at-transport-playhead",
    ".at-bar-selection",
    ".at-loop-range",
  ]) {
    await expect(page.locator(selector).first()).toBeVisible();
  }

  const stacking = await page.evaluate(() => {
    const layer = document.querySelector(".cotab-range-background-layer");
    const canvas = document.querySelector(".at-surface");
    if (!layer || !canvas) throw new Error("Score range layers are unavailable");
    return {
      rangeLayerHost: layer.parentElement?.className ?? "",
      rangeLayerZIndex: window.getComputedStyle(layer).zIndex,
      surfaceZIndex: window.getComputedStyle(canvas).zIndex,
      scoreZIndexes: Array.from(canvas.children)
        .filter((child) => child instanceof HTMLElement)
        .map((child) => window.getComputedStyle(child).zIndex),
    };
  });
  expect(stacking.rangeLayerHost).toContain("at-main");
  expect(stacking.rangeLayerZIndex).toBe("0");
  expect(stacking.surfaceZIndex).toBe("1");
  expect(stacking.scoreZIndexes.length).toBeGreaterThan(0);
  expect(stacking.scoreZIndexes.every((zIndex) => zIndex === "1")).toBe(true);
}

async function findCrossStaffNavigationScenario(page) {
  return page.evaluate(() => {
    const api = window.__ALPHATAB_API__;
    const viewport = document.querySelector(".at-viewport");
    if (!api?.score || !viewport) throw new Error("Score is unavailable");

    const renderedBars = api.boundsLookup.staffSystems.flatMap((system) =>
      system.bars.flatMap((masterBar) => masterBar.bars),
    );
    const findBar = (trackIndex, barIndex) =>
      renderedBars.find((bounds) => {
        const bar = bounds.bar ?? bounds.beats[0]?.beat.voice.bar;
        return bar?.staff.track.index === trackIndex
          && bar.staff.index === 0
          && bar.index === barIndex;
      });
    const findGrid = (trackIndex, barIndex) =>
      Object.values(window.__SNAP_GRIDS__).find(
        (grid) => grid.trackIndex === trackIndex
          && grid.staffIndex === 0
          && grid.barIndexes.includes(barIndex),
      );

    for (let sourceTrackIndex = 0;
      sourceTrackIndex < api.score.tracks.length - 1;
      sourceTrackIndex++) {
      const sourceStaff = api.score.tracks[sourceTrackIndex].staves[0];
      for (let barIndex = 0; barIndex < sourceStaff.bars.length; barIndex++) {
        const sourceBar = findBar(sourceTrackIndex, barIndex);
        const targetBar = findBar(sourceTrackIndex + 1, barIndex);
        const sourceGrid = findGrid(sourceTrackIndex, barIndex);
        const targetGrid = findGrid(sourceTrackIndex + 1, barIndex);
        if (
          !sourceBar || !targetBar || !sourceGrid || !targetGrid
          || sourceBar.beats.length === 0 || targetBar.beats.length < 2
          || sourceGrid.positions.length === 0 || targetGrid.positions.length === 0
        ) continue;

        for (const sourceBeat of sourceBar.beats) {
          const targetBeat = targetBar.beats.reduce((nearest, candidate) => {
            const nearestCenter = nearest.realBounds.x + nearest.realBounds.w / 2;
            const candidateCenter = candidate.realBounds.x + candidate.realBounds.w / 2;
            return Math.abs(sourceBeat.onNotesX - candidateCenter)
              < Math.abs(sourceBeat.onNotesX - nearestCenter)
              ? candidate
              : nearest;
          });
          if (targetBeat.beat.index === 0) continue;

          const sourceSnapIndex = Math.floor((sourceGrid.positions.length - 1) / 2);
          const targetSnapIndex = sourceGrid.positions.length === 1
            ? Math.floor((targetGrid.positions.length - 1) / 2)
            : Math.round(
              sourceSnapIndex
                / (sourceGrid.positions.length - 1)
                * (targetGrid.positions.length - 1),
            );
          const sourceSnap = sourceGrid.positions[sourceSnapIndex];
          const targetSnap = targetGrid.positions[targetSnapIndex];

          viewport.scrollLeft = Math.max(0, sourceBeat.onNotesX - 400);
          viewport.scrollTop = Math.max(
            0,
            Math.min(sourceSnap.y, targetSnap.y) - 120,
          );

          return {
            source: {
              trackIndex: sourceTrackIndex,
              staffIndex: 0,
              voiceIndex: sourceBeat.beat.voice.index,
              barIndex,
              beatIndex: sourceBeat.beat.index,
              string: sourceSnap.string,
              x: sourceBeat.onNotesX,
              y: sourceSnap.y,
            },
            target: {
              trackIndex: sourceTrackIndex + 1,
              staffIndex: 0,
              voiceIndex: targetBeat.beat.voice.index,
              barIndex,
              beatIndex: targetBeat.beat.index,
              string: targetSnap.string,
              x: sourceBeat.onNotesX,
              y: targetSnap.y,
            },
          };
        }
      }
    }
    throw new Error("No cross-staff variable-rhythm navigation scenario found");
  });
}

async function clickAlphaTabPoint(page, point) {
  const screenPoint = await page.evaluate(({ x, y }) => {
    const api = window.__ALPHATAB_API__;
    const main = document.querySelector(".at-main");
    if (!api || !main) throw new Error("Score is unavailable");
    const rect = main.getBoundingClientRect();
    return {
      x: rect.left + x * api.settings.display.scale,
      y: rect.top + y * api.settings.display.scale,
    };
  }, point);
  await page.mouse.click(screenPoint.x, screenPoint.y);
}

for (const layout of ["horizontal", "parchment"]) {
  test(`Command+vertical navigation matches mouse snapping in ${layout} layout`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/");
    await waitForScore(page);
    await chooseLayout(
      page,
      layout === "horizontal" ? "Horizontal layout" : "Parchment layout",
    );
    await waitForLayout(page, layout, layout === "horizontal" ? 1 : 2);

    const scenario = await findCrossStaffNavigationScenario(page);
    const { x: _sourceX, y: _sourceY, ...expectedSource } = scenario.source;
    const { x: _targetX, y: _targetY, ...expectedTarget } = scenario.target;
    const reverseMousePoint = await page.evaluate(({ source, target }) => {
      const api = window.__ALPHATAB_API__;
      const grids = Object.values(window.__SNAP_GRIDS__);
      const targetBeat = api.score.tracks[target.trackIndex].staves[target.staffIndex]
        .bars[target.barIndex].voices[target.voiceIndex].beats[target.beatIndex];
      const targetBounds = api.boundsLookup.findBeat(targetBeat);
      const fromGrid = grids.find((grid) =>
        grid.trackIndex === target.trackIndex
        && grid.staffIndex === target.staffIndex
        && grid.barIndexes.includes(target.barIndex));
      const toGrid = grids.find((grid) =>
        grid.trackIndex === source.trackIndex
        && grid.staffIndex === source.staffIndex
        && grid.barIndexes.includes(source.barIndex));
      if (!targetBounds || !fromGrid || !toGrid) {
        throw new Error("Reverse navigation geometry is unavailable");
      }
      const fromPosition = fromGrid.positions.find(
        (position) => position.string === target.string,
      );
      const fromFirst = fromGrid.positions[0].y;
      const fromLast = fromGrid.positions.at(-1).y;
      const relativeY = fromPosition && fromLast !== fromFirst
        ? (fromPosition.y - fromFirst) / (fromLast - fromFirst)
        : 0.5;
      const toFirst = toGrid.positions[0].y;
      const toLast = toGrid.positions.at(-1).y;
      return {
        x: targetBounds.onNotesX,
        y: toFirst + relativeY * (toLast - toFirst),
      };
    }, scenario);
    await page.waitForTimeout(100);
    await clickAlphaTabPoint(page, scenario.source);
    await expect
      .poll(() => page.evaluate(() => window.__PLAYER_STORE__.getState().selectedBeat))
      .toMatchObject(expectedSource);

    const modifier = await page.evaluate(() =>
      navigator.userAgent.toLowerCase().includes("mac") ? "Meta" : "Control",
    );
    await page.keyboard.press(`${modifier}+ArrowDown`);
    await expect
      .poll(() => page.evaluate(() => window.__PLAYER_STORE__.getState().selectedBeat))
      .toMatchObject(expectedTarget);
    const keyboardSelection = await page.evaluate(() =>
      window.__PLAYER_STORE__.getState().selectedBeat,
    );

    await clickAlphaTabPoint(page, scenario.source);
    await clickAlphaTabPoint(page, scenario.target);
    const mouseSelection = await page.evaluate(() =>
      window.__PLAYER_STORE__.getState().selectedBeat,
    );
    expect(keyboardSelection).toEqual(mouseSelection);

    await page.keyboard.press(`${modifier}+ArrowUp`);
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__PLAYER_STORE__.getState().selectedBeat?.trackIndex ?? null,
        ),
      )
      .toBe(scenario.source.trackIndex);
    const keyboardUpSelection = await page.evaluate(() =>
      window.__PLAYER_STORE__.getState().selectedBeat,
    );

    await clickAlphaTabPoint(page, scenario.target);
    await clickAlphaTabPoint(page, reverseMousePoint);
    const mouseUpSelection = await page.evaluate(() =>
      window.__PLAYER_STORE__.getState().selectedBeat,
    );
    expect(keyboardUpSelection).toEqual(mouseUpSelection);
  });
}

for (const layout of ["horizontal", "parchment"]) {
  test(`Command+vertical navigation uses visible percussion lines in ${layout} layout`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/");
    await waitForScore(page);
    await chooseLayout(
      page,
      layout === "horizontal" ? "Horizontal layout" : "Parchment layout",
    );
    await waitForLayout(page, layout, layout === "horizontal" ? 1 : 2);

    const scenario = await page.evaluate(() => {
      const api = window.__ALPHATAB_API__;
      const targetTrackIndex = api.score.tracks.findIndex(
        (track, index) => track.isPercussion && index > 0,
      );
      const sourceTrackIndex = targetTrackIndex - 1;
      if (targetTrackIndex <= 0 || api.score.tracks[sourceTrackIndex].isPercussion) {
        throw new Error("No adjacent melodic/percussion tracks found");
      }

      const grids = Object.values(window.__SNAP_GRIDS__);
      for (const sourceGrid of grids) {
        if (
          sourceGrid.trackIndex !== sourceTrackIndex
          || sourceGrid.staffIndex !== 0
          || sourceGrid.positions.length === 0
        ) continue;
        const barIndex = sourceGrid.barIndexes[0];
        const targetGrid = grids.find((grid) =>
          grid.trackIndex === targetTrackIndex
          && grid.staffIndex === 0
          && grid.barIndexes.includes(barIndex));
        const sourceBeat = api.score.tracks[sourceTrackIndex].staves[0]
          .bars[barIndex]?.voices[0]?.beats[0];
        const visibleTargetPositions = targetGrid?.positions.filter(
          (position) => position.string >= 0 && position.string <= 8,
        ) ?? [];
        if (!targetGrid || !sourceBeat || visibleTargetPositions.length === 0) continue;

        return {
          source: {
            trackIndex: sourceTrackIndex,
            staffIndex: 0,
            voiceIndex: 0,
            barIndex,
            beatIndex: sourceBeat.index,
            string: sourceGrid.positions[0].string,
          },
          targetTrackIndex,
          expectedTargetString: visibleTargetPositions[0].string,
        };
      }
      throw new Error("No rendered percussion navigation scenario found");
    });

    await page.evaluate((source) => {
      window.__PLAYER_STORE__.getState().setSelection(source);
    }, scenario.source);
    const modifier = await page.evaluate(() =>
      navigator.userAgent.toLowerCase().includes("mac") ? "Meta" : "Control",
    );
    await page.keyboard.press(`${modifier}+ArrowDown`);
    const percussionSelection = await page.evaluate(() =>
      window.__PLAYER_STORE__.getState().selectedBeat,
    );
    expect(percussionSelection).toMatchObject({
      trackIndex: scenario.targetTrackIndex,
      string: scenario.expectedTargetString,
    });
    expect(percussionSelection.string).toBeGreaterThanOrEqual(0);
    expect(percussionSelection.string).toBeLessThanOrEqual(8);

    await page.keyboard.press(`${modifier}+ArrowUp`);
    await expect
      .poll(() => page.evaluate(() => window.__PLAYER_STORE__.getState().selectedBeat))
      .toMatchObject(scenario.source);
  });
}

test("mouse and keyboard selector moves keep the cursor in view", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 320 });
  await page.goto("/");
  await waitForScore(page);
  await chooseLayout(page, "Horizontal layout");
  await waitForLayout(page, "horizontal", 1);

  const target = await page.evaluate(() => {
    const api = window.__ALPHATAB_API__;
    const viewport = document.querySelector(".at-viewport");
    if (!api || !viewport) throw new Error("Score viewport is unavailable");
    const bars = api.boundsLookup.staffSystems
      .flatMap((system) => system.bars)
      .flatMap((masterBar) => masterBar.bars)
      .filter((bounds) => {
        const bar = bounds.bar ?? bounds.beats[0]?.beat.voice.bar;
        return bar?.staff.track.index === 0
          && bar.staff.index === 0
          && bounds.beats.length > 1;
      });
    const barBounds = bars[Math.floor(bars.length * 0.75)];
    const beatBounds = barBounds?.beats.at(-1);
    if (!barBounds || !beatBounds) throw new Error("No late selector target found");
    const clickX = beatBounds.realBounds.x + beatBounds.realBounds.w / 2;
    const clickedBeatBounds = barBounds.beats.reduce((nearest, candidate) => {
      const nearestCenter = nearest.realBounds.x + nearest.realBounds.w / 2;
      const candidateCenter = candidate.realBounds.x + candidate.realBounds.w / 2;
      return Math.abs(clickX - candidateCenter) < Math.abs(clickX - nearestCenter)
        ? candidate
        : nearest;
    });
    const bar = clickedBeatBounds.beat.voice.bar;
    const grid = Object.values(window.__SNAP_GRIDS__).find((candidate) =>
      candidate.trackIndex === 0
      && candidate.staffIndex === 0
      && candidate.barIndexes.includes(bar.index));
    if (!grid) throw new Error("No selector snap grid found");
    const snap = grid.positions[Math.floor(grid.positions.length / 2)];
    viewport.scrollLeft = Math.max(
      0,
      (clickedBeatBounds.onNotesX - grid.noteWidth / 2)
        * api.settings.display.scale - 8,
    );
    viewport.scrollTop = Math.max(
      0,
      snap.y * api.settings.display.scale - viewport.clientHeight / 2,
    );
    return {
      x: clickX,
      y: snap.y,
      selection: {
        trackIndex: 0,
        staffIndex: 0,
        voiceIndex: clickedBeatBounds.beat.voice.index,
        barIndex: bar.index,
        beatIndex: clickedBeatBounds.beat.index,
        string: snap.string,
      },
      initialScrollLeft: viewport.scrollLeft,
    };
  });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    const viewport = document.querySelector(".at-viewport");
    if (!viewport) throw new Error("Score viewport is unavailable");
    window.__SELECTOR_SCROLL_SAMPLES__ = [viewport.scrollLeft];
    viewport.addEventListener("scroll", () => {
      window.__SELECTOR_SCROLL_SAMPLES__.push(viewport.scrollLeft);
    }, { passive: true });
  });

  await clickAlphaTabPoint(page, target);
  await expect
    .poll(() => page.evaluate(() => window.__PLAYER_STORE__.getState().selectedBeat))
    .toMatchObject({
      trackIndex: target.selection.trackIndex,
      staffIndex: target.selection.staffIndex,
      barIndex: target.selection.barIndex,
      string: target.selection.string,
    });
  await expect
    .poll(() => page.evaluate(() => {
      const viewport = document.querySelector(".at-viewport");
      const cursor = document.querySelector(".at-edit-cursor");
      if (!viewport || !cursor) return -Infinity;
      return cursor.getBoundingClientRect().left
        - viewport.getBoundingClientRect().left;
    }))
    .toBeGreaterThanOrEqual(24);
  await page.waitForTimeout(220);
  const mouseFocus = await page.evaluate(() => {
    const viewport = document.querySelector(".at-viewport");
    const cursor = document.querySelector(".at-edit-cursor");
    if (!viewport || !cursor) throw new Error("Selector cursor is unavailable");
    const viewportRect = viewport.getBoundingClientRect();
    const cursorRect = cursor.getBoundingClientRect();
    return {
      scrollLeft: viewport.scrollLeft,
      leftGap: cursorRect.left - viewportRect.left,
      scrollSamples: window.__SELECTOR_SCROLL_SAMPLES__,
    };
  });
  expect(mouseFocus.scrollLeft).toBeLessThan(target.initialScrollLeft);
  expect(mouseFocus.leftGap).toBeGreaterThanOrEqual(24);
  const distinctScrollSamples = [...new Set(mouseFocus.scrollSamples)];
  expect(distinctScrollSamples.length).toBeGreaterThan(2);
  expect(distinctScrollSamples.some((value) =>
    value < target.initialScrollLeft && value > mouseFocus.scrollLeft)).toBe(true);

  await page.evaluate(() => {
    const viewport = document.querySelector(".at-viewport");
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
  });
  await page.keyboard.press("ArrowLeft");
  await expect
    .poll(() => page.evaluate(() => document.querySelector(".at-viewport").scrollLeft))
    .toBeGreaterThan(0);

  const modifier = await page.evaluate(() =>
    navigator.userAgent.toLowerCase().includes("mac") ? "Meta" : "Control",
  );
  for (let index = 0; index < 5; index++) {
    await page.keyboard.press(`${modifier}+ArrowDown`);
  }
  await expect
    .poll(() => page.evaluate(() => window.__PLAYER_STORE__.getState().selectedBeat))
    .toMatchObject({ trackIndex: 5 });
  await page.waitForTimeout(100);
  await expect
    .poll(() => page.evaluate(() => {
      const viewport = document.querySelector(".at-viewport");
      const cursor = document.querySelector(".at-edit-cursor");
      if (!viewport || !cursor) return -Infinity;
      return viewport.getBoundingClientRect().bottom
        - cursor.getBoundingClientRect().bottom;
    }))
    .toBeGreaterThanOrEqual(24);
  const keyboardFocus = await page.evaluate(() => {
    const viewport = document.querySelector(".at-viewport");
    const cursor = document.querySelector(".at-edit-cursor");
    if (!viewport || !cursor) throw new Error("Selector cursor is unavailable");
    const viewportRect = viewport.getBoundingClientRect();
    const cursorRect = cursor.getBoundingClientRect();
    return {
      scrollTop: viewport.scrollTop,
      topGap: cursorRect.top - viewportRect.top,
      bottomGap: viewportRect.bottom - cursorRect.bottom,
    };
  });
  expect(keyboardFocus.scrollTop).toBeGreaterThan(0);
  expect(keyboardFocus.topGap).toBeGreaterThanOrEqual(24);
  expect(keyboardFocus.bottomGap).toBeGreaterThanOrEqual(24);
});

test("Developer preferences control snap grid visibility", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await waitForScore(page);

  await page.getByTestId("preferences-menu").click();
  const toggle = page.getByRole("menuitemcheckbox", {
    name: "Show snap grid",
  });
  await expect(toggle).not.toBeChecked();
  await expect(page.locator(".at-snap-grid-overlay")).toHaveCount(0);

  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect(page.locator(".at-snap-grid-overlay")).toHaveCount(1);
  await expect(page.locator(".at-snap-grid-marker").first()).toBeVisible();

  await chooseLayout(page, "Parchment layout");
  await waitForLayout(page, "parchment", 2);
  await page.getByTestId("preferences-menu").click();
  await expect(toggle).toBeChecked();
  await expect(page.locator(".at-snap-grid-overlay")).toHaveCount(1);
  await expect(page.locator(".at-snap-grid-marker").first()).toBeVisible();

  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await expect(page.locator(".at-snap-grid-overlay")).toHaveCount(0);
});

test("hides the alphaTab attribution at every supported zoom", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await waitForScore(page);

  for (const zoom of [0.5, 1, 1.25, 2]) {
    await page.evaluate((value) => {
      window.__PLAYER_STORE__.getState().setZoom(value);
    }, zoom);
    await expect.poll(() =>
      page.evaluate(() => window.__ALPHATAB_API__.settings.display.scale)
    ).toBe(zoom);
    await expect(
      page.locator(".at-surface-svg").filter({ hasText: "rendered by alphaTab" }),
    ).toBeHidden();
    await expect(page.locator(".at-surface-svg:visible").first()).toBeVisible();
  }
});

test("switches layouts and snaps a later parchment system locally", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await waitForScore(page);
  await chooseLayout(page, "Horizontal layout");
  await waitForLayout(page, "horizontal", 1);

  const horizontalRows = await page.evaluate(() =>
    new Set(
      window.__ALPHATAB_API__.boundsLookup.staffSystems.map(
        (system) =>
          `${system.realBounds.x}:${system.realBounds.y}:${system.realBounds.w}:${system.realBounds.h}`,
      ),
    ).size,
  );
  expect(horizontalRows).toBe(1);

  await chooseLayout(page, "Parchment layout");
  await waitForLayout(page, "parchment", 2);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Object.values(window.__SNAP_GRIDS__ ?? {}).filter(
            (grid) => grid.trackIndex === 0 && grid.staffIndex === 0,
          ).length,
      ),
    )
    .toBeGreaterThan(1);

  const parchment = await page.evaluate(() => {
    const api = window.__ALPHATAB_API__;
    const grids = Object.values(window.__SNAP_GRIDS__ ?? {});
    const trackGrids = grids.filter(
      (grid) => grid.trackIndex === 0 && grid.staffIndex === 0,
    );
    return {
      systems: api.boundsLookup.staffSystems.length,
      systemIndexes: trackGrids.map((grid) => grid.systemIndex),
      topPositions: trackGrids.map((grid) => grid.positions[0]?.y ?? null),
    };
  });

  expect(parchment.systems).toBeGreaterThan(1);
  expect(new Set(parchment.systemIndexes).size).toBeGreaterThan(1);
  expect(new Set(parchment.topPositions).size).toBeGreaterThan(1);

  const target = await page.evaluate(() => {
    const api = window.__ALPHATAB_API__;
    const system = api.boundsLookup.staffSystems[1];
    const barBounds = system.bars
      .flatMap((masterBar) => masterBar.bars)
      .find(
        (bounds) => {
          const bar = bounds.bar ?? bounds.beats[0]?.beat?.voice?.bar;
          return (
            bar?.staff.track.index === 0 &&
            bar?.staff.index === 0 &&
            bounds.beats.length > 0
          );
        },
      );
    if (!barBounds) throw new Error("No Lead Guitar bar in system 1");

    const grid = Object.values(window.__SNAP_GRIDS__).find(
      (candidate) =>
        candidate.systemIndex === system.index &&
        candidate.trackIndex === 0 &&
        candidate.staffIndex === 0,
    );
    if (!grid) throw new Error("No snap grid for system 1 Lead Guitar");

    const snap = grid.positions[0];
    const beatBounds = barBounds.beats[0];
    const viewport = document.querySelector(".at-viewport");
    viewport.scrollTop = Math.max(0, snap.y - 180);
    return {
      x: beatBounds.onNotesX,
      y: snap.y,
      string: snap.string,
      barIndex: beatBounds.beat.voice.bar.index,
      beatIndex: beatBounds.beat.index,
    };
  });

  await page.waitForTimeout(100);
  const screenPoint = await page.evaluate(({ x, y }) => {
    const api = window.__ALPHATAB_API__;
    const main = document.querySelector(".at-main");
    const rect = main.getBoundingClientRect();
    return {
      x: rect.left + x * api.settings.display.scale,
      y: rect.top + y * api.settings.display.scale,
    };
  }, target);
  await page.mouse.click(screenPoint.x, screenPoint.y);

  await expect
    .poll(() =>
      page.evaluate(() => {
        const selection = window.__PLAYER_STORE__.getState().selectedBeat;
        return selection
          ? {
              barIndex: selection.barIndex,
              beatIndex: selection.beatIndex,
              string: selection.string,
            }
          : null;
      }),
    )
    .toEqual({
      barIndex: target.barIndex,
      beatIndex: target.beatIndex,
      string: target.string,
    });

  const loopDrag = await page.evaluate(() => {
    const api = window.__ALPHATAB_API__;
    const viewport = document.querySelector(".at-viewport");
    const main = document.querySelector(".at-main");
    viewport.scrollTop = 0;

    const resolvePoint = (systemIndex) => {
      const system = api.boundsLookup.staffSystems[systemIndex];
      const barBounds = system.bars
        .flatMap((masterBar) => masterBar.bars)
        .find((bounds) => {
          const bar = bounds.bar ?? bounds.beats[0]?.beat?.voice?.bar;
          return (
            bar?.staff.track.index === 0 &&
            bar?.staff.index === 0 &&
            bounds.beats.length > 0
          );
        });
      const grid = Object.values(window.__SNAP_GRIDS__).find(
        (candidate) =>
          candidate.systemIndex === systemIndex &&
          candidate.trackIndex === 0 &&
          candidate.staffIndex === 0,
      );
      if (!barBounds || !grid) {
        throw new Error(`Missing bounds for system ${systemIndex}`);
      }
      const beatBounds = barBounds.beats[0];
      return {
        x: beatBounds.onNotesX,
        y: grid.positions[0].y,
        barIndex: beatBounds.beat.voice.bar.index,
        beatIndex: beatBounds.beat.index,
      };
    };

    const rect = main.getBoundingClientRect();
    const scale = api.settings.display.scale;
    const start = resolvePoint(0);
    const end = resolvePoint(1);
    return {
      start: {
        ...start,
        screenX: rect.left + start.x * scale,
        screenY: rect.top + start.y * scale,
      },
      end: {
        ...end,
        screenX: rect.left + end.x * scale,
        screenY: rect.top + end.y * scale,
      },
    };
  });

  await page.mouse.move(loopDrag.start.screenX, loopDrag.start.screenY);
  await page.mouse.down();
  await page.mouse.move(loopDrag.end.screenX, loopDrag.end.screenY, {
    steps: 10,
  });
  await page.mouse.up();

  await expect
    .poll(() =>
      page.evaluate(() => window.__PLAYER_STORE__.getState().selectionRange),
    )
    .toEqual({
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      startBarIndex: Math.min(
        loopDrag.start.barIndex,
        loopDrag.end.barIndex,
      ),
      endBarIndex: Math.max(loopDrag.start.barIndex, loopDrag.end.barIndex),
    });

  await page.mouse.move(loopDrag.start.screenX, loopDrag.start.screenY);
  await page.keyboard.down("Alt");
  await page.mouse.down();
  await page.mouse.move(loopDrag.end.screenX, loopDrag.end.screenY, {
    steps: 10,
  });
  await page.mouse.up();
  await page.keyboard.up("Alt");

  await expect
    .poll(() =>
      page.evaluate(() => {
        const range = window.__PLAYER_STORE__.getState().transport.loopRange;
        return range
          ? {
              start: {
                barIndex: range.start.barIndex,
                beatIndex: range.start.beatIndex,
              },
              end: {
                barIndex: range.end.barIndex,
                beatIndex: range.end.beatIndex,
              },
            }
          : null;
      }),
    )
    .toEqual({
      start: {
        barIndex: loopDrag.start.barIndex,
        beatIndex: loopDrag.start.beatIndex,
      },
      end: {
        barIndex: loopDrag.end.barIndex,
        beatIndex: loopDrag.end.beatIndex,
      },
    });

  const editorStateBeforeSwitch = await page.evaluate(() => {
    const state = window.__PLAYER_STORE__.getState();
    return {
      selectedBeat: state.selectedBeat,
      selectionRange: state.selectionRange,
      transportPlayhead: state.transport.playhead,
      loopRange: state.transport.loopRange,
    };
  });
  await expectEditorOverlays(page);

  await chooseLayout(page, "Horizontal layout");
  await waitForLayout(page, "horizontal", 1);
  await expect
    .poll(() =>
      page.evaluate(() =>
        new Set(
          window.__ALPHATAB_API__.boundsLookup.staffSystems.map(
            (system) =>
              `${system.realBounds.x}:${system.realBounds.y}:${system.realBounds.w}:${system.realBounds.h}`,
          ),
        ).size,
      ),
    )
    .toBe(1);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = window.__PLAYER_STORE__.getState();
        return {
          selectedBeat: state.selectedBeat,
          selectionRange: state.selectionRange,
          transportPlayhead: state.transport.playhead,
          loopRange: state.transport.loopRange,
        };
      }),
    )
    .toEqual(editorStateBeforeSwitch);
  await expectEditorOverlays(page);

  await chooseLayout(page, "Parchment layout");
  await waitForLayout(page, "parchment", 2);
  await openLayoutMenu(page);
  const zoomSlider = page.getByRole("slider");
  await zoomSlider.focus();
  for (let step = 0; step < 5; step++) await zoomSlider.press("ArrowRight");
  await expect
    .poll(() =>
      page.evaluate(() => ({
        scale: window.__ALPHATAB_API__.settings.display.scale,
        state: (() => {
          const current = window.__PLAYER_STORE__.getState();
          return {
            selectedBeat: current.selectedBeat,
            selectionRange: current.selectionRange,
            transportPlayhead: current.transport.playhead,
            loopRange: current.transport.loopRange,
          };
        })(),
      })),
    )
    .toEqual({ scale: 1.25, state: editorStateBeforeSwitch });
  await expectEditorOverlays(page);
});

test("edits parchment rows with Guitar Pro-style layout controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await waitForScore(page);

  await chooseLayout(page, "Parchment layout");
  await waitForLayout(page, "parchment", 2);
  await waitForSystemRows(page, [[0, 3], [4, 7]]);

  await selectBar(page, 1);
  await openLayoutSettings(page);
  await page.getByRole("button", { name: "End row after bar 2" }).click();
  await waitForSystemRows(page, [[0, 1], [2, 3], [4, 7]]);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__ALPHATAB_API__.score.systemsLayout.slice(0, 3),
      ),
    )
    .toEqual([2, 2, 4]);

  await openLayoutSettings(page);
  await page.getByRole("button", { name: "Merge rows after bar 2" }).click();
  await waitForSystemRows(page, [[0, 3], [4, 7]]);

  await openLayoutMenu(page);
  await page.getByRole("menuitemcheckbox", {
    name: "Edit score layout",
  }).click();
  await expect(
    page.getByRole("button", {
      name: "Move one bar from the next row into row 1",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", {
    name: "Move one bar from the next row into row 1",
    exact: true,
  }).click();
  await waitForSystemRows(page, [[0, 4], [5, 7]]);
  await page.getByRole("button", {
    name: "Move one bar from row 1 to the next row",
    exact: true,
  }).click();
  await waitForSystemRows(page, [[0, 3], [4, 7]]);

  await openLayoutSettings(page);
  await page.getByLabel("Bars per row").fill("5");
  await page.getByRole("button", { name: "Apply layout" }).click();
  await waitForSystemRows(page, [[0, 4], [5, 9]]);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        defaultSystemsLayout:
          window.__ALPHATAB_API__.score.defaultSystemsLayout,
        systemsLayout: [...window.__ALPHATAB_API__.score.systemsLayout],
      })),
    )
    .toEqual({ defaultSystemsLayout: 5, systemsLayout: [] });

  await selectBar(page, 6);
  await openLayoutSettings(page);
  await page.getByLabel("Bars per row").fill("3");
  await page.getByRole("button", { name: "From current row" }).click();
  await page.getByRole("button", { name: "Apply layout" }).click();
  await waitForSystemRows(page, [[0, 4], [5, 7], [8, 10]]);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        defaultSystemsLayout:
          window.__ALPHATAB_API__.score.defaultSystemsLayout,
        systemsLayout: [...window.__ALPHATAB_API__.score.systemsLayout],
      })),
    )
    .toEqual({ defaultSystemsLayout: 3, systemsLayout: [5] });

  await selectBar(page, 5);
  const modifier = await page.evaluate(() =>
    navigator.userAgent.toLowerCase().includes("mac") ? "Meta" : "Control",
  );
  await page.keyboard.press(`${modifier}+Enter`);
  await waitForSystemRows(page, [[0, 4], [5, 5], [6, 7]]);
  await page.keyboard.press("Shift+7");
  await waitForSystemRows(page, [[0, 4], [5, 7], [8, 10]]);
});

test("uses track layout when only one track is visible", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await waitForScore(page);

  await chooseLayout(page, "Parchment layout");
  await waitForLayout(page, "parchment", 2);
  const originalScoreLayout = await page.evaluate(() => ({
    defaultSystemsLayout: window.__ALPHATAB_API__.score.defaultSystemsLayout,
    systemsLayout: [...window.__ALPHATAB_API__.score.systemsLayout],
  }));

  await page.getByRole("button", { name: "Meta", exact: true }).click();
  for (const trackName of [
    "Baritone Guitar",
    "Bass",
    "Lead Violin",
    "Baritone Violin",
    "Drumkit",
  ]) {
    await page.getByRole("button", {
      name: `Hide ${trackName}`,
      exact: true,
    }).click();
  }
  await expect
    .poll(() =>
      page.evaluate(() => ({
        visibleTrackIndices:
          window.__PLAYER_STORE__.getState().visibleTrackIndices,
        renderedTrackIndices:
          window.__ALPHATAB_API__.tracks.map((track) => track.index),
      })),
    )
    .toEqual({ visibleTrackIndices: [0], renderedTrackIndices: [0] });

  await openLayoutSettings(page);
  await expect(page.getByText("Track: Lead Guitar", { exact: true })).toBeVisible();
  await page.getByLabel("Bars per row").fill("5");
  await page.getByRole("button", { name: "Apply layout" }).click();
  await waitForSystemRows(page, [[0, 4], [5, 9]]);

  const layouts = await page.evaluate(() => ({
    score: {
      defaultSystemsLayout: window.__ALPHATAB_API__.score.defaultSystemsLayout,
      systemsLayout: [...window.__ALPHATAB_API__.score.systemsLayout],
    },
    track: {
      defaultSystemsLayout:
        window.__ALPHATAB_API__.score.tracks[0].defaultSystemsLayout,
      systemsLayout: [
        ...window.__ALPHATAB_API__.score.tracks[0].systemsLayout,
      ],
    },
  }));
  expect(layouts).toEqual({
    score: originalScoreLayout,
    track: { defaultSystemsLayout: 5, systemsLayout: [] },
  });
});
