import { describe, expect, it, vi } from "vitest";

import {
  EditorEngine,
  type CollaborationAdapter,
  type CollaborationPersistence,
  type CollaborationProvider,
} from "@/core/engine";

function createLifecycleHandle() {
  const callbacks = new Map<string, Array<() => void>>();
  return {
    on: vi.fn((event: string, callback: () => void) => {
      callbacks.set(event, [...(callbacks.get(event) ?? []), callback]);
    }),
    destroy: vi.fn(),
    emit(event: string) {
      for (const callback of callbacks.get(event) ?? []) {
        callback();
      }
    },
  };
}

describe("EditorEngine collaboration lifecycle", () => {
  it("connects, tracks presence, syncs, and disconnects through an injected adapter", async () => {
    const engine = new EditorEngine();
    const provider = createLifecycleHandle();
    const persistence = createLifecycleHandle();
    const createProvider = vi.fn(() => provider as CollaborationProvider);
    const createPersistence = vi.fn(() => persistence as CollaborationPersistence);
    const adapter: CollaborationAdapter = {
      roomExists: vi.fn(async () => true),
      createProvider,
      createPersistence,
    };
    const onPeerYDocEdit = vi.fn();

    engine.initDoc();
    engine.setCollaborationAdapter(adapter);
    engine.registerHooks({ onPeerYDocEdit });
    await engine.connect("ROOM42", "Ada");

    expect(engine.connected).toBe(true);
    expect(engine.roomCode).toBe("ROOM42");
    expect(engine.userName).toBe("Ada");
    expect(engine.connectionStatus).toBe("connected");
    expect(createProvider).toHaveBeenCalledWith(expect.objectContaining({
      roomCode: "ROOM42",
      userName: "Ada",
    }));
    expect(createPersistence).toHaveBeenCalledWith("ROOM42", expect.anything());

    const presence = createProvider.mock.calls[0][0].onPresenceMessage;
    presence({ type: "auth-ok", peers: [{ id: "peer-1", name: "Grace" }] });
    expect(engine.peers).toEqual([{ id: "peer-1", name: "Grace" }]);

    provider.emit("synced");
    persistence.emit("synced");
    expect(onPeerYDocEdit).toHaveBeenCalledTimes(2);

    await engine.disconnect();
    expect(provider.destroy).toHaveBeenCalledTimes(1);
    expect(persistence.destroy).toHaveBeenCalledTimes(1);
    expect(engine.connected).toBe(false);
    expect(engine.roomCode).toBeNull();
    expect(engine.peers).toEqual([]);
  });

  it("keeps room creation lifecycle in the engine while delegating room allocation", async () => {
    const engine = new EditorEngine();
    const provider = createLifecycleHandle();
    const adapter: CollaborationAdapter = {
      createRoom: vi.fn(async () => "NEWRM"),
      roomExists: vi.fn(async () => true),
      createProvider: vi.fn(() => provider as CollaborationProvider),
    };

    engine.initDoc();
    engine.setCollaborationAdapter(adapter);
    await engine.createRoom("Lin");

    expect(adapter.createRoom).toHaveBeenCalledTimes(1);
    expect(engine.connected).toBe(true);
    expect(engine.roomCode).toBe("NEWRM");
    expect(engine.getScoreMap()?.get("tracks")).toBeDefined();
  });

  it("reports missing rooms without creating a provider", async () => {
    const engine = new EditorEngine();
    const createProvider = vi.fn();
    const adapter: CollaborationAdapter = {
      roomExists: vi.fn(async () => false),
      createProvider,
    };

    engine.initDoc();
    engine.setCollaborationAdapter(adapter);
    await engine.connect("MISSING", "Ada");

    expect(createProvider).not.toHaveBeenCalled();
    expect(engine.connected).toBe(false);
    expect(engine.connectionStatus).toBe("error");
    expect(engine.connectionError).toBe("errorRoomNotFound");
  });
});
