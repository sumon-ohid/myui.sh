#!/usr/bin/env node

import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FORCE_UPDATE_FILES = new Set([
  "commands/myui.md",
  "skills/myui/SKILL.md",
  "skills/myui/scripts/scaffold-runtime.mjs",
  "skills/myui/scripts/validate.mjs",
]);

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function copyTree(srcDir, dstDir, counts, relBase = "") {
  await mkdir(dstDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
    const srcPath = resolve(srcDir, entry.name);
    const dstPath = resolve(dstDir, entry.name);

    if (entry.isDirectory()) {
      await copyTree(srcPath, dstPath, counts, relPath);
      continue;
    }

    const alreadyExists = await exists(dstPath);
    const shouldForceUpdate = FORCE_UPDATE_FILES.has(relPath);

    if (alreadyExists && !shouldForceUpdate) {
      counts.skipped += 1;
      continue;
    }

    await mkdir(dirname(dstPath), { recursive: true });
    await copyFile(srcPath, dstPath);
    if (alreadyExists) {
      counts.updated += 1;
    } else {
      counts.created += 1;
    }
  }
}

async function main() {
  if (process.env.MYUI_SKIP_SKILL_BOOTSTRAP === "1") {
    return;
  }

  const home = homedir();
  if (!home) {
    return;
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const pkgRoot = resolve(here, "..");
  const targets = [
    {
      name: "Claude",
      skipFlag: "MYUI_SKIP_CLAUDE_BOOTSTRAP",
      templateRoot: resolve(pkgRoot, "templates", "claude"),
      installRoot: resolve(home, ".claude"),
    },
    {
      name: "Copilot",
      skipFlag: "MYUI_SKIP_COPILOT_BOOTSTRAP",
      templateRoot: resolve(pkgRoot, "templates", "copilot"),
      installRoot: resolve(home, ".copilot"),
    },
  ];

  for (const target of targets) {
    if (process.env[target.skipFlag] === "1") {
      continue;
    }
    if (!(await exists(target.templateRoot))) {
      continue;
    }

    const counts = { created: 0, updated: 0, skipped: 0 };
    await copyTree(target.templateRoot, target.installRoot, counts);

    if (counts.created > 0 || counts.updated > 0) {
      process.stdout.write(
        `[myui] Installed ${target.name} templates in ${target.installRoot} (${counts.created} created, ${counts.updated} updated, ${counts.skipped} existing).\n`,
      );
    }
  }
} 

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[myui] Skill bootstrap skipped: ${message}\n`);
});
