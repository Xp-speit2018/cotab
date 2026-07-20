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
}

test("complex field editors commit semantic values and show matching summaries", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.goto("/");
  await waitForScore(page);
  await selectFirstMelodicNote(page);

  await page.getByRole("button", { name: "Trill", exact: true }).click();
  const trillRow = page.getByRole("button", { name: /Trill.*Fret/ });
  await expect(trillRow).toBeVisible();
  await trillRow.click();
  let editor = page.getByRole("dialog");
  await editor.getByLabel("Alternate fret").fill("14");
  await editor.getByRole("button", {
    name: "Thirty-second Note",
    exact: true,
  }).click();
  await editor.getByRole("button", { name: "Apply", exact: true }).click();

  await expect.poll(() => page.evaluate(() => {
    const state = window.__PLAYER_STORE__.getState();
    return state.selectedBeatInfo?.notes[state.selectedNoteIndex]?.trillValue;
  })).toBe(14);
  await expect(trillRow).toContainText("32");

  await page.getByRole("button", { name: "Harmonics", exact: true }).click();
  const harmonicRow = page.getByRole("button", { name: /Harmonic.*Natural/ });
  await expect(harmonicRow).toBeVisible();
  await harmonicRow.click();
  editor = page.getByRole("dialog");
  await editor.getByRole("button", { name: "Artificial", exact: true }).click();
  await editor.getByLabel("Harmonic Value").fill("12");
  await editor.getByRole("button", { name: "Apply", exact: true }).click();

  await expect.poll(() => page.evaluate(() => {
    const state = window.__PLAYER_STORE__.getState();
    const note = state.selectedBeatInfo?.notes[state.selectedNoteIndex];
    return note ? [note.harmonicType, note.harmonicValue] : null;
  })).toEqual([2, 12]);
  await expect(page.getByRole("button", {
    name: /Harmonic.*Artificial.*12/,
  })).toBeVisible();

  await page.getByRole("button", { name: "Slide Out", exact: true }).click();
  await page.getByRole("combobox", { name: "Slide Out" }).click();
  await page.getByRole("option", { name: "Pick Slide Up", exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const state = window.__PLAYER_STORE__.getState();
    return state.selectedBeatInfo?.notes[state.selectedNoteIndex]?.slideOutType;
  })).toBe(6);

  await page.getByRole("button", { name: "Ornament", exact: true }).click();
  await page.getByRole("combobox", { name: "Ornament" }).click();
  await page.getByRole("option", { name: "Lower Mordent", exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const state = window.__PLAYER_STORE__.getState();
    return state.selectedBeatInfo?.notes[state.selectedNoteIndex]?.ornament;
  })).toBe(4);

  await page.getByRole("button", { name: "Beat Vibrato", exact: true }).click();
  await page.getByRole("combobox", { name: "Beat Vibrato" }).click();
  await page.getByRole("option", { name: "Wide", exact: true }).click();
  await expect.poll(() => page.evaluate(() =>
    window.__PLAYER_STORE__.getState().selectedBeatInfo?.vibrato,
  )).toBe(2);

  await page.getByRole("button", { name: "Bend", exact: true }).click();
  const bendRow = page.getByRole("button", { name: /Bend.*\+1 tones/ });
  await expect(bendRow).toBeVisible();
  await bendRow.click();
  editor = page.getByRole("dialog");
  await editor.getByRole("slider", { name: "Curve point 2" }).click();
  await editor.getByLabel("Pitch (tones)").fill("1.5");
  await editor.getByRole("radio", { name: "Gradual", exact: true }).click();

  await expect.poll(() => page.evaluate(() => {
    const state = window.__PLAYER_STORE__.getState();
    const note = state.selectedBeatInfo?.notes[state.selectedNoteIndex];
    return note?.bendPoints?.at(-1)?.value;
  })).toBe(4);

  await editor.getByRole("button", { name: "Apply", exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const state = window.__PLAYER_STORE__.getState();
    const note = state.selectedBeatInfo?.notes[state.selectedNoteIndex];
    return note
      ? [note.bendStyle, note.bendPoints?.at(-1)?.value]
      : null;
  })).toEqual([1, 6]);
  await expect(page.getByRole("button", {
    name: /Bend.*\+1\.5 tones/,
  })).toBeVisible();

  await page.getByRole("button", { name: "Whammy Bar", exact: true }).click();
  const whammyRow = page.getByRole("button", {
    name: /Whammy Bar.*Dive.*-1 tones/,
  });
  await expect(whammyRow).toBeVisible();
  await whammyRow.click();
  editor = page.getByRole("dialog");
  await editor.getByRole("combobox").click();
  await page.getByRole("option", { name: "Dip", exact: true }).click();
  await editor.getByRole("button", { name: "Apply", exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const effect = window.__PLAYER_STORE__.getState().selectedBeatInfo;
    return effect
      ? [effect.whammyBarType, effect.whammyBarPoints?.length]
      : null;
  })).toEqual([3, 3]);

  const alternateEndings = page.getByRole("button", {
    name: /Alt\. Endings/,
  });
  await alternateEndings.click();
  editor = page.getByRole("dialog");
  const clear = editor.getByRole("button", { name: "Clear", exact: true });
  if (await clear.isEnabled()) await clear.click();
  await editor.getByRole("button", { name: "1", exact: true }).click();
  await editor.getByRole("button", { name: "3", exact: true }).click();
  await expect.poll(() => page.evaluate(() =>
    window.__PLAYER_STORE__.getState().selectedMasterBarInfo?.alternateEndings,
  )).toBe(5);
  await page.keyboard.press("Escape");
  await expect(alternateEndings).toContainText("1, 3");

  const timeSignature = page.getByRole("button", {
    name: /Time Signature/,
  });
  await timeSignature.click();
  editor = page.getByRole("dialog").filter({ hasText: "Time Signature" });
  await editor.getByRole("button", { name: "7/8", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect.poll(() => page.evaluate(() => {
    const masterBar = window.__PLAYER_STORE__.getState().selectedMasterBarInfo;
    return masterBar
      ? [masterBar.timeSignatureNumerator, masterBar.timeSignatureDenominator]
      : null;
  })).toEqual([7, 8]);
  await expect(timeSignature).toContainText("7/8");

  const section = page.getByRole("button", { name: /^Section / });
  await section.click();
  editor = page.getByRole("dialog").filter({
    hasText: "Edit the section name",
  });
  await editor.getByLabel("Name").fill("Bridge");
  await editor.getByLabel("Marker").fill("B");
  await editor.getByRole("button", { name: "Apply", exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const masterBar = window.__PLAYER_STORE__.getState().selectedMasterBarInfo;
    return masterBar ? [masterBar.sectionText, masterBar.sectionMarker] : null;
  })).toEqual(["Bridge", "B"]);
  await expect(section).toContainText("B · Bridge");

  const keySignature = page.getByRole("button", { name: /^Key / });
  await keySignature.click();
  editor = page.getByRole("dialog");
  await editor.getByRole("radio", { name: "Minor", exact: true }).click();
  await editor.getByRole("button", { name: "D♯m", exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const bar = window.__PLAYER_STORE__.getState().selectedBarInfo;
    return bar ? [bar.keySignature, bar.keySignatureType] : null;
  })).toEqual([6, 1]);
  await expect(keySignature).toContainText("D♯m");
});
