// @ts-check
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/__ui-harness");
  await expect(page.locator("[data-ui-harness]")).toBeVisible();
});

test("interaction semantics use consistent cursors and states", async ({ page }) => {
  const command = page.getByRole("button", { name: "Settings", exact: true });
  const toggle = page.getByRole("button", { name: "Loop", exact: true });
  const disabled = page.getByRole("button", {
    name: "Disabled command",
    exact: true,
  });
  const link = page.getByRole("link", { name: /alphaTab/ });

  await expect.poll(() => command.evaluate(
    (element) => getComputedStyle(element).cursor,
  )).toBe("default");
  await expect.poll(() => toggle.evaluate(
    (element) => getComputedStyle(element).cursor,
  )).toBe("default");
  await expect.poll(() => disabled.evaluate(
    (element) => getComputedStyle(element).cursor,
  )).toBe("not-allowed");
  await expect.poll(() => link.evaluate(
    (element) => getComputedStyle(element).cursor,
  )).toBe("pointer");

  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  const disclosure = page.getByRole("button", { name: /Instrument/ });
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await disclosure.click();
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
});

test("inline editing has a bounded hit target and loose commit", async ({ page }) => {
  const titleSection = page.locator("[data-interaction='inline-edit']").filter({
    has: page.getByText("Title", { exact: true }),
  });
  const label = titleSection.getByText("Title", { exact: true });
  const field = titleSection.locator("[data-single-line-edit-field]");
  const initialBackground = await titleSection.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );

  await label.hover();
  await expect.poll(() => titleSection.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  )).not.toBe(initialBackground);
  await expect.poll(() => label.evaluate(
    (element) => getComputedStyle(element).cursor,
  )).toBe("default");
  await expect.poll(() => field.evaluate(
    (element) => getComputedStyle(element).cursor,
  )).toBe("text");

  await label.click();
  await expect(titleSection.getByRole("textbox", { name: "Title" })).toHaveCount(0);
  await field.click();
  const input = titleSection.getByRole("textbox", { name: "Title" });
  await input.fill("Harness title committed from the left label");
  await label.click();
  await expect(input).toHaveCount(0);
  await expect(titleSection.locator("[data-single-line-edit-field]"))
    .toContainText("Harness title committed from the left label");
});

test("choice overlays and narrow inspector layout remain usable", async ({ page }) => {
  await page.getByRole("button", { name: /Complex editor Configured/ }).click();
  await expect(page.getByText("Numerator", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 360, height: 760 });
  await expect(page.locator("[data-harness-inspector]")).toBeVisible();
  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )).toBe(true);
});

