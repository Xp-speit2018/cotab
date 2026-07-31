import type { DocumentStorageProvider } from "./types";

export class DocumentStorageProviderRegistry {
  private readonly providers = new Map<string, DocumentStorageProvider>();

  constructor(providers: readonly DocumentStorageProvider[] = []) {
    for (const provider of providers) this.register(provider);
  }

  register(provider: DocumentStorageProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`Storage provider "${provider.id}" is already registered.`);
    }
    this.providers.set(provider.id, provider);
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
}
