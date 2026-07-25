// @ts-check
import { expect, test } from "@playwright/test";

test("shows and edits the complete Taijin Kyofusho tempo map", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await expect.poll(() => page.evaluate(() =>
    window.__PLAYER_STORE__?.getState().scoreMasterBarCount ?? 0,
  )).toBe(58);

  await expect.poll(() => page.evaluate(() =>
    window.__PLAYER_STORE__.getState().scoreTempoMap.map((entry) => [
      entry.masterBarIndex,
      entry.automations[0]?.value,
    ]),
  )).toEqual([
    [0, 70],
    [8, 70],
    [16, 75],
    [24, 78],
    [32, 80],
    [40, 82],
    [48, 85],
  ]);

  await page.getByRole("button", { name: "Meta", exact: true }).click();
  const tempoMap = page.getByRole("button", { name: /^Tempo Map / });
  await expect(tempoMap).toContainText("7 points · 70–85 BPM");
  await expect(page.getByText("Initial Tempo", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Initial Tempo Label", { exact: true }))
    .toHaveCount(0);
  await tempoMap.click();

  const dialog = page.getByRole("dialog").filter({ hasText: "Tempo Map" });
  await expect(dialog.getByLabel("Bar 1", { exact: true })).toHaveValue("1");
  await expect(dialog.getByLabel("Bar 2", { exact: true })).toHaveValue("9");
  await expect(dialog.getByLabel("Bar 7", { exact: true })).toHaveValue("49");
  await expect(dialog.getByLabel("Tempo (BPM) 7", { exact: true }))
    .toHaveValue("85");

  await dialog.getByLabel("Tempo (BPM) 7", { exact: true }).fill("86");
  await dialog.getByRole("button", { name: "Add tempo point" }).click();
  await expect(dialog.getByLabel("Bar 8", { exact: true })).toHaveValue("50");
  await expect(dialog.getByLabel("Tempo (BPM) 8", { exact: true }))
    .toHaveValue("86");
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();

  await expect.poll(() => page.evaluate(() => ({
    values: [
      window.__ALPHATAB_API__.score.masterBars[48].tempoAutomations[0]?.value,
      window.__ALPHATAB_API__.score.masterBars[49].tempoAutomations[0]?.value,
    ],
    pointCount: window.__PLAYER_STORE__.getState().scoreTempoMap
      .reduce((count, entry) => count + entry.automations.length, 0),
  }))).toEqual({ values: [86, 86], pointCount: 8 });
  await expect(tempoMap).toContainText("8 points · 70–86 BPM");
});
