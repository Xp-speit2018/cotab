import { expect, test } from "@playwright/test";

type RuntimeWindow = Window & {
  __ALPHATAB_API__: {
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