test("drum kit diagram exposes coherent visual and keyboard states", async ({
  page,
}) => {
  const compact = page.locator("[data-harness-drum-kit-compact]");
  const expanded = page.locator("[data-harness-drum-kit-expanded]");
  const compactDiagram = compact.locator("[data-drum-kit-diagram]");
  const expandedDiagram = expanded.locator("[data-drum-kit-diagram]");

  await expect(compactDiagram).toBeVisible();
  await expect(expandedDiagram).toBeVisible();
  await expect(compactDiagram.locator("[data-drum-zone]")).toHaveCount(9);
  await expect(expandedDiagram.locator("[data-drum-zone]")).toHaveCount(9);
  await expect(compactDiagram.locator("[data-hi-hat-cymbal]")).toHaveCount(2);
  await expect(compactDiagram.locator("[data-hi-hat-clutch]")).toHaveCount(1);
  await expect(compactDiagram.locator("[data-hi-hat-cup]")).toHaveCount(1);
  await expect(compactDiagram.locator("[data-hi-hat-linkage]")).toHaveCount(1);
  await expect(compactDiagram.locator("[data-hi-hat-pedal]")).toHaveCount(1);
  await expect(
    compactDiagram.locator("linearGradient, radialGradient"),
  ).toHaveCount(0);
  await expect(compactDiagram.locator("[data-cymbal-profile]")).toHaveCount(3);
  await expect(compactDiagram.locator("[data-cymbal-bell]")).toHaveCount(3);
  await expect(compactDiagram.locator("[data-cymbal-stand]")).toHaveCount(3);
  await expect(compactDiagram.locator("[data-drum-shell]")).toHaveCount(4);
  await expect(compactDiagram.locator("[data-drum-lug]")).toHaveCount(8);
  await expect(compactDiagram.locator("[data-tom-mount]")).toHaveCount(2);
  await expect(compactDiagram.locator("[data-snare-mechanism]")).toHaveCount(1);
  await expect(compactDiagram.locator("[data-floor-tom-legs]")).toHaveCount(1);
  await expect(compactDiagram.locator("[data-bass-drum-lug]")).toHaveCount(9);
  await expect(compactDiagram.locator("[data-bass-drum-port]")).toHaveCount(1);

  const snare = compact.getByRole("button", { name: /Snare, MIDI 37, 38, 40/ });
  const highTom = compact.getByRole("button", {
    name: /High tom, MIDI 48, 50/,
  });
  const hiHat = compact.getByRole("button", {
    name: /Hi-hat, MIDI 42, 44, 46/,
  });
  const disabledCrash = compact.getByRole("button", {
    name: /Crash R, MIDI 57/,
  });

  await expect(snare).toHaveAttribute("data-selected", "true");
  await expect(hiHat).toHaveAttribute("data-active", "true");
  await expect(disabledCrash).toHaveAttribute("aria-disabled", "true");
  await expect
    .poll(() => highTom.evaluate((element) => getComputedStyle(element).cursor))
    .toBe("default");

  await highTom.click();
  await expect(highTom).toHaveAttribute("data-selected", "true");
  await expect(compact).toContainText("High tom");
  await expect(compact).toContainText("MIDI 48/50");

  await disabledCrash.click({ force: true });
  await expect(disabledCrash).not.toHaveAttribute("data-selected", "true");

  await highTom.focus();
  await expect(highTom).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(highTom).toHaveAttribute("data-selected", "true");

  const compactBox = await compactDiagram.boundingBox();
  const expandedBox = await expandedDiagram.boundingBox();
  expect(compactBox).not.toBeNull();
  expect(expandedBox).not.toBeNull();
  expect(compactBox.width).toBeLessThan(expandedBox.width);
});

test("application menu bar has one geometry and anatomy contract", async ({ page }) => {
  const menuBar = page.locator("[data-harness-menu-bar]");
  const triggers = menuBar.locator("[data-app-menu-trigger]");
  await expect(triggers).toHaveCount(5);

  const triggerStyles = await triggers.evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      height: rect.height,
      fontSize: style.fontSize,
      borderRadius: style.borderRadius,
      transitionDuration: style.transitionDuration,
    };
  }));
  expect(new Set(triggerStyles.map((style) => style.height)).size).toBe(1);
  expect(new Set(triggerStyles.map((style) => style.fontSize)).size).toBe(1);
  expect(new Set(triggerStyles.map((style) => style.borderRadius)).size).toBe(1);
  expect(triggerStyles.every((style) => style.transitionDuration === "0s"))
    .toBe(true);

  const widths = [];
  for (const name of ["File", "Edit", "Layout", "Preferences", "Help"]) {
    await page.getByRole("button", { name, exact: true }).click();
    const content = page.locator("[data-app-menu-content]:visible");
    await expect(content).toBeVisible();
    widths.push(await content.evaluate((element) => element.getBoundingClientRect().width));
    const itemHeights = await content.locator("[data-app-menu-item]")
      .evaluateAll((elements) => elements.map(
        (element) => element.getBoundingClientRect().height,
      ));
    expect(itemHeights.every((height) => height === 32)).toBe(true);
    await page.keyboard.press("Escape");
  }
  expect(new Set(widths).size).toBe(1);

  await page.getByRole("button", { name: "File", exact: true }).click();
  await expect(page.locator("[data-app-menu-panel]:visible"))
    .toContainText("Harness.cotab");
  await expect(page.locator("[data-app-menu-shortcut]:visible"))
    .toHaveText("Ctrl+S");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const editMenu = page.locator("[data-app-menu-content]:visible");
  await expect(editMenu.locator("[data-app-menu-label]")).toHaveText([
    "Beat",
    "Track",
  ]);
  await expect(editMenu.locator("[data-app-menu-separator]"))
    .toHaveCount(2);
  await expect(editMenu.getByRole("menuitem", {
    name: "Insert Rest Before",
    exact: true,
  })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Layout", exact: true }).click();
  await expect(page.locator("[data-app-menu-control]:visible"))
    .toContainText("Zoom");
});

