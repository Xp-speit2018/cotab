import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
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
const errors: string[] = [];

// Inspect repository files, including new files, without traversing ignored
// dependencies, build output, or personal agent settings.
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: repoRoot, encoding: "utf8" },
).split("\0").filter(Boolean);

for (const file of new Set(files)) {
  if (!existsSync(resolve(repoRoot, file))) continue;
  if (file.split("/").some((part) => legacyEntryNames.has(part))) {
    errors.push(`remove legacy coding-agent entry: ${file}`);
  }
}

if (!existsSync(guidePath)) {
  errors.push("AGENTS.md is missing");
} else {
  const guide = readFileSync(guidePath, "utf8");

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
