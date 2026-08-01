import { expect, test, type Page } from "@playwright/test";

interface StorageMockWindow extends Window {
  __ALPHATAB_API__?: {
    score?: { tracks?: unknown[] };
  };
  __COTAB_STORAGE_MOCK__?: {
    picks: number;
    writes: number;
    revision: string | null;
    data: number[] | null;
    forceConflict(): void;
  };
  __COTAB_CLOUD_MOCK__?: {
    writes: number;
    data: number[] | null;
  };
  __COTAB_WEBDAV_MOCK__?: {
    writes: number;
    requests: Array<{
      method: string;
      ifMatch: string | null;
      ifNoneMatch: string | null;
    }>;
  };
  __COTAB_BROWSER_FILE_MOCK__?: {
    readonly openPicks: number;
    readonly savePicks: number;
    readonly writes: number;
  };
}

async function installBrowserLocalFileMock(page: Page) {
  await page.addInitScript(() => {
    let data = new Uint8Array();
    let modified = 1;
    let openPicks = 0;
    let savePicks = 0;
    let writes = 0;
    const handle = {
      kind: "file" as const,
      name: "browser-local.cotab",
      async getFile() {
        return new File([data], this.name, { lastModified: modified });
      },
      async createWritable() {
        let nextData = data;
        return {
          async write(value: ArrayBuffer | ArrayBufferView | Blob | string) {
            if (value instanceof Blob) {
              nextData = new Uint8Array(await value.arrayBuffer());
            } else if (typeof value === "string") {
              nextData = new TextEncoder().encode(value);
            } else if (ArrayBuffer.isView(value)) {
              nextData = new Uint8Array(
                value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength),
              );
            } else {
              nextData = new Uint8Array(value.slice(0));
            }
          },
          async close() {
            data = nextData;
            modified += 1;
            writes += 1;
          },
        };
      },
      async isSameEntry(other: unknown) {
        return other === handle;
      },
    };
    Object.assign(window, {
      showOpenFilePicker: async () => {
        openPicks += 1;
        return [handle];
      },
      showSaveFilePicker: async () => {
        savePicks += 1;
        return handle;
      },
    });
    (window as unknown as StorageMockWindow).__COTAB_BROWSER_FILE_MOCK__ = {
      get openPicks() {
        return openPicks;
      },
      get savePicks() {
        return savePicks;
      },
      get writes() {
        return writes;
      },
    };
  });
}

