// @ts-check
import { expect, test } from "@playwright/test";

async function waitForScore(page) {
  await expect.poll(() => page.evaluate(() =>
    window.__ALPHATAB_API__?.boundsLookup?.staffSystems?.length ?? 0,
  )).toBeGreaterThan(0);
}

async function selectFirstMelodicNote(page) {
  await page.evaluate(() => {
    const api = window.__ALPHATAB_API__;
    const store = window.__PLAYER_STORE__;
    const staff = api.score.tracks[0].staves[0];
    const barIndex = staff.bars.findIndex((bar) =>
      bar.voices[0].beats.some((beat) => beat.notes.length > 0));
    const bar = staff.bars[barIndex];
    const beatIndex = bar.voices[0].beats.findIndex(
      (beat) => beat.notes.length > 0,
    );
    const note = bar.voices[0].beats[beatIndex].notes[0];
    store.getState().setSelection({
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      barIndex,
      beatIndex,
      string: note.string,
    });
  });
}

test("tooltips do not block hovering the next editor control", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.goto("/");
  await waitForScore(page);
  await selectFirstMelodicNote(page);

  const bend = page.getByRole("button", { name: "Bend", exact: true });
  const vibrato = page.getByRole("button", { name: "Vibrato", exact: true });
  await bend.hover();
  await expect(page.getByRole("tooltip", { name: "Bend" })).toBeVisible();

  const vibratoBounds = await vibrato.boundingBox();
  expect(vibratoBounds).not.toBeNull();
  await page.mouse.move(
    vibratoBounds.x + vibratoBounds.width / 2,
    vibratoBounds.y + vibratoBounds.height / 2,
  );

  await expect(page.getByRole("tooltip", { name: "Vibrato" })).toBeVisible();
  await expect(page.getByRole("tooltip", { name: "Bend" })).toBeHidden();
});
