import { expect, test } from "@playwright/test";

type AlphaTabBoundsLookupForTest = {
  staffSystems: Array<{
    bars: Array<{
      visualBounds: { x: number; y: number; w: number; h: number };
      bars: Array<{
        beats: Array<{
          onNotesX: number;
          realBounds: { x: number; y: number; w: number; h: number };
          visualBounds: { x: number; y: number; w: number; h: number };
          notes: Array<{
            noteHeadBounds?: { x: number; y: number; w: number; h: number };
          }> | null;
          beat: {
            index: number;
            notes: unknown[];
            voice: {
              index: number;
              bar: {
                index: number;
                staff: { index: number; track: { index: number } };
              };
            };
          };
        }>;
      }>;
    }>;
  }>;
};

declare global {
  interface Window {
    __ALPHATAB_API__?: {
      isLooping: boolean;
      boundsLookup: AlphaTabBoundsLookupForTest;
      settings: { display: { scale: number } };
      playbackRange: {
        startTick: number;
        endTick: number;
      } | null;
    };
    __PLAYER_STORE__?: {
      getState(): {
        isPlayerReady: boolean;
        selectedBeat: {
          trackIndex: number;
          staffIndex: number;
          voiceIndex: number;
          barIndex: number;
          beatIndex: number;
          string: number | null;
        } | null;
        selectionRange: {
          trackIndex: number;
          staffIndex: number;
          voiceIndex: number;
          startBarIndex: number;
          endBarIndex: number;
        } | null;
        transport: {
          playhead: {
            trackIndex: number;
            staffIndex: number;
            voiceIndex: number;
            barIndex: number;
            beatIndex: number;
            string: number | null;
          } | null;
          loopRange: {
            start: {
              trackIndex: number;
              staffIndex: number;
              voiceIndex: number;
              barIndex: number;
              beatIndex: number;
            };
            end: {
              trackIndex: number;
              staffIndex: number;
              voiceIndex: number;
              barIndex: number;
              beatIndex: number;
            };
          } | null;
        };
        toggleLoop(): void;
        setTransportLoopRange(
          range: {
            start: {
              trackIndex: number;
              staffIndex: number;
              voiceIndex: number;
              barIndex: number;
              beatIndex: number;
            };
            end: {
              trackIndex: number;
              staffIndex: number;
              voiceIndex: number;
              barIndex: number;
              beatIndex: number;
            };
          } | null,
        ): void;
      };
    };
  }
}