async function installLocalStorageMock(page: Page) {
  await page.addInitScript(() => {
    let revisionCounter = 0;
    let revision: string | null = null;
    let data: number[] | null = null;
    let picks = 0;
    let writes = 0;
    let forceConflict = false;

    const mock = {
      get picks() {
        return picks;
      },
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
          if (command === "webdav_request") {
            const request = args?.request as {
              url: string;
              method: string;
              headers: Record<string, string>;
              body: number[];
            };
            const response = await window.fetch(request.url, {
              method: request.method,
              headers: request.headers,
              body: request.body.length > 0
                ? Uint8Array.from(request.body)
                : undefined,
            });
            return {
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
              body: Array.from(new Uint8Array(await response.arrayBuffer())),
            };
          }
          if (command === "pick_local_document_path") {
            picks += 1;
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

async function installWebDavMock(page: Page) {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    let data: Uint8Array | null = null;
    let revision = 0;
    let writes = 0;
    const requests: Array<{
      method: string;
      ifMatch: string | null;
      ifNoneMatch: string | null;
    }> = [];
    const mock = {
      get writes() {
        return writes;
      },
      requests,
    };
    (window as unknown as StorageMockWindow).__COTAB_WEBDAV_MOCK__ = mock;

    window.fetch = async (input, init) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );
      if (url.origin !== "https://dav.example.test") {
        return originalFetch(input, init);
      }
      const method = init?.method ?? "GET";
      const headers = new Headers(init?.headers);
      requests.push({
        method,
        ifMatch: headers.get("if-match"),
        ifNoneMatch: headers.get("if-none-match"),
      });

      if (method === "HEAD") {
        return data
          ? new Response(null, {
              status: 200,
              headers: { ETag: `"dav-${revision}"` },
            })
          : new Response(null, { status: 404 });
      }
      if (method === "GET") {
        return data
          ? new Response(data, {
              status: 200,
              headers: { ETag: `"dav-${revision}"` },
            })
          : new Response(null, { status: 404 });
      }
      if (method === "PROPFIND") {
        const body = data ? `
          <?xml version="1.0" encoding="utf-8"?>
          <d:multistatus xmlns:d="DAV:">
            <d:response>
              <d:href>/files/alice/</d:href>
              <d:propstat><d:prop>
                <d:displayname>alice</d:displayname>
                <d:resourcetype><d:collection/></d:resourcetype>
              </d:prop></d:propstat>
            </d:response>
            <d:response>
              <d:href>/files/alice/Taijin%20Kyofusho.cotab</d:href>
              <d:propstat><d:prop>
                <d:displayname>Taijin Kyofusho.cotab</d:displayname>
                <d:resourcetype/>
                <d:getcontentlength>${data.byteLength}</d:getcontentlength>
              </d:prop></d:propstat>
            </d:response>
          </d:multistatus>
        ` : `
          <?xml version="1.0" encoding="utf-8"?>
          <d:multistatus xmlns:d="DAV:">
            <d:response>
              <d:href>/files/alice/</d:href>
              <d:propstat><d:prop>
                <d:displayname>alice</d:displayname>
                <d:resourcetype><d:collection/></d:resourcetype>
              </d:prop></d:propstat>
            </d:response>
          </d:multistatus>
        `;
        return new Response(body, {
          status: 207,
          headers: { "Content-Type": "application/xml" },
        });
      }
      if (method === "PUT") {
        const currentEtag = data ? `"dav-${revision}"` : null;
        const conditionMatches = currentEtag === null
          ? headers.get("if-none-match") === "*"
          : headers.get("if-match") === currentEtag;
        if (!conditionMatches) return new Response(null, { status: 412 });
        data = new Uint8Array(
          await new Response(init?.body ?? null).arrayBuffer(),
        );
        revision += 1;
        writes += 1;
        return new Response(null, {
          status: 201,
          headers: { ETag: `"dav-${revision}"` },
        });
      }
      return new Response(null, { status: 405 });
    };
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

test("Web Open keeps imports and read-only examples alongside WebDAV", async ({ page }) => {
  await page.goto("/");
  await waitForScore(page);

  await page.getByRole("button", { name: "Open file" }).click();
  await expect(page.getByRole("heading", { name: "Open from" })).toBeVisible();
  await expect(page.getByRole("button", { name: /WebDAV/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Import Guitar Pro/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Examples/ })).toBeVisible();
});

test("Bundled demos open read-only and Save chooses a writable provider", async ({
  page,
}) => {
  await page.goto("/");
  await waitForScore(page);
  await page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    engine.getDoc()?.getMap("score").set("artist", "Unsaved replacement");
  });

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Open file" }).click();
  await page.getByRole("button", { name: /Examples/ }).click();
  await expect(page.getByRole("heading", { name: "Examples" })).toBeVisible();
  await page.getByRole("button", { name: /Taijin Kyofusho/ }).click();

  await expect.poll(() => page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    return {
      artist: engine.getScoreMap()?.get("artist"),
      binding: engine.storage.binding,
      status: engine.storage.status,
    };
  })).toEqual({
    artist: "The Evapatoria Report",
    binding: null,
    status: "unbound",
  });

  await page.getByTestId("storage-save").click();
  await expect(page.getByRole("heading", { name: "Save to" })).toBeVisible();
  await expect(page.getByRole("button", { name: /WebDAV/ })).toBeVisible();
});

test("Web Save As offers local download and WebDAV without native handles", async ({
  page,
}) => {
  await page.goto("/");
  await waitForScore(page);

  const saveAsShortcut = await page.evaluate(() =>
    navigator.userAgent.toLowerCase().includes("mac")
      ? "Meta+Shift+s"
      : "Control+Shift+s"
  );
  await page.keyboard.press(saveAsShortcut);
  await expect(page.getByRole("heading", { name: "Save to" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Local file/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /WebDAV/ })).toBeVisible();
});

