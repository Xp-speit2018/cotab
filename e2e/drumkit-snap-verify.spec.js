// @ts-check
/**
 * Verifies that clicking at different Y positions within the drumkit track
 * produces different snap positions. Run with: npx playwright test e2e/drumkit-snap-verify.spec.js
 */
import { test, expect } from "@playwright/test";

async function waitForScore(page) {
  await expect(
    page
      .locator("span.font-mono")
      .filter({ hasText: /\d{2}:\d{2}\s*\/\s*\d{2}:\d{2}/ }),
  ).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(3000);
}

test("drumkit snap grid: 13 Y positions produce distinct snap values", async ({
  page,
}) => {
  await page.goto("/");
  await page.setViewportSize({ width: 1400, height: 900 });
  await waitForScore(page);

  // 3. Scroll viewport right
  await page.evaluate(() => {
    document.querySelector(".at-viewport").scrollLeft = 1000;
  });
  await page.waitForTimeout(1000);

  // 4. Read drumkit grid and bounds
  const gridInfo = await page.evaluate(() => {
    const state = window.__PLAYER_STORE__.getState();
    const bounds = state.trackBounds[5];
    const g = window.__SNAP_GRIDS__?.["5:0"];
    return JSON.stringify({
      bounds,
      grid: g
        ? {
            count: g.positions.length,
            spacing:
              Math.round((g.positions[1].y - g.positions[0].y) * 100) / 100,
            positions: g.positions.map((p) => ({
              s: p.string,
              y: Math.round(p.y * 10) / 10,
            })),
          }
        : null,
    });
  });
  console.log("\n--- Drumkit grid and bounds ---");
  console.log(gridInfo);

  // 5. Get viewport bounding box
  const vpRect = await page.evaluate(() => {
    const rect = document.querySelector(".at-viewport")?.getBoundingClientRect();
    return rect ? JSON.stringify({ x: rect.x, y: rect.y }) : "null";
  });
  console.log("\n--- Viewport rect (x, y) ---");
  console.log(vpRect);

  const vp = JSON.parse(vpRect);
  const gridData = JSON.parse(gridInfo);
  const drumkitY = gridData.bounds?.y ?? 582;
  const drumkitH = gridData.bounds?.height ?? 36;

  // 6. Click at 13 Y positions and record results
  const results = [];
  for (let i = 0; i < 13; i++) {
    const clickY = vp.y + drumkitY + drumkitH * (i / 12);
    const clickX = vp.x + 150;
    const clickOffset = drumkitY + drumkitH * (i / 12);

    await page.mouse.click(clickX, clickY);
    await page.waitForTimeout(400);

    const sel = await page.evaluate(() => {
      const s = window.__PLAYER_STORE__.getState();
      return JSON.stringify({
        trackIndex: s.selectedBeat?.trackIndex,
        string: s.selectedBeat?.string,
      });
    });
    const parsed = JSON.parse(sel);
    results.push({
      click_offset: Math.round(clickOffset * 10) / 10,
      trackIndex: parsed.trackIndex,
      snappedString: parsed.string,
    });
  }

  // 7. Report table
  console.log("\n--- Results table: click_offset | trackIndex | snappedString ---");
  console.log(
    "click_offset | trackIndex | snappedString\n" +
      results.map((r) => `${r.click_offset} | ${r.trackIndex ?? "-"} | ${r.snappedString ?? "-"}`).join("\n")
  );

  // 8. Count unique snapped strings when trackIndex was 5
  const drumkitResults = results.filter((r) => r.trackIndex === 5);
  const uniqueStrings = new Set(
    drumkitResults.map((r) => r.snappedString).filter((s) => s != null)
  );
  const uniqueCount = uniqueStrings.size;
  console.log(`\n--- Unique snapped strings (trackIndex=5): ${uniqueCount} ---`);
  console.log("Values:", [...uniqueStrings].sort((a, b) => a - b));

  // Expect at least 11 distinct positions within the drumkit bar area
  expect(
    uniqueCount,
    `Drumkit should have at least 11 distinct snap positions, got ${uniqueCount}`,
  ).toBeGreaterThanOrEqual(11);

  // Screenshot
  await page.screenshot({
    path: "test-screenshots/drumkit-snap-verify.png",
  });
});
