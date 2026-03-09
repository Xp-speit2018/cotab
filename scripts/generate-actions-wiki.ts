/**
 * generate-actions-wiki.ts
 *
 * Parses src/actions/*.ts using the TypeScript compiler API,
 * extracts action metadata, resolves i18n keys, and writes
 * a formatted markdown document to stdout.
 *
 * Usage:
 *   npx -p typescript tsc --project scripts/tsconfig.scripts.json
 *   node dist-scripts/generate-actions-wiki.js
 */

import * as ts from "typescript";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActionParam {
  name: string;
  type: string;
  enumValues?: string[];
}

interface ActionInfo {
  id: string;
  i18nKey: string;
  category: string;
  params: ActionParam[];
}

// ---------------------------------------------------------------------------
// i18n resolution
// ---------------------------------------------------------------------------

function loadI18n(filePath: string): Record<string, unknown> {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as Record<string, unknown>;
}

function resolveDotPath(obj: Record<string, unknown>, dotPath: string): string | undefined {
  const parts = dotPath.split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

// ---------------------------------------------------------------------------
// AST helpers
// ---------------------------------------------------------------------------

function getPropName(prop: ts.PropertyAssignment): string | undefined {
  if (ts.isIdentifier(prop.name)) return prop.name.text;
  if (ts.isStringLiteral(prop.name)) return prop.name.text;
  return undefined;
}

function getStringProperty(obj: ts.ObjectLiteralExpression, name: string): string | undefined {
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const propName = getPropName(prop);
    if (propName !== name) continue;
    if (ts.isStringLiteral(prop.initializer)) {
      return prop.initializer.text;
    }
  }
  return undefined;
}

function getParamsArray(obj: ts.ObjectLiteralExpression): ActionParam[] {
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    if (getPropName(prop) !== "params") continue;
    if (!ts.isArrayLiteralExpression(prop.initializer)) continue;

    const params: ActionParam[] = [];
    for (const elem of prop.initializer.elements) {
      if (!ts.isObjectLiteralExpression(elem)) continue;
      const name = getStringProperty(elem, "name");
      const type = getStringProperty(elem, "type");
      if (!name || !type) continue;

      const param: ActionParam = { name, type };

      // Extract enumValues if present
      for (const p of elem.properties) {
        if (!ts.isPropertyAssignment(p)) continue;
        if (getPropName(p) !== "enumValues") continue;
        if (ts.isArrayLiteralExpression(p.initializer)) {
          param.enumValues = p.initializer.elements
            .filter((e): e is ts.StringLiteral => ts.isStringLiteral(e))
            .map((s) => s.text);
        }
      }

      params.push(param);
    }
    return params;
  }
  return [];
}

// ---------------------------------------------------------------------------
// Source file parsing
// ---------------------------------------------------------------------------