test("Web local files remain bound across Save As, Save, and Open", async ({
  page,
}) => {
  await installBrowserLocalFileMock(page);
  await page.goto("/");
  await waitForScore(page);

  const saveAsShortcut = await page.evaluate(() =>
    navigator.userAgent.toLowerCase().includes("mac")
      ? "Meta+Shift+s"
      : "Control+Shift+s"
  );
  await page.keyboard.press(saveAsShortcut);
  await page.getByRole("button", { name: /Local file/ }).click();

  await expect.poll(() => page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    return {
      binding: engine.storage.binding,
      status: engine.storage.status,
      writes: (window as unknown as StorageMockWindow)
        .__COTAB_BROWSER_FILE_MOCK__?.writes,
    };
  })).toMatchObject({
    binding: {
      providerId: "local-file",
      displayName: "browser-local.cotab",
    },
    status: "saved",
    writes: 1,
  });

  await page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    engine.getDoc()?.getMap("score").set("artist", "Saved in browser file");
  });
  await page.getByTestId("storage-save").click();
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as StorageMockWindow)
      .__COTAB_BROWSER_FILE_MOCK__?.writes
  )).toBe(2);

  await page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    engine.getDoc()?.getMap("score").set("artist", "Unsaved replacement");
  });
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Open file" }).click();
  await expect(page.getByRole("button", { name: /Local file/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Import Guitar Pro/ })).toBeVisible();
  await page.getByRole("button", { name: /Local file/ }).click();

  await expect.poll(() => page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    return {
      artist: engine.getScoreMap()?.get("artist"),
      openPicks: (window as unknown as StorageMockWindow)
        .__COTAB_BROWSER_FILE_MOCK__?.openPicks,
    };
  })).toEqual({ artist: "Saved in browser file", openPicks: 1 });
});

test("Cmd+S prompts for an unbound document while an inline editor is focused", async ({
  page,
}) => {
  await installLocalStorageMock(page);
  await page.goto("/");
  await waitForScore(page);

  await page.getByRole("button", { name: "Meta", exact: true }).click();
  const titleRow = page.locator("[data-interaction='inline-edit']").filter({
    has: page.getByText("Title", { exact: true }),
  });
  await titleRow.locator("[data-single-line-edit-field]").click();
  const titleInput = titleRow.getByRole("textbox", { name: "Title" });
  await titleInput.fill("Saved from the active title editor");

  const saveShortcut = await page.evaluate(() =>
    navigator.userAgent.toLowerCase().includes("mac") ? "Meta+s" : "Control+s"
  );
  await page.keyboard.press(saveShortcut);
  await expect(page.getByRole("heading", { name: "Save to" })).toBeVisible();
  await page.getByRole("button", { name: /Local disk/ }).click();

  await expect.poll(() =>
    page.evaluate(
      () =>
        (window as unknown as StorageMockWindow).__COTAB_STORAGE_MOCK__?.picks,
    ),
  ).toBe(1);
  await expect.poll(() =>
    page.evaluate(
      () =>
        (window as unknown as StorageMockWindow).__COTAB_STORAGE_MOCK__?.writes,
    ),
  ).toBe(1);
  await expect(titleInput).toHaveCount(0);
  await expect.poll(() => page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    return engine.getScoreMap()?.get("title");
  })).toBe("Saved from the active title editor");
  await expect.poll(() => page.evaluate(async () => {
    const data = (window as unknown as StorageMockWindow).__COTAB_STORAGE_MOCK__
      ?.data;
    if (!data) return null;
    const { createDocumentFromCotab } = await import(
      "/src/storage/cotab-file.ts"
    );
    return createDocumentFromCotab(Uint8Array.from(data))
      .getMap("score")
      .get("title");
  })).toBe("Saved from the active title editor");
});

