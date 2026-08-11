// @ts-check
import { expect, test } from "@playwright/test";

async function waitForScore(page) {
  await expect.poll(() => page.evaluate(() =>
    window.__ALPHATAB_API__?.boundsLookup?.staffSystems?.length ?? 0,
  )).toBeGreaterThan(0);
}

async function enableFirstStaffStandardNotation(page) {
  if (await page.evaluate(() =>
    window.__ALPHATAB_API__.score.tracks[0].staves[0].showStandardNotation,
  )) return;

  await page.getByRole("button", { name: "Meta", exact: true }).click();
  await page.getByRole("button", {
    name: "Toggle Lead Guitar details",
    exact: true,
  }).click();
  await page.getByRole("button", { name: /^Staves/ }).click();
  const renderFinished = page.evaluate(() => new Promise((resolve) => {
    const unsubscribe = window.__ALPHATAB_API__.postRenderFinished.on(() => {
      unsubscribe();
      resolve(undefined);
    });
  }));
  await page.getByRole("menuitemcheckbox", {
    name: "Standard notation",
    exact: true,
  }).click();
  await renderFinished;
}

async function clickAlphaTabPoint(page, point) {
  const screenPoint = await page.evaluate(({ x, y }) => {
    const api = window.__ALPHATAB_API__;
    const main = document.querySelector(".at-main");
    const rect = main.getBoundingClientRect();
    return {
      x: rect.left + x * api.settings.display.scale,
      y: rect.top + y * api.settings.display.scale,
    };
  }, point);
  await page.mouse.click(screenPoint.x, screenPoint.y);
}

