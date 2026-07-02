import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __ALPHATAB_API__?: {
      tickPosition: number;
      score?: {
        tracks: Array<{
          staves: Array<{
            bars: Array<{
              voices: Array<{
                beats: Array<{
                  absolutePlaybackStart?: number;
                  playbackStart?: number;
                }>;
              }>;
            }>;
          }>;
        }>;
      };
    };
    __PLAYER_STORE__?: {
      getState(): {
        isPlayerReady: boolean;
        playerState: "stopped" | "playing" | "paused";
        selectedBeat: unknown;
        transport: {
          playhead: unknown;
          tickPosition: number;
        };
        setSelection(args: {
          trackIndex: number;
          staffIndex: number;
          voiceIndex: number;
          barIndex: number;
          beatIndex: number;
          string: number | null;
        }): void;
        setTransportPlayheadToSelection(): void;
        togglePlayback(): void;
      };
    };
  }
}

test("Selection does not change the transport playback start", async ({ page }) => {
  await page.goto("/");

  await page.waitForFunction(() => {
    const store = window.__PLAYER_STORE__;
    const api = window.__ALPHATAB_API__;
    return Boolean(
      store?.getState().isPlayerReady &&
        api?.score?.tracks?.[0]?.staves?.[0]?.bars?.[8]?.voices?.[0]?.beats?.[0],
    );
  });

  const beforePlay = await page.evaluate(() => {
    const api = window.__ALPHATAB_API__!;
    const store = window.__PLAYER_STORE__!;
    const selectedBeat = {
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      barIndex: 8,
      beatIndex: 0,
      string: null,
    };
    const targetBeat =
      api.score!.tracks[0].staves[0].bars[8].voices[0].beats[0];
    const expectedTick =
      targetBeat.absolutePlaybackStart ?? targetBeat.playbackStart ?? null;

    api.tickPosition = 0;
    store.getState().setSelection(selectedBeat);
    const stateAfterSelection = store.getState();

    return {
      expectedTick,
      tickBeforePlay: api.tickPosition,
      playerStateBeforePlay: stateAfterSelection.playerState,
      selectedBeat: store.getState().selectedBeat,
      transportPlayhead: stateAfterSelection.transport.playhead,
    };
  });

  expect(beforePlay.selectedBeat).toMatchObject({
    trackIndex: 0,
    staffIndex: 0,
    voiceIndex: 0,
    barIndex: 8,
    beatIndex: 0,
  });
  expect(beforePlay.expectedTick).toBeGreaterThan(0);
  expect(beforePlay.tickBeforePlay).toBe(0);
  expect(beforePlay.playerStateBeforePlay).toBe("stopped");
  expect(beforePlay.transportPlayhead).toBeNull();

  await page.getByRole("button", { name: "Play" }).click();

  await page.waitForFunction(
    () => window.__PLAYER_STORE__!.getState().playerState === "playing",
  );

  const afterPlay = await page.evaluate(() => ({
    tickAfterPlay: window.__ALPHATAB_API__!.tickPosition,
    playerStateAfterPlay: window.__PLAYER_STORE__!.getState().playerState,
  }));

  expect(afterPlay.playerStateAfterPlay).toBe("playing");
  expect(afterPlay.tickAfterPlay).toBeLessThan(beforePlay.expectedTick);
});

test("Explicit transport playhead starts playback from the selector", async ({ page }) => {
  await page.goto("/");

  await page.waitForFunction(() => {
    const store = window.__PLAYER_STORE__;
    const api = window.__ALPHATAB_API__;
    return Boolean(
      store?.getState().isPlayerReady &&
        api?.score?.tracks?.[0]?.staves?.[0]?.bars?.[8]?.voices?.[0]?.beats?.[0],
    );
  });

  const beforePlay = await page.evaluate(() => {
    const api = window.__ALPHATAB_API__!;
    const store = window.__PLAYER_STORE__!;
    const selectedBeat = {
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      barIndex: 8,
      beatIndex: 0,
      string: null,
    };
    const targetBeat =
      api.score!.tracks[0].staves[0].bars[8].voices[0].beats[0];
    const expectedTick =
      targetBeat.absolutePlaybackStart ?? targetBeat.playbackStart ?? null;

    api.tickPosition = 0;
    store.getState().setSelection(selectedBeat);
    store.getState().setTransportPlayheadToSelection();
    const stateAfterTransport = store.getState();

    return {
      expectedTick,
      tickBeforePlay: api.tickPosition,
      transportPlayhead: stateAfterTransport.transport.playhead,
    };
  });

  expect(beforePlay.transportPlayhead).toMatchObject({
    trackIndex: 0,
    staffIndex: 0,
    voiceIndex: 0,
    barIndex: 8,
    beatIndex: 0,
  });
  expect(beforePlay.expectedTick).toBeGreaterThan(0);
  expect(beforePlay.tickBeforePlay).toBe(beforePlay.expectedTick);

  await page.getByRole("button", { name: "Play" }).click();

  await page.waitForFunction(
    () => window.__PLAYER_STORE__!.getState().playerState === "playing",
  );

  const afterPlay = await page.evaluate(() => ({
    tickAfterPlay: window.__ALPHATAB_API__!.tickPosition,
  }));

  expect(afterPlay.tickAfterPlay).toBeGreaterThanOrEqual(beforePlay.expectedTick);
  expect(afterPlay.tickAfterPlay).toBeLessThan(beforePlay.expectedTick + 3840);
});
