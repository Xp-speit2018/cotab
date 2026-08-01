import type {
  DocumentStorageProvider,
  DocumentStorageTarget,
  DocumentWriteResult,
  StoredDocument,
} from "./types";
import {
  COTAB_FILE_EXTENSIONS,
  OPEN_SCORE_FILE_EXTENSIONS,
} from "./score-file-types";

interface FilePickerAcceptType {
  readonly description?: string;
  readonly accept: Record<string, readonly string[]>;
}

interface FilePickerOptions {
  readonly types?: readonly FilePickerAcceptType[];
  readonly excludeAcceptAllOption?: boolean;
}

interface SaveFilePickerOptions extends FilePickerOptions {
  readonly suggestedName?: string;
}

interface FilePickerWindow extends Window {
  showOpenFilePicker(
    options?: FilePickerOptions,
  ): Promise<readonly FileSystemFileHandle[]>;
  showSaveFilePicker(
    options?: SaveFilePickerOptions,
  ): Promise<FileSystemFileHandle>;
}

const COTAB_FILE_TYPE: FilePickerAcceptType = {
  description: "CoTab document",
  accept: { "application/octet-stream": COTAB_FILE_EXTENSIONS },
};

const OPEN_SCORE_FILE_TYPE: FilePickerAcceptType = {
  description: "CoTab or Guitar Pro score",
  accept: { "application/octet-stream": OPEN_SCORE_FILE_EXTENSIONS },
};

function isPickerCancellation(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function revisionOf(file: File): string {
  return `${file.lastModified}:${file.size}`;
}

export function isBrowserLocalFileStorageAvailable(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function hasNativeFilePickers(): boolean {
  return typeof window !== "undefined" &&
    "showOpenFilePicker" in window &&
    "showSaveFilePicker" in window;
}

type BrowserFileEntry =
  | { readonly kind: "handle"; readonly handle: FileSystemFileHandle }
  | { readonly kind: "fallback"; readonly file: File };

export class BrowserLocalFileProvider implements DocumentStorageProvider {
  readonly id = "local-file";
  readonly name = "Local file";

  private readonly entries = new Map<string, BrowserFileEntry>();
  private readonly locators = new WeakMap<FileSystemFileHandle, string>();
  private nextLocatorId = 0;

  async pickOpen(): Promise<StoredDocument | null> {
    if (!hasNativeFilePickers()) {
      const file = await this.pickFallbackFile();
      return file ? this.readFallbackFile(file) : null;
    }
    try {
      const [handle] = await this.pickerWindow().showOpenFilePicker({
        types: [OPEN_SCORE_FILE_TYPE],
        excludeAcceptAllOption: true,
      });
      return handle ? this.readHandle(handle) : null;
    } catch (error) {
      if (isPickerCancellation(error)) return null;
      throw error;
    }
  }

  async pickSave(suggestedName: string): Promise<DocumentStorageTarget | null> {
    if (!hasNativeFilePickers()) {
      const locator = `browser-download:${++this.nextLocatorId}`;
      this.entries.set(locator, {
        kind: "fallback",
        file: new File([], suggestedName),
      });
      return { locator, displayName: suggestedName, revision: null };
    }
    try {
      const handle = await this.pickerWindow().showSaveFilePicker({
        suggestedName,
        types: [COTAB_FILE_TYPE],
        excludeAcceptAllOption: true,
      });
      const file = await handle.getFile();
      return {
        locator: this.rememberHandle(handle),
        displayName: handle.name,
        revision: revisionOf(file),
      };
    } catch (error) {
      if (isPickerCancellation(error)) return null;
      throw error;
    }
  }

  async read(locator: string): Promise<StoredDocument | null> {
    const entry = this.entries.get(locator);
    if (!entry) return null;
    return entry.kind === "handle"
      ? this.readHandle(entry.handle, locator)
      : this.storedFallbackFile(entry.file, locator);
  }

  async write(
    locator: string,
    data: Uint8Array,
    expectedRevision: string | null,
  ): Promise<DocumentWriteResult> {
    const entry = this.entries.get(locator);
    if (!entry) {
      throw new Error("The local file handle is no longer available.");
    }

    if (entry.kind === "fallback") {
      const file = new File([data], entry.file.name, { lastModified: Date.now() });
      this.entries.set(locator, { kind: "fallback", file });
      this.download(file);
      return { kind: "saved", revision: revisionOf(file) };
    }

    const current = await this.readHandle(entry.handle, locator);
    if (expectedRevision !== current.revision) {
      return { kind: "conflict", current };
    }

    const writable = await entry.handle.createWritable();
    await writable.write(data);
    await writable.close();
    const saved = await entry.handle.getFile();
    return { kind: "saved", revision: revisionOf(saved) };
  }

  supportsAutoSave(locator: string): boolean {
    return this.entries.get(locator)?.kind === "handle";
  }

  private pickerWindow(): FilePickerWindow {
    if (!hasNativeFilePickers()) {
      throw new Error("Local file access is not supported by this browser.");
    }
    return window as unknown as FilePickerWindow;
  }

  private async readHandle(
    handle: FileSystemFileHandle,
    locator = this.rememberHandle(handle),
  ): Promise<StoredDocument> {
    const file = await handle.getFile();
    return {
      locator,
      displayName: handle.name,
      revision: revisionOf(file),
      data: new Uint8Array(await file.arrayBuffer()),
    };
  }

  private rememberHandle(handle: FileSystemFileHandle): string {
    const existing = this.locators.get(handle);
    if (existing) return existing;
    const locator = `browser-file:${++this.nextLocatorId}`;
    this.locators.set(handle, locator);
    this.entries.set(locator, { kind: "handle", handle });
    return locator;
  }

  private pickFallbackFile(): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = OPEN_SCORE_FILE_EXTENSIONS.join(",");
      input.hidden = true;
      const finish = (file: File | null) => {
        input.remove();
        resolve(file);
      };
      input.addEventListener("change", () => finish(input.files?.[0] ?? null), {
        once: true,
      });
      input.addEventListener("cancel", () => finish(null), { once: true });
      document.body.append(input);
      input.click();
    });
  }

  private readFallbackFile(file: File): Promise<StoredDocument> {
    const locator = `browser-import:${++this.nextLocatorId}`;
    this.entries.set(locator, { kind: "fallback", file });
    return this.storedFallbackFile(file, locator);
  }

  private async storedFallbackFile(
    file: File,
    locator: string,
  ): Promise<StoredDocument> {
    return {
      locator,
      displayName: file.name,
      revision: revisionOf(file),
      data: new Uint8Array(await file.arrayBuffer()),
    };
  }

  private download(file: File): void {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
