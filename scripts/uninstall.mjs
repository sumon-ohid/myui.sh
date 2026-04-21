#!/usr/bin/env node
// Runs on `npm uninstall myui-sh` (preuninstall hook).
// Removes the skill/command files that postinstall.mjs copied to ~/.copilot and ~/.claude.

import { rm } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

if (process.env.MYUI_SKIP_SKILL_BOOTSTRAP === "1") process.exit(0);

const home = homedir();
if (!home) process.exit(0);

const targets = [
  { name: "Copilot skill",   path: resolve(home, ".copilot", "skills", "myui") },
  { name: "Claude skill",    path: resolve(home, ".claude",  "skills", "myui") },
  { name: "Claude command",  path: resolve(home, ".claude",  "commands", "myui.md") },
];

for (const t of targets) {
  try {
    await rm(t.path, { recursive: true, force: true });
    process.stdout.write(`[myui] Removed ${t.name} (${t.path})\n`);
  } catch (err) {
    process.stderr.write(`[myui] Could not remove ${t.name}: ${err.message}\n`);
  }
}
