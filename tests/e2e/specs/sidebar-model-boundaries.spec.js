// @ts-check
import { expect, test } from "@playwright/test";

async function waitForScore(page) {
  await expect
    .poll(() => page.evaluate(() =>
      window.__ALPHATAB_API__?.boundsLookup?.staffSystems?.length ?? 0))
    .toBeGreaterThan(0);
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
  await page.getByRole("menuitemcheckbox", {
    name: "Standard notation",
    exact: true,
  }).click();
  await expect.poll(() => page.evaluate(() =>
    window.__ALPHATAB_API__.score.tracks[0].staves[0].showStandardNotation,
  )).toBe(true);
  await page.getByRole("button", { name: "Notes", exact: true }).click();
}

test("separates MasterBar, Bar, Track, and Staff ownership in the sidebar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await waitForScore(page);

  await page.evaluate(() => {
    const api = window.__ALPHATAB_API__;
    const beat = api.score.tracks[0].staves[0].bars[0].voices[0].beats[0];
    const grid = Object.values(window.__SNAP_GRIDS__).find((candidate) =>
      candidate.trackIndex === 0
      && candidate.staffIndex === 0
      && candidate.barIndexes.includes(0));
    window.__PLAYER_STORE__.getState().setSelection({
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      barIndex: 0,
      beatIndex: beat.index,
      string: grid?.positions[0]?.string ?? null,
    });
  });
  await enableFirstStaffStandardNotation(page);

  await expect(page.getByText("MasterBar", { exact: true })).toBeVisible();
  await expect(page.getByText("Bar", { exact: true })).toBeVisible();
  await expect(page.getByText("Time Signature", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", {
    name: "Clef",
    exact: true,
  })).toBeVisible();

  await page.getByRole("button", { name: "Meta", exact: true }).click();
  await page.getByRole("button", {
    name: "Toggle Lead Guitar details",
    exact: true,
  }).click();
  await expect(page.getByText(/^Staff [12]$/, { exact: true })).toHaveCount(0);

  await page.evaluate(() => {
    const api = window.__ALPHATAB_API__;
    const store = window.__PLAYER_STORE__;
    const track = api.score.tracks[0];
    track.staves.push(track.staves[0]);

    const state = store.getState();
    store.setState({
      tracks: state.tracks.map((item) => item.index === 0
        ? { ...item, staffCount: 2 }
        : item),
      selectedTrackInfo: state.selectedTrackInfo
        ? { ...state.selectedTrackInfo, staffCount: 2 }
        : null,
    });
  });

  await expect(page.getByText("Staff 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Staff 2", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await expect(page.getByText("Bar · Staff 1", { exact: true })).toBeVisible();
  await expect(page.getByText("MasterBar", { exact: true })).toHaveCount(1);
});

test("adds a metadata-aligned track from the Tracks header popover", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await waitForScore(page);
  await page.getByRole("button", { name: "Meta", exact: true }).click();

  const addTrack = page.getByRole("button", { name: "Add Track", exact: true });
  const triggerBounds = await addTrack.boundingBox();
  await addTrack.click();
  const menu = page.getByRole("menu", { name: "Add Track", exact: true });
  await expect(menu).toBeVisible();
  const menuBounds = await menu.boundingBox();
  expect(triggerBounds).not.toBeNull();
  expect(menuBounds).not.toBeNull();
  expect(menuBounds.x).toBeGreaterThanOrEqual(triggerBounds.x + triggerBounds.width);

  const before = await page.evaluate(() =>
    window.__ALPHATAB_API__.score.tracks.length
  );
  await page.getByRole("menuitem", { name: /^Acoustic Piano/ }).click();
  await expect(menu).toBeHidden();

  await expect.poll(() => page.evaluate(() => {
    const track = window.__ALPHATAB_API__.score.tracks.at(-1);
    return {
      trackCount: window.__ALPHATAB_API__.score.tracks.length,
      name: track?.name,
      shortName: track?.shortName,
      program: track?.playbackInfo.program,
      staffCount: track?.staves.length,
      notation: track?.staves.map((staff) => ({
        standard: staff.showStandardNotation,
        tab: staff.showTablature,
      })),
    };
  })).toEqual({
    trackCount: before + 1,
    name: "Acoustic Piano",
    shortName: "Pno.",
    program: 0,
    staffCount: 2,
    notation: [
      { standard: true, tab: false },
      { standard: true, tab: false },
    ],
  });

  await addTrack.click();
  const instrumentCombobox = page.getByRole("combobox", {
    name: "All instruments",
    exact: true,
  });
  await instrumentCombobox.click();
  const instrumentSearch = page.getByRole("searchbox", {
    name: "Search presets",
  });
  await instrumentSearch.fill("^Flute$");
  await page.getByRole("option", { name: /^Flute/ }).click();

  await expect.poll(() => page.evaluate(() => {
    const track = window.__ALPHATAB_API__.score.tracks.at(-1);
    return {
      name: track?.name,
      program: track?.playbackInfo.program,
      bank: track?.playbackInfo.bank,
      staffCount: track?.staves.length,
      standard: track?.staves[0]?.showStandardNotation,
      tab: track?.staves[0]?.showTablature,
    };
  })).toEqual({
    name: "Flute",
    program: 73,
    bank: 0,
    staffCount: 1,
    standard: true,
    tab: false,
  });

  await page.getByRole("button", { name: "Toggle Flute details" }).click();
  const deleteTrack = page.getByRole("button", {
    name: "Delete track",
    exact: true,
  });
  await deleteTrack.click();
  await expect(page.getByRole("button", {
    name: "Confirm delete",
    exact: true,
  })).toBeVisible();
  await page.getByRole("button", {
    name: "Confirm delete",
    exact: true,
  }).click();

  await expect.poll(() => page.evaluate(() =>
    window.__ALPHATAB_API__.score.tracks.some((track) => track.name === "Flute")
  )).toBe(false);
});
