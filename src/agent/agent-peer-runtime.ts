import { engine, subscribeActiveEngine } from "@/core/engine";
import type { DocumentPeerConnection } from "@/core/editor/collaboration";
import type { MinimalMcpCallResult } from "@/protocol/minimal-mcp";
import {
  getRendererDiagnostics,
  waitForRendererRevision,
  type RendererRevisionOutcome,
} from "@/stores/renderer-bridge";
import type { AgentToMainMessage, MainToAgentMessage } from "./messages";
import { isTauriRuntime } from "./target";

export type AgentPeerRuntimeStatus = "stopped" | "starting" | "ready" | "error";

export interface AgentPeerRuntimeSnapshot {
  readonly status: AgentPeerRuntimeStatus;
  readonly clientId: number | null;
  readonly error: string | null;
}

export interface AgentToolDiagnostics {
  readonly document: {
    readonly changed: boolean;
    readonly workerUpdateCount: number;
    readonly mainUpdateCount: number;
  };
  readonly renderer: RendererRevisionOutcome | null;
}

export type AgentMcpCallResult = MinimalMcpCallResult & {
  readonly diagnostics?: AgentToolDiagnostics;
};

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
  private receivedDocumentUpdateCount = 0;
  private readonly pending = new Map<
    number,
    {
      tool: string;
      arguments: unknown;
      rendererRevisionBefore: number;
      receivedDocumentUpdatesBefore: number;
      resolve: (result: AgentMcpCallResult) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();
  private readonly documentUpdateListeners = new Set<(update: Uint8Array) => void>();
  private readonly statusListeners = new Set<
    (status: NonNullable<DocumentPeerConnection["peer"]>["status"]) => void
  >();

  private readonly peerConnection: DocumentPeerConnection = {
    peer: {
      id: "agent:local-codex",
      name: "Local Codex",
      kind: "agent",
      status: "connecting",
    },
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
    onPeerStatusChange: (callback) => {
      this.statusListeners.add(callback);
      return () => this.statusListeners.delete(callback);
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
        this.setSnapshot({ status: "ready", clientId: message.clientId, error: null });
        this.resolveStart?.();
        this.resolveStart = null;
        this.rejectStart = null;
        break;
      case "document.update":
        this.receivedDocumentUpdateCount += 1;
        for (const listener of this.documentUpdateListeners) {
          listener(new Uint8Array(message.update));
        }
        break;
      case "mcp.result":
        void this.completeToolCall(message);
        break;
    }
  };

  private readonly completeToolCall = async (
    message: Extract<AgentToMainMessage, { type: "mcp.result" }>,
  ): Promise<void> => {
    const pending = this.pending.get(message.requestId);
    if (!pending) return;

    const mainUpdateCount =
      this.receivedDocumentUpdateCount - pending.receivedDocumentUpdatesBefore;
    const documentDiagnostics: AgentToolDiagnostics["document"] = {
      changed: message.documentUpdateCount > 0,
      workerUpdateCount: message.documentUpdateCount,
      mainUpdateCount,
    };

    if (message.documentUpdateCount === 0) {
      if (!message.result.ok || pending.tool !== "execute_action") {
        this.resolvePending(message.requestId, pending, message.result);
        return;
      }
      const actionId = this.actionId(pending.arguments);
      this.resolvePending(message.requestId, pending, {
        ok: false,
        error: {
          code: "execution_failed",
          message:
            `Core-edit action ${JSON.stringify(actionId)} completed without a Y.Doc update. `
            + "It may have been blocked by an invalid selector or resolved to a no-op.",
        },
        diagnostics: {
          document: documentDiagnostics,
          renderer: null,
        },
      });
      return;
    }

    const rendererRevision = getRendererDiagnostics().requestedRevision;
    if (rendererRevision <= pending.rendererRevisionBefore) {
      this.resolvePending(message.requestId, pending, {
        ok: false,
        error: {
          code: "execution_failed",
          message:
            "The Agent updated Y.Doc, but the main renderer did not observe a new rebuild revision.",
        },
        diagnostics: {
          document: documentDiagnostics,
          renderer: null,
        },
      });
      return;
    }

    const renderer = await waitForRendererRevision(rendererRevision);
    if (this.pending.get(message.requestId) !== pending) return;
    const diagnostics: AgentToolDiagnostics = {
      document: documentDiagnostics,
      renderer,
    };
    if (renderer.status === "failed") {
      const actionId = this.actionId(pending.arguments);
      const detail = renderer.error?.message ?? "Unknown renderer error.";
      this.resolvePending(message.requestId, pending, {
        ok: false,
        error: {
          code: "execution_failed",
          message:
            `Y.Doc changed for ${JSON.stringify(actionId)}, but AlphaTab renderer revision `
            + `${renderer.revision} failed during ${renderer.stage}: ${detail}`,
        },
        diagnostics,
      });
      return;
    }

    this.resolvePending(message.requestId, pending, {
      ...message.result,
      diagnostics,
    });
  };

  private actionId(argumentsValue: unknown): string {
    if (typeof argumentsValue !== "object" || argumentsValue === null) {
      return "unknown action";
    }
    const id = (argumentsValue as { id?: unknown }).id;
    return typeof id === "string" ? id : "unknown action";
  }

  private resolvePending(
    requestId: number,
    pending: {
      resolve: (result: AgentMcpCallResult) => void;
      timeout: ReturnType<typeof setTimeout>;
    },
    result: AgentMcpCallResult,
  ): void {
    clearTimeout(pending.timeout);
    this.pending.delete(requestId);
    pending.resolve(result);
  }

  getSnapshot(): AgentPeerRuntimeSnapshot {
    return this.snapshot;
  }

  private setSnapshot(snapshot: AgentPeerRuntimeSnapshot): void {
    this.snapshot = snapshot;
    const status = snapshot.status === "ready"
      ? "synced"
      : snapshot.status === "error"
        ? "error"
        : snapshot.status === "stopped"
          ? "offline"
          : "connecting";
    if (this.peerConnection.peer) this.peerConnection.peer.status = status;
    for (const listener of this.statusListeners) listener(status);
  }

  async start(): Promise<void> {
    if (!isTauriRuntime()) {
      throw new Error("The agent peer runtime is only available in CoTab Desktop.");
    }
    if (this.snapshot.status === "ready") return;
    if (this.startPromise) return this.startPromise;
    if (this.snapshot.status === "error") this.stop();
    if (typeof Worker === "undefined") {
      throw new Error("Web Workers are not available in this runtime.");
    }

    this.setSnapshot({ status: "starting", clientId: null, error: null });
    let worker: Worker;
    try {
      worker = new Worker(
        new URL("./agent-peer.worker.ts", import.meta.url),
        { type: "module", name: "cotab-agent-peer" },
      );
    } catch (cause) {
      const error = cause instanceof Error
        ? cause
        : new Error("The agent peer worker could not be created.");
      this.setSnapshot({ status: "error", clientId: null, error: error.message });
      throw error;
    }

    this.startPromise = new Promise<void>((resolve, reject) => {
      this.resolveStart = resolve;
      this.rejectStart = reject;
    });

    this.worker = worker;
    worker.addEventListener("message", this.handleWorkerMessage);
    worker.addEventListener("error", (event) => {
      const error = new Error(event.message || "The agent peer worker failed.");
      this.setSnapshot({ status: "error", clientId: null, error: error.message });
      this.rejectStart?.(error);
      this.resolveStart = null;
      this.rejectStart = null;
      this.startPromise = null;
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timeout);
        pending.reject(error);
      }
      this.pending.clear();
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
    this.setSnapshot({ status: "stopped", clientId: null, error: null });
  }

  rebindDocument(): void {
    if (!this.worker) return;
    this.unregisterPeer?.();
    this.unregisterPeer = engine.registerDocumentPeer(this.peerConnection);
  }

  async callTool(
    tool: string,
    args: unknown = {},
  ): Promise<AgentMcpCallResult> {
    await this.start();
    if (!this.worker) throw new Error("Agent peer runtime is not running.");

    const requestId = this.nextRequestId++;
    const result = new Promise<AgentMcpCallResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`CoTab MCP tool timed out: ${tool}`));
      }, CALL_TIMEOUT_MS);
      this.pending.set(requestId, {
        tool,
        arguments: args,
        rendererRevisionBefore: getRendererDiagnostics().requestedRevision,
        receivedDocumentUpdatesBefore: this.receivedDocumentUpdateCount,
        resolve,
        reject,
        timeout,
      });
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

subscribeActiveEngine(() => agentPeerRuntime.rebindDocument());
