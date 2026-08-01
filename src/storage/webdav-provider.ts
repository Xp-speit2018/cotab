import type {
  DocumentStorageProvider,
  DocumentStorageTarget,
  DocumentWriteResult,
  StoredDocument,
} from "./types";
import {
  getActiveWebDavConfig,
  selectWebDavLocation,
  type WebDavConnectionConfig,
  type WebDavLocation,
} from "./webdav-location";

type Fetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

interface NativeWebDavResponse {
  readonly status: number;
  readonly statusText: string;
  readonly headers: Record<string, string>;
  readonly body: number[];
}

export interface WebDavStorageProviderOptions {
  readonly fetch?: Fetch;
  readonly pickLocation?: (
    operation: "open" | "save",
    suggestedName: string,
  ) => Promise<WebDavLocation | null>;
  readonly getConfig?: () => WebDavConnectionConfig | null;
}

function normalizeBaseUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("WebDAV server URL must use HTTP or HTTPS.");
  }
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  url.search = "";
  url.hash = "";
  return url;
}

function resolveLocation(config: WebDavConnectionConfig, path: string): URL {
  const relativePath = path.trim().replace(/^\/+/, "");
  if (!relativePath) throw new Error("WebDAV document path is required.");
  const base = normalizeBaseUrl(config.baseUrl);
  const url = new URL(relativePath, base);
  if (
    url.origin !== base.origin ||
    !url.pathname.startsWith(base.pathname)
  ) {
    throw new Error("WebDAV document path must stay within the configured server root.");
  }
  return url;
}

function assertLocator(
  config: WebDavConnectionConfig,
  locator: string,
): URL {
  const base = normalizeBaseUrl(config.baseUrl);
  const url = new URL(locator);
  if (
    url.origin !== base.origin ||
    !url.pathname.startsWith(base.pathname)
  ) {
    throw new Error("The WebDAV binding does not belong to the configured server.");
  }
  return url;
}

function encodeBasicAuth(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `Basic ${btoa(binary)}`;
}

function requestHeaders(
  config: WebDavConnectionConfig,
  extra?: Record<string, string>,
): Headers {
  const headers = new Headers(extra);
  if (config.username || config.password) {
    headers.set(
      "Authorization",
      encodeBasicAuth(config.username, config.password),
    );
  }
  return headers;
}

function responseError(operation: string, response: Response): Error {
  return new Error(
    `WebDAV ${operation} failed (${response.status} ${response.statusText}).`,
  );
}

function requiredEtag(response: Response): string {
  const etag = response.headers.get("etag");
  if (!etag) {
    throw new Error(
      "WebDAV server did not expose an ETag required for conflict detection.",
    );
  }
  if (etag.startsWith("W/")) {
    throw new Error(
      "WebDAV server exposed a weak ETag that cannot be used with If-Match.",
    );
  }
  return etag;
}

function displayName(url: URL): string {
  const segment = url.pathname.split("/").filter(Boolean).at(-1);
  return segment ? decodeURIComponent(segment) : "untitled.cotab";
}

async function nativeWebDavFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const url = input instanceof Request ? input.url : String(input);
  const headers = Object.fromEntries(new Headers(init?.headers).entries());
  const body = init?.body instanceof Uint8Array
    ? Array.from(init.body)
    : [];
  const { invoke } = await import("@tauri-apps/api/core");
  const response = await invoke<NativeWebDavResponse>("webdav_request", {
    request: {
      url,
      method: init?.method ?? "GET",
      headers,
      body,
    },
  });
  return new Response(
    response.body.length > 0 ? Uint8Array.from(response.body) : null,
    {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    },
  );
}

function defaultWebDavFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    return nativeWebDavFetch(input, init);
  }
  return fetch(input, init);
}

export class WebDavStorageProvider implements DocumentStorageProvider {
  readonly id = "webdav";
  readonly name = "WebDAV";
  private readonly request: Fetch;
  private readonly pickLocation: NonNullable<
    WebDavStorageProviderOptions["pickLocation"]
  >;
  private readonly getConfig: NonNullable<
    WebDavStorageProviderOptions["getConfig"]
  >;

  constructor(options: WebDavStorageProviderOptions = {}) {
    this.request = options.fetch ?? defaultWebDavFetch;
    this.pickLocation = options.pickLocation ?? selectWebDavLocation;
    this.getConfig = options.getConfig ?? getActiveWebDavConfig;
  }

  async pickOpen(): Promise<StoredDocument | null> {
    const location = await this.pickLocation("open", "");
    if (!location) return null;
    const stored = await this.readWithConfig(
      location.config,
      resolveLocation(location.config, location.path),
    );
    if (!stored) throw new Error("WebDAV document was not found.");
    return stored;
  }

  async pickSave(suggestedName: string): Promise<DocumentStorageTarget | null> {
    const location = await this.pickLocation("save", suggestedName);
    if (!location) return null;
    const url = resolveLocation(location.config, location.path);
    const response = await this.request(url, {
      method: "HEAD",
      headers: requestHeaders(location.config),
    });
    if (response.status === 404) {
      return {
        locator: url.href,
        displayName: displayName(url),
        revision: null,
      };
    }
    if (!response.ok) throw responseError("HEAD", response);
    return {
      locator: url.href,
      displayName: displayName(url),
      revision: requiredEtag(response),
    };
  }

  async read(locator: string): Promise<StoredDocument | null> {
    const config = this.requireConfig();
    return this.readWithConfig(config, assertLocator(config, locator));
  }

  async write(
    locator: string,
    data: Uint8Array,
    expectedRevision: string | null,
  ): Promise<DocumentWriteResult> {
    const config = this.requireConfig();
    const url = assertLocator(config, locator);
    const conditionalHeader: Record<string, string> = expectedRevision === null
      ? { "If-None-Match": "*" }
      : { "If-Match": expectedRevision };
    const response = await this.request(url, {
      method: "PUT",
      headers: requestHeaders(config, {
        "Content-Type": "application/octet-stream",
        ...conditionalHeader,
      }),
      body: data,
    });

    if (response.status === 412) {
      return {
        kind: "conflict",
        current: await this.readWithConfig(config, url),
      };
    }
    if (!response.ok) throw responseError("PUT", response);

    let revision = response.headers.get("etag");
    if (!revision) {
      const head = await this.request(url, {
        method: "HEAD",
        headers: requestHeaders(config),
      });
      if (!head.ok) throw responseError("HEAD", head);
      revision = requiredEtag(head);
    }
    return { kind: "saved", revision };
  }

  private requireConfig(): WebDavConnectionConfig {
    const config = this.getConfig();
    if (!config) throw new Error("Configure WebDAV before using this binding.");
    return config;
  }

  private async readWithConfig(
    config: WebDavConnectionConfig,
    url: URL,
  ): Promise<StoredDocument | null> {
    const response = await this.request(url, {
      method: "GET",
      headers: requestHeaders(config),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw responseError("GET", response);
    return {
      locator: url.href,
      displayName: displayName(url),
      revision: requiredEtag(response),
      data: new Uint8Array(await response.arrayBuffer()),
    };
  }
}