test("Save As switches an existing binding to another storage provider", async ({
  page,
}) => {
  await installLocalStorageMock(page);
  await page.goto("/");
  await waitForScore(page);

  await page.evaluate(async () => {
    let writes = 0;
    let data: number[] | null = null;
    const cloudMock = {
      get writes() {
        return writes;
      },
      get data() {
        return data;
      },
    };
    (window as unknown as StorageMockWindow).__COTAB_CLOUD_MOCK__ = cloudMock;

    const { documentStorageProviders } = await import(
      "/src/storage/document-storage-runtime.ts"
    );
    documentStorageProviders.register({
      id: "test-cloud",
      name: "Test cloud",
      async pickOpen() {
        return null;
      },
      async pickSave(suggestedName: string) {
        return {
          locator: `cloud/${suggestedName}`,
          displayName: suggestedName,
          revision: null,
        };
      },
      async read() {
        return null;
      },
      async write(_locator: string, nextData: Uint8Array) {
        data = Array.from(nextData);
        writes += 1;
        return { kind: "saved" as const, revision: `cloud-${writes}` };
      },
    });
  });

  await page.getByTestId("storage-save").click();
  const providerDialogTitle = page.getByRole("heading", { name: "Save to" });
  await expect(providerDialogTitle).toBeVisible();
  await page.getByRole("button", { name: /Local disk/ }).click();
  await expect(providerDialogTitle).toBeHidden();
  await expect.poll(() =>
    page.evaluate(
      () =>
        (window as unknown as StorageMockWindow).__COTAB_STORAGE_MOCK__?.writes,
    ),
  ).toBe(1);

  await page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    engine.getDoc()?.getMap("score").set("artist", "Moved to cloud");
  });
  const saveAsShortcut = await page.evaluate(() =>
    navigator.userAgent.toLowerCase().includes("mac")
      ? "Meta+Shift+s"
      : "Control+Shift+s"
  );
  await page.keyboard.press(saveAsShortcut);
  await expect(providerDialogTitle).toBeVisible();
  await page.getByRole("button", { name: /Test cloud/ }).click();

  await expect.poll(() =>
    page.evaluate(
      () =>
        (window as unknown as StorageMockWindow).__COTAB_CLOUD_MOCK__?.writes,
    ),
  ).toBe(1);
  expect(await page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    return engine.storage.binding;
  })).toMatchObject({
    providerId: "test-cloud",
    displayName: "Taijin Kyofusho.cotab",
  });
});

