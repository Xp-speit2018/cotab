import type { MinimalMcpCallResult } from "@/protocol/minimal-mcp";

export type MainToAgentMessage =
  | { readonly type: "document.reset"; readonly update: ArrayBuffer }
  | { readonly type: "document.update"; readonly update: ArrayBuffer }
  | {
      readonly type: "mcp.call";
      readonly requestId: number;
      readonly tool: string;
      readonly arguments: unknown;
    }
  | { readonly type: "runtime.stop" };

export type AgentToMainMessage =
  | { readonly type: "runtime.ready" }
  | { readonly type: "document.ready"; readonly clientId: number }
  | { readonly type: "document.update"; readonly update: ArrayBuffer }
  | {
      readonly type: "mcp.result";
      readonly requestId: number;
      readonly result: MinimalMcpCallResult;
      readonly documentUpdateCount: number;
    };
