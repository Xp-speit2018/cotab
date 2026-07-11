import { engine } from "@/core/engine";
import { MINIMAL_MCP_TOOLS } from "@/protocol/minimal-mcp";
import { codexConnection, type CodexConnectionPhase } from "./codex-connection";
import {
  agentHistoryIndex,
  type AgentThreadBinding,
} from "./history-index";

export type AgentTimelineEntry = AgentMessageEntry | AgentActivityEntry;

export interface AgentMessageEntry {
  readonly kind: "message";
  readonly id: string;
  readonly turnId: string | null;
  readonly role: "user" | "assistant";
  readonly text: string;
}

export interface AgentActivityEntry {
  readonly kind: "activity";
  readonly id: string;
  readonly turnId: string | null;
  readonly activityType: "reasoning" | "tool" | "plan";
  readonly status: "running" | "completed" | "failed";
  readonly title: string;
  readonly detail: string;
  readonly tool?: string;
  readonly arguments?: unknown;
  readonly durationMs?: number | null;
}

export interface AgentHistoryEntry {
  readonly threadId: string;
  readonly documentId: string;
  readonly scoreLabel: string;
  readonly title: string;
  readonly preview: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly lastOpenedAt: number;
}

export interface CodexModelOption {
  readonly id: string;
  readonly model: string;
  readonly displayName: string;
  readonly description: string;
  readonly hidden?: boolean;
  readonly isDefault: boolean;
  readonly defaultReasoningEffort: string;
  readonly supportedReasoningEfforts: readonly {
    readonly reasoningEffort: string;
    readonly description: string;
  }[];
}

export type CodexCollaborationMode = "default" | "plan";

export interface AgentSessionSnapshot {
  readonly phase: CodexConnectionPhase | "working";
  readonly installed: boolean;
  readonly version: string | null;
  readonly threadId: string | null;
  readonly activeTurnId: string | null;
  readonly timeline: readonly AgentTimelineEntry[];
  readonly history: readonly AgentHistoryEntry[];
  readonly historyLoading: boolean;
  readonly models: readonly CodexModelOption[];
  readonly model: string | null;
  readonly reasoningEffort: string | null;
  readonly collaborationMode: CodexCollaborationMode;
  readonly modelsLoading: boolean;
  readonly error: string | null;
}

interface CodexThreadItem {
  readonly type: string;
  readonly id?: string;
  readonly text?: string;
  readonly content?: unknown[];
  readonly summary?: string[];
  readonly tool?: string;
  readonly arguments?: unknown;
  readonly status?: string;
  readonly durationMs?: number | null;
}

interface CodexTurn {
  readonly id: string;
  readonly status: string;
  readonly items: CodexThreadItem[];
  readonly error?: { readonly message?: string } | null;
}

interface CodexThread {
  readonly id: string;
  readonly preview: string;
  readonly name: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly turns: CodexTurn[];
}

interface ThreadStartResponse {
  readonly thread: CodexThread;
  readonly model?: string;
  readonly reasoningEffort?: string | null;
}

interface ThreadListResponse {
  readonly data: CodexThread[];
  readonly nextCursor: string | null;
}

interface ModelListResponse {
  readonly data: CodexModelOption[];
  readonly nextCursor: string | null;
}

const CODEX_DEVELOPER_INSTRUCTIONS = [
  "You are the score-editing agent inside CoTab.",
  "Use the provided CoTab tools to inspect and edit the current score.",
  "Use set_selection before selection-scoped beat or note actions.",
  "Do not edit source files or use shell commands for score changes.",
  "Inspect current score state again when prior context may be stale.",
  "Report the score changes you made in the final response.",
].join(" ");

function dynamicTools() {
  return MINIMAL_MCP_TOOLS.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

function currentDocumentContext(): { documentId: string; scoreLabel: string } {
  const documentId = engine.getDocumentId();
  if (!documentId) throw new Error("The current CoTab document has no identity.");
  const score = engine.getScoreMap();
  const title = score?.get("title");
  const artist = score?.get("artist");
  const titleText = typeof title === "string" && title.trim()
    ? title.trim()
    : "Untitled";
  const artistText = typeof artist === "string" ? artist.trim() : "";
  return {
    documentId,
    scoreLabel: artistText ? `${titleText} · ${artistText}` : titleText,
  };
}

function userInputText(content: unknown[] | undefined): string {
  if (!content) return "";
  return content
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const input = item as { type?: unknown; text?: unknown };
      return input.type === "text" && typeof input.text === "string"
        ? input.text
        : "";
    })
    .filter(Boolean)
    .join("\n");
}

