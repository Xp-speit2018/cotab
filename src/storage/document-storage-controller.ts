import * as Y from "yjs";

import {
  createDocumentFromCotab,
  decodeCotabDocument,
  encodeCotabDocument,
} from "./cotab-file";
import type {
  DocumentStorageBinding,
  DocumentStorageProvider,
  DocumentStorageSnapshot,
  DocumentStorageTarget,
  StoredDocument,
} from "./types";

export interface DocumentStorageControllerOptions {
  readonly provider: DocumentStorageProvider;
  readonly getDocument: () => Y.Doc | null;
  readonly replaceDocument: (doc: Y.Doc) => void;
  readonly autoSaveDelayMs?: number;
  readonly minimumSaveIntervalMs?: number;
  readonly now?: () => number;
}

type Listener = (snapshot: DocumentStorageSnapshot) => void;

const DEFAULT_AUTO_SAVE_DELAY_MS = 2_000;
const DEFAULT_MINIMUM_SAVE_INTERVAL_MS = 5_000;
const STORAGE_MERGE_ORIGIN = "storage-merge";

export class DocumentStorageController {
  private readonly provider: DocumentStorageProvider;
  private readonly getDocument: () => Y.Doc | null;
  private readonly replaceDocument: (doc: Y.Doc) => void;
  private readonly autoSaveDelayMs: number;
  private readonly minimumSaveIntervalMs: number;
  private readonly now: () => number;
  private readonly listeners = new Set<Listener>();
  private snapshot: DocumentStorageSnapshot = {
    status: "unbound",
    binding: null,
    autoSaveEnabled: true,
    lastSavedAt: null,
    error: null,
    hasConflict: false,
  };
  private observedDocument: Y.Doc | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private savePromise: Promise<void> | null = null;
  private changeGeneration = 0;
  private conflict: StoredDocument | null | undefined;
  private replacingDocument = false;

  constructor(options: DocumentStorageControllerOptions) {
    this.provider = options.provider;
    this.getDocument = options.getDocument;
    this.replaceDocument = options.replaceDocument;
    this.autoSaveDelayMs = options.autoSaveDelayMs ?? DEFAULT_AUTO_SAVE_DELAY_MS;
    this.minimumSaveIntervalMs =
      options.minimumSaveIntervalMs ?? DEFAULT_MINIMUM_SAVE_INTERVAL_MS;
    this.now = options.now ?? Date.now;
    this.attachDocument(this.getDocument(), false);
  }

