import { isTauriRuntime } from "./target";

export interface AgentThreadBinding {
  readonly threadId: string;
  readonly documentId: string;
  readonly scoreLabel: string;
  readonly createdAt: number;
  readonly lastOpenedAt: number;
}

interface AgentHistoryIndexData {
  readonly version: 1;
  readonly bindings: AgentThreadBinding[];
}

const EMPTY_INDEX: AgentHistoryIndexData = { version: 1, bindings: [] };

async function invokeNative<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

class AgentHistoryIndex {
  private data: AgentHistoryIndexData | null = null;
  private loadPromise: Promise<AgentHistoryIndexData> | null = null;
  private saveQueue: Promise<void> = Promise.resolve();

  async load(): Promise<AgentThreadBinding[]> {
    if (this.data) return [...this.data.bindings];
    if (!isTauriRuntime()) return [];
    if (!this.loadPromise) {
      this.loadPromise = invokeNative<AgentHistoryIndexData>("load_agent_history")
        .then((data) => {
          this.data = data.version === 1 ? data : EMPTY_INDEX;
          return this.data;
        })
        .finally(() => {
          this.loadPromise = null;
        });
    }
    const data = await this.loadPromise;
    return [...data.bindings];
  }

  async upsert(binding: AgentThreadBinding): Promise<void> {
    await this.load();
    const current = this.data ?? EMPTY_INDEX;
    const bindings = current.bindings.filter(
      (candidate) => candidate.threadId !== binding.threadId,
    );
    bindings.push(binding);
    this.data = { version: 1, bindings };
    await this.persist();
  }

  async touch(threadId: string, openedAt: number): Promise<void> {
    await this.load();
    const current = this.data ?? EMPTY_INDEX;
    const bindings = current.bindings.map((binding) =>
      binding.threadId === threadId
        ? { ...binding, lastOpenedAt: openedAt }
        : binding,
    );
    this.data = { version: 1, bindings };
    await this.persist();
  }

  async remove(threadId: string): Promise<void> {
    await this.load();
    const current = this.data ?? EMPTY_INDEX;
    this.data = {
      version: 1,
      bindings: current.bindings.filter(
        (binding) => binding.threadId !== threadId,
      ),
    };
    await this.persist();
  }

  private async persist(): Promise<void> {
    if (!isTauriRuntime() || !this.data) return;
    const snapshot: AgentHistoryIndexData = {
      version: 1,
      bindings: [...this.data.bindings],
    };
    this.saveQueue = this.saveQueue.then(() =>
      invokeNative<void>("save_agent_history", { index: snapshot }),
    );
    await this.saveQueue;
  }
}

export const agentHistoryIndex = new AgentHistoryIndex();