function activityStatus(status: string | undefined): AgentActivityEntry["status"] {
  if (status === "failed") return "failed";
  if (status === "completed") return "completed";
  return "running";
}

function timelineEntryFromItem(
  item: CodexThreadItem,
  turnId: string,
): AgentTimelineEntry | null {
  const id = item.id ?? `${turnId}:${item.type}`;
  switch (item.type) {
    case "userMessage":
      return {
        kind: "message",
        id,
        turnId,
        role: "user",
        text: userInputText(item.content),
      };
    case "agentMessage":
      return {
        kind: "message",
        id,
        turnId,
        role: "assistant",
        text: item.text ?? "",
      };
    case "reasoning":
      return {
        kind: "activity",
        id,
        turnId,
        activityType: "reasoning",
        status: "completed",
        title: "reasoning",
        detail: item.summary?.join("\n") ?? "",
      };
    case "plan":
      return {
        kind: "activity",
        id,
        turnId,
        activityType: "plan",
        status: "completed",
        title: "plan",
        detail: item.text ?? "",
      };
    case "dynamicToolCall":
    case "mcpToolCall":
      return {
        kind: "activity",
        id,
        turnId,
        activityType: "tool",
        status: activityStatus(item.status),
        title: "tool",
        detail: "",
        tool: item.tool ?? "unknown",
        arguments: item.arguments,
        durationMs: item.durationMs,
      };
    default:
      return null;
  }
}

function timelineFromTurns(turns: readonly CodexTurn[]): AgentTimelineEntry[] {
  const timeline: AgentTimelineEntry[] = [];
  for (const turn of turns) {
    for (const item of turn.items) {
      const entry = timelineEntryFromItem(item, turn.id);
      if (entry) timeline.push(entry);
    }
  }
  return timeline;
}

class AgentSession {
  private snapshot: AgentSessionSnapshot = {
    phase: codexConnection.getSnapshot().phase,
    installed: codexConnection.getSnapshot().installed,
    version: codexConnection.getSnapshot().version,
    threadId: null,
    activeTurnId: null,
    timeline: [],
    history: [],
    historyLoading: false,
    models: [],
    model: null,
    reasoningEffort: null,
    collaborationMode: "default",
    modelsLoading: false,
    error: null,
  };
  private readonly listeners = new Set<() => void>();

  constructor() {
    codexConnection.subscribe(() => this.syncConnection());
    codexConnection.onNotification((method, params) => {
      this.handleNotification(method, params);
    });
  }