test("transport modifier routes score mouse input to transport state", async ({ page }) => {
  await page.goto("/");

  await page.waitForFunction(() => window.__PLAYER_STORE__?.getState().isPlayerReady);

  const viewport = page.locator(".at-viewport");
  await viewport.click({ position: { x: 300, y: 150 } });

  await page.waitForFunction(() => Boolean(window.__PLAYER_STORE__?.getState().selectedBeat));

  const afterSelectorClick = await page.evaluate(() => {
    const state = window.__PLAYER_STORE__!.getState();
    return {
      selectedBeat: state.selectedBeat,
      transportPlayhead: state.transport.playhead,
      loopRange: state.transport.loopRange,
    };
  });

  expect(afterSelectorClick.selectedBeat).not.toBeNull();
  expect(afterSelectorClick.transportPlayhead).toBeNull();
  expect(afterSelectorClick.loopRange).toBeNull();

  const box = await viewport.boundingBox();
  expect(box).not.toBeNull();
  const y = box!.y + 150;

  await page.mouse.move(box!.x + 260, y);
  await page.mouse.down();
  await page.mouse.move(box!.x + 267, y);
  await expect(page.locator(".at-drag-range-preview")).toBeVisible();
  const selectionRangeDuringSmallDrag = await page.evaluate(
    () => window.__PLAYER_STORE__!.getState().selectionRange,
  );
  expect(selectionRangeDuringSmallDrag).toBeNull();
  await page.mouse.up();
  await expect(page.locator(".at-drag-range-preview")).not.toBeVisible();
  await expect(page.locator(".at-bar-selection")).not.toBeVisible();

  await page.mouse.move(box!.x + 260, y);
  await page.mouse.down();
  await page.mouse.move(box!.x + 760, y, { steps: 8 });
  await expect(page.locator(".at-drag-range-preview")).toBeVisible();
  await page.mouse.up();
  await expect(page.locator(".at-drag-range-preview")).not.toBeVisible();
  await expect(page.locator(".at-bar-selection").first()).toBeVisible();
  const selectorRangeParentClass = await page
    .locator(".at-bar-selection")
    .first()
    .evaluate((el) => el.parentElement?.className ?? "");
  expect(selectorRangeParentClass).toBe("cotab-range-background-layer");
  const selectorRangeLayerHostClass = await page
    .locator(".at-bar-selection")
    .first()
    .evaluate((el) => el.parentElement?.parentElement?.className ?? "");
  expect(selectorRangeLayerHostClass).toContain("at-surface");

  const afterSelectorDrag = await page.evaluate(() => {
    const state = window.__PLAYER_STORE__!.getState();
    return {
      selectedBeat: state.selectedBeat,
      selectionRange: state.selectionRange,
    };
  });
  expect(afterSelectorDrag.selectedBeat).not.toBeNull();
  expect(afterSelectorDrag.selectionRange).not.toBeNull();

  await page.keyboard.down("Alt");
  await expect(viewport).toHaveClass(/at-transport-mode/);
  await viewport.click({ position: { x: 520, y: 150 } });
  await page.keyboard.up("Alt");

  const afterTransportClick = await page.evaluate(() => {
    const state = window.__PLAYER_STORE__!.getState();
    return {
      selectedBeat: state.selectedBeat,
      transportPlayhead: state.transport.playhead,
      loopRange: state.transport.loopRange,
    };
  });

  expect(afterTransportClick.selectedBeat).toEqual(afterSelectorDrag.selectedBeat);
  expect(afterTransportClick.transportPlayhead).not.toBeNull();
  expect(afterTransportClick.loopRange).toBeNull();
  await expect(page.locator(".at-transport-playhead")).toBeVisible();

  const betweenBeatsAcrossBarline = await page.evaluate(() => {
    const api = window.__ALPHATAB_API__!;
    const mainRect = document.querySelector(".at-main")!.getBoundingClientRect();
    const scale = api.settings.display.scale;
    const contentRange = (beatBounds: AlphaTabBoundsLookupForTest["staffSystems"][number]["bars"][number]["bars"][number]["beats"][number]) => {
      const noteHeadBounds = (beatBounds.notes ?? [])
        .map((noteBounds) => noteBounds.noteHeadBounds)
        .filter((bounds): bounds is { x: number; w: number } =>
          Boolean(bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.w) && bounds.w > 0),
        );
      if (noteHeadBounds.length > 0) {
        return {
          left: Math.min(...noteHeadBounds.map((bounds) => bounds.x)),
          right: Math.max(...noteHeadBounds.map((bounds) => bounds.x + bounds.w)),
        };
      }
      return {
        left: Math.min(beatBounds.visualBounds.x, beatBounds.onNotesX),
        right: Math.max(beatBounds.visualBounds.x + beatBounds.visualBounds.w, beatBounds.onNotesX),
      };
    };
    for (const system of api.boundsLookup.staffSystems) {
      for (let index = 1; index < system.bars.length; index++) {
        const previousMasterBar = system.bars[index - 1];
        const nextMasterBar = system.bars[index];
        const previousBeats = previousMasterBar.bars[0]?.beats ?? [];
        const nextFirstBeatBounds = nextMasterBar.bars[0]?.beats[0];
        if (previousBeats.length === 0 || !nextFirstBeatBounds) continue;

        const nextFirstRange = contentRange(nextFirstBeatBounds);
        const gap = nextFirstRange.left - nextMasterBar.visualBounds.x;
        if (gap <= 10) continue;

        const previousLastBeatBounds = previousBeats[previousBeats.length - 1];
        const previousLastRange = contentRange(previousLastBeatBounds);
        const previousLastBeat = previousLastBeatBounds.beat;
        const previousBar = previousLastBeat.voice.bar;
        return {
          anchorClientX: mainRect.left + previousLastBeatBounds.onNotesX * scale,
          deadZoneClientX:
            mainRect.left + (nextMasterBar.visualBounds.x + Math.min(gap - 2, 8)) * scale,
          clientY: mainRect.top + (nextFirstBeatBounds.realBounds.y + 10) * scale,
          expectedLoopRight: previousLastRange.right + 18,
          expectedEnd: {
            trackIndex: previousBar.staff.track.index,
            staffIndex: previousBar.staff.index,
            voiceIndex: previousLastBeat.voice.index,
            barIndex: previousBar.index,
            beatIndex: previousLastBeat.index,
          },
        };
      }
    }
    throw new Error("Expected a gap between a barline and the next first beat");
  });

  await page.keyboard.down("Alt");
  await page.mouse.move(
    betweenBeatsAcrossBarline.anchorClientX,
    betweenBeatsAcrossBarline.clientY,
  );
  await page.mouse.down();
  await page.mouse.move(
    betweenBeatsAcrossBarline.deadZoneClientX,
    betweenBeatsAcrossBarline.clientY,
  );
  await expect(page.locator(".at-drag-range-preview")).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__PLAYER_STORE__?.getState().transport.loopRange));
  const deadZoneLoopState = await page.evaluate(() => {
    const state = window.__PLAYER_STORE__!.getState();
    const rect = document.querySelector(".at-loop-range") as HTMLElement | null;
    const left = rect ? Number.parseFloat(rect.style.left) : 0;
    return {
      loopRange: state.transport.loopRange,
      loopRight: rect ? left + Number.parseFloat(rect.style.width) : 0,
    };
  });
  expect(deadZoneLoopState.loopRange?.end).toMatchObject(betweenBeatsAcrossBarline.expectedEnd);
  expect(
    Math.abs(deadZoneLoopState.loopRight - betweenBeatsAcrossBarline.expectedLoopRight),
  ).toBeLessThan(1);
  await page.mouse.up();
  await page.keyboard.up("Alt");
  await expect(page.locator(".at-drag-range-preview")).not.toBeVisible();

  await page.keyboard.down("Alt");
  await page.mouse.move(box!.x + 260, y);
  await page.mouse.down();
  await page.mouse.move(box!.x + 760, y, { steps: 8 });
  await expect(page.locator(".at-drag-range-preview")).toBeVisible();
  const previewZIndex = await page
    .locator(".at-drag-range-preview")
    .evaluate((el) => Number.parseInt(window.getComputedStyle(el).zIndex, 10));
  const previewParentClass = await page
    .locator(".at-drag-range-preview")
    .evaluate((el) => el.parentElement?.className ?? "");
  expect(previewParentClass).toBe("at-cursors");
  await page.mouse.up();
  await page.keyboard.up("Alt");
  await expect(page.locator(".at-drag-range-preview")).not.toBeVisible();

  await page.waitForFunction(() => {
    const range = window.__PLAYER_STORE__?.getState().transport.loopRange;
    return Boolean(
      range &&
      (
        range.end.barIndex > range.start.barIndex ||
        (
          range.end.barIndex === range.start.barIndex &&
          range.end.beatIndex >= range.start.beatIndex
        )
      ),
    );
  });

  const afterTransportDrag = await page.evaluate(() => {
    const state = window.__PLAYER_STORE__!.getState();
    return {
      selectedBeat: state.selectedBeat,
      loopRange: state.transport.loopRange,
    };
  });

  expect(afterTransportDrag.selectedBeat).toEqual(afterSelectorDrag.selectedBeat);
  expect(afterTransportDrag.loopRange?.start).toMatchObject({
    trackIndex: afterTransportClick.transportPlayhead!.trackIndex,
    staffIndex: afterTransportClick.transportPlayhead!.staffIndex,
    voiceIndex: afterTransportClick.transportPlayhead!.voiceIndex,
  });
  expect(afterTransportDrag.loopRange?.start.beatIndex).toEqual(expect.any(Number));
  expect(afterTransportDrag.loopRange?.end.beatIndex).toEqual(expect.any(Number));
  await expect(page.locator(".at-loop-range").first()).toBeVisible();
  const loopZIndex = await page
    .locator(".at-loop-range")
    .first()
    .evaluate((el) => Number.parseInt(window.getComputedStyle(el).zIndex, 10));
  const loopParentClass = await page
    .locator(".at-loop-range")
    .first()
    .evaluate((el) => el.parentElement?.className ?? "");
  expect(loopParentClass).toBe("cotab-range-background-layer");
  const loopLayerHostClass = await page
    .locator(".at-loop-range")
    .first()
    .evaluate((el) => el.parentElement?.parentElement?.className ?? "");
  expect(loopLayerHostClass).toContain("at-surface");
  const persistentRangeStack = await page.evaluate(() => {
    const surface = document.querySelector(".at-surface");
    if (!surface) throw new Error("Expected AlphaTab surface");
    const rangeLayer = surface.querySelector(".cotab-range-background-layer");
    if (!rangeLayer) throw new Error("Expected range background layer");
    const surfaceChildren = Array.from(surface.children);
    const visibleScoreChildren = surfaceChildren.filter((child) => {
      if (child === rangeLayer) return false;
      const rect = child.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    return {
      rangeLayerIndex: surfaceChildren.indexOf(rangeLayer),
      rangeLayerZIndex: window.getComputedStyle(rangeLayer).zIndex,
      scoreChildCount: visibleScoreChildren.length,
      scoreChildZIndexes: visibleScoreChildren.map((child) => window.getComputedStyle(child).zIndex),
    };
  });
  expect(persistentRangeStack.rangeLayerIndex).toBe(0);
  expect(persistentRangeStack.rangeLayerZIndex).toBe("0");
  expect(persistentRangeStack.scoreChildCount).toBeGreaterThan(0);
  expect(persistentRangeStack.scoreChildZIndexes.every((zIndex) => zIndex === "1")).toBe(true);
  expect(previewZIndex).toBeGreaterThan(loopZIndex);

  const singleBeatLoopMetrics = await page.evaluate(() => {
    const api = window.__ALPHATAB_API__!;
    const store = window.__PLAYER_STORE__!.getState();
    const contentRange = (beatBounds: AlphaTabBoundsLookupForTest["staffSystems"][number]["bars"][number]["bars"][number]["beats"][number]) => {
      const noteHeadBounds = (beatBounds.notes ?? [])
        .map((noteBounds) => noteBounds.noteHeadBounds)
        .filter((bounds): bounds is { x: number; w: number } =>
          Boolean(bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.w) && bounds.w > 0),
        );
      if (noteHeadBounds.length > 0) {
        return {
          left: Math.min(...noteHeadBounds.map((bounds) => bounds.x)),
          right: Math.max(...noteHeadBounds.map((bounds) => bounds.x + bounds.w)),
        };
      }
      return {
        left: Math.min(beatBounds.visualBounds.x, beatBounds.onNotesX),
        right: Math.max(beatBounds.visualBounds.x + beatBounds.visualBounds.w, beatBounds.onNotesX),
      };
    };
    const masterBar = api.boundsLookup.staffSystems[0].bars.find((candidate) => {
      const beatBounds = candidate.bars[0]?.beats[0];
      return candidate.bars[0]?.beats.length === 1 && beatBounds?.beat.notes.length === 0;
    });
    if (!masterBar) throw new Error("Expected at least one single-rest master bar");

    const beatBounds = masterBar.bars[0].beats[0];
    const beat = beatBounds.beat;
    const bar = beat.voice.bar;
    const staff = bar.staff;
    const track = staff.track;
    const address = {
      trackIndex: track.index,
      staffIndex: staff.index,
      voiceIndex: beat.voice.index,
      barIndex: bar.index,
      beatIndex: beat.index,
    };

    store.setTransportLoopRange({ start: address, end: address });
    const range = contentRange(beatBounds);

    return {
      expectedLeft: range.left - 8,
      expectedRight: range.right + 18,
    };
  });

  await expect(page.locator(".at-loop-range").first()).toBeVisible();
  const singleBeatLoopRect = await page.locator(".at-loop-range").first().evaluate((el) => {
    const node = el as HTMLElement;
    const left = Number.parseFloat(node.style.left);
    return {
      left,
      right: left + Number.parseFloat(node.style.width),
    };
  });
  expect(Math.abs(singleBeatLoopRect.left - singleBeatLoopMetrics.expectedLeft)).toBeLessThan(1);
  expect(Math.abs(singleBeatLoopRect.right - singleBeatLoopMetrics.expectedRight)).toBeLessThan(1);

  const playbackRangeBeforeLoop = await page.evaluate(() => window.__ALPHATAB_API__!.playbackRange);
  expect(playbackRangeBeforeLoop).not.toBeNull();
  expect(playbackRangeBeforeLoop!.endTick).toBeGreaterThan(playbackRangeBeforeLoop!.startTick);

  const loopState = await page.evaluate(() => {
    window.__PLAYER_STORE__!.getState().toggleLoop();
    return {
      isLooping: window.__ALPHATAB_API__!.isLooping,
      playbackRange: window.__ALPHATAB_API__!.playbackRange,
    };
  });

  expect(loopState.isLooping).toBe(true);
  expect(loopState.playbackRange).not.toBeNull();
  expect(loopState.playbackRange!.endTick).toBeGreaterThan(loopState.playbackRange!.startTick);

  await page.keyboard.down("Alt");
  await viewport.click({ position: { x: 420, y: 150 } });
  await page.keyboard.up("Alt");

  const afterTransportSingleClick = await page.evaluate(() => {
    const state = window.__PLAYER_STORE__!.getState();
    return {
      transportPlayhead: state.transport.playhead,
      loopRange: state.transport.loopRange,
      playbackRange: window.__ALPHATAB_API__!.playbackRange,
    };
  });

  expect(afterTransportSingleClick.transportPlayhead).not.toBeNull();
  expect(afterTransportSingleClick.loopRange).toBeNull();
  expect(afterTransportSingleClick.playbackRange).toBeNull();
});
