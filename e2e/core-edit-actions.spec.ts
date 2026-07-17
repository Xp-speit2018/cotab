import { expect, test } from "@playwright/test";

type RuntimeWindow = Window & {
  __ALPHATAB_API__: {
    load(scoreData: unknown, trackIndexes?: number[]): boolean;
    renderScore(
      score: unknown,
      trackIndexes?: number[],
      renderHints?: {
        reuseViewport?: boolean;
        firstChangedMasterBar?: number;
      },
    ): void;
    postRenderFinished: {
      on(callback: () => void): () => void;
    };
    renderer: {
      partialLayoutFinished: {
        on(callback: (args: {
          id: string;
          firstMasterBarIndex: number;
          lastMasterBarIndex: number;
          reuseViewport: boolean;
        }) => void): () => void;
      };
    };
    canvasElement: { element: HTMLElement };
    tracks: Array<{ index: number }>;
    score: {
      masterBars: Array<{
        tempoAutomations: Array<{
          type: number;
          value: number;
          ratioPosition: number;
        }>;
      }>;
      tracks: Array<{
        staves: Array<{
          bars: Array<{
            voices: Array<{
              beats: Array<{
                duration: number;
                isRest: boolean;
                isEmpty: boolean;
                notes: Array<{
                  fret: number;
                  string: number;
                  bendType: number;
                  bendPoints: Array<{ offset: number; value: number }> | null;
                }>;
              }>;
            }>;
          }>;
        }>;
      }>;
    };
  };
  __PLAYER_STORE__: {
    getState(): {
      isPlayerReady: boolean;
      visibleTrackIndices: number[];
      setSelection(selection: {
        trackIndex: number;
        staffIndex: number;
        voiceIndex: number;
        barIndex: number;
        beatIndex: number;
        string: number;
      }): void;
    };
  };
  __RENDER_REUSE_PROBE__?: {
    renderScoreCalls: number;
    loadCalls: number;
    completedRenders: number;
    reuseViewportHints: Array<boolean | undefined>;
    firstChangedMasterBarHints: Array<number | undefined>;
    renderedPartials: Element[];
    displayedBlankFrame: boolean;
    scrollLeft: number;
    disconnect(): void;
  };
  __FIXED_SYSTEM_PROBE__?: {
    phase: "initial" | "update";
    completedRenders: number;
    initial: Array<{
      id: string;
      firstMasterBarIndex: number;
      lastMasterBarIndex: number;
      reuseViewport: boolean;
    }>;
    update: Array<{
      id: string;
      firstMasterBarIndex: number;
      lastMasterBarIndex: number;
      reuseViewport: boolean;
    }>;
    disconnect(): void;
  };
};

test("keyboard editing projects shortcut values into document action objects", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() =>
    Boolean((window as unknown as RuntimeWindow).__PLAYER_STORE__?.getState().isPlayerReady),
  );

  const initial = await page.evaluate(() => {
    const runtime = window as unknown as RuntimeWindow;
    const beat = runtime.__ALPHATAB_API__.score.tracks[0].staves[0]
      .bars[8].voices[0].beats[0];
    const note = beat.notes[0];
    runtime.__PLAYER_STORE__.getState().setSelection({
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      barIndex: 8,
      beatIndex: 0,
      string: note.string,
    });
    return { duration: beat.duration, fret: note.fret, string: note.string };
  });
  expect(initial.duration).not.toBe(2);

  await page.keyboard.press("-");
  await page.waitForFunction(() =>
    (window as unknown as RuntimeWindow).__ALPHATAB_API__.score.tracks[0]
      .staves[0].bars[8].voices[0].beats[0].duration === 2,
  );

  await page.keyboard.press("0");
  await page.waitForFunction(({ string }) => {
    const beat = (window as unknown as RuntimeWindow).__ALPHATAB_API__.score
      .tracks[0].staves[0].bars[8].voices[0].beats[0];
    return beat.notes.some((note) => note.string === string && note.fret === 0);
  }, { string: initial.string });

  const updated = await page.evaluate(({ string }) => {
    const beat = (window as unknown as RuntimeWindow).__ALPHATAB_API__.score
      .tracks[0].staves[0].bars[8].voices[0].beats[0];
    return {
      duration: beat.duration,
      fret: beat.notes.find((note) => note.string === string)?.fret,
    };
  }, { string: initial.string });
  expect(updated).toEqual({ duration: 2, fret: 0 });
});

