#!/usr/bin/env node

import { runCliCommand } from "./commands.js";

try {
  const result = runCliCommand(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
