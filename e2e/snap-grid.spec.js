// @ts-check
import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, "../test-screenshots");

async function waitForScore(page) {
  await expect(
    page
      .locator("span.font-mono")
      .filter({ hasText: /\d{2}:\d{2}\s*\/\s*\d{2}:\d{2}/ }),
  ).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(2500);
}

test.describe("Snap Grid — position counts and spacing", () => {
  test("snap grid has correct positions for tab and notation tracks", async ({
    page,
  }) => {
    await page.goto("/");
    await page.setViewportSize({ width: 1400, height: 900 });
    await waitForScore(page);

    // Read snap grids + track info from the store
    const data = await page.evaluate(() => {
      const state = window.__PLAYER_STORE__.getState();
      const grids = window.__SNAP_GRIDS__;
      const api = window.__ALPHATAB_API__;
      const score = api?.score;

      const result = [];
      if (!score || !grids) return result;

      for (const [key, grid] of Object.entries(grids)) {
        const [tiStr, siStr] = key.split(":");
        const ti = Number(tiStr);
        const si = Number(siStr);
        const track = score.tracks[ti];
        const staff = track?.staves[si];
        if (!track || !staff) continue;

        const positions = grid.positions.map((p) => ({
          string: p.string,
          y: Math.round(p.y * 100) / 100,
        }));

        // Compute spacing between adjacent positions
        const spacings = [];
        for (let i = 1; i < positions.length; i++) {
          spacings.push(
            Math.round((positions[i].y - positions[i - 1].y) * 100) / 100,
          );
        }

        result.push({
          key,
          trackIndex: ti,
          staffIndex: si,
          trackName: track.name,
          isPercussion: track.isPercussion,
          isTab: staff.showTablature,
          tuningLength: staff.tuning?.length ?? 0,
          positionCount: positions.length,
          positions,
          spacings,
          noteWidth: Math.round(grid.noteWidth * 100) / 100,
          noteHeight: Math.round(grid.noteHeight * 100) / 100,
        });
      }
      return result;
    });

    expect(data.length, "Should have at least one snap grid").toBeGreaterThan(
      0,
    );

    // Print tabular summary
    console.log("\n┌─────────────────────┬───────┬──────┬──────┬─────────┐");
    console.log(  "│ Track               │ isTab │ Pos# │ Tune │ Spacing │");
    console.log(  "├─────────────────────┼───────┼──────┼──────┼─────────┤");
    for (const d of data) {
      const name = d.trackName.padEnd(19).slice(0, 19);
      const tab = d.isTab ? "yes" : " no";
      const pos = String(d.positionCount).padStart(4);
      const tune = String(d.tuningLength).padStart(4);
      const minS = d.spacings.length > 0 ? Math.min(...d.spacings) : 0;
      const maxS = d.spacings.length > 0 ? Math.max(...d.spacings) : 0;
      const spacing = `${minS.toFixed(1)}-${maxS.toFixed(1)}`;
      console.log(
        `│ ${name} │  ${tab}  │ ${pos} │ ${tune} │ ${spacing.padStart(7)} │`,
      );
    }
    console.log("└─────────────────────┴───────┴──────┴──────┴─────────┘\n");

    for (const d of data) {
      if (d.isTab) {
        // Tab tracks: positions should match tuning length
        expect(
          d.positionCount,
          `Tab track "${d.trackName}" should have ${d.tuningLength} positions (one per string)`,
        ).toBe(d.tuningLength);
      } else {
        // Notation tracks: at least 9 positions (5 lines + 4 spaces)
        expect(
          d.positionCount,
          `Notation track "${d.trackName}" should have >= 21 positions (11 lines + 10 spaces)`,
        ).toBeGreaterThanOrEqual(21);
      }

      // All tracks: spacing should be roughly uniform
      // (max/min ratio < 2.0 means no huge jumps)
      if (d.spacings.length >= 2) {
        const minSpacing = Math.min(...d.spacings);
        const maxSpacing = Math.max(...d.spacings);
        if (minSpacing > 0) {
          const ratio = maxSpacing / minSpacing;
          expect(
            ratio,
            `Track "${d.trackName}" spacing ratio ${ratio.toFixed(2)} should be < 2.0 (uniform grid)`,
          ).toBeLessThan(2.0);
        }
      }
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "snap-grid.png"),
    });
  });
});