test("live document edits reuse the rendered AlphaTab viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await page.waitForFunction(() => {
    const runtime = window as unknown as RuntimeWindow;
    return Boolean(
      runtime.__PLAYER_STORE__?.getState().isPlayerReady
      && runtime.__ALPHATAB_API__?.canvasElement.element.querySelector("svg"),
    );
  });

  const initial = await page.evaluate(() => {
    const runtime = window as unknown as RuntimeWindow;
    const api = runtime.__ALPHATAB_API__;
    const beat = api.score.tracks[0].staves[0]
      .bars[8].voices[0].beats[0];
    const note = beat.notes[0];
    runtime.__PLAYER_STORE__.getState().setSelection({
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      barIndex: 8,
      beatIndex: 0,
      string: note.string,
    });

    const viewport = document.querySelector<HTMLElement>(".at-viewport")!;
    viewport.scrollLeft = Math.min(
      2_000,
      viewport.scrollWidth - viewport.clientWidth,
    );
    return {
      duration: beat.duration,
      scrollLeft: viewport.scrollLeft,
    };
  });

  await page.waitForFunction(() => {
    const runtime = window as unknown as RuntimeWindow;
    const viewport = document.querySelector<HTMLElement>(".at-viewport")!;
    const viewportBounds = viewport.getBoundingClientRect();
    return Array.from(runtime.__ALPHATAB_API__.canvasElement.element.children)
      .some((element) => {
        const bounds = element.getBoundingClientRect();
        return element.childElementCount > 0
          && bounds.right > viewportBounds.left
          && bounds.left < viewportBounds.right;
      });
  });

  const renderedPartialCount = await page.evaluate(() => {
    const runtime = window as unknown as RuntimeWindow;
    const api = runtime.__ALPHATAB_API__;
    const viewport = document.querySelector<HTMLElement>(".at-viewport")!;
    const viewportBounds = viewport.getBoundingClientRect();
    const renderedPartials = Array.from(api.canvasElement.element.children)
      .filter((element) => {
        const bounds = element.getBoundingClientRect();
        return element.childElementCount > 0
          && bounds.right > viewportBounds.left
          && bounds.left < viewportBounds.right;
      });
    const probe: NonNullable<RuntimeWindow["__RENDER_REUSE_PROBE__"]> = {
      renderScoreCalls: 0,
      loadCalls: 0,
      completedRenders: 0,
      reuseViewportHints: [],
      firstChangedMasterBarHints: [],
      renderedPartials,
      displayedBlankFrame: false,
      scrollLeft: viewport.scrollLeft,
      disconnect: () => undefined,
    };

    let sampling = true;
    const sampleVisiblePartials = () => {
      if (!sampling) return;
      if (renderedPartials.some(
        (partial) => partial.isConnected && partial.childElementCount === 0,
      )) {
        probe.displayedBlankFrame = true;
      }
      requestAnimationFrame(sampleVisiblePartials);
    };
    requestAnimationFrame(sampleVisiblePartials);

    const originalLoad = api.load.bind(api);
    api.load = (scoreData, trackIndexes) => {
      probe.loadCalls += 1;
      return originalLoad(scoreData, trackIndexes);
    };
    const originalRenderScore = api.renderScore.bind(api);
    api.renderScore = (score, trackIndexes, renderHints) => {
      probe.renderScoreCalls += 1;
      probe.reuseViewportHints.push(renderHints?.reuseViewport);
      probe.firstChangedMasterBarHints.push(
        renderHints?.firstChangedMasterBar,
      );
      originalRenderScore(score, trackIndexes, renderHints);
    };
    const unsubscribe = api.postRenderFinished.on(() => {
      probe.completedRenders += 1;
    });
    probe.disconnect = () => {
      sampling = false;
      unsubscribe();
    };
    runtime.__RENDER_REUSE_PROBE__ = probe;
    return renderedPartials.length;
  });

  expect(initial.duration).not.toBe(2);
  expect(initial.scrollLeft).toBeGreaterThan(0);
  expect(renderedPartialCount).toBeGreaterThan(0);

  await page.keyboard.press("-");
  await page.waitForFunction(() => {
    const runtime = window as unknown as RuntimeWindow;
    return runtime.__ALPHATAB_API__.score.tracks[0].staves[0]
      .bars[8].voices[0].beats[0].duration === 2
      && (runtime.__RENDER_REUSE_PROBE__?.completedRenders ?? 0) > 0;
  });
  await page.waitForTimeout(400);

  const result = await page.evaluate(() => {
    const runtime = window as unknown as RuntimeWindow;
    const probe = runtime.__RENDER_REUSE_PROBE__!;
    const viewport = document.querySelector<HTMLElement>(".at-viewport")!;
    const result = {
      renderScoreCalls: probe.renderScoreCalls,
      loadCalls: probe.loadCalls,
      reuseViewportHints: probe.reuseViewportHints,
      firstChangedMasterBarHints: probe.firstChangedMasterBarHints,
      displayedBlankFrame: probe.displayedBlankFrame,
      renderedPartialsStillConnected: probe.renderedPartials.every(
        (partial) => partial.isConnected,
      ),
      scrollLeftBefore: probe.scrollLeft,
      scrollLeftAfter: viewport.scrollLeft,
    };
    probe.disconnect();
    delete runtime.__RENDER_REUSE_PROBE__;
    return result;
  });

  expect(result.renderScoreCalls).toBeGreaterThan(0);
  expect(result.loadCalls).toBe(0);
  expect(result.reuseViewportHints.every(Boolean)).toBe(true);
  expect(result.firstChangedMasterBarHints).toEqual([8]);
  expect(result.displayedBlankFrame).toBe(false);
  expect(result.renderedPartialsStillConnected).toBe(true);
  expect(result.scrollLeftAfter).toBe(result.scrollLeftBefore);
});