test("WebDAV saves with ETag preconditions and keeps credentials out of persistence", async ({
  page,
}) => {
  await installLocalStorageMock(page);
  await installWebDavMock(page);
  await page.goto("/");
  await waitForScore(page);

  const save = page.getByTestId("storage-save");
  await save.click();
  await page.getByRole("button", { name: /WebDAV/ }).click();
  await expect(
    page.getByRole("heading", { name: "Save to WebDAV" }),
  ).toBeVisible();
  await page.getByLabel("Connection name").fill("Alice cloud");
  await page.getByLabel("Server URL").fill(
    "dav.example.test/files/alice",
  );
  await page.getByLabel("Username").fill("alice");
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("not-persisted");
  await expect(password).toHaveAttribute("type", "password");
  const revealPassword = page.getByRole("button", {
    name: "Hold to show password",
  });
  await revealPassword.hover();
  await page.mouse.down();
  await expect(password).toHaveAttribute("type", "text");
  await page.mouse.up();
  await expect(password).toHaveAttribute("type", "password");
  await expect(page.getByLabel("Document path")).toHaveValue(
    "Taijin Kyofusho.cotab",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(save).toHaveAttribute(
    "aria-label",
    /Save CoTab document · Saved/,
  );
  expect(await page.evaluate(async () => {
    const runtime = window as unknown as StorageMockWindow;
    const { engine } = await import("/src/core/engine.ts");
    return {
      binding: engine.storage.binding,
      writes: runtime.__COTAB_WEBDAV_MOCK__?.writes,
      persistedProfiles: localStorage.getItem("cotab:webdav-profiles-v1"),
    };
  })).toMatchObject({
    binding: {
      providerId: "webdav",
      locator:
        "https://dav.example.test/files/alice/Taijin%20Kyofusho.cotab",
    },
    writes: 1,
  });
  const persistedProfiles = await page.evaluate(
    () => localStorage.getItem("cotab:webdav-profiles-v1"),
  );
  expect(persistedProfiles).toContain("Alice cloud");
  expect(persistedProfiles).not.toContain("not-persisted");

  await page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    engine.getDoc()?.getMap("score").set("artist", "WebDAV update");
  });
  await save.click();
  await expect.poll(() =>
    page.evaluate(
      () =>
        (window as unknown as StorageMockWindow).__COTAB_WEBDAV_MOCK__?.writes,
    ),
  ).toBe(2);
  expect(await page.evaluate(
    () =>
      (window as unknown as StorageMockWindow).__COTAB_WEBDAV_MOCK__?.requests,
  )).toEqual([
    { method: "HEAD", ifMatch: null, ifNoneMatch: null },
    { method: "PUT", ifMatch: null, ifNoneMatch: "*" },
    { method: "PUT", ifMatch: '"dav-1"', ifNoneMatch: null },
  ]);

  await page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    engine.getDoc()?.getMap("score").set("title", "Unsaved WebDAV replacement");
  });
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Open file" }).click();
  await page.getByRole("button", { name: /WebDAV/ }).click();
  await expect(
    page.getByRole("heading", { name: "Open from WebDAV" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Alice cloud/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /New connection/ })).toBeVisible();
  await expect(page.getByLabel("Connection name")).toHaveValue("Alice cloud");
  await expect(page.getByLabel("Server URL")).toHaveValue(
    "https://dav.example.test/files/alice/",
  );
  await expect(page.getByLabel("Username")).toHaveValue("alice");
  await expect(page.getByLabel("Password", { exact: true }))
    .toHaveValue("not-persisted");
  await page.getByRole("button", { name: "Browse server" }).click();
  await expect(page.getByLabel("WebDAV files")).toBeVisible();
  await page.getByRole("button", {
    name: /Taijin Kyofusho\.cotab/,
  }).click();
  await expect(page.getByLabel("Document path"))
    .toHaveValue("Taijin Kyofusho.cotab");
  await page.getByRole("button", { name: "Open", exact: true }).click();

  await expect.poll(() => page.evaluate(async () => {
    const { engine } = await import("/src/core/engine.ts");
    return {
      title: engine.getScoreMap()?.get("title"),
      artist: engine.getScoreMap()?.get("artist"),
      status: engine.storage.status,
      providerId: engine.storage.binding?.providerId,
    };
  })).toEqual({
    title: "Taijin Kyofusho",
    artist: "WebDAV update",
    status: "saved",
    providerId: "webdav",
  });
});

test("desktop local storage saves, auto-saves, reopens, and resolves conflicts", async ({
  page,
}) => {
  await installLocalStorageMock(page);
  await page.goto("/");
  await waitForScore(page);

  const save = page.getByTestId("storage-save");
  await expect(save).toBeVisible();
  await expect(save).toHaveAttribute(
    "aria-label",
    /Save CoTab document · Not saved/,
  );
  await save.click();
  await expect(page.getByRole("heading", { name: "Save to" })).toBeVisible();
  await page.getByRole("button", { name: /Local disk/ }).click();
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
  expect(await page.evaluate(async () => {
    const [{ engine }, { useEditorStore }] = await Promise.all([
      import("/src/core/engine.ts"),
      import("/src/stores/editor-store.ts"),
    ]);
    return {
      sameReference: useEditorStore.getState().storage === engine.storage,
      binding: engine.storage.binding,
    };
  })).toMatchObject({
    sameReference: true,
    binding: {
      providerId: "local-disk",
      displayName: "storage-e2e.cotab",
    },
  });

  await page.getByRole("button", { name: "Debug", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sync State", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("syncState", { exact: true })).toBeVisible();
  await expect(page.getByText("storage", { exact: true })).toBeVisible();
  await page.getByText("binding", { exact: true }).click();
  await expect(page.getByText('"storage-e2e.cotab"', { exact: true }))
    .toBeVisible();

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
  await expect(page.getByRole("heading", { name: "Open from" })).toBeVisible();
  await page.getByRole("button", { name: /Local disk/ }).click();
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