test("application menu choices expose distinct persistent semantics", async ({ page }) => {
  await page.getByRole("button", { name: "Layout", exact: true }).click();
  await expect(page.getByRole("menuitemradio", {
    name: "Parchment layout",
    exact: true,
  })).toBeChecked();
  await page.getByRole("menuitemradio", {
    name: "Horizontal layout",
    exact: true,
  }).click();
  await page.getByRole("button", { name: "Layout", exact: true }).click();
  await expect(page.getByRole("menuitemradio", {
    name: "Horizontal layout",
    exact: true,
  })).toBeChecked();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Preferences", exact: true }).click();
  const autoSave = page.getByRole("menuitemcheckbox", {
    name: "Auto-save",
    exact: true,
  });
  await expect(autoSave).toBeChecked();
  await autoSave.click();
  await expect(autoSave).not.toBeChecked();
  await expect(page.locator("[data-app-menu-content]:visible")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Help", exact: true }).click();
  const projectLink = page.getByRole("menuitem", { name: "Project on GitHub" });
  await expect.poll(() => projectLink.evaluate(
    (element) => getComputedStyle(element).cursor,
  )).toBe("pointer");
});

test("preset menus filter by regex without accepting free-form values", async ({ page }) => {
  const trigger = page.getByRole("combobox", {
    name: "Tuning preset",
    exact: true,
  });
  const heading = page.getByRole("heading", { name: "CoTab UI Harness" });

  await expect(trigger).toContainText("Standard");
  await trigger.click();
  let search = page.getByRole("searchbox", { name: "Search presets" });
  await search.fill("^Drop");
  await expect(page.getByRole("option", { name: "Drop D" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Standard" })).toHaveCount(0);
  await heading.click();
  await expect(trigger).toContainText("Standard");

  await trigger.click();
  search = page.getByRole("searchbox", { name: "Search presets" });
  await search.fill("[");
  await expect(page.getByRole("alert")).toHaveText("Invalid regular expression");
  await heading.click();
  await expect(trigger).toContainText("Standard");

  await trigger.click();
  search = page.getByRole("searchbox", { name: "Search presets" });
  await search.fill("Drop D");
  await heading.click();
  await expect(trigger).toContainText("Drop D");

  await trigger.click();
  search = page.getByRole("searchbox", { name: "Search presets" });
  await search.fill("^DAD");
  await page.getByRole("option", { name: "DADGAD" }).click();
  await expect(trigger).toContainText("DADGAD");
});

test("preset keyboard navigation keeps the active option visible", async ({ page }) => {
  const editor = page.locator("[data-harness-chord-editor]");
  await editor.getByRole("combobox", { name: "Root note" }).click();

  const search = page.getByRole("searchbox", { name: "Search presets" });
  const listbox = page.getByRole("listbox", { name: "Root note" });
  for (let index = 0; index < 12; index += 1) {
    await search.press("ArrowDown");
  }

  const activeOptionId = await search.getAttribute("aria-activedescendant");
  expect(activeOptionId).not.toBeNull();
  const activeOption = page.locator(`[id="${activeOptionId}"]`);
  await expect(activeOption).toHaveText("B");
  await expect.poll(() => listbox.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect.poll(async () => {
    const [listboxBounds, optionBounds] = await Promise.all([
      listbox.boundingBox(),
      activeOption.boundingBox(),
    ]);
    if (!listboxBounds || !optionBounds) return false;
    return optionBounds.y >= listboxBounds.y
      && optionBounds.y + optionBounds.height <= listboxBounds.y + listboxBounds.height;
  }).toBe(true);
});

test("preset popovers scroll their options with the mouse wheel", async ({ page }) => {
  const editor = page.locator("[data-harness-chord-editor]");
  await editor.getByRole("combobox", { name: "Root note" }).click();

  const search = page.getByRole("searchbox", { name: "Search presets" });
  const listbox = page.getByRole("listbox", { name: "Root note" });
  await expect.poll(() => listbox.evaluate(
    (element) => element.scrollHeight > element.clientHeight,
  )).toBe(true);

  await search.hover();
  await page.mouse.wheel(0, 160);
  await expect.poll(() => listbox.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

test("chord editor sections follow one hierarchy and explain their roles", async ({ page }) => {
  const editor = page.locator("[data-harness-chord-editor]");
  const sections = editor.locator("[data-chord-section]");
  await expect(sections).toHaveCount(5);
  expect(await sections.evaluateAll((elements) => elements.map(
    (element) => element.getAttribute("data-chord-section"),
  ))).toEqual([
    "fretboard",
    "composition",
    "recognition",
    "voicings",
    "score-display",
  ]);

  const recognition = editor.locator('[data-chord-section="recognition"]');
  const voicings = editor.locator('[data-chord-section="voicings"]');
  const [recognitionBounds, voicingBounds] = await Promise.all([
    recognition.boundingBox(),
    voicings.boundingBox(),
  ]);
  expect(recognitionBounds).not.toBeNull();
  expect(voicingBounds).not.toBeNull();
  expect(Math.abs(recognitionBounds.y - voicingBounds.y)).toBeLessThanOrEqual(1);
  expect(voicingBounds.x).toBeGreaterThan(recognitionBounds.x);

  for (const help of [
    "Choose which strings sound and select frets. Labels can show note names or intervals.",
    "Choose the root, bass, and chord tones. Changes update the chord and recommendations.",
    "Ranks chord names that match the notes selected on the fretboard.",
    "Compares playable shapes for this chord. Density favors fewer or more sounding strings.",
    "Controls how the chord name and diagram appear in the score.",
  ]) {
    await editor.getByRole("button", { name: help, exact: true }).hover();
    await expect(page.getByRole("tooltip", { name: help, exact: true })).toBeVisible();
  }
  await expect(editor.getByText("Score display", { exact: true })).toBeVisible();
  await expect(editor.getByText("Fingering recommendations", { exact: true })).toBeVisible();
  await expect(editor.locator(
    '[data-chord-section="composition"] [data-chord-section-title]',
  )).toHaveText("Chord structure");
  const rootControl = editor.locator("[data-chord-root-control]");
  await expect(rootControl).toContainText("Root");
  await expect(rootControl.getByRole("combobox", { name: "Root note" })).toBeVisible();
});

test("interactive fretboard suggests a chord without committing it", async ({ page }) => {
  const editor = page.locator("[data-harness-chord-editor]");
  for (const name of [
    "String 1, Open",
    "String 2, Fret 1",
    "String 3, Open",
    "String 4, Fret 2",
    "String 5, Fret 3",
  ]) {
    await editor.getByRole("button", { name, exact: true }).click();
  }

  const best = editor.locator("[data-chord-candidates]")
    .getByRole("button")
    .first();
  await expect(best).toContainText("C");
  await expect(best).toContainText("Recommended");
  const nameInput = editor.getByRole("textbox", { name: "Name", exact: true });
  await expect(nameInput).toHaveValue("");

  await expect(editor.getByRole("button", {
    name: "String 4, Fret 2",
    exact: true,
  })).toContainText("E");
  await editor.getByRole("button", { name: "Intervals", exact: true }).click();
  await expect(editor.getByRole("button", {
    name: "String 4, Fret 2",
    exact: true,
  })).toContainText("3");

  const composition = editor.locator("[data-chord-composition]");
  await expect(editor.getByText("Chord structure", { exact: true })).toBeVisible();
  await expect(composition.locator(
    "[data-chord-option][data-chord-function='root'][data-selected='true']",
  )).toHaveText("1");
  await expect(composition.locator(
    "[data-chord-option][data-chord-function='third'][data-selected='true']",
  )).toHaveText("3");
  await expect(composition.locator(
    "[data-chord-option][data-chord-function='fifth'][data-selected='true']",
  )).toHaveText("5");
  await expect(editor.locator("[data-chord-function-legend]")).toContainText("Root");

  const voicingSection = editor.locator("[data-chord-voicings]");
  const voicingCards = voicingSection.locator("[data-voicing-family]");
  await expect(voicingCards).toHaveCount(4);
  const families = await voicingCards.evaluateAll((cards) => cards.map(
    (card) => card.getAttribute("data-voicing-family"),
  ));
  expect(new Set(families).size).toBe(families.length);
  await expect(voicingSection).toContainText("Open");
  await expect(voicingSection).toContainText("Movable");
  await expect(voicingSection.locator('[data-voicing-family="open:open"]'))
    .toContainText("Root on string 5");

  await voicingSection.getByRole("radio", { name: "Compact" }).click();
  await expect(voicingSection.locator('[data-voicing-family="open:open"]'))
    .toContainText("3 strings");
  await voicingSection.getByRole("radio", { name: "Full" }).click();
  await expect(voicingSection).toContainText("6 strings");
  await voicingSection.getByRole("radio", { name: "Balanced" }).click();

  await best.click();
  await expect(nameInput).toHaveValue("C");
  const selectedStyle = await voicingSection.getByRole("radio", { name: "Balanced" })
    .evaluate((element) => ({
      backgroundColor: getComputedStyle(element).backgroundColor,
      borderColor: getComputedStyle(element).borderColor,
    }));
  for (const selectedControl of [
    best,
    voicingSection.locator("[data-voicing-family][aria-pressed='true']"),
    composition.locator("[data-chord-bass] [aria-pressed='true']"),
    editor.getByLabel("Show name in score"),
  ]) {
    await expect.poll(() => selectedControl.evaluate((element) => ({
      backgroundColor: getComputedStyle(element).backgroundColor,
      borderColor: getComputedStyle(element).borderColor,
    }))).toEqual(selectedStyle);
  }

  const marker = editor.getByRole("button", {
    name: "String 4, Fret 2",
    exact: true,
  })
    .locator("[data-fret-marker]");
  const stringLine = editor.locator("[data-string-line='4']");
  const [markerBox, lineBox] = await Promise.all([
    marker.boundingBox(),
    stringLine.boundingBox(),
  ]);
  expect(markerBox).not.toBeNull();
  expect(lineBox).not.toBeNull();
  expect(Math.abs(
    markerBox.y + markerBox.height / 2 - (lineBox.y + lineBox.height / 2),
  )).toBeLessThanOrEqual(1);

  const [firstStringBox, lastStringBox, fretLineBox] = await Promise.all([
    editor.locator("[data-string-line='1']").boundingBox(),
    editor.locator("[data-string-line='6']").boundingBox(),
    editor.locator("[data-fret-line='1']").boundingBox(),
  ]);
  expect(firstStringBox).not.toBeNull();
  expect(lastStringBox).not.toBeNull();
  expect(fretLineBox).not.toBeNull();
  expect(Math.abs(
    fretLineBox.y - (firstStringBox.y + firstStringBox.height / 2),
  )).toBeLessThanOrEqual(1);
  expect(Math.abs(
    fretLineBox.y + fretLineBox.height
      - (lastStringBox.y + lastStringBox.height / 2),
  )).toBeLessThanOrEqual(1);

  await editor.getByRole("combobox", { name: "Root note" }).click();
  await page.getByRole("option", { name: "F", exact: true }).click();
  await composition.locator("[data-tone='3']").click();
  await expect(nameInput).toHaveValue("F5");
  await expect(editor.locator("[data-chord-voicings]")).toBeVisible();
  await expect(editor.locator("[data-chord-candidates]")).toContainText("F5");

  const extendedFretboard = editor.locator("[data-interactive-fretboard]");
  const defaultScrollWidth = await extendedFretboard.evaluate((element) => element.scrollWidth);
  await editor.getByRole("spinbutton", { name: "First fret" }).fill("5");
  await expect(extendedFretboard).toHaveAttribute("data-last-displayed-fret", "15");
  await expect(editor.getByRole("button", {
    name: "String 1, Fret 1",
    exact: true,
  })).toBeVisible();
  await expect(editor.getByRole("button", {
    name: "String 1, Fret 16",
    exact: true,
  })).toHaveCount(0);
  await expect.poll(() => extendedFretboard.evaluate((element) => element.scrollWidth))
    .toBe(defaultScrollWidth);

  await editor.getByRole("spinbutton", { name: "First fret" }).fill("13");
  await expect(extendedFretboard).toHaveAttribute("data-last-displayed-fret", "17");
  await expect(editor.getByRole("button", {
    name: "String 1, Fret 17",
    exact: true,
  })).toBeAttached();
  await expect.poll(() => extendedFretboard.evaluate(
    (element, baseline) => element.scrollWidth > baseline,
    defaultScrollWidth,
  )).toBe(true);
  await extendedFretboard.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  await expect.poll(() => extendedFretboard.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
});
