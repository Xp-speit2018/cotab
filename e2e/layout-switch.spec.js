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
        systems:
          window.__ALPHATAB_API__?.boundsLookup?.staffSystems?.length ?? 0,
      })),
    )
    .toMatchObject({ layout, alphaTabLayoutMode });
}

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
  await page.getByRole("button", { name: "Layout settings" }).click();
  await expect(page.getByText("Score layout", { exact: true })).toBeVisible();
}

test("switches layouts and snaps a later parchment system locally", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await waitForScore(page);

  const horizontalRows = await page.evaluate(() =>
    new Set(
      window.__ALPHATAB_API__.boundsLookup.staffSystems.map(
        (system) =>
          `${system.realBounds.x}:${system.realBounds.y}:${system.realBounds.w}:${system.realBounds.h}`,
      ),
    ).size,
  );
  expect(horizontalRows).toBe(1);

  await page.getByRole("button", { name: "Parchment layout" }).click();
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

  await page.getByRole("button", { name: "Horizontal layout" }).click();
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
});

test("edits parchment rows with Guitar Pro-style layout controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await waitForScore(page);

  await page.getByRole("button", { name: "Parchment layout" }).click();
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

  await page.getByRole("button", { name: "Edit score layout" }).click();
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

  await page.getByRole("button", { name: "Parchment layout" }).click();
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
