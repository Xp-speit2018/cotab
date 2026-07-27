import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const guidePath = resolve(repoRoot, "AGENTS.md");
const packagePath = resolve(repoRoot, "package.json");

const legacyEntryNames = new Set([
  ".claude",
  ".cursor",
  ".cursorrules",
  "CLAUDE.md",
]);
const ignoredDirectoryNames = new Set([
  ".git",
  "blob-report",
  "dist",
  "node_modules",
  "playwright-report",
  "target",
  "test-results",
  "test-screenshots",
]);

const requiredHeadings = [
  "## Codex Workflow",
  "## Repository Verification",
  "## Repository Layout",
  "## UI Interaction Harness",
  "## Document Rendering",
  "## Rendering Tests",
] as const;

const errors: string[] = [];
const aiCoAuthorPattern =
  /^co-authored-by:.*(?:cursoragent@cursor\.com|noreply@anthropic\.com|copilot@github\.com|codex).*$/gim;

function findLegacyEntries(directory: string): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    const repositoryPath = relative(repoRoot, entryPath);

    if (legacyEntryNames.has(entry.name)) {
      errors.push(`remove legacy coding-agent entry: ${repositoryPath}`);
      continue;
    }

    if (entry.isDirectory() && !ignoredDirectoryNames.has(entry.name)) {
      findLegacyEntries(entryPath);
    }
  }
}

findLegacyEntries(repoRoot);

const commitHistory = execFileSync(
  "git",
  ["log", "--format=%H%n%B%n%x00", "HEAD"],
  {
    cwd: repoRoot,
    encoding: "utf8",
  },
);

for (const entry of commitHistory.split("\0")) {
  const [commit = "", ...messageLines] = entry.trim().split("\n");
  const message = messageLines.join("\n");
  const trailers = message.match(aiCoAuthorPattern) ?? [];

  for (const trailer of trailers) {
    errors.push(
      `remove AI co-author trailer from commit ${commit.slice(0, 12)}: ${trailer}`,
    );
  }
}

if (!existsSync(guidePath)) {
  errors.push("AGENTS.md is missing");
} else {
  const guide = readFileSync(guidePath, "utf8");

  for (const heading of requiredHeadings) {
    if (!guide.includes(heading)) {
      errors.push(`AGENTS.md is missing required section: ${heading}`);
    }
  }

  const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as {
    scripts?: Record<string, string>;
  };
  const scripts = packageJson.scripts ?? {};
  const referencedScripts = new Set(
    [...guide.matchAll(/npm run ([a-zA-Z0-9:_-]+)/g)].map((match) => match[1]),
  );

  for (const script of referencedScripts) {
    if (!(script in scripts)) {
      errors.push(`AGENTS.md references missing package script: ${script}`);
    }
  }
}

if (errors.length > 0) {
  console.error("Codex guide check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log("Codex guide and repository AI configuration are consistent.");
}