test("dual notation staff snaps and navigates by visible staff", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.goto("/?demo=taijin-kyofusho");
  await waitForScore(page);
  await enableFirstStaffStandardNotation(page);

  const scenario = await page.evaluate(() => {
    const api = window.__ALPHATAB_API__;
    const grids = Object.values(window.__SNAP_GRIDS__).filter((grid) =>
      grid.trackIndex === 0 && grid.staffIndex === 0
    );
    const standard = grids.find((grid) => grid.renderedStave === "standard");
    const tablature = grids.find((grid) => grid.renderedStave === "tablature");
    if (!standard || !tablature) {
      throw new Error("Expected independent standard and tablature snap grids");
    }
    const barIndex = standard.barIndexes.find((index) =>
      tablature.barIndexes.includes(index)
    );
    if (barIndex === undefined) throw new Error("No shared rendered bar found");

    const renderedBars = api.boundsLookup.staffSystems
      .flatMap((system) => system.bars)
      .flatMap((masterBar) => masterBar.bars)
      .filter((bounds) => {
        const bar = bounds.bar ?? bounds.beats[0]?.beat.voice.bar;
        return bar?.staff.track.index === 0
          && bar.staff.index === 0
          && bar.index === barIndex
          && bounds.beats.length > 0;
      })
      .sort((a, b) => a.realBounds.y - b.realBounds.y);
    const standardBounds = renderedBars[0];
    const tablatureBounds = renderedBars.at(-1);
    if (!standardBounds || !tablatureBounds) {
      throw new Error("No dual rendered bounds found");
    }
    const standardSnap = standard.positions[Math.floor(standard.positions.length / 2)];
    const tablatureSnap = tablature.positions[Math.floor(tablature.positions.length / 2)];
    return {
      standard: {
        x: standardBounds.beats[0].onNotesX,
        y: standardSnap.y,
        string: standardSnap.string,
        barIndex,
      },
      tablature: {
        x: tablatureBounds.beats[0].onNotesX,
        y: tablatureSnap.y,
        string: tablatureSnap.string,
        barIndex,
        beatIndex: tablatureBounds.beats[0].beat.index,
        voiceIndex: tablatureBounds.beats[0].beat.voice.index,
      },
      tablatureTopString: tablature.positions[0].string,
      tablatureBottomString: tablature.positions.at(-1).string,
      standardPositionCount: standard.positions.length,
      tablaturePositionCount: tablature.positions.length,
    };
  });

  expect(scenario.standardPositionCount).toBe(21);
  expect(scenario.tablaturePositionCount).toBe(6);

  await clickAlphaTabPoint(page, scenario.standard);
  await expect.poll(() => page.evaluate(() => {
    const selection = window.__PLAYER_STORE__.getState().selectedBeat;
    return selection && {
      trackIndex: selection.trackIndex,
      staffIndex: selection.staffIndex,
      barIndex: selection.barIndex,
      string: selection.string,
      renderedStave: selection.renderedStave,
    };
  })).toEqual({
    trackIndex: 0,
    staffIndex: 0,
    barIndex: scenario.standard.barIndex,
    string: scenario.standard.string,
    renderedStave: "standard",
  });

  await clickAlphaTabPoint(page, scenario.tablature);
  await expect.poll(() => page.evaluate(() => {
    const selection = window.__PLAYER_STORE__.getState().selectedBeat;
    return selection && {
      string: selection.string,
      renderedStave: selection.renderedStave,
    };
  })).toEqual({
    string: scenario.tablature.string,
    renderedStave: "tablature",
  });

  const modifier = await page.evaluate(() =>
    navigator.userAgent.toLowerCase().includes("mac") ? "Meta" : "Control"
  );
  for (const [sourceString, expectedString] of [
    [scenario.tablatureTopString, 7],
    [scenario.tablatureBottomString, 15],
  ]) {
    await page.evaluate(({ sourceString, tablature }) => {
      window.__PLAYER_STORE__.getState().setSelection({
        trackIndex: 0,
        staffIndex: 0,
        voiceIndex: tablature.voiceIndex,
        barIndex: tablature.barIndex,
        beatIndex: tablature.beatIndex,
        string: sourceString,
        renderedStave: "tablature",
      });
    }, { sourceString, tablature: scenario.tablature });
    await page.keyboard.press(`${modifier}+ArrowUp`);
    await expect.poll(() => page.evaluate(() => {
      const selection = window.__PLAYER_STORE__.getState().selectedBeat;
      return selection && {
        string: selection.string,
        renderedStave: selection.renderedStave,
      };
    })).toEqual({
      string: expectedString,
      renderedStave: "standard",
    });
  }

  await clickAlphaTabPoint(page, scenario.standard);
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => page.evaluate(() => {
    const selection = window.__PLAYER_STORE__.getState().selectedBeat;
    return selection && {
      string: selection.string,
      renderedStave: selection.renderedStave,
    };
  })).toEqual({
    string: scenario.standard.string + 1,
    renderedStave: "standard",
  });
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press(`${modifier}+ArrowDown`);
  await expect.poll(() => page.evaluate(() => {
    const selection = window.__PLAYER_STORE__.getState().selectedBeat;
    return selection && {
      trackIndex: selection.trackIndex,
      staffIndex: selection.staffIndex,
      renderedStave: selection.renderedStave,
    };
  })).toEqual({
    trackIndex: 0,
    staffIndex: 0,
    renderedStave: "tablature",
  });

  await page.keyboard.press(`${modifier}+ArrowDown`);
  await expect.poll(() => page.evaluate(() => {
    const selection = window.__PLAYER_STORE__.getState().selectedBeat;
    return selection && {
      trackIndex: selection.trackIndex,
      staffIndex: selection.staffIndex,
      renderedStave: selection.renderedStave,
    };
  })).toEqual({
    trackIndex: 1,
    staffIndex: 0,
    renderedStave: "tablature",
  });

  await page.keyboard.press(`${modifier}+ArrowUp`);
  await expect.poll(() => page.evaluate(() =>
    window.__PLAYER_STORE__.getState().selectedBeat?.renderedStave ?? null,
  )).toBe("tablature");
  await expect.poll(() => page.evaluate(() =>
    window.__PLAYER_STORE__.getState().selectedBeat?.trackIndex ?? null,
  )).toBe(0);
});