  getSnapshot = (): AgentSessionSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async initialize(): Promise<void> {
    await codexConnection.refresh();
    const bindings = await agentHistoryIndex.load();
    this.setSnapshot({
      ...this.snapshot,
      history: bindings
        .map((binding) => this.historyEntryFromBinding(binding))
        .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt),
    });
  }

  async connect(): Promise<void> {
    this.setSnapshot({ ...this.snapshot, error: null });
    try {
      await codexConnection.connect();
      await this.loadModels();
      await this.loadHistory();
    } catch (error) {
      this.setError(error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await codexConnection.disconnect();
    this.setSnapshot({
      ...this.snapshot,
      activeTurnId: null,
      error: null,
    });
  }

  async newThread(): Promise<void> {
    await this.ensureConnected();
    const context = currentDocumentContext();
    const result = await codexConnection.request<ThreadStartResponse>(
      "thread/start",
      {
        approvalPolicy: "never",
        sandbox: "read-only",
        ephemeral: false,
        developerInstructions: CODEX_DEVELOPER_INSTRUCTIONS,
        dynamicTools: dynamicTools(),
        model: this.snapshot.model,
      },
    );
    const now = Date.now();
    const binding: AgentThreadBinding = {
      threadId: result.thread.id,
      documentId: context.documentId,
      scoreLabel: context.scoreLabel,
      createdAt: now,
      lastOpenedAt: now,
    };
    await agentHistoryIndex.upsert(binding);
    this.setSnapshot({
      ...this.snapshot,
      threadId: result.thread.id,
      activeTurnId: null,
      timeline: [],
      model: result.model ?? this.snapshot.model,
      reasoningEffort: this.snapshot.reasoningEffort ?? result.reasoningEffort ?? null,
      error: null,
    });
    await this.updateThreadSettings({ effort: this.snapshot.reasoningEffort });
    await this.setCollaborationMode(this.snapshot.collaborationMode);
    await this.loadHistory();
  }

  async openThread(threadId: string): Promise<void> {
    await this.ensureConnected();
    const bindings = await agentHistoryIndex.load();
    const binding = bindings.find((candidate) => candidate.threadId === threadId);
    if (!binding) throw new Error("This Codex thread is not indexed by CoTab.");
    const context = currentDocumentContext();
    if (binding.documentId !== context.documentId) {
      throw new Error("This conversation belongs to a different CoTab document.");
    }

    const result = await codexConnection.request<ThreadStartResponse>(
      "thread/resume",
      {
        threadId,
        approvalPolicy: "never",
        sandbox: "read-only",
        developerInstructions: CODEX_DEVELOPER_INSTRUCTIONS,
      dynamicTools: dynamicTools(),
      },
    );
    await agentHistoryIndex.touch(threadId, Date.now());
    this.setSnapshot({
      ...this.snapshot,
      threadId,
      activeTurnId: null,
      timeline: timelineFromTurns(result.thread.turns),
      model: result.model ?? this.snapshot.model,
      reasoningEffort: result.reasoningEffort ?? this.snapshot.reasoningEffort,
      error: null,
    });
    await this.loadHistory();
  }

  async archiveThread(threadId: string): Promise<void> {
    await this.ensureConnected();
    await codexConnection.request("thread/archive", { threadId });
    await agentHistoryIndex.remove(threadId);
    const isActive = this.snapshot.threadId === threadId;
    this.setSnapshot({
      ...this.snapshot,
      threadId: isActive ? null : this.snapshot.threadId,
      activeTurnId: isActive ? null : this.snapshot.activeTurnId,
      timeline: isActive ? [] : this.snapshot.timeline,
      history: this.snapshot.history.filter((entry) => entry.threadId !== threadId),
    });
  }

  async sendPrompt(prompt: string): Promise<void> {
    const text = prompt.trim();
    if (!text || this.snapshot.activeTurnId) return;
    if (!this.snapshot.threadId) await this.newThread();
    const threadId = this.snapshot.threadId;
    if (!threadId) throw new Error("Codex thread was not created.");

    const firstUserMessage = !this.snapshot.timeline.some(
      (entry) => entry.kind === "message" && entry.role === "user",
    );
    const pendingTurnId = `pending:${Date.now()}`;
    const userEntry: AgentMessageEntry = {
      kind: "message",
      id: `user:${pendingTurnId}`,
      turnId: pendingTurnId,
      role: "user",
      text,
    };
    this.setSnapshot({
      ...this.snapshot,
      activeTurnId: pendingTurnId,
      timeline: [...this.snapshot.timeline, userEntry],
      error: null,
    });

    try {
      const result = await codexConnection.request<{ turn?: { id?: unknown } }>(
        "turn/start",
        {
          threadId,
          input: [{ type: "text", text, text_elements: [] }],
          summary: "concise",
        },
      );
      const turnId = typeof result.turn?.id === "string"
        ? result.turn.id
        : this.snapshot.activeTurnId;
      if (turnId && this.snapshot.activeTurnId === pendingTurnId) {
        this.setSnapshot({
          ...this.snapshot,
          activeTurnId: turnId,
          timeline: this.snapshot.timeline.map((entry) =>
            entry.id === userEntry.id
              ? { ...entry, turnId }
              : entry,
          ),
        });
      }
      if (firstUserMessage) {
        const name = text.split("\n", 1)[0].slice(0, 72);
        void codexConnection.request("thread/name/set", { threadId, name });
      }
    } catch (error) {
      this.setSnapshot({ ...this.snapshot, activeTurnId: null });
      this.setError(error);
      throw error;
    }
  }

  async interrupt(): Promise<void> {
    const { threadId, activeTurnId } = this.snapshot;
    if (!threadId || !activeTurnId || activeTurnId.startsWith("pending:")) return;
    await codexConnection.request("turn/interrupt", {
      threadId,
      turnId: activeTurnId,
    });
  }

  async loadHistory(): Promise<void> {
    this.setSnapshot({ ...this.snapshot, historyLoading: true });
    try {
      const bindings = await agentHistoryIndex.load();
      const bindingByThread = new Map(
        bindings.map((binding) => [binding.threadId, binding]),
      );
      const threads: CodexThread[] = [];
      let cursor: string | null = null;
      do {
        const page: ThreadListResponse = await codexConnection.request<ThreadListResponse>(
          "thread/list",
          {
            cursor,
            limit: 100,
            sortKey: "updated_at",
            sortDirection: "desc",
            sourceKinds: ["appServer"],
          },
        );
        threads.push(...page.data);
        cursor = page.nextCursor;
      } while (cursor && threads.length < 1000);

      const history = threads
        .map((thread): AgentHistoryEntry | null => {
          const binding = bindingByThread.get(thread.id);
          if (!binding) return null;
          return {
            threadId: thread.id,
            documentId: binding.documentId,
            scoreLabel: binding.scoreLabel,
            title: thread.name || thread.preview || binding.scoreLabel,
            preview: thread.preview,
            createdAt: thread.createdAt * 1000 || binding.createdAt,
            updatedAt: thread.updatedAt * 1000 || binding.lastOpenedAt,
            lastOpenedAt: binding.lastOpenedAt,
          };
        })
        .filter((entry): entry is AgentHistoryEntry => entry !== null)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      this.setSnapshot({ ...this.snapshot, history, historyLoading: false });
    } catch (error) {
      this.setSnapshot({ ...this.snapshot, historyLoading: false });
      this.setError(error);
    }
  }

  async loadModels(): Promise<void> {
    this.setSnapshot({ ...this.snapshot, modelsLoading: true });
    try {
      const response = await codexConnection.request<ModelListResponse>("model/list", {});
      const models = response.data.filter((model) => !model.hidden);
      const selected = models.find((model) => model.model === this.snapshot.model)
        ?? models.find((model) => model.isDefault)
        ?? models[0]
        ?? null;
      this.setSnapshot({
        ...this.snapshot,
        models,
        model: selected?.model ?? null,
        reasoningEffort: selected && !selected.supportedReasoningEfforts.some(
          (option) => option.reasoningEffort === this.snapshot.reasoningEffort,
        )
          ? selected.defaultReasoningEffort
          : this.snapshot.reasoningEffort ?? selected?.defaultReasoningEffort ?? null,
        modelsLoading: false,
      });
    } catch (error) {
      this.setSnapshot({ ...this.snapshot, modelsLoading: false });
      this.setError(error);
    }
  }

  async setModel(model: string): Promise<void> {
    const selected = this.snapshot.models.find((candidate) => candidate.model === model);
    if (!selected) throw new Error("Codex model is not available.");
    const effort = selected.supportedReasoningEfforts.some(
      (option) => option.reasoningEffort === this.snapshot.reasoningEffort,
    )
      ? this.snapshot.reasoningEffort
      : selected.defaultReasoningEffort;
    await this.updateThreadSettings({ model, effort });
  }

  async setReasoningEffort(effort: string): Promise<void> {
    const selected = this.snapshot.models.find((candidate) => candidate.model === this.snapshot.model);
    if (!selected?.supportedReasoningEfforts.some(
      (option) => option.reasoningEffort === effort,
    )) {
      throw new Error("Reasoning effort is not supported by the selected Codex model.");
    }
    await this.updateThreadSettings({ effort });
  }

  async setCollaborationMode(mode: CodexCollaborationMode): Promise<void> {
    const model = this.snapshot.model;
    if (!model) throw new Error("Select a Codex model before changing collaboration mode.");
    const developerInstructions = mode === "plan"
      ? `${CODEX_DEVELOPER_INSTRUCTIONS} In plan mode, inspect and explain the proposed score changes but do not execute edit tools.`
      : CODEX_DEVELOPER_INSTRUCTIONS;
    await this.updateThreadSettings({
      collaborationMode: {
        mode,
        settings: {
          model,
          reasoning_effort: this.snapshot.reasoningEffort,
          developer_instructions: developerInstructions,
        },
      },
    });
  }

  private async ensureConnected(): Promise<void> {
    if (codexConnection.getSnapshot().phase !== "connected") {
      await this.connect();
    }
  }

  private async updateThreadSettings(
    settings: {
      readonly model?: string;
      readonly effort?: string | null;
      readonly collaborationMode?: {
        readonly mode: CodexCollaborationMode;
        readonly settings: {
          readonly model: string;
          readonly reasoning_effort: string | null;
          readonly developer_instructions: string;
        };
      };
    },
  ): Promise<void> {
    if (this.snapshot.threadId) {
      await codexConnection.request("thread/settings/update", {
        threadId: this.snapshot.threadId,
        ...settings,
      });
    }
    this.setSnapshot({
      ...this.snapshot,
      model: settings.model ?? this.snapshot.model,
      reasoningEffort: settings.effort ?? this.snapshot.reasoningEffort,
      collaborationMode: settings.collaborationMode?.mode ?? this.snapshot.collaborationMode,
      error: null,
    });
  }

  private historyEntryFromBinding(binding: AgentThreadBinding): AgentHistoryEntry {
    return {
      threadId: binding.threadId,
      documentId: binding.documentId,
      scoreLabel: binding.scoreLabel,
      title: binding.scoreLabel,
      preview: "",
      createdAt: binding.createdAt,
      updatedAt: binding.lastOpenedAt,
      lastOpenedAt: binding.lastOpenedAt,
    };
  }

  private syncConnection(): void {
    const connection = codexConnection.getSnapshot();
    this.setSnapshot({
      ...this.snapshot,
      phase: this.snapshot.activeTurnId ? "working" : connection.phase,
      installed: connection.installed,
      version: connection.version,
      error: connection.error ?? this.snapshot.error,
    });
  }

  private handleNotification(
    method: string,
    params: Record<string, unknown>,
  ): void {
    const notificationThreadId = params.threadId;
    if (
      typeof notificationThreadId === "string" &&
      this.snapshot.threadId &&
      notificationThreadId !== this.snapshot.threadId
    ) {
      return;
    }

    if (method === "turn/started") {
      const turn = params.turn as { id?: unknown } | undefined;
      if (typeof turn?.id === "string") {
        this.setSnapshot({ ...this.snapshot, activeTurnId: turn.id });
      }
      return;
    }

    if (method === "turn/completed") {
      const turn = params.turn as CodexTurn | undefined;
      const error = turn?.status === "failed"
        ? turn.error?.message ?? "Codex turn failed."
        : null;
      this.setSnapshot({
        ...this.snapshot,
        activeTurnId: null,
        error,
      });
      void this.loadHistory();
      return;
    }

    if (method === "item/agentMessage/delta") {
      this.appendDelta(params, "assistant");
      return;
    }

    if (method === "item/reasoning/summaryTextDelta") {
      this.appendDelta(params, "reasoning");
      return;
    }

    if (method === "item/plan/delta") {
      this.appendDelta(params, "plan");
      return;
    }

    if (method === "item/started" || method === "item/completed") {
      const item = params.item as CodexThreadItem | undefined;
      const turnId = typeof params.turnId === "string" ? params.turnId : null;
      if (!item || !turnId) return;
      const entry = timelineEntryFromItem(item, turnId);
      if (!entry) return;
      const completed = method === "item/completed";
      this.upsertTimelineEntry(
        entry.kind === "activity"
          ? { ...entry, status: completed ? activityStatus(item.status ?? "completed") : "running" }
          : entry,
      );
      return;
    }

    if (method === "error" || method === "warning") {
      const message = params.message;
      if (typeof message === "string") this.setError(message);
    }
  }

  private appendDelta(
    params: Record<string, unknown>,
    target: "assistant" | "reasoning" | "plan",
  ): void {
    const itemId = params.itemId;
    const turnId = params.turnId;
    const delta = params.delta;
    if (
      typeof itemId !== "string" ||
      typeof turnId !== "string" ||
      typeof delta !== "string"
    ) {
      return;
    }
    const existing = this.snapshot.timeline.find((entry) => entry.id === itemId);
    if (existing) {
      const timeline = this.snapshot.timeline.map((entry) => {
        if (entry.id !== itemId) return entry;
        if (entry.kind === "message") return { ...entry, text: entry.text + delta };
        return { ...entry, detail: entry.detail + delta };
      });
      this.setSnapshot({ ...this.snapshot, timeline });
      return;
    }

    const entry: AgentTimelineEntry = target === "assistant"
      ? {
          kind: "message",
          id: itemId,
          turnId,
          role: "assistant",
          text: delta,
        }
      : {
          kind: "activity",
          id: itemId,
          turnId,
          activityType: target,
          status: "running",
          title: target,
          detail: delta,
        };
    this.setSnapshot({
      ...this.snapshot,
      timeline: [...this.snapshot.timeline, entry],
    });
  }

  private upsertTimelineEntry(entry: AgentTimelineEntry): void {
    const index = this.snapshot.timeline.findIndex(
      (candidate) => candidate.id === entry.id,
    );
    const timeline = [...this.snapshot.timeline];
    if (index === -1) timeline.push(entry);
    else timeline[index] = entry;
    this.setSnapshot({ ...this.snapshot, timeline });
  }

  private setError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.setSnapshot({ ...this.snapshot, error: message });
  }

  private setSnapshot(snapshot: AgentSessionSnapshot): void {
    const connectionPhase = codexConnection.getSnapshot().phase;
    this.snapshot = {
      ...snapshot,
      phase: snapshot.activeTurnId ? "working" : connectionPhase,
    };
    for (const listener of this.listeners) listener();
  }
}

export const agentSession = new AgentSession();
