/**
 * Writes a wiki-formatted document action reference to stdout.
 *
 * Usage: npm run docs:actions:wiki
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DOCUMENT_ACTION_DESCRIPTORS,
  type DocumentActionDescriptor,
} from "../src/core/actions/projections";

function loadI18n(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

function resolveDotPath(
  object: Record<string, unknown>,
  dotPath: string,
): string | undefined {
  let current: unknown = object;
  for (const part of dotPath.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

function tableCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function formatArgs(action: DocumentActionDescriptor): string {
  return `\`${tableCell(JSON.stringify(action.argsSchema))}\``;
}

function generateMarkdown(
  actions: readonly DocumentActionDescriptor[],
  i18n: Record<string, unknown>,
): string {
  const byCategory = new Map<string, DocumentActionDescriptor[]>();
  for (const action of actions) {
    const entries = byCategory.get(action.category) ?? [];
    entries.push(action);
    byCategory.set(action.category, entries);
  }
  const categories = [...byCategory.keys()].sort((a, b) => a.localeCompare(b));
  const lines = [
    "# Actions - Full List",
    "",
    "> **Auto-generated** from `DocumentActionDefinition.argsSchema`; do not edit manually.",
    "",
    "See [Actions](Actions) for a conceptual overview of the action system.",
    "",
    "## Summary",
    "",
    "| Category | Actions | CRDT Sync |",
    "|----------|--------:|-----------|",
  ];

  for (const category of categories) {
    lines.push(`| \`${category}\` | ${byCategory.get(category)!.length} | Yes |`);
  }
  lines.push(`| **Total** | **${actions.length}** | |`, "");

  for (const category of categories) {
    lines.push(
      `## \`${category}\` (CRDT)`,
      "",
      "| Action ID | Name | Description | Arguments JSON Schema |",
      "|-----------|------|-------------|-----------------------|",
    );
    for (const action of byCategory.get(category)!) {
      const name = resolveDotPath(i18n, `${action.i18nKey}.name`)
        ?? action.id.split(".").at(-1)
        ?? action.id;
      const description = resolveDotPath(
        i18n,
        `${action.i18nKey}.description`,
      ) ?? "-";
      lines.push(
        `| \`${action.id}\` | ${tableCell(name)} | ${tableCell(description)} | ${formatArgs(action)} |`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");
const i18nPath = path.join(
  rootDirectory,
  "src",
  "i18n",
  "locales",
  "en.json",
);
const i18n = fs.existsSync(i18nPath) ? loadI18n(i18nPath) : {};
process.stdout.write(generateMarkdown(DOCUMENT_ACTION_DESCRIPTORS, i18n));
