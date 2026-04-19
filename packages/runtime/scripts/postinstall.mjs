#!/usr/bin/env node

import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function copyTree(srcDir, dstDir, counts) {
  await mkdir(dstDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = resolve(srcDir, entry.name);
    const dstPath = resolve(dstDir, entry.name);

    if (entry.isDirectory()) {
      await copyTree(srcPath, dstPath, counts);
      continue;
    }

    if (await exists(dstPath)) {
      counts.skipped += 1;
      continue;
    }

    await mkdir(dirname(dstPath), { recursive: true });
    await copyFile(srcPath, dstPath);
    counts.created += 1;
  }
}

async function main() {
  if (process.env.MYUI_SKIP_CLAUDE_BOOTSTRAP === "1") {
    return;
  }

  const home = homedir();
  if (!home) {
    return;
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const pkgRoot = resolve(here, "..");
  const templateRoot = resolve(pkgRoot, "templates", "claude");
  const claudeRoot = resolve(home, ".claude");

  if (!(await exists(templateRoot))) {
    return;
  }

  const counts = { created: 0, skipped: 0 };
  await copyTree(templateRoot, claudeRoot, counts);

  if (counts.created > 0) {
    process.stdout.write(
      `[myui] Installed Claude templates in ${claudeRoot} (${counts.created} created, ${counts.skipped} existing).\n`,
    );
  }
} 

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[myui] Claude bootstrap skipped: ${message}\n`);
});
