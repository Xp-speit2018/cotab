#!/usr/bin/env node
/**
 * CoTab MCP Server CLI Entry Point
 *
 * Usage: tsx src/mcp/cli.ts
 * Or after build: node dist/mcp/cli.js
 */

import { startServer } from "./server";

startServer().catch((error) => {
  console.error("Fatal error starting MCP server:", error);
  process.exit(1);
});
