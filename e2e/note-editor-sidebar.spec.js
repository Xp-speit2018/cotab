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

async function readSelection(page) {
  return page.evaluate(() => {
    const s = window.__PLAYER_STORE__.getState();
    const beatInfo = s.selectedBeatInfo;
    const noteIdx = s.selectedNoteIndex;
    const note =
      beatInfo && noteIdx >= 0 && noteIdx < beatInfo.notes.length
        ? beatInfo.notes[noteIdx]
        : null;
    return {
      trackIndex: s.selectedBeat?.trackIndex ?? null,
      barIndex: s.selectedBeat?.barIndex ?? null,
      beatIndex: s.selectedBeat?.beatIndex ?? null,
      noteIndex: noteIdx,
      noteCount: beatInfo?.notes?.length ?? 0,
      duration: beatInfo?.duration ?? null,
      isRest: beatInfo?.isRest ?? null,
      note: note
        ? { fret: note.fret, string: note.string, isDead: note.isDead,
            isGhost: note.isGhost, isLetRing: note.isLetRing,
            isPalmMute: note.isPalmMute, isTieDestination: note.isTieDestination }
        : null,
    };
  });
}

test.describe("Note Editor Sidebar — note-level selection", () => {
  test("clicking at different Y positions selects different tracks via boundsLookup", async ({
    page,
  }) => {
    await page.goto("/");
    await page.setViewportSize({ width: 1400, height: 900 });
    await waitForScore(page);

    const info = await page.evaluate(() => {
      const s = window.__PLAYER_STORE__.getState();
      return {
        tracks: s.tracks.map((t) => ({ index: t.index, name: t.name })),
        trackBounds: s.trackBounds,
      };
    });
    console.log("\n=== TRACKS ===");
    info.tracks.forEach((t) => console.log(`  [${t.index}] ${t.name}`));
    console.log("Bounds:", JSON.stringify(info.trackBounds));

    const vpBox = await page.locator(".at-viewport").boundingBox();
    if (!vpBox) throw new Error("No viewport");

    // Scroll to where Lead Guitar has notes
    await page.evaluate(() => {
      document.querySelector(".at-viewport").scrollLeft = 1000;
    });
    await page.waitForTimeout(500);

    // Click at each track's Y center
    const results = [];
    const bounds = info.trackBounds;
    for (let ti = 0; ti < bounds.length; ti++) {
      const b = bounds[ti];
      const clickX = vpBox.x + 150;
      const clickY = vpBox.y + b.y + b.height / 2;

      if (clickY < vpBox.y || clickY > vpBox.y + vpBox.height) continue;

      await page.mouse.click(clickX, clickY);
      await page.waitForTimeout(400);

      const sel = await readSelection(page);
      const debug = await page.evaluate(() => window.__SELECTION_DEBUG__);
      results.push({ boundsIndex: ti, ...sel });
      const trackName = info.tracks[sel.trackIndex]?.name ?? "?";
      console.log(
        `  track-bounds[${ti}] → track=${sel.trackIndex} (${trackName}), ` +
          `bar=${sel.barIndex}, notes=${sel.noteCount}, noteIdx=${sel.noteIndex}` +
          (sel.note ? `, fret=${sel.note.fret}` : ""),
      );
      console.log(`    debug: ${JSON.stringify(debug)}`);
    }

    const uniqueTracks = new Set(results.map((r) => r.trackIndex));
    console.log(`\nUnique tracks: ${[...uniqueTracks].sort().join(", ")}`);

    // With boundsLookup-based hit testing, we should resolve to different tracks
    expect(
      uniqueTracks.size,
      "Should select more than 1 track when clicking at different Y positions",
    ).toBeGreaterThanOrEqual(2);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "note-selection-multi-track.png"),
    });
  });

  test("sidebar highlights match the clicked note attributes", async ({
    page,
  }) => {
    await page.goto("/");
    await page.setViewportSize({ width: 1400, height: 900 });
    await waitForScore(page);

    const vpBox = await page.locator(".at-viewport").boundingBox();
    if (!vpBox) throw new Error("No viewport");

    // Scroll to notes
    await page.evaluate(() => {
      document.querySelector(".at-viewport").scrollLeft = 1000;
    });
    await page.waitForTimeout(500);

    // Click to find a beat with notes
    const bounds = await page.evaluate(
      () => window.__PLAYER_STORE__.getState().trackBounds,
    );
    let foundNote = false;

    for (let ti = 0; ti < bounds.length && !foundNote; ti++) {
      const b = bounds[ti];
      const clickX = vpBox.x + 150;

      // Try multiple Y positions within the track to hit a note's string
      const yOffsets = [0.3, 0.5, 0.7, 0.2, 0.8, 0.1, 0.9];
      let sel = null;
      for (const frac of yOffsets) {
        const clickY = vpBox.y + b.y + b.height * frac;
        if (clickY < vpBox.y || clickY > vpBox.y + vpBox.height) continue;

        await page.mouse.click(clickX, clickY);
        await page.waitForTimeout(400);

        sel = await readSelection(page);
        if (sel.note) break;
      }
      if (!sel || !sel.note) continue;
      foundNote = true;

      // Check sidebar toggles
      const toggles = await page.evaluate(() => {
        const sidebar = document.querySelector(
          ".flex.flex-col.border-r.bg-card",
        );
        if (!sidebar) return [];
        return Array.from(sidebar.querySelectorAll("button[aria-label]"))
          .filter((b) => b.getAttribute("aria-label"))
          .map((b) => ({
            label: b.getAttribute("aria-label"),
            isActive: b.className.includes("bg-primary"),
          }));
      });

      const activeSet = new Set(
        toggles.filter((t) => t.isActive).map((t) => t.label),
      );
      console.log("\nActive toggles:", [...activeSet].join(", "));
      console.log("Selected note:", JSON.stringify(sel.note));

      // Verify boolean attributes match toggle state
      const checks = [
        { label: "Tie", value: sel.note.isTieDestination },
        { label: "Ghost Note", value: sel.note.isGhost },
        { label: "Dead Note", value: sel.note.isDead },
        { label: "Let Ring", value: sel.note.isLetRing },
        { label: "Palm Mute", value: sel.note.isPalmMute },
      ];
      for (const c of checks) {
        expect(activeSet.has(c.label)).toBe(c.value);
      }

      // Duration toggle should be active
      const durationMap = {
        1: "Whole Note", 2: "Half Note", 4: "Quarter Note",
        8: "Eighth Note", 16: "Sixteenth Note",
        32: "Thirty-second Note", 64: "Sixty-fourth Note",
      };
      const expectedDuration = durationMap[sel.duration];
      if (expectedDuration) {
        expect(activeSet.has(expectedDuration)).toBe(true);
      }
    }

    expect(foundNote, "Should find at least one note").toBe(true);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "note-selection-attributes.png"),
    });
    console.log("\n========== ATTRIBUTE TEST PASSED ==========");
  });
});
