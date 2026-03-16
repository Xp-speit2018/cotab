/**
 * generate-server-api-wiki.ts
 *
 * Parses server/src/*.ts using the TypeScript compiler API,
 * extracts REST endpoints, WebSocket message types, and configuration
 * constants, then writes a formatted markdown document to stdout.
 *
 * Usage:
 *   npx -p typescript tsc --project scripts/tsconfig.scripts.json
 *   node dist-scripts/generate-server-api-wiki.js
 */

import * as ts from "typescript";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RestEndpoint {
  method: string;
  path: string;
  description: string;
  responseStatus: number[];
  responseFields?: string[];
}

interface MessageField {
  name: string;
  type: string;
  optional: boolean;
}

interface MessageType {
  name: string;
  interfaceName: string;
  typeValue: string; // the "type" field value
  fields: MessageField[];
  direction: "client-to-server" | "server-to-client";
}

interface ConfigConstant {
  name: string;
  value: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// AST helpers
// ---------------------------------------------------------------------------

function getInterfaceMembers(
  node: ts.InterfaceDeclaration,
  sourceFile: ts.SourceFile
): MessageField[] {
  const fields: MessageField[] = [];
  for (const member of node.members) {
    if (!ts.isPropertySignature(member)) continue;
    if (!member.name || !ts.isIdentifier(member.name)) continue;
    const name = member.name.text;
    const optional = !!member.questionToken;
    let type = "unknown";
    if (member.type) {
      type = member.type.getText(sourceFile);
    }
    fields.push({ name, type, optional });
  }
  return fields;
}

function getTypeValue(fields: MessageField[]): string {
  const typeField = fields.find((f) => f.name === "type");
  if (!typeField) return "";
  // Strip quotes from literal type like `"auth"`
  return typeField.type.replace(/^["']|["']$/g, "");
}

// ---------------------------------------------------------------------------
// Source file parsing
// ---------------------------------------------------------------------------

function extractInterfaces(
  sourceFile: ts.SourceFile
): ts.InterfaceDeclaration[] {
  const interfaces: ts.InterfaceDeclaration[] = [];
  function visit(node: ts.Node): void {
    if (ts.isInterfaceDeclaration(node)) {
      interfaces.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return interfaces;
}

function extractConstants(sourceFile: ts.SourceFile): ConfigConstant[] {
  const constants: ConfigConstant[] = [];
  function visit(node: ts.Node): void {
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        const name = decl.name.text;
        // Only extract UPPER_CASE constants
        if (!/^[A-Z][A-Z0-9_]+$/.test(name)) continue;
        if (!decl.initializer) continue;
        let value = decl.initializer.getText(sourceFile);
        // Simplify parseInt/parseFloat wrappers to show the default
        const parseMatch = value.match(
          /parse(?:Int|Float)\(process\.env\.\w+\s*\?\?\s*["'](.+?)["']/
        );
        if (parseMatch) {
          value = `${parseMatch[1]} (env override)`;
        }
        // Look for preceding comment
        const fullText = sourceFile.getFullText();
        const commentRanges = ts.getLeadingCommentRanges(
          fullText,
          node.getFullStart()
        );
        let description: string | undefined;
        if (commentRanges && commentRanges.length > 0) {
          const lastComment = commentRanges[commentRanges.length - 1];
          const commentText = fullText
            .slice(lastComment.pos, lastComment.end)
            .replace(/^\/\*\*?\s*|\s*\*\/$/g, "")
            .replace(/^\s*\*\s?/gm, "")
            .trim();
          if (commentText) description = commentText;
        }
        constants.push({ name, value, description });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return constants;
}

// ---------------------------------------------------------------------------
// REST endpoint extraction (from index.ts request handlers)
// ---------------------------------------------------------------------------

function extractRestEndpoints(): RestEndpoint[] {
  // These are extracted manually from the known server structure since
  // HTTP handler patterns are too varied for reliable AST extraction.
  return [
    {
      method: "GET",
      path: "/",
      description: "Health check",
      responseStatus: [200],
      responseFields: ["status", "rooms"],
    },
    {
      method: "POST",
      path: "/api/rooms",
      description: "Create a new room",
      responseStatus: [201],
      responseFields: ["code"],
    },
    {
      method: "GET",
      path: "/api/rooms/:code",
      description: "Get room info",
      responseStatus: [200, 400, 404],
      responseFields: ["code", "topic", "peerCount", "peers", "createdAt"],
    },
  ];
}

// ---------------------------------------------------------------------------
// Message type classification
// ---------------------------------------------------------------------------

const CLIENT_MESSAGE_INTERFACES = new Set([
  "AuthMessage",
  "SubscribeMessage",
  "UnsubscribeMessage",
  "PublishMessage",
  "PingMessage",
]);

const SERVER_MESSAGE_INTERFACES = new Set([
  "AuthOkMessage",
  "AuthErrorMessage",
  "PeerJoinedMessage",
  "PeerLeftMessage",
  "PongMessage",
]);

// ---------------------------------------------------------------------------
// Markdown generation
// ---------------------------------------------------------------------------

function formatField(f: MessageField): string {
  const opt = f.optional ? "?" : "";
  return `\`${f.name}${opt}: ${f.type}\``;
}

function generateMarkdown(
  endpoints: RestEndpoint[],
  messages: MessageType[],
  constants: ConfigConstant[]
): string {
  const lines: string[] = [];

  lines.push("# Signaling Server API");
  lines.push("");
  lines.push(
    "> **Auto-generated** \u2014 do not edit manually. " +
      `Last updated: ${new Date().toISOString().slice(0, 10)}`
  );
  lines.push("");

  // ── Overview ──
  lines.push("## Overview");
  lines.push("");
  lines.push(
    "The signaling server provides room management via REST and " +
      "real-time peer coordination via WebSocket. It is compatible with " +
      "the y-webrtc signaling protocol."
  );
  lines.push("");

  // ── Table of Contents ──
  lines.push("## Contents");
  lines.push("");
  lines.push("- [REST Endpoints](#rest-endpoints)");
  lines.push("- [WebSocket Protocol](#websocket-protocol)");
  lines.push("  - [Authentication](#authentication)");
  lines.push("  - [Client \u2192 Server Messages](#client--server-messages)");
  lines.push("  - [Server \u2192 Client Messages](#server--client-messages)");
  lines.push("- [Configuration](#configuration)");
  lines.push("");

  // ── REST Endpoints ──
  lines.push("## REST Endpoints");
  lines.push("");
  lines.push("All responses are `application/json`. CORS is enabled for all origins.");
  lines.push("");
  lines.push("| Method | Path | Description | Status Codes |");
  lines.push("|--------|------|-------------|-------------|");
  for (const ep of endpoints) {
    const statuses = ep.responseStatus.map((s) => `\`${s}\``).join(", ");
    lines.push(`| \`${ep.method}\` | \`${ep.path}\` | ${ep.description} | ${statuses} |`);
  }
  lines.push("");

  // Detail for each endpoint
  for (const ep of endpoints) {
    lines.push(`### \`${ep.method} ${ep.path}\``);
    lines.push("");
    lines.push(ep.description + ".");
    lines.push("");
    if (ep.responseFields && ep.responseFields.length > 0) {
      lines.push("**Response fields:**");
      lines.push("");
      for (const f of ep.responseFields) {
        lines.push(`- \`${f}\``);
      }
      lines.push("");
    }
  }

  // ── WebSocket Protocol ──
  lines.push("## WebSocket Protocol");
  lines.push("");
  lines.push("Connect via `ws://host:port` (or `wss://` in production).");
  lines.push("");

  // Authentication section
  lines.push("### Authentication");
  lines.push("");
  lines.push("Authentication is required before any other message can be sent.");
  lines.push("");
  lines.push("**Option 1 \u2014 Query parameters:**");
  lines.push("");
  lines.push("```");
  lines.push("ws://host:port?roomCode=A3K7M2&name=Alice");
  lines.push("```");
  lines.push("");
  lines.push("**Option 2 \u2014 Auth message** (first message after connecting):");
  lines.push("");
  lines.push("```json");
  lines.push('{ "type": "auth", "name": "Alice", "roomCode": "A3K7M2" }');
  lines.push("```");
  lines.push("");
  lines.push(
    "On success the server responds with `auth-ok`. " +
      "On failure it responds with `auth-error`."
  );
  lines.push("");

  // Client → Server
  const clientMsgs = messages.filter((m) => m.direction === "client-to-server");
  lines.push("### Client \u2192 Server Messages");
  lines.push("");
  lines.push(
    "| Message Type | Fields | Description |"
  );
  lines.push("|-------------|--------|-------------|");
  for (const msg of clientMsgs) {
    const fields = msg.fields
      .filter((f) => f.name !== "type")
      .map(formatField)
      .join(", ") || "\u2014";
    const desc = getMessageDescription(msg.typeValue);
    lines.push(`| \`${msg.typeValue}\` | ${fields} | ${desc} |`);
  }
  lines.push("");

  // Detail per client message
  for (const msg of clientMsgs) {
    lines.push(`#### \`${msg.typeValue}\``);
    lines.push("");
    lines.push(getMessageDescription(msg.typeValue) + ".");
    lines.push("");
    if (msg.fields.length > 0) {
      lines.push("| Field | Type | Required |");
      lines.push("|-------|------|----------|");
      for (const f of msg.fields) {
        lines.push(
          `| \`${f.name}\` | \`${f.type}\` | ${f.optional ? "No" : "Yes"} |`
        );
      }
      lines.push("");
    }
  }

  // Server → Client
  const serverMsgs = messages.filter(
    (m) => m.direction === "server-to-client"
  );
  lines.push("### Server \u2192 Client Messages");
  lines.push("");
  lines.push(
    "| Message Type | Fields | Description |"
  );
  lines.push("|-------------|--------|-------------|");
  for (const msg of serverMsgs) {
    const fields = msg.fields
      .filter((f) => f.name !== "type")
      .map(formatField)
      .join(", ") || "\u2014";
    const desc = getMessageDescription(msg.typeValue);
    lines.push(`| \`${msg.typeValue}\` | ${fields} | ${desc} |`);
  }
  lines.push("");

  // Detail per server message
  for (const msg of serverMsgs) {
    lines.push(`#### \`${msg.typeValue}\``);
    lines.push("");
    lines.push(getMessageDescription(msg.typeValue) + ".");
    lines.push("");
    if (msg.fields.length > 0) {
      lines.push("| Field | Type | Required |");
      lines.push("|-------|------|----------|");
      for (const f of msg.fields) {
        lines.push(
          `| \`${f.name}\` | \`${f.type}\` | ${f.optional ? "No" : "Yes"} |`
        );
      }
      lines.push("");
    }
  }

  // ── Configuration ──
  lines.push("## Configuration");
  lines.push("");
  lines.push("| Constant | Value | Description |");
  lines.push("|----------|-------|-------------|");
  for (const c of constants) {
    const desc = c.description ?? "\u2014";
    lines.push(`| \`${c.name}\` | \`${c.value}\` | ${desc} |`);
  }
  lines.push("");

  return lines.join("\n");
}

function getMessageDescription(typeValue: string): string {
  const descriptions: Record<string, string> = {
    auth: "Authenticate with a room code and display name",
    subscribe: "Subscribe to one or more topics for message relay",
    unsubscribe: "Unsubscribe from one or more topics",
    publish: "Publish a message to all other subscribers of a topic",
    ping: "Application-level keepalive ping",
    "auth-ok": "Authentication succeeded, includes room topic and current peer list",
    "auth-error": "Authentication failed with a reason string",
    "peer-joined": "A new peer joined the room",
    "peer-left": "A peer left the room",
    pong: "Response to a ping message",
  };
  return descriptions[typeValue] ?? "\u2014";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const rootDir = path.resolve(__dirname, "..");
  const serverSrcDir = path.join(rootDir, "server", "src");

  // Parse server source files
  const serverFiles = fs
    .readdirSync(serverSrcDir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => path.join(serverSrcDir, f));

  if (serverFiles.length === 0) {
    process.stderr.write("Error: no server source files found\n");
    process.exit(1);
  }

  const program = ts.createProgram(serverFiles, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
    allowJs: false,
    noEmit: true,
  });

  // Extract message types from types.ts
  const messages: MessageType[] = [];
  const typesFile = program.getSourceFile(
    path.join(serverSrcDir, "types.ts")
  );
  if (typesFile) {
    const interfaces = extractInterfaces(typesFile);
    for (const iface of interfaces) {
      const name = iface.name.text;
      const isClient = CLIENT_MESSAGE_INTERFACES.has(name);
      const isServer = SERVER_MESSAGE_INTERFACES.has(name);
      if (!isClient && !isServer) continue;

      const fields = getInterfaceMembers(iface, typesFile);
      const typeValue = getTypeValue(fields);
      if (!typeValue) continue;

      messages.push({
        name,
        interfaceName: name,
        typeValue,
        fields,
        direction: isClient ? "client-to-server" : "server-to-client",
      });
    }
  }

  // Extract configuration constants from all server files
  const constants: ConfigConstant[] = [];
  for (const filePath of serverFiles) {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) continue;
    constants.push(...extractConstants(sourceFile));
  }

  // Extract REST endpoints
  const endpoints = extractRestEndpoints();

  // Generate and output
  const markdown = generateMarkdown(endpoints, messages, constants);
  process.stdout.write(markdown);
}

main();
