import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const sharedTargetRoots = ["src/core", "src/adapters/local", "src/cli", "src/mcp"];

const forbiddenImports = [
  {
    roots: sharedTargetRoots,
    patterns: [/^@\/components(?:\/|$)/, /^@\/stores(?:\/|$)/, /^@\/shortcuts(?:\/|$)/],
    reason: "shared targets must not import Web UI layers",
  },
  {
    roots: sharedTargetRoots,
    patterns: [/^@\/adapters\/web(?:\/|$)/],
    reason: "shared targets must not depend on the Web target adapter",
  },
  {
    roots: sharedTargetRoots,
    patterns: [/^y-webrtc$/, /^y-indexeddb$/],
    reason: "shared targets must not depend on concrete Web transport/storage",
  },
];

function isSourceFile(filePath: string): boolean {
  return (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) && !filePath.includes(`${path.sep}__tests__${path.sep}`);
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      return walk(fullPath);
    }
    return isSourceFile(fullPath) ? [fullPath] : [];
  });
}

function importSources(source: string): string[] {
  const importPattern = /\b(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;
  return [...source.matchAll(importPattern)].map((match) => match[1] ?? match[2]);
}

describe("target boundaries", () => {
  it("keeps production core, local, CLI, and MCP code independent of Web UI and Web adapter imports", () => {
    const violations = sharedTargetRoots.flatMap((root) => {
      const files = walk(path.join(process.cwd(), root));
      return files.flatMap((filePath) => {
        const source = readFileSync(filePath, "utf8");
        return importSources(source).flatMap((importSource) => {
          return forbiddenImports
            .filter((rule) => rule.roots.includes(root))
            .filter((rule) => rule.patterns.some((pattern) => pattern.test(importSource)))
            .map((rule) => `${path.relative(process.cwd(), filePath)} imports ${importSource}: ${rule.reason}`);
        });
      });
    });

    expect(violations).toEqual([]);
  });
});
