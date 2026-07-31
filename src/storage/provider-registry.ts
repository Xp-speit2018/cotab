import type { DocumentStorageProvider } from "./types";

export class DocumentStorageProviderRegistry {
  private readonly providers = new Map<string, DocumentStorageProvider>();
  private readonly listeners = new Set<() => void>();

  constructor(providers: readonly DocumentStorageProvider[] = []) {
    for (const provider of providers) this.register(provider);
  }

  register(provider: DocumentStorageProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`Storage provider "${provider.id}" is already registered.`);
    }
    this.providers.set(provider.id, provider);
    this.emitChange();
  }

  unregister(providerId: string): void {
    if (this.providers.delete(providerId)) this.emitChange();
  }

  get(providerId: string): DocumentStorageProvider | undefined {
    return this.providers.get(providerId);
  }

  list(): readonly DocumentStorageProvider[] {
    return Array.from(this.providers.values());
  }

  ids(): readonly string[] {
    return Array.from(this.providers.keys());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitChange(): void {
    for (const listener of this.listeners) listener();
  }
}
