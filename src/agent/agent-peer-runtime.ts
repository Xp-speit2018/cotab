import { engine } from "@/core/engine";
import type { DocumentPeerConnection } from "@/core/editor/collaboration";
import type { MinimalMcpCallResult } from "@/protocol/minimal-mcp";
import type { AgentToMainMessage, MainToAgentMessage } from "./messages";
import { isTauriRuntime } from "./target";

export type AgentPeerRuntimeStatus = "stopped" | "starting" | "ready" | "error";

export interface AgentPeerRuntimeSnapshot {
  readonly status: AgentPeerRuntimeStatus;
  readonly clientId: number | null;
  readonly error: string | null;
}

const CALL_TIMEOUT_MS = 30_000;

class AgentPeerRuntime {
  private worker: Worker | null = null;
  private unregisterPeer: (() => void) | null = null;
  private nextRequestId = 1;
  private startPromise: Promise<void> | null = null;
  private resolveStart: (() => void) | null = null;
  private rejectStart: ((error: Error) => void) | null = null;
  private snapshot: AgentPeerRuntimeSnapshot = {
    status: "stopped",
    clientId: null,
    error: null,
  };
  private readonly pending = new Map<
    number,
    {
      resolve: (result: MinimalMcpCallResult) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();
  private readonly documentUpdateListeners = new Set<(update: Uint8Array) => void>();

  private readonly peerConnection: DocumentPeerConnection = {
    resetDocument: (update) => {
      const copy = update.slice().buffer;
      this.post({ type: "document.reset", update: copy }, [copy]);
    },
    updateDocument: (update) => {
      const copy = update.slice().buffer;
      this.post({ type: "document.update", update: copy }, [copy]);
    },
    onDocumentUpdate: (callback) => {
      this.documentUpdateListeners.add(callback);
      return () => this.documentUpdateListeners.delete(callback);
    },
  };

  private readonly handleWorkerMessage = (
    event: MessageEvent<AgentToMainMessage>,
  ): void => {
    const message = event.data;
    switch (message.type) {
      case "runtime.ready":
        break;
      case "document.ready":
        this.snapshot = {
          status: "ready",
          clientId: message.clientId,
          error: null,
        };
        this.resolveStart?.();
        this.resolveStart = null;
        this.rejectStart = null;
        break;
      case "document.update":
        for (const listener of this.documentUpdateListeners) {
          listener(new Uint8Array(message.update));
        }
        break;
      case "mcp.result": {
        const pending = this.pending.get(message.requestId);
        if (!pending) break;
        clearTimeout(pending.timeout);
        this.pending.delete(message.requestId);
        pending.resolve(message.result);
        break;
      }
    }
  };

  getSnapshot(): AgentPeerRuntimeSnapshot {
    return this.snapshot;
  }

  async start(): Promise<void> {
    if (!isTauriRuntime()) {
      throw new Error("The agent peer runtime is only available in CoTab Desktop.");
    }
    if (this.snapshot.status === "ready") return;
    if (this.startPromise) return this.startPromise;
    if (typeof Worker === "undefined") {
      throw new Error("Web Workers are not available in this runtime.");
    }

    this.snapshot = { status: "starting", clientId: null, error: null };
    this.startPromise = new Promise<void>((resolve, reject) => {
      this.resolveStart = resolve;
      this.rejectStart = reject;
    });

    const worker = new Worker(
      new URL("./agent-peer.worker.ts", import.meta.url),
      { type: "module", name: "cotab-agent-peer" },
    );
    this.worker = worker;
    worker.addEventListener("message", this.handleWorkerMessage);
    worker.addEventListener("error", (event) => {
      const error = new Error(event.message || "The agent peer worker failed.");
      this.snapshot = { status: "error", clientId: null, error: error.message };
      this.rejectStart?.(error);
      this.resolveStart = null;
      this.rejectStart = null;
      this.startPromise = null;
    });

    this.unregisterPeer = engine.registerDocumentPeer(this.peerConnection);

    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  stop(): void {
    this.unregisterPeer?.();
    this.unregisterPeer = null;

    if (this.worker) {
      this.post({ type: "runtime.stop" });
      this.worker.removeEventListener("message", this.handleWorkerMessage);
      this.worker.terminate();
      this.worker = null;
    }

    const error = new Error("Agent peer runtime stopped.");
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
    this.rejectStart?.(error);
    this.startPromise = null;
    this.resolveStart = null;
    this.rejectStart = null;
    this.snapshot = { status: "stopped", clientId: null, error: null };
  }

  async callTool(
    tool: string,
    args: unknown = {},
  ): Promise<MinimalMcpCallResult> {
    await this.start();
    if (!this.worker) throw new Error("Agent peer runtime is not running.");

    const requestId = this.nextRequestId++;
    const result = new Promise<MinimalMcpCallResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`CoTab MCP tool timed out: ${tool}`));
      }, CALL_TIMEOUT_MS);
      this.pending.set(requestId, { resolve, reject, timeout });
    });

    this.post({
      type: "mcp.call",
      requestId,
      tool,
      arguments: args,
    });
    return result;
  }

  private post(message: MainToAgentMessage, transfer?: Transferable[]): void {
    this.worker?.postMessage(message, transfer ?? []);
  }
}

export const agentPeerRuntime = new AgentPeerRuntime();
