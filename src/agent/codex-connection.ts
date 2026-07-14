import type { Channel } from "@tauri-apps/api/core";
import { agentPeerRuntime } from "./agent-peer-runtime";
import { isTauriRuntime } from "./target";

export type CodexConnectionPhase =
  | "unavailable"
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface NativeCodexStatus {
  readonly installed: boolean;
  readonly connected: boolean;
  readonly executable: string | null;
  readonly version: string | null;
}

export interface CodexConnectionSnapshot {
  readonly phase: CodexConnectionPhase;
  readonly installed: boolean;
  readonly version: string | null;
  readonly error: string | null;
}

type NativeCodexEvent =
  | { readonly type: "message"; readonly message: string }
  | { readonly type: "error"; readonly message: string }
  | { readonly type: "closed" };

interface RpcResponse {
  readonly id: number;
  readonly result?: unknown;
  readonly error?: { readonly code?: number; readonly message?: string };
}

interface RpcMessage {
  readonly id?: number;
  readonly method?: string;
  readonly params?: Record<string, unknown>;
  readonly result?: unknown;
  readonly error?: { readonly code?: number; readonly message?: string };
}

interface DynamicToolCallParams {
  readonly tool: string;
  readonly arguments: unknown;
}

type NotificationListener = (
  method: string,
  params: Record<string, unknown>,
) => void;

async function invokeNative<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

class CodexConnection {
  private channel: Channel<NativeCodexEvent> | null = null;
  private nextRequestId = 1;
  private snapshot: CodexConnectionSnapshot = {
    phase: isTauriRuntime() ? "disconnected" : "unavailable",
    installed: false,
    version: null,
    error: null,
  };
  private readonly listeners = new Set<() => void>();
  private readonly notificationListeners = new Set<NotificationListener>();
  private readonly pendingRequests = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();

  getSnapshot = (): CodexConnectionSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  onNotification(listener: NotificationListener): () => void {
    this.notificationListeners.add(listener);
    return () => this.notificationListeners.delete(listener);
  }

  async refresh(): Promise<void> {
    if (!isTauriRuntime()) {
      this.setSnapshot({ ...this.snapshot, phase: "unavailable" });
      return;
    }
    try {
      const status = await invokeNative<NativeCodexStatus>("get_codex_status");
      this.setSnapshot({
        phase: this.channel ? "connected" : "disconnected",
        installed: status.installed,
        version: status.version,
        error: null,
      });
    } catch (error) {
      this.fail(error);
    }
  }

  async connect(
    localResources = false,
    webResources = false,
    proxyUrl: string | null = null,
  ): Promise<void> {
    if (!isTauriRuntime()) {
      throw new Error("Local Codex is only available in CoTab Desktop.");
    }
    if (this.channel) return;

    this.setSnapshot({ ...this.snapshot, phase: "connecting", error: null });
    try {
      await agentPeerRuntime.start();
      const { Channel: NativeChannel } = await import("@tauri-apps/api/core");
      const channel = new NativeChannel<NativeCodexEvent>();
      channel.onmessage = (event) => {
        if (this.channel === channel) this.handleNativeEvent(event);
      };
      this.channel = channel;
      const native = await invokeNative<NativeCodexStatus>("connect_local_codex", {
        onEvent: channel,
        localResources,
        webResources,
        proxyUrl,
      });

      await this.request("initialize", {
        clientInfo: { name: "cotab", title: "CoTab", version: "0.1.0" },
        capabilities: {
          experimentalApi: true,
          requestAttestation: false,
        },
      });
      await this.notify("initialized");
      this.setSnapshot({
        phase: "connected",
        installed: true,
        version: native.version,
        error: null,
      });
    } catch (error) {
      this.closeTransport();
      agentPeerRuntime.stop();
      await invokeNative<void>("disconnect_local_codex").catch(() => undefined);
      this.fail(error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.closeTransport();
    agentPeerRuntime.stop();
    if (isTauriRuntime()) {
      await invokeNative<void>("disconnect_local_codex").catch(() => undefined);
    }
    this.setSnapshot({
      ...this.snapshot,
      phase: isTauriRuntime() ? "disconnected" : "unavailable",
      error: null,
    });
  }

  async reconnect(
    localResources: boolean,
    webResources: boolean,
    proxyUrl: string | null,
  ): Promise<void> {
    await this.disconnect();
    await this.connect(localResources, webResources, proxyUrl);
  }

  async pickWriteRoot(): Promise<string | null> {
    if (!isTauriRuntime()) return null;
    return invokeNative<string | null>("pick_agent_write_root");
  }

  request<T = unknown>(method: string, params: unknown): Promise<T> {
    if (!this.channel) {
      return Promise.reject(new Error("Codex app-server is not connected."));
    }
    const id = this.nextRequestId++;
    const response = new Promise<unknown>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
    });
    void this.sendMessage({ id, method, params }).catch((error) => {
      const pending = this.pendingRequests.get(id);
      if (!pending) return;
      this.pendingRequests.delete(id);
      pending.reject(error instanceof Error ? error : new Error(String(error)));
    });
    return response as Promise<T>;
  }