test("parchment edits preserve systems before the first changed master bar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await page.waitForFunction(() => {
    const runtime = window as unknown as RuntimeWindow;
    return Boolean(runtime.__PLAYER_STORE__?.getState().isPlayerReady);
  });

  await page.evaluate(() => {
    const runtime = window as unknown as RuntimeWindow;
    const api = runtime.__ALPHATAB_API__;
    const probe: NonNullable<RuntimeWindow["__FIXED_SYSTEM_PROBE__"]> = {
      phase: "initial",
      completedRenders: 0,
      initial: [],
      update: [],
      disconnect: () => undefined,
    };
    const unsubscribeLayout = api.renderer.partialLayoutFinished.on((args) => {
      probe[probe.phase].push({
        id: args.id,
        firstMasterBarIndex: args.firstMasterBarIndex,
        lastMasterBarIndex: args.lastMasterBarIndex,
        reuseViewport: args.reuseViewport,
      });
    });
    const unsubscribeFinished = api.postRenderFinished.on(() => {
      probe.completedRenders += 1;
    });
    probe.disconnect = () => {
      unsubscribeLayout();
      unsubscribeFinished();
    };
    runtime.__FIXED_SYSTEM_PROBE__ = probe;
  });

  await page.getByRole("button", { name: "Parchment layout" }).click();
  await page.waitForFunction(() => {
    const probe = (window as unknown as RuntimeWindow).__FIXED_SYSTEM_PROBE__;
    return (probe?.completedRenders ?? 0) > 0
      && Boolean(probe?.initial.some(
        (partial) => partial.firstMasterBarIndex <= 8
          && partial.lastMasterBarIndex >= 8,
      ));
  });

  const initialDuration = await page.evaluate(() => {
    const runtime = window as unknown as RuntimeWindow;
    runtime.__FIXED_SYSTEM_PROBE__!.phase = "update";
    const api = runtime.__ALPHATAB_API__;
    const beat = api.score.tracks[0].staves[0]
      .bars[8].voices[0].beats[0];
    const note = beat.notes[0];
    runtime.__PLAYER_STORE__.getState().setSelection({
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      barIndex: 8,
      beatIndex: 0,
      string: note.string,
    });
    return beat.duration;
  });

  expect(initialDuration).not.toBe(2);
  await page.keyboard.press("-");
  await page.waitForFunction(() => {
    const runtime = window as unknown as RuntimeWindow;
    return runtime.__ALPHATAB_API__.score.tracks[0].staves[0]
      .bars[8].voices[0].beats[0].duration === 2
      && (runtime.__FIXED_SYSTEM_PROBE__?.completedRenders ?? 0) > 1;
  });

  const result = await page.evaluate(() => {
    const runtime = window as unknown as RuntimeWindow;
    const probe = runtime.__FIXED_SYSTEM_PROBE__!;
    const initialSystems = probe.initial.filter(
      (partial) => partial.firstMasterBarIndex >= 0,
    );
    const updatedSystems = probe.update.filter(
      (partial) => partial.firstMasterBarIndex >= 0,
    );
    const changedSystem = initialSystems.find(
      (partial) => partial.firstMasterBarIndex <= 8
        && partial.lastMasterBarIndex >= 8,
    )!;
    const updatedByFirstBar = new Map(
      updatedSystems.map((partial) => [partial.firstMasterBarIndex, partial]),
    );
    const result = {
      preservedPrefix: initialSystems
        .filter(
          (partial) => partial.lastMasterBarIndex
            < changedSystem.firstMasterBarIndex,
        )
        .map((partial) => ({
          before: partial.id,
          after: updatedByFirstBar.get(partial.firstMasterBarIndex)?.id,
        })),
      changedSystemBefore: changedSystem.id,
      changedSystemAfter: updatedByFirstBar.get(
        changedSystem.firstMasterBarIndex,
      )?.id,
      updateReuseViewport: probe.update.map(
        (partial) => partial.reuseViewport,
      ),
    };
    probe.disconnect();
    delete runtime.__FIXED_SYSTEM_PROBE__;
    return result;
  });

  expect(result.preservedPrefix.length).toBeGreaterThan(0);
  expect(result.preservedPrefix.every(
    ({ before, after }) => before === after,
  )).toBe(true);
  expect(result.changedSystemAfter).toBeTruthy();
  expect(result.changedSystemAfter).not.toBe(result.changedSystemBefore);
  expect(result.updateReuseViewport.every(Boolean)).toBe(true);
});

