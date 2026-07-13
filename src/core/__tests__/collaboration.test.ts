import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import {
  EditorEngine,
  FILE_IMPORT_ORIGIN,
  type CollaborationAdapter,
  type CollaborationPersistence,
  type CollaborationProvider,
  type DocumentPeerConnection,
} from "@/core/engine";
import { initializeScore } from "@/core/schema";

function createLifecycleHandle() {
  const callbacks = new Map<string, Array<(event: unknown) => void>>();
  return {
    on: vi.fn((event: string, callback: (event: unknown) => void) => {
      callbacks.set(event, [...(callbacks.get(event) ?? []), callback]);
    }),
    destroy: vi.fn(),
    emit(event: string, payload?: unknown) {
      for (const callback of callbacks.get(event) ?? []) {
        callback(payload);
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
    presence({
      type: "transport-profile",
      profile: {
        ...engine.syncState.transport,
        signalingConnected: true,
        lastSampleAt: Date.now(),
      },
    });
    expect(engine.syncState.phase).toBe("ready");

    presence({
      type: "network-peers",
      peers: [{ id: "peer-1", name: "Grace", kind: "human", status: "connecting" }],
    });
    expect(engine.peers).toEqual([
      { id: "peer-1", name: "Grace", kind: "human", status: "connecting" },
    ]);
    expect(engine.syncState.phase).toBe("connecting");

    presence({
      type: "transport-profile",
      profile: {
        ...engine.syncState.transport,
        signalingConnected: true,
        webRtcPeerCount: 1,
        connectedPeerCount: 1,
        lastSampleAt: Date.now(),
      },
    });
    expect(engine.syncState.phase).toBe("syncing");

    presence({
      type: "network-peers",
      peers: [{ id: "peer-1", name: "Grace", kind: "human", status: "synced" }],
    });
    presence({
      type: "transport-profile",
      profile: {
        ...engine.syncState.transport,
        syncedPeerCount: 1,
        lastSampleAt: Date.now(),
      },
    });
    expect(engine.syncState.phase).toBe("synced");
    expect(engine.syncState.lastSyncedAt).not.toBeNull();

    provider.emit("synced", { synced: true });
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

  it("does not create a provider when a pending connection is cancelled", async () => {
    const engine = new EditorEngine();
    let resolveRoomLookup!: (exists: boolean) => void;
    const roomLookup = new Promise<boolean>((resolve) => {
      resolveRoomLookup = resolve;
    });
    const createProvider = vi.fn();
    const adapter: CollaborationAdapter = {
      roomExists: vi.fn(() => roomLookup),
      createProvider,
    };

    engine.initDoc();
    engine.setCollaborationAdapter(adapter);
    const connect = engine.connect("ROOM42", "Ada");
    await vi.waitFor(() => expect(adapter.roomExists).toHaveBeenCalledOnce());
    await engine.disconnect();
    resolveRoomLookup(true);
    await connect;

    expect(createProvider).not.toHaveBeenCalled();
    expect(engine.connected).toBe(false);
    expect(engine.connectionStatus).toBe("idle");
    expect(engine.syncState.phase).toBe("offline");
  });

  it("cleans up a partial connection and keeps an editable document on failure", async () => {
    const engine = new EditorEngine();
    const persistence = createLifecycleHandle();
    const adapter: CollaborationAdapter = {
      roomExists: vi.fn(async () => true),
      createPersistence: vi.fn(() => persistence as CollaborationPersistence),
      createProvider: vi.fn(() => {
        throw new Error("provider failed");
      }),
    };

    engine.initDoc();
    engine.setCollaborationAdapter(adapter);
    await engine.connect("BROKEN", "Ada");

    expect(persistence.destroy).toHaveBeenCalledOnce();
    expect(engine.connected).toBe(false);
    expect(engine.roomCode).toBeNull();
    expect(engine.connectionStatus).toBe("error");
    expect(engine.connectionError).toBe("errorConnection");
    expect(engine.getDoc()).not.toBeNull();
    expect(engine.getScoreMap()).not.toBeNull();
  });

  it("profiles file imports and undo transactions as local updates", () => {
    const engine = new EditorEngine();
    engine.initDoc();

    engine.localEditYDoc(() => engine.getScoreMap()?.set("title", "Local"));
    const afterEdit = engine.syncState.yjs.bySource.local.updates;
    engine.getUndoManager()?.undo();
    const afterUndo = engine.syncState.yjs.bySource.local.updates;
    engine.getDoc()?.transact(() => {
      engine.getScoreMap()?.set("title", "Imported");
    }, FILE_IMPORT_ORIGIN);

    expect(afterEdit).toBeGreaterThan(0);
    expect(afterUndo).toBeGreaterThan(afterEdit);
    expect(engine.syncState.yjs.bySource.local.updates).toBeGreaterThan(afterUndo);
    expect(engine.syncState.yjs.bySource.system.updates).toBe(0);
  });

  it("owns logical document peer routing across document replacement", () => {
    const engine = new EditorEngine();
    let receivePeerUpdate: ((update: Uint8Array) => void) | null = null;
    const connection: DocumentPeerConnection = {
      peer: {
        id: "agent:test",
        name: "Test Agent",
        kind: "agent",
        status: "connecting",
      },
      resetDocument: vi.fn(),
      updateDocument: vi.fn(),
      onDocumentUpdate: vi.fn((callback) => {
        receivePeerUpdate = callback;
        return vi.fn();
      }),
    };

    engine.initDoc();
    const unregister = engine.registerDocumentPeer(connection);
    expect(connection.resetDocument).toHaveBeenCalledOnce();
    expect(engine.peers).toContainEqual({
      id: "agent:test",
      name: "Test Agent",
      kind: "agent",
      status: "connecting",
    });

    engine.localEditYDoc(() => engine.getScoreMap()?.set("title", "Local"));
    expect(connection.updateDocument).toHaveBeenCalledOnce();
    expect(engine.syncState.yjs.bySource.local.updates).toBeGreaterThan(0);
    expect(engine.syncState.logicalPeers["agent:test"].sentBytes).toBeGreaterThan(0);
    expect(engine.syncState.logicalPeers["agent:test"].resetCount).toBe(1);

    const peerDoc = new Y.Doc();
    const initialUpdate = vi.mocked(connection.resetDocument).mock.calls[0][0];
    Y.applyUpdate(peerDoc, initialUpdate);
    const localUpdate = vi.mocked(connection.updateDocument).mock.calls[0][0];
    Y.applyUpdate(peerDoc, localUpdate);
    let update: Uint8Array | null = null;
    peerDoc.on("update", (next) => { update = next; });
    peerDoc.getMap("score").set("title", "Peer");
    expect(update).not.toBeNull();
    const updatesBeforePeerEdit = vi.mocked(connection.updateDocument).mock.calls.length;
    receivePeerUpdate!(update!);
    expect(engine.getScoreMap()?.get("title")).toBe("Peer");
    expect(engine.syncState.yjs.bySource.agent.updates).toBeGreaterThan(0);
    expect(engine.syncState.logicalPeers["agent:test"].receivedBytes).toBeGreaterThan(0);
    expect(connection.updateDocument).toHaveBeenCalledTimes(updatesBeforePeerEdit);

    const replacement = new Y.Doc();
    engine.replaceDoc(replacement, initializeScore(replacement));
    expect(connection.resetDocument).toHaveBeenCalledTimes(2);
    expect(engine.syncState.logicalPeers["agent:test"].resetCount).toBe(2);

    unregister();
    expect(engine.peers).not.toContainEqual(expect.objectContaining({ id: "agent:test" }));
    engine.localEditYDoc(() => engine.getScoreMap()?.set("title", "After"));
    expect(connection.updateDocument).toHaveBeenCalledTimes(updatesBeforePeerEdit);
  });
});
