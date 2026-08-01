import type {
  DocumentStorageProvider,
  DocumentStorageTarget,
  DocumentWriteResult,
  StoredDocument,
} from "./types";
import {
  getActiveWebDavConfig,
  normalizeWebDavBaseUrl,
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

export interface WebDavDirectoryEntry {
  readonly kind: "directory" | "file";
  readonly name: string;
  readonly path: string;
  readonly size: number | null;
  readonly lastModified: string | null;
}

function resolveLocation(config: WebDavConnectionConfig, path: string): URL {
  const relativePath = path.trim().replace(/^\/+/, "");
  if (!relativePath) throw new Error("WebDAV document path is required.");
  const base = normalizeWebDavBaseUrl(config.baseUrl);
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
  const base = normalizeWebDavBaseUrl(config.baseUrl);
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

function elementsByLocalName(
  root: Document | Element,
  localName: string,
): readonly Element[] {
  return Array.from(root.getElementsByTagName("*"))
    .filter((element) => element.localName === localName);
}

function childText(element: Element, localName: string): string | null {
  const child = elementsByLocalName(element, localName)[0];
  return child?.textContent?.trim() || null;
}

function relativeWebDavPath(root: URL, entry: URL): string | null {
  if (entry.origin !== root.origin || !entry.pathname.startsWith(root.pathname)) {
    return null;
  }
  const encoded = entry.pathname.slice(root.pathname.length);
  try {
    return encoded
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment))
      .join("/") + (entry.pathname.endsWith("/") && encoded ? "/" : "");
  } catch {
    return null;
  }
}

export function parseWebDavDirectory(
  xml: string,
  root: URL,
  directory: URL,
): readonly WebDavDirectoryEntry[] {
  const document = new DOMParser().parseFromString(xml.trim(), "application/xml");
  if (elementsByLocalName(document, "parsererror").length > 0) {
    throw new Error("WebDAV server returned an invalid directory response.");
  }

  const directoryPath = directory.pathname.endsWith("/")
    ? directory.pathname
    : `${directory.pathname}/`;
  const entries = elementsByLocalName(document, "response")
    .flatMap<WebDavDirectoryEntry>((response) => {
      const href = childText(response, "href");
      if (!href) return [];
      const entryUrl = new URL(href, directory);
      const entryPath = relativeWebDavPath(root, entryUrl);
      if (entryPath === null) return [];
      const normalizedEntryPath = entryUrl.pathname.endsWith("/")
        ? entryUrl.pathname
        : `${entryUrl.pathname}/`;
      if (normalizedEntryPath === directoryPath) return [];

      const resourceType = elementsByLocalName(response, "resourcetype")[0];
      const isDirectory = resourceType
        ? elementsByLocalName(resourceType, "collection").length > 0
        : false;
      const pathSegments = entryUrl.pathname.split("/").filter(Boolean);
      const fallbackName = pathSegments.at(-1) ?? entryPath;
      const displayName = childText(response, "displayname");
      let name: string;
      try {
        name = displayName || decodeURIComponent(fallbackName);
      } catch {
        name = displayName || fallbackName;
      }
      const rawSize = childText(response, "getcontentlength");
      const size = rawSize === null ? null : Number(rawSize);

      return [{
        kind: isDirectory ? "directory" : "file",
        name,
        path: entryPath,
        size: Number.isFinite(size) ? size : null,
        lastModified: childText(response, "getlastmodified"),
      }];
    });

  return entries.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1;
    return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  });
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

export async function listWebDavDirectory(
  config: WebDavConnectionConfig,
  directoryPath = "",
  request: Fetch = defaultWebDavFetch,
): Promise<readonly WebDavDirectoryEntry[]> {
  const root = normalizeWebDavBaseUrl(config.baseUrl);
  const relativePath = directoryPath.trim().replace(/^\/+/, "");
  const directory = new URL(relativePath, root);
  if (
    directory.origin !== root.origin ||
    !directory.pathname.startsWith(root.pathname)
  ) {
    throw new Error("WebDAV directory must stay within the configured server root.");
  }
  if (!directory.pathname.endsWith("/")) directory.pathname += "/";

  const response = await request(directory, {
    method: "PROPFIND",
    headers: requestHeaders(config, {
      Depth: "1",
      "Content-Type": "application/xml; charset=utf-8",
    }),
    body: new TextEncoder().encode(
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<d:propfind xmlns:d="DAV:"><d:prop>' +
      "<d:displayname/><d:resourcetype/><d:getcontentlength/>" +
      "<d:getlastmodified/>" +
      "</d:prop></d:propfind>",
    ),
  });
  if (!response.ok) throw responseError("PROPFIND", response);
  return parseWebDavDirectory(await response.text(), root, directory);
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