test("core edit controls refresh the selected AlphaTab snapshot", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() =>
    Boolean((window as unknown as RuntimeWindow).__PLAYER_STORE__?.getState().isPlayerReady),
  );

  await page.evaluate(() => {
    const runtime = window as unknown as RuntimeWindow;
    const string = runtime.__ALPHATAB_API__.score.tracks[0].staves[0]
      .bars[8].voices[0].beats[0].notes[0].string;
    runtime.__PLAYER_STORE__.getState().setSelection({
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      barIndex: 8,
      beatIndex: 0,
      string,
    });
  });

  const tempoMarker = page.getByRole("button", {
    name: "Tempo Marker",
    exact: true,
  });
  await expect(tempoMarker).toBeVisible();

  await tempoMarker.click();
  await page.waitForFunction(() =>
    (window as unknown as RuntimeWindow)
      .__ALPHATAB_API__.score.masterBars[8].tempoAutomations.length === 0,
  );

  await tempoMarker.click();
  await page.waitForFunction(() =>
    (window as unknown as RuntimeWindow)
      .__ALPHATAB_API__.score.masterBars[8].tempoAutomations
      .some((automation) => automation.value === 120),
  );

  await page.getByRole("button", { name: "Bend", exact: true }).click();
  await page.waitForFunction(() => {
    const note = (window as unknown as RuntimeWindow)
      .__ALPHATAB_API__.score.tracks[0].staves[0].bars[8]
      .voices[0].beats[0].notes[0];
    return note?.bendType === 2 && note.bendPoints?.length === 2;
  });

  await page.getByRole("button", { name: "Rest", exact: true }).click();
  await page.waitForFunction(() => {
    const beat = (window as unknown as RuntimeWindow)
      .__ALPHATAB_API__.score.tracks[0].staves[0].bars[8]
      .voices[0].beats[0];
    return beat.isRest && !beat.isEmpty && beat.notes.length === 0;
  });

  const result = await page.evaluate(() => {
    const runtime = window as unknown as RuntimeWindow;
    const automation = runtime.__ALPHATAB_API__.score.masterBars[8]
      .tempoAutomations[0];
    const beat = runtime.__ALPHATAB_API__.score.tracks[0].staves[0]
      .bars[8].voices[0].beats[0];
    return {
      automation: {
        type: automation.type,
        value: automation.value,
        ratioPosition: automation.ratioPosition,
      },
      isRest: beat.isRest,
      noteCount: beat.notes.length,
    };
  });

  expect(result).toEqual({
    automation: { type: 0, value: 120, ratioPosition: 0 },
    isRest: true,
    noteCount: 0,
  });
});

test("track visibility is a local ViewAction and survives rendering", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() =>
    Boolean((window as unknown as RuntimeWindow).__PLAYER_STORE__?.getState().isPlayerReady),
  );

  await page.getByRole("button", { name: "Meta", exact: true }).click();
  await page.getByRole("button", { name: "Hide Lead Guitar", exact: true }).click();

  await page.waitForFunction(() => {
    const runtime = window as unknown as RuntimeWindow;
    return (
      !runtime.__PLAYER_STORE__.getState().visibleTrackIndices.includes(0) &&
      runtime.__ALPHATAB_API__.tracks.every((track) => track.index !== 0)
    );
  });

  await page.getByRole("button", { name: "Show Lead Guitar", exact: true }).click();
  await page.waitForFunction(() => {
    const runtime = window as unknown as RuntimeWindow;
    return (
      runtime.__PLAYER_STORE__.getState().visibleTrackIndices.includes(0) &&
      runtime.__ALPHATAB_API__.tracks.some((track) => track.index === 0)
    );
  });

  const scoreTrackCount = await page.evaluate(() =>
    (window as unknown as RuntimeWindow).__ALPHATAB_API__.score.tracks.length,
  );
  expect(scoreTrackCount).toBe(6);
});
