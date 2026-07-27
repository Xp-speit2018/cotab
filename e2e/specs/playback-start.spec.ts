import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __ALPHATAB_API__?: {
      tickPosition: number;
      playbackRange: {
        startTick: number;
        endTick: number;
      } | null;
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
        isLooping: boolean;
        playerState: "stopped" | "playing" | "paused";
        selectedBeat: unknown;
        transport: {
          playhead: {
            trackIndex: number;
            staffIndex: number;
            voiceIndex: number;
            barIndex: number;
            beatIndex: number;
            string: number | null;
          } | null;
          currentTime: number;
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
        toggleLoop(): void;
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

  await page.getByRole("button", { name: "Play", exact: true }).click();

  await page.waitForFunction(
    () => window.__PLAYER_STORE__!.getState().playerState === "playing",
  );

  const afterPlay = await page.evaluate(() => ({
    tickAfterPlay: window.__ALPHATAB_API__!.tickPosition,
    playerStateAfterPlay: window.__PLAYER_STORE__!.getState().playerState,
  }));

  expect(afterPlay.playerStateAfterPlay).toBe("playing");
  expect(afterPlay.tickAfterPlay).toBeLessThan(beforePlay.expectedTick);

  const afterLoopActivation = await page.evaluate(() => {
    const api = window.__ALPHATAB_API__!;
    const store = window.__PLAYER_STORE__!;
    const loopAddress = {
      trackIndex: 0,
      staffIndex: 0,
      voiceIndex: 0,
      barIndex: 8,
      beatIndex: 0,
    };
    const tickBeforeLoopActivation = api.tickPosition;
    store.getState().setTransportLoopRange({ start: loopAddress, end: loopAddress });
    store.getState().toggleLoop();
    return {
      appLooping: store.getState().isLooping,
      apiTickAfterLoopActivation: api.tickPosition,
      tickBeforeLoopActivation,
      playbackRange: api.playbackRange,
    };
  });

  expect(afterLoopActivation.appLooping).toBe(true);
  expect(afterLoopActivation.playbackRange).toBeNull();
  expect(afterLoopActivation.apiTickAfterLoopActivation).toBeLessThan(beforePlay.expectedTick);
  expect(afterLoopActivation.apiTickAfterLoopActivation).toBeGreaterThanOrEqual(
    afterLoopActivation.tickBeforeLoopActivation,
  );
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

  await page.getByRole("button", { name: "Play", exact: true }).click();

  await page.waitForFunction(
    () => window.__PLAYER_STORE__!.getState().playerState === "playing",
  );

  const afterPlay = await page.evaluate(() => ({
    tickAfterPlay: window.__ALPHATAB_API__!.tickPosition,
    transportTickAfterPlay: window.__PLAYER_STORE__!.getState().transport.tickPosition,
    transportPlayheadAfterPlay: window.__PLAYER_STORE__!.getState().transport.playhead,
  }));

  expect(afterPlay.tickAfterPlay).toBeGreaterThanOrEqual(beforePlay.expectedTick);
  expect(afterPlay.tickAfterPlay).toBeLessThan(beforePlay.expectedTick + 3840);
  expect(afterPlay.transportTickAfterPlay).toBe(afterPlay.tickAfterPlay);
  expect(afterPlay.transportPlayheadAfterPlay).toMatchObject({
    trackIndex: 0,
    staffIndex: 0,
    voiceIndex: 0,
    barIndex: 8,
    beatIndex: 0,
  });

  await page.getByRole("button", { name: "Stop and return to playhead" }).click();

  await page.waitForFunction(
    () => window.__PLAYER_STORE__!.getState().playerState === "stopped",
  );

  const afterStop = await page.evaluate(() => ({
    apiTickAfterStop: window.__ALPHATAB_API__!.tickPosition,
    transportTickAfterStop: window.__PLAYER_STORE__!.getState().transport.tickPosition,
    transportPlayheadAfterStop: window.__PLAYER_STORE__!.getState().transport.playhead,
  }));

  // AlphaTab seeks through milliseconds in its synth worker and converts the
  // result back to `targetTick + 1`; the immediate setter read can still expose
  // the exact target before that worker update arrives.
  expect(afterStop.apiTickAfterStop).toBeGreaterThanOrEqual(beforePlay.expectedTick);
  expect(afterStop.apiTickAfterStop).toBeLessThanOrEqual(beforePlay.expectedTick + 1);
  expect(afterStop.transportTickAfterStop).toBe(afterStop.apiTickAfterStop);
  expect(afterStop.transportPlayheadAfterStop).toMatchObject({
    trackIndex: 0,
    staffIndex: 0,
    voiceIndex: 0,
    barIndex: 8,
    beatIndex: 0,
  });
});
