#!/usr/bin/env node
/**
 * CoTab MCP stdio adapter entry point.
 *
 * Usage: tsx src/mcp/cli.ts
 * Or after build: node dist/mcp/cli.js
 */

import { startServer } from "./server.js";

startServer().catch((error: unknown) => {
  console.error("Fatal error starting MCP stdio adapter:", error);
  process.exit(1);
});
