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
  await page.goto("/?demo=taijin-kyofusho");
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

test("adds a metadata-aligned track from the shared Track Creator", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/?demo=taijin-kyofusho");
  await waitForScore(page);
  await page.getByRole("button", { name: "Meta", exact: true }).click();

  const addTrack = page.getByRole("button", { name: "Add Track", exact: true });
  await addTrack.click();
  const creator = page.getByRole("dialog", { name: "Add Track", exact: true });
  await expect(creator).toBeVisible();

  const before = await page.evaluate(() =>
    window.__ALPHATAB_API__.score.tracks.length
  );
  await creator.getByRole("button", { name: /^Acoustic Piano/ }).click();
  await expect(creator.getByLabel("Name", { exact: true }))
    .toHaveValue("Acoustic Piano");
  await expect(creator.getByLabel("Abbreviation", { exact: true }))
    .toHaveValue("Pno.");
  const presetInstrument = creator.getByRole("combobox", {
    name: "Instrument",
    exact: true,
  });
  await expect(presetInstrument).toContainText("Acoustic Grand Piano");
  await presetInstrument.click();
  const instrumentList = page.getByRole("listbox", {
    name: "Instrument",
    exact: true,
  });
  await instrumentList.hover();
  await page.mouse.wheel(0, 500);
  await expect.poll(() => instrumentList.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect(instrumentList).toBeHidden();
  await expect(creator).toBeVisible();
  await creator.getByLabel("Name", { exact: true }).fill("Session Piano");
  await creator.getByLabel("Abbreviation", { exact: true }).fill("Keys");
  await expect.poll(() => page.evaluate(() =>
    window.__ALPHATAB_API__.score.tracks.length
  )).toBe(before);
  await creator.getByRole("button", { name: "Create Track", exact: true }).click();
  await expect(creator).toBeHidden();

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
    name: "Session Piano",
    shortName: "Keys",
    program: 0,
    staffCount: 2,
    notation: [
      { standard: true, tab: false },
      { standard: true, tab: false },
    ],
  });

  await addTrack.click();
  const instrumentCombobox = page.getByRole("combobox", {
    name: "Instrument",
    exact: true,
  });
  await instrumentCombobox.click();
  const instrumentSearch = page.getByRole("searchbox", {
    name: "Search presets",
  });
  await instrumentSearch.fill("^Flute$");
  await page.getByRole("option", { name: /^Flute/ }).click();
  await expect(page.getByRole("dialog", { name: "Add Track", exact: true })
    .getByLabel("Name", { exact: true })).toHaveValue("Flute");
  await page.getByRole("button", { name: "Create Track", exact: true }).click();

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
  const dialog = page.getByRole("dialog", { name: 'Delete "Flute"?' });
  await expect(dialog).toBeVisible();
  const confirmButton = dialog.getByRole("button", {
    name: "Delete track",
    exact: true,
  });
  await expect(confirmButton).toBeDisabled();
  const confirmation = dialog.getByRole("textbox", {
    name: "Track name confirmation",
  });
  await confirmation.fill("flute");
  await expect(confirmButton).toBeDisabled();
  await confirmation.fill("Flute");
  await expect(confirmButton).toBeEnabled();

  const countBeforeIndexShift = await page.evaluate(() =>
    window.__ALPHATAB_API__.score.tracks.length
  );
  await page.evaluate(() => {
    const { engine } = window.__COTAB_STORE__;
    const yTracks = engine.getScoreMap()?.get("tracks");
    if (!yTracks || typeof yTracks.delete !== "function") {
      throw new Error("Missing Y.Track array");
    }
    engine.localEditYDoc(() => yTracks.delete(0, 1));
  });
  await expect.poll(() => page.evaluate(() =>
    window.__ALPHATAB_API__.score.tracks.length
  )).toBe(countBeforeIndexShift - 1);
  await expect(dialog).toBeVisible();
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();

  await expect.poll(() => page.evaluate(() =>
    window.__ALPHATAB_API__.score.tracks.some((track) => track.name === "Flute")
  )).toBe(false);
});
