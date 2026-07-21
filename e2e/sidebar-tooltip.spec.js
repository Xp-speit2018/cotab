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
  await expect.poll(() => page.evaluate(() =>
    window.__PLAYER_STORE__.getState().selectedNoteIndex,
  )).toBeGreaterThanOrEqual(0);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() =>
      requestAnimationFrame(resolve)));
  });
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

test("tooltips do not block hovering the next editor control", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.goto("/");
  await waitForScore(page);
  await selectFirstMelodicNote(page);

  const first = page.getByRole("button", {
    name: "Hammer-on / Pull-off",
    exact: true,
  });
  const next = page.getByRole("button", { name: "Left-hand Tap", exact: true });
  await first.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await page.mouse.move(1000, 500);
  const firstBounds = await first.boundingBox();
  expect(firstBounds).not.toBeNull();
  await page.mouse.move(
    firstBounds.x + firstBounds.width / 2,
    firstBounds.y + firstBounds.height / 2,
    { steps: 10 },
  );
  await expect(page.getByRole("tooltip", { name: "Hammer-on / Pull-off" }))
    .toBeVisible();

  const nextBounds = await next.boundingBox();
  expect(nextBounds).not.toBeNull();
  await page.mouse.move(
    nextBounds.x + nextBounds.width / 2,
    nextBounds.y + nextBounds.height / 2,
    { steps: 4 },
  );

  await expect(page.getByRole("tooltip", { name: "Left-hand Tap" })).toBeVisible();
  await expect(page.getByRole("tooltip", { name: "Hammer-on / Pull-off" }))
    .toBeHidden();
});

test("toggle state emphasizes the symbol without drawing a backdrop", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.goto("/");
  await waitForScore(page);
  await selectFirstMelodicNote(page);

  const selected = page.getByRole("button", { name: "Quarter Note", exact: true });
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  const selectedStyle = await selected.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    scale: getComputedStyle(element.firstElementChild).scale,
  }));
  expect(selectedStyle.background).toBe("rgba(0, 0, 0, 0)");
  expect(Number(selectedStyle.scale)).toBeGreaterThan(1);

  const inactive = page.getByRole("button", {
    name: "Hammer-on / Pull-off",
    exact: true,
  });
  await inactive.evaluate((element) => element.scrollIntoView({ block: "center" }));
  const colorBeforeHover = await inactive.evaluate(
    (element) => getComputedStyle(element).color,
  );
  await inactive.hover();
  await expect.poll(() => inactive.evaluate(
    (element) => getComputedStyle(element).color,
  )).not.toBe(colorBeforeHover);
  const hoverStyle = await inactive.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    color: getComputedStyle(element).color,
    scale: getComputedStyle(element.firstElementChild).scale,
  }));
  expect(hoverStyle.background).toBe("rgba(0, 0, 0, 0)");
  expect(Number(hoverStyle.scale)).toBeGreaterThan(1);
});

test("selected note identity is hidden and dynamics are beat-scoped", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.goto("/");
  await waitForScore(page);
  await selectFirstMelodicNote(page);

  for (const label of ["Fret", "String"]) {
    await expect(page.getByText(label, { exact: true })).toHaveCount(0);
  }
  await expect(page.getByText("Note dynamics", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Dynamics", { exact: true })).toHaveCount(1);
});

test("standard notation fields follow the selected staff visibility", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.goto("/");
  await waitForScore(page);
  await selectFirstMelodicNote(page);

  await expect(page.getByRole("combobox", { name: "Clef" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Key / })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Accidental" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Simile" })).toBeVisible();

  await enableFirstStaffStandardNotation(page);

  await expect(page.getByRole("combobox", { name: "Clef" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Key / })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accidental" })).toBeVisible();
});

test("optional parameterized fields reveal details only after activation", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await page.goto("/");
  await waitForScore(page);
  await selectFirstMelodicNote(page);
  await enableFirstStaffStandardNotation(page);

  const optionalFields = [
    "Repeat Count",
    "Alt. Endings",
    "Triplet Feel",
    "Clef Ottava",
    "Simile",
    "Tuplet",
    "Left-hand finger",
    "Rasgueado",
    "Ottava",
  ];
  for (const label of optionalFields) {
    await expect(page.getByText(label, { exact: true })).toHaveCount(0);
  }

  const activations = [
    ["Repeat End", "Repeat Count"],
    ["Triplet Feel", "Triplet Feel"],
    ["Clef Ottava", "Clef Ottava"],
    ["Simile", "Simile"],
    ["Tuplet", "Tuplet"],
    ["Left-hand finger", "Left-hand finger"],
    ["Rasgueado", "Rasgueado"],
    ["Ottava", "Ottava"],
  ];
  for (const [buttonName, detailLabel] of activations) {
    await page.getByRole("button", { name: buttonName, exact: true }).click();
    await expect(page.getByText(detailLabel, { exact: true })).toBeVisible();
  }
  await expect(page.getByText("Alt. Endings", { exact: true })).toBeVisible();

  for (const [buttonName, detailLabel] of [...activations].reverse()) {
    await page.getByRole("button", { name: buttonName, exact: true }).click();
    await expect(page.getByText(detailLabel, { exact: true })).toHaveCount(0);
  }
  await expect(page.getByText("Alt. Endings", { exact: true })).toHaveCount(0);
});

test("articulations are visible only for percussion tracks", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.goto("/");
  await waitForScore(page);
  await selectFirstMelodicNote(page);

  await expect(page.getByText("Articulations", { exact: true })).toHaveCount(0);

  await page.evaluate(() => {
    const api = window.__ALPHATAB_API__;
    const store = window.__PLAYER_STORE__;
    const trackIndex = api.score.tracks.findIndex((track) =>
      track.staves.some((staff) => staff.isPercussion));
    const staff = api.score.tracks[trackIndex].staves[0];
    const barIndex = staff.bars.findIndex((bar) =>
      bar.voices[0].beats.some((beat) => beat.notes.length > 0));
    const bar = staff.bars[barIndex];
    const beatIndex = bar.voices[0].beats.findIndex(
      (beat) => beat.notes.length > 0,
    );
    const note = bar.voices[0].beats[beatIndex].notes[0];
    store.getState().setSelection({
      trackIndex,
      staffIndex: 0,
      voiceIndex: 0,
      barIndex,
      beatIndex,
      string: note.string,
    });
  });

  await expect(page.getByText("Articulations", { exact: true })).toBeVisible();
});

test("playing techniques use distinct notation symbols", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.goto("/");
  await waitForScore(page);
  await selectFirstMelodicNote(page);

  await expect(page.getByRole("button", { name: "Bend", exact: true }).locator("svg"))
    .toBeVisible();
  await expect(page.getByRole("button", { name: "Slide In", exact: true })
    .locator('[data-notation-icon="slide-in"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Slide Out", exact: true })
    .locator('[data-notation-icon="slide-out"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Pick Stroke Up", exact: true })
    .locator('[data-music-glyph="E612"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Pick Stroke Down", exact: true })
    .locator('[data-music-glyph="E610"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Crescendo", exact: true })
    .locator('[data-music-glyph="E53E"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Decrescendo", exact: true })
    .locator('[data-music-glyph="E53F"]')).toBeVisible();
});
