import { expect, test, type Page } from "@playwright/test";

interface StorageMockWindow extends Window {
  __ALPHATAB_API__?: {
    score?: { tracks?: unknown[] };
  };
  __COTAB_STORAGE_MOCK__?: {
    writes: number;
    revision: string | null;
    data: number[] | null;
    forceConflict(): void;
  };
}

async function installLocalStorageMock(page: Page) {
  await page.addInitScript(() => {
    let revisionCounter = 0;
    let revision: string | null = null;
    let data: number[] | null = null;
    let writes = 0;
    let forceConflict = false;

    const mock = {
      get writes() {
        return writes;
      },
      get revision() {
        return revision;
      },
      get data() {
        return data;
      },
      forceConflict() {
        forceConflict = true;
      },
    };
    (window as unknown as StorageMockWindow).__COTAB_STORAGE_MOCK__ = mock;

    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: {
        transformCallback: () => 1,
        unregisterCallback: () => undefined,
        runCallback: () => undefined,
        invoke: async (command: string, args?: Record<string, unknown>) => {
          if (command === "pick_local_document_path") {
            return {
              locator: "/tmp/storage-e2e.cotab",
              displayName: "storage-e2e.cotab",
              revision,
            };
          }
          if (command === "write_local_document") {
            const expectedRevision = args?.expectedRevision as string | null;
            if (forceConflict) {
              forceConflict = false;
              revision = `external-${++revisionCounter}`;
              return {
                kind: "conflict",
                current: data
                  ? {
                      locator: "/tmp/storage-e2e.cotab",
                      displayName: "storage-e2e.cotab",
                      revision,
                      data,
                    }
                  : null,
              };
            }
            if (expectedRevision !== revision) {
              return {
                kind: "conflict",
                current: data
                  ? {
                      locator: "/tmp/storage-e2e.cotab",
                      displayName: "storage-e2e.cotab",
                      revision,
                      data,
                    }
                  : null,
              };
            }
            data = [...(args?.data as number[])];
            revision = `local-${++revisionCounter}`;
            writes += 1;
            return { kind: "saved", revision };
          }
          if (command === "pick_local_score_file") {
            return data && revision
              ? {
                  kind: "cotab",
                  document: {
                    locator: "/tmp/storage-e2e.cotab",
                    displayName: "storage-e2e.cotab",
                    revision,
                    data,
                  },
                }
              : null;
          }
          if (command === "read_local_document") {
            return data && revision
              ? {
                  locator: "/tmp/storage-e2e.cotab",
                  displayName: "storage-e2e.cotab",
                  revision,
                  data,
                }
              : null;
          }
          return null;
        },
      },
    });
  });
}

async function waitForScore(page: Page) {
  await page.waitForFunction(() =>
    Boolean(
      (window as unknown as StorageMockWindow).__ALPHATAB_API__?.score?.tracks
        ?.length,
    ),
  );
}

test("desktop local storage saves, auto-saves, reopens, and resolves conflicts", async ({
  page,
}) => {
  await installLocalStorageMock(page);
  await page.goto("/");
  await waitForScore(page);

  const save = page.getByTestId("storage-save");
  await expect(save).toBeVisible();
  await save.click();
  await expect(save).toHaveAttribute(
    "aria-label",
    /Save CoTab document · Saved/,
  );
  await expect.poll(() =>
    page.evaluate(
      () =>
        (window as unknown as StorageMockWindow).__COTAB_STORAGE_MOCK__?.writes,
    ),
  ).toBe(1);

  await page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    engine.getDoc()?.getMap("score").set("title", "Auto-saved title");
  });
  await expect(save).toHaveAttribute(
    "aria-label",
    /Save CoTab document · Unsaved changes/,
  );
  await expect.poll(
    () =>
      page.evaluate(
        () =>
          (window as unknown as StorageMockWindow).__COTAB_STORAGE_MOCK__?.writes,
      ),
    { timeout: 8_000 },
  ).toBe(2);
  await expect(save).toHaveAttribute(
    "aria-label",
    /Save CoTab document · Saved/,
  );

  await page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    engine.getDoc()?.getMap("score").set("title", "Unsaved replacement");
  });
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Open file" }).click();
  await expect(page.getByText("Auto-saved title", { exact: true })).toBeVisible();
  await expect(save).toHaveAttribute(
    "aria-label",
    /Save CoTab document · Saved/,
  );

  await page.evaluate(async () => {
    const runtime = window as unknown as StorageMockWindow;
    runtime.__COTAB_STORAGE_MOCK__?.forceConflict();
    const { engine } = await import("/src/core/engine.ts");
    engine.getDoc()?.getMap("score").set("artist", "Local conflict edit");
  });
  await save.click();
  await expect(
    page.getByRole("heading", {
      name: "This document changed on disk",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Overwrite Disk" }).click();
  await expect(
    page.getByRole("heading", {
      name: "This document changed on disk",
    }),
  ).toHaveCount(0);
  await expect(save).toHaveAttribute(
    "aria-label",
    /Save CoTab document · Saved/,
  );

  await page.getByRole("button", { name: "Save options" }).click();
  const autoSave = page.getByRole("checkbox", { name: "Auto-save" });
  await expect(autoSave).toBeChecked();
  await autoSave.click();
  await expect(autoSave).not.toBeChecked();
  await expect(autoSave).toBeVisible();
});