test("single-string tablature systems preserve string order", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.goto("/?demo=taijin-kyofusho");
  await waitForScore(page);

  const positions = await page.evaluate(() => {
    const barIndex = 48;
    const trackIndex = 1;
    const grid = Object.values(window.__SNAP_GRIDS__).find((candidate) =>
      candidate.trackIndex === trackIndex
      && candidate.staffIndex === 0
      && candidate.renderedStave === "tablature"
      && candidate.barIndexes.includes(barIndex)
    );
    const barBounds = window.__ALPHATAB_API__.boundsLookup.staffSystems
      .flatMap((system) => system.bars)
      .flatMap((masterBar) => masterBar.bars)
      .find((bounds) => {
        const bar = bounds.bar ?? bounds.beats[0]?.beat.voice.bar;
        return bar?.staff.track.index === trackIndex
          && bar.staff.index === 0
          && bar.index === barIndex;
      });
    const renderedSixthStringY = barBounds?.beats
      .flatMap((beat) => beat.notes ?? [])
      .find((noteBounds) => noteBounds.note.string === 6)?.noteHeadBounds;
    if (!grid || !renderedSixthStringY) {
      throw new Error("No second-track grid or sixth-string note at measure 49");
    }
    const sixthStringY = renderedSixthStringY.y + renderedSixthStringY.h / 2;
    return {
      strings: grid.positions.map((position) => position.string),
      ys: grid.positions.map((position) => position.y),
      sixthStringY,
    };
  });

  expect(positions.strings).toEqual([6, 5, 4, 3, 2, 1]);
  expect(positions.ys).toEqual([...positions.ys].sort((a, b) => a - b));
  expect(positions.ys[0]).toBeCloseTo(positions.sixthStringY);
});

test("percussion grids use stable rendered-stave geometry", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.goto("/?demo=taijin-kyofusho");
  await waitForScore(page);

  const result = await page.evaluate(() => {
    const api = window.__ALPHATAB_API__;
    const trackIndex = api.score.tracks.findIndex((track) => track.isPercussion);
    const grids = Object.values(window.__SNAP_GRIDS__)
      .filter((grid) => grid.trackIndex === trackIndex)
      .sort((a, b) => a.systemIndex - b.systemIndex);
    if (grids.length < 2) throw new Error("No multi-system percussion grids");

    const expectedStrings = grids[0].positions.map((position) => position.string);
    const expectedOffsets = grids[0].positions.map(
      (position) => position.y - grids[0].positions[0].y,
    );
    const stableAcrossSystems = grids.every((grid) =>
      JSON.stringify(grid.positions.map((position) => position.string))
        === JSON.stringify(expectedStrings)
      && grid.positions.every((position, index) =>
        Math.abs(
          position.y - grid.positions[0].y - expectedOffsets[index],
        ) < 0.001
      )
    );

    let alignedNoteCount = 0;
    let maximumAlignmentError = 0;
    for (const system of api.boundsLookup.staffSystems) {
      for (const masterBar of system.bars) {
        for (const bounds of masterBar.bars) {
          const bar = bounds.bar ?? bounds.beats[0]?.beat.voice.bar;
          if (bar?.staff.track.index !== trackIndex) continue;
          const grid = grids.find((candidate) =>
            candidate.barIndexes.includes(bar.index)
          );
          if (!grid?.percussionMap) continue;
          const noteBoundsList = bounds.beats.flatMap((beat) => beat.notes ?? []);
          for (const noteBounds of noteBoundsList) {
            const staffLine = [...grid.percussionMap].find(
              ([, articulation]) =>
                articulation === noteBounds.note.percussionArticulation,
            )?.[0];
            const snap = grid.positions.find(
              (position) => position.string === staffLine,
            );
            if (!snap) continue;
            const noteY = noteBounds.noteHeadBounds.y
              + noteBounds.noteHeadBounds.h / 2;
            maximumAlignmentError = Math.max(
              maximumAlignmentError,
              Math.abs(noteY - snap.y),
            );
            alignedNoteCount++;
          }
        }
      }
    }

    return {
      strings: expectedStrings,
      stableAcrossSystems,
      alignedNoteCount,
      maximumAlignmentError,
    };
  });

  expect(result.strings).toEqual(
    Array.from({ length: 36 }, (_value, index) => index - 12),
  );
  expect(result.stableAcrossSystems).toBe(true);
  expect(result.alignedNoteCount).toBeGreaterThan(0);
  expect(result.maximumAlignmentError).toBeLessThan(0.001);
});