  notify(method: string, params?: unknown): Promise<void> {
    return this.sendMessage({
      method,
      ...(params === undefined ? {} : { params }),
    });
  }

  private handleNativeEvent(event: NativeCodexEvent): void {
    if (event.type === "message") {
      this.handleMessage(event.message);
      return;
    }
    if (event.type === "error") {
      this.fail(event.message);
      return;
    }
    this.handleClose();
  }

  private handleMessage(rawMessage: string): void {
    let message: RpcMessage;
    try {
      message = JSON.parse(rawMessage) as RpcMessage;
    } catch {
      return;
    }

    if (message.id !== undefined && message.method) {
      void this.handleServerRequest(message.id, message.method, message.params ?? {});
      return;
    }
    if (message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (!pending) return;
      this.pendingRequests.delete(message.id);
      const response = message as RpcResponse;
      if (response.error) {
        pending.reject(new Error(response.error.message ?? "Codex request failed."));
      } else {
        pending.resolve(response.result);
      }
      return;
    }
    if (message.method) {
      for (const listener of this.notificationListeners) {
        listener(message.method, message.params ?? {});
      }
    }
  }

  private async handleServerRequest(
    id: number,
    method: string,
    params: Record<string, unknown>,
  ): Promise<void> {
    if (method !== "item/tool/call") {
      this.sendRpcError(id, -32601, `Unsupported Codex request: ${method}`);
      return;
    }

    const call = params as unknown as DynamicToolCallParams;
    try {
      const result = await agentPeerRuntime.callTool(call.tool, call.arguments);
      this.sendRpcResult(id, {
        contentItems: [{ type: "inputText", text: JSON.stringify(result) }],
        success: result.ok,
      });
    } catch (error) {
      this.sendRpcResult(id, {
        contentItems: [{
          type: "inputText",
          text: error instanceof Error ? error.message : String(error),
        }],
        success: false,
      });
    }
  }

  private sendRpcResult(id: number, result: unknown): void {
    void this.sendMessage({ id, result }).catch((error) => this.fail(error));
  }

  private sendRpcError(id: number, code: number, message: string): void {
    void this.sendMessage({ id, error: { code, message } }).catch((error) => this.fail(error));
  }

  private handleClose(): void {
    this.closeTransport();
    agentPeerRuntime.stop();
    if (isTauriRuntime()) {
      void invokeNative<void>("disconnect_local_codex").catch(() => undefined);
    }
    if (this.snapshot.phase !== "error") {
      this.setSnapshot({ ...this.snapshot, phase: "disconnected" });
    }
  }

  private closeTransport(): void {
    this.channel = null;
    const error = new Error("Codex connection closed.");
    for (const pending of this.pendingRequests.values()) pending.reject(error);
    this.pendingRequests.clear();
  }

  private async sendMessage(message: Record<string, unknown>): Promise<void> {
    if (!this.channel) throw new Error("Codex app-server is not connected.");
    await invokeNative<void>("send_codex_message", { message });
  }

  private fail(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.setSnapshot({ ...this.snapshot, phase: "error", error: message });
  }

  private setSnapshot(snapshot: CodexConnectionSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}

export const codexConnection = new CodexConnection();