function extractActionsFromFile(sourceFile: ts.SourceFile): ActionInfo[] {
  const actions: ActionInfo[] = [];

  function visit(node: ts.Node): void {
    // Match: const fooAction: ActionDefinition<...> = { id: "...", ... };
    if (
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.length > 0
    ) {
      for (const decl of node.declarationList.declarations) {
        if (!decl.initializer || !ts.isObjectLiteralExpression(decl.initializer)) continue;

        const obj = decl.initializer;
        const id = getStringProperty(obj, "id");
        const i18nKey = getStringProperty(obj, "i18nKey");
        const category = getStringProperty(obj, "category");

        if (!id || !i18nKey || !category) continue;

        actions.push({
          id,
          i18nKey,
          category,
          params: getParamsArray(obj),
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return actions;
}

// ---------------------------------------------------------------------------
// Markdown generation
// ---------------------------------------------------------------------------

function formatParam(p: ActionParam): string {
  if (p.type === "enum" && p.enumValues && p.enumValues.length > 0) {
    return `\`${p.name}: enum(${p.enumValues.join(", ")})\``;
  }
  return `\`${p.name}: ${p.type}\``;
}

function generateMarkdown(actions: ActionInfo[], i18n: Record<string, unknown>): string {
  const lines: string[] = [];

  lines.push("# Actions — Full List");
  lines.push("");
  lines.push(
    "> **Auto-generated** — do not edit manually. " +
    `Last updated: ${new Date().toISOString().slice(0, 10)}`
  );
  lines.push("");
  lines.push("See [Actions](Actions) for a conceptual overview of the action system.");
  lines.push("");

  // Group by category
  const byCategory = new Map<string, ActionInfo[]>();
  for (const a of actions) {
    const list = byCategory.get(a.category) ?? [];
    list.push(a);
    byCategory.set(a.category, list);
  }

  // Sort categories: edit.* first (alphabetically), then others
  const sortedCategories = [...byCategory.keys()].sort((a, b) => {
    const aEdit = a.startsWith("edit.");
    const bEdit = b.startsWith("edit.");
    if (aEdit && !bEdit) return -1;
    if (!aEdit && bEdit) return 1;
    return a.localeCompare(b);
  });

  // Summary table
  lines.push("## Summary");
  lines.push("");
  lines.push("| Category | Actions | CRDT Sync |");
  lines.push("|----------|--------:|-----------|");
  for (const cat of sortedCategories) {
    const count = byCategory.get(cat)!.length;
    const crdt = cat.startsWith("edit.") ? "Yes" : "No";
    lines.push(`| \`${cat}\` | ${count} | ${crdt} |`);
  }
  const total = actions.length;
  lines.push(`| **Total** | **${total}** | |`);
  lines.push("");

  // Per-category sections
  for (const cat of sortedCategories) {
    const catActions = byCategory.get(cat)!;
    const crdt = cat.startsWith("edit.") ? " (CRDT)" : "";
    lines.push(`## \`${cat}\`${crdt}`);
    lines.push("");
    lines.push("| Action ID | Name | Description | Parameters |");
    lines.push("|-----------|------|-------------|------------|");

    for (const a of catActions) {
      const name = resolveDotPath(i18n, `${a.i18nKey}.name`) ?? a.id.split(".").pop() ?? a.id;
      const desc = resolveDotPath(i18n, `${a.i18nKey}.description`) ?? "\u2014";
      const params =
        a.params.length > 0
          ? a.params.map(formatParam).join(", ")
          : "*(none)*";
      lines.push(`| \`${a.id}\` | ${name} | ${desc} | ${params} |`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const rootDir = path.resolve(__dirname, "..");
  const actionsDir = path.join(rootDir, "src", "actions");

  // Discover action source files (exclude infra files)
  const excludeFiles = new Set(["types.ts", "registry.ts", "index.ts"]);
  const actionFiles = fs
    .readdirSync(actionsDir)
    .filter((f) => f.endsWith(".ts") && !excludeFiles.has(f))
    .map((f) => path.join(actionsDir, f));

  if (actionFiles.length === 0) {
    process.stderr.write("Error: no action source files found\n");
    process.exit(1);
  }

  // Create TS program (type-checking not needed, just parsing)
  const program = ts.createProgram(actionFiles, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
    allowJs: false,
    noEmit: true,
  });

  // Extract actions from all source files
  const allActions: ActionInfo[] = [];
  for (const filePath of actionFiles) {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) continue;
    allActions.push(...extractActionsFromFile(sourceFile));
  }

  // Sort actions by id within each category for stable output
  allActions.sort((a, b) => a.id.localeCompare(b.id));

  // Load i18n
  const i18nPath = path.join(rootDir, "src", "i18n", "locales", "en.json");
  const i18n = fs.existsSync(i18nPath) ? loadI18n(i18nPath) : {};

  // Generate and output
  const markdown = generateMarkdown(allActions, i18n);
  process.stdout.write(markdown);
}

main();
