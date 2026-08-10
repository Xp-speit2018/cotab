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

  await best.click();
  await expect(nameInput).toHaveValue("C");

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
});
