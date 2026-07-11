import * as Y from "yjs";
import { engine } from "@/core/engine";
import { coreEditEngineHost } from "@/protocol/core-edit-host";
import { executeMinimalMcpTool } from "@/protocol/minimal-mcp";
import type { AgentToMainMessage, MainToAgentMessage } from "./messages";

interface WorkerPort {
  postMessage(message: AgentToMainMessage, transfer?: Transferable[]): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<MainToAgentMessage>) => void,
  ): void;
  close(): void;
}

const port = globalThis as unknown as WorkerPort;
const MAIN_DOCUMENT_ORIGIN = Symbol("cotab-main-document");
let currentDoc: Y.Doc | null = null;

function post(message: AgentToMainMessage, transfer?: Transferable[]): void {
  port.postMessage(message, transfer);
}

function forwardAgentUpdate(update: Uint8Array, origin: unknown): void {
  if (origin === MAIN_DOCUMENT_ORIGIN) return;
  const copy = update.slice().buffer;
  post({ type: "document.update", update: copy }, [copy]);
}

function replaceDocument(update: ArrayBuffer): void {
  const previousDoc = currentDoc;
  previousDoc?.off("update", forwardAgentUpdate);

  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(update), MAIN_DOCUMENT_ORIGIN);
  doc.on("update", forwardAgentUpdate);
  currentDoc = doc;

  engine.replaceDoc(doc, doc.getMap("score"));
  engine.localClearSelection();
  previousDoc?.destroy();
  post({ type: "document.ready", clientId: doc.clientID });
}

function applyMainUpdate(update: ArrayBuffer): void {
  if (!currentDoc) {
    replaceDocument(update);
    return;
  }
  Y.applyUpdate(currentDoc, new Uint8Array(update), MAIN_DOCUMENT_ORIGIN);
}

port.addEventListener("message", (event) => {
  const message = event.data;
  switch (message.type) {
    case "document.reset":
      replaceDocument(message.update);
      break;
    case "document.update":
      applyMainUpdate(message.update);
      break;
    case "mcp.call":
      post({
        type: "mcp.result",
        requestId: message.requestId,
        result: executeMinimalMcpTool(
          coreEditEngineHost,
          message.tool,
          message.arguments,
        ),
      });
      break;
    case "runtime.stop":
      currentDoc?.off("update", forwardAgentUpdate);
      engine.destroyDoc();
      port.close();
      break;
  }
});

post({ type: "runtime.ready" });
