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

async function clickAndWaitForRender(page, locator) {
  const renderFinished = page.evaluate(() => new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      unsubscribe();
      reject(new Error("Timed out waiting for AlphaTab render"));
    }, 5_000);
    const unsubscribe = window.__ALPHATAB_API__.postRenderFinished.on(() => {
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(undefined);
    });
  }));
  await locator.click();
  await renderFinished;
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
  await clickAndWaitForRender(page, page.getByRole("button", {
    name: "Standard notation",
    exact: true,
  }));
  await expect.poll(() => page.evaluate(() =>
    window.__ALPHATAB_API__.score.tracks[0].staves[0].showStandardNotation,
  )).toBe(true);
  await page.getByRole("button", { name: "Notes", exact: true }).click();
}

test("complex field editors commit semantic values and show matching summaries", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.goto("/");
  await waitForScore(page);
  await selectFirstMelodicNote(page);

  await clickAndWaitForRender(page, page.getByRole("button", {
    name: "Left-hand finger",
    exact: true,
  }));
  await page.getByRole("combobox", { name: "Left-hand finger" }).click();
  await clickAndWaitForRender(
    page,
    page.getByRole("option", { name: "Middle", exact: true }),
  );
  await expect.poll(() => page.evaluate(() => {
    const state = window.__PLAYER_STORE__.getState();
    const note = state.selectedBeatInfo?.notes[state.selectedNoteIndex];
    return note?.leftHandFinger;
  })).toBe(2);

  await clickAndWaitForRender(page, page.getByRole("button", {
    name: "Pick Stroke Up",
    exact: true,
  }));
  await expect.poll(() => page.evaluate(() =>
    window.__PLAYER_STORE__.getState().selectedBeatInfo?.pickStroke,
  )).toBe(1);

  await page.getByRole("button", { name: /^Lyrics / }).click();
  let editor = page.getByRole("dialog").filter({ hasText: "Lyrics" });
  await editor.getByLabel("Lyrics").fill("Lead\nHarmony");
  await editor.getByRole("button", { name: "Apply", exact: true }).click();
  await expect.poll(() => page.evaluate(() =>
    window.__PLAYER_STORE__.getState().selectedBeatInfo?.lyrics,
  )).toEqual(["Lead", "Harmony"]);

  const initialPlaybackChangeCount = await page.evaluate(() =>
    window.__PLAYER_STORE__.getState().selectedBeatInfo?.automations.length ?? 0,
  );
  const playbackChanges = page.getByRole("button", {
    name: /^Playback Changes /,
  });
  await playbackChanges.click();
  editor = page.getByRole("dialog").filter({ hasText: "Playback Changes" });
  await editor.getByRole("button", { name: "Add playback change" }).click();
  const addedPlaybackChangeIndex = initialPlaybackChangeCount + 1;
  await editor.getByLabel(`Value (0-16) ${addedPlaybackChangeIndex}`).fill("11.5");
  await editor.getByRole("button", { name: "Apply", exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const automations = window.__PLAYER_STORE__.getState()
      .selectedBeatInfo?.automations;
    const volume = automations?.find((automation) => automation.type === 1);
    return {
      count: automations?.length,
      volume: volume?.value,
    };
  })).toEqual({
    count: initialPlaybackChangeCount + 1,
    volume: 11.5,
  });
  await expect(playbackChanges).toContainText("Volume");

  await page.getByRole("button", { name: "Trill", exact: true }).click();
  const trillRow = page.getByRole("button", { name: /Trill.*Fret/ });
  await expect(trillRow).toBeVisible();
  await trillRow.click();
  editor = page.getByRole("dialog");
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
  await clickAndWaitForRender(
    page,
    page.getByRole("option", { name: "Lower Mordent", exact: true }),
  );
  await expect.poll(() => page.evaluate(() => {
    const state = window.__PLAYER_STORE__.getState();
    return state.selectedBeatInfo?.notes[state.selectedNoteIndex]?.ornament;
  })).toBe(4);

  await page.getByRole("button", { name: "Beat Vibrato", exact: true }).click();
  await page.getByRole("combobox", { name: "Beat Vibrato" }).click();
  await clickAndWaitForRender(
    page,
    page.getByRole("option", { name: "Wide", exact: true }),
  );
  await expect.poll(() => page.evaluate(() =>
    window.__PLAYER_STORE__.getState().selectedBeatInfo?.vibrato,
  )).toBe(2);

  await clickAndWaitForRender(
    page,
    page.getByRole("button", { name: "Whammy Bar", exact: true }),
  );
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

  await clickAndWaitForRender(
    page,
    page.getByRole("button", { name: "Repeat End", exact: true }),
  );
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

  const initialTempoCount = await page.evaluate(() =>
    window.__PLAYER_STORE__.getState().selectedMasterBarInfo
      ?.tempoAutomations.length ?? 0,
  );
  const tempoChanges = page.getByRole("button", {
    name: /^Tempo Points in Bar /,
  });
  await tempoChanges.click();
  editor = page.getByRole("dialog").filter({ hasText: "Tempo Points in Bar" });
  await editor.getByRole("button", { name: "Add tempo change" }).click();
  const addedTempoIndex = initialTempoCount + 1;
  await editor.getByLabel(`Tempo (BPM) ${addedTempoIndex}`).fill("96");
  await editor.getByLabel(`Tempo instruction ${addedTempoIndex}`).fill("rit.");
  await editor.getByLabel(
    `Position in bar ${addedTempoIndex}`,
    { exact: true },
  ).fill("50");
  await editor.getByRole("button", { name: "Apply", exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const automations = window.__PLAYER_STORE__.getState()
      .selectedMasterBarInfo?.tempoAutomations;
    const added = automations?.find((automation) => automation.text === "rit.");
    return {
      count: automations?.length,
      added: added
        ? [added.value, added.ratioPosition, added.text]
        : null,
    };
  })).toEqual({
    count: initialTempoCount + 1,
    added: [96, 0.5, "rit."],
  });
  await expect(tempoChanges).toContainText(`${initialTempoCount + 1} changes`);

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

  await enableFirstStaffStandardNotation(page);
  await page.getByRole("combobox", { name: "Accidental" }).click();
  await clickAndWaitForRender(
    page,
    page.getByRole("option", { name: "Flat", exact: true }),
  );
  await expect.poll(() => page.evaluate(() => {
    const state = window.__PLAYER_STORE__.getState();
    return state.selectedBeatInfo?.notes[state.selectedNoteIndex]
      ?.accidentalMode;
  })).toBe(5);

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

  await page.getByRole("button", { name: "Meta", exact: true }).click();
  const instructions = page.getByRole("button", { name: /^Instructions / });
  await instructions.click();
  editor = page.getByRole("dialog").filter({ hasText: "Instructions" });
  await editor.getByLabel("Instructions").fill("Play softly.\nLet the final chord ring.");
  await editor.getByRole("button", { name: "Apply", exact: true }).click();
  await expect.poll(() => page.evaluate(() =>
    window.__PLAYER_STORE__.getState().scoreInstructions,
  )).toBe("Play softly.\nLet the final chord ring.");
  await expect(instructions).toContainText("Play softly. Let the final chord ring.");

  await page.getByRole("button", {
    name: "Toggle Lead Guitar details",
    exact: true,
  }).click();
  await page.getByRole("button", { name: /^Track color / }).click();
  await page.getByLabel("Custom color").fill("#336699");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const color = window.__ALPHATAB_API__.score.tracks[0].color;
    return [color.r, color.g, color.b];
  })).toEqual([51, 102, 153]);
  const instrument = page.getByRole("button", { name: /^Instrument / }).first();
  await instrument.click();
  editor = page.getByRole("dialog").filter({ hasText: "Instrument" });
  await editor.getByLabel("Search instruments").fill("distortion guitar");
  await editor.getByRole("button", {
    name: "Distortion Guitar",
    exact: true,
  }).click();
  await editor.getByLabel("Sound bank").fill("2");
  await editor.getByRole("button", { name: "Apply", exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const info = window.__PLAYER_STORE__.getState().tracks[0]?.playbackInfo;
    return info ? [info.program, info.bank] : null;
  })).toEqual([30, 2]);
  await expect(instrument).toContainText("Distortion Guitar · Sound bank 2");

  await page.getByRole("button", {
    name: "Toggle Drumkit details",
    exact: true,
  }).click();
  const percussionMap = page.getByRole("button", {
    name: /^Percussion Map /,
  });
  await percussionMap.click();
  editor = page.getByRole("dialog").filter({ hasText: "Percussion Map" });
  await editor.getByLabel("Search articulations or drum sounds").fill("snare");
  await editor.getByLabel("Snare · hit", { exact: true }).fill("40");
  await expect(
    editor.getByText("Electric Snare", { exact: true }).first(),
  ).toBeVisible();
  await editor.getByRole("button", { name: "Apply", exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const drumTrack = window.__PLAYER_STORE__.getState().tracks
      .find((track) => track.isPercussion);
    return drumTrack?.percussionArticulations
      .find((articulation) => articulation.id === 38)?.outputMidiNumber;
  })).toBe(40);
});