  getSnapshot(): DocumentStorageSnapshot {
    return this.snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  handleDocumentReplaced(doc: Y.Doc | null): void {
    if (this.replacingDocument) return;
    this.attachDocument(doc, this.snapshot.binding !== null);
  }

  setAutoSaveEnabled(enabled: boolean): void {
    this.publish({ autoSaveEnabled: enabled });
    if (enabled && this.snapshot.status === "dirty") this.scheduleAutoSave();
    if (!enabled) this.clearSaveTimer();
  }

  unbind(): void {
    this.clearSaveTimer();
    this.conflict = undefined;
    this.publish({
      status: "unbound",
      binding: null,
      lastSavedAt: null,
      error: null,
      hasConflict: false,
    });
  }

  async open(): Promise<boolean> {
    try {
      const stored = await this.provider.pickOpen();
      if (!stored) return false;
      await this.openStoredDocument(stored);
      return true;
    } catch (error) {
      this.reportError(error);
      return false;
    }
  }

  async openStoredDocument(stored: StoredDocument): Promise<void> {
    const doc = createDocumentFromCotab(stored.data);
    this.replacingDocument = true;
    try {
      this.replaceDocument(doc);
      this.attachDocument(doc, false);
    } finally {
      this.replacingDocument = false;
    }
    this.changeGeneration = 0;
    this.conflict = undefined;
    this.publish({
      status: "saved",
      binding: {
        providerId: this.provider.id,
        locator: stored.locator,
        displayName: stored.displayName,
        revision: stored.revision,
      },
      lastSavedAt: this.now(),
      error: null,
      hasConflict: false,
    });
  }

  async save(): Promise<boolean> {
    if (!this.snapshot.binding) return this.saveAs();
    if (this.snapshot.status === "saved") return true;
    if (this.savePromise) {
      await this.savePromise;
      return this.getSnapshot().status === "saved";
    }
    this.savePromise = this.writeToBinding(this.snapshot.binding).finally(() => {
      this.savePromise = null;
    });
    await this.savePromise;
    return this.getSnapshot().status === "saved";
  }

  async saveAs(): Promise<boolean> {
    try {
      const target = await this.provider.pickSave(this.suggestedName());
      if (!target) return false;
      return this.saveToTarget(target);
    } catch (error) {
      this.reportError(error);
      return false;
    }
  }

  async saveConflictCopy(): Promise<boolean> {
    if (this.snapshot.status !== "conflict") return false;
    return this.saveAs();
  }

  async mergeConflict(): Promise<boolean> {
    if (this.snapshot.status !== "conflict" || this.conflict === undefined) {
      return false;
    }
    const doc = this.getDocument();
    if (!doc || this.conflict === null) return false;
    const remote = decodeCotabDocument(this.conflict.data);
    Y.applyUpdate(doc, remote.update, STORAGE_MERGE_ORIGIN);
    const binding = this.snapshot.binding;
    if (!binding) return false;
    const revision = this.conflict.revision;
    this.conflict = undefined;
    this.publish({
      status: "dirty",
      binding: { ...binding, revision },
      hasConflict: false,
      error: null,
    });
    return this.save();
  }

  async overwriteConflict(): Promise<boolean> {
    if (this.snapshot.status !== "conflict" || this.conflict === undefined) {
      return false;
    }
    const binding = this.snapshot.binding;
    if (!binding) return false;
    const revision = this.conflict?.revision ?? null;
    this.conflict = undefined;
    this.publish({
      status: "dirty",
      binding: { ...binding, revision },
      hasConflict: false,
      error: null,
    });
    return this.save();
  }

  reportError(error: unknown): void {
    this.publish({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  destroy(): void {
    this.clearSaveTimer();
    this.attachDocument(null, false);
    this.listeners.clear();
  }

  private async saveToTarget(target: DocumentStorageTarget): Promise<boolean> {
    const binding: DocumentStorageBinding = {
      providerId: this.provider.id,
      locator: target.locator,
      displayName: target.displayName,
      revision: target.revision,
    };
    await this.writeToBinding(binding);
    return this.snapshot.status === "saved";
  }

  private async writeToBinding(binding: DocumentStorageBinding): Promise<void> {
    const doc = this.getDocument();
    if (!doc) {
      this.publish({ status: "error", error: "No document is open." });
      return;
    }
    const generation = this.changeGeneration;
    this.clearSaveTimer();
    this.publish({
      status: "saving",
      binding,
      error: null,
      hasConflict: false,
    });
    try {
      const result = await this.provider.write(
        binding.locator,
        encodeCotabDocument(doc, this.now()),
        binding.revision,
      );
      if (result.kind === "conflict") {
        this.conflict = result.current;
        this.publish({
          status: "conflict",
          binding,
          error: null,
          hasConflict: true,
        });
        return;
      }
      const savedAt = this.now();
      this.conflict = undefined;
      const nextBinding = { ...binding, revision: result.revision };
      if (generation === this.changeGeneration) {
        this.publish({
          status: "saved",
          binding: nextBinding,
          lastSavedAt: savedAt,
          error: null,
          hasConflict: false,
        });
      } else {
        this.publish({
          status: "dirty",
          binding: nextBinding,
          lastSavedAt: savedAt,
          error: null,
          hasConflict: false,
        });
        this.scheduleAutoSave();
      }
    } catch (error) {
      this.publish({
        status: "error",
        binding,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private attachDocument(doc: Y.Doc | null, markDirty: boolean): void {
    if (this.observedDocument === doc) return;
    this.observedDocument?.off("update", this.handleDocumentUpdate);
    this.observedDocument = doc;
    this.observedDocument?.on("update", this.handleDocumentUpdate);
    if (markDirty && doc) this.markDirty();
  }

  private readonly handleDocumentUpdate = (): void => {
    this.markDirty();
  };

  private markDirty(): void {
    this.changeGeneration += 1;
    if (!this.snapshot.binding) {
      this.publish({
        status: "dirty",
        error: null,
        hasConflict: false,
      });
      return;
    }
    if (this.snapshot.status !== "conflict") {
      this.publish({ status: "dirty", error: null, hasConflict: false });
      this.scheduleAutoSave();
    }
  }

  private scheduleAutoSave(): void {
    if (!this.snapshot.autoSaveEnabled || !this.snapshot.binding) return;
    this.clearSaveTimer();
    const sinceLastSave = this.snapshot.lastSavedAt === null
      ? Number.POSITIVE_INFINITY
      : this.now() - this.snapshot.lastSavedAt;
    const delay = Math.max(
      this.autoSaveDelayMs,
      this.minimumSaveIntervalMs - sinceLastSave,
    );
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.save();
    }, delay);
  }

  private clearSaveTimer(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  private suggestedName(): string {
    const doc = this.getDocument();
    const title = doc?.getMap("score").get("title");
    const value = typeof title === "string" ? title.trim() : "";
    const safe = value.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_") || "untitled";
    return `${safe}.cotab`;
  }

  private publish(patch: Partial<DocumentStorageSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener(this.snapshot);
  }
}
