import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ProjectContext } from "./context.js";

export interface ShadcnPrimitive {
  readonly name: string;
  readonly file: string;
  readonly exports: readonly string[];
}

const UI_DIR_CANDIDATES = [
  "src/components/ui",
  "components/ui",
  "app/components/ui",
];

const EXPORT_REGEX =
  /export\s+(?:const|function|class)\s+([A-Z][A-Za-z0-9_]*)|export\s*\{([^}]+)\}/g;

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function findUiDir(root: string): Promise<string | null> {
  for (const candidate of UI_DIR_CANDIDATES) {
    const full = resolve(root, candidate);
    if (await fileExists(full)) return full;
  }
  return null;
}

function extractExports(source: string): string[] {
  const out = new Set<string>();
  let match: RegExpExecArray | null;
  const rx = new RegExp(EXPORT_REGEX.source, "g");
  while ((match = rx.exec(source)) !== null) {
    if (match[1]) {
      out.add(match[1]);
    } else if (match[2]) {
      for (const raw of match[2].split(",")) {
        const name = raw.trim().split(/\s+as\s+/)[0]?.trim();
        if (name && /^[A-Z]/.test(name)) out.add(name);
      }
    }
  }
  return [...out];
}

function toPascal(stem: string): string {
  return stem
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

export async function scanShadcnPrimitives(
  context: ProjectContext,
  limit = 40,
): Promise<readonly ShadcnPrimitive[]> {
  if (!context.hasShadcn) return [];
  const dir = await findUiDir(context.root);
  if (!dir) return [];

  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const files = entries.filter((f) => /\.(tsx|jsx|ts|js)$/.test(f)).slice(0, limit);
  const primitives: ShadcnPrimitive[] = [];

  for (const file of files) {
    const path = join(dir, file);
    let source: string;
    try {
      source = await readFile(path, "utf8");
    } catch {
      continue;
    }
    const exported = extractExports(source);
    const stem = file.replace(/\.(tsx|jsx|ts|js)$/, "");
    const name = toPascal(stem);
    if (exported.length === 0) continue;
    primitives.push({ name, file: stem, exports: exported });
  }

  return primitives;
}
