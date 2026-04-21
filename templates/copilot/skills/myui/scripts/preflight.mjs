#!/usr/bin/env node
// Pre-flight context gatherer for myui skill.
// Dumps design tokens, sample components, config, and references in one shot.
// Usage: node preflight.mjs <project-root> [--near <relative-target-file>] [--max-components 3]
// Output: JSON to stdout. Exit 0 always. Caller inspects ok.

import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join, relative, dirname, basename, extname } from "node:path";

const MAX_FILE_BYTES = 40_000;
const MAX_COMPONENT_BYTES = 8_000;

const TOKEN_CANDIDATES = [
  "app/globals.css",
  "src/app/globals.css",
  "src/globals.css",
  "styles/globals.css",
  "src/styles/globals.css",
  "app/tokens.css",
  "src/tokens.css",
  "tailwind.config.js",
  "tailwind.config.ts",
  "tailwind.config.mjs",
  "tailwind.config.cjs",
  "theme.ts",
  "src/theme.ts",
  "src/lib/theme.ts",
];

const REFERENCE_CANDIDATES = [
  "REFERENCES.md",
  ".myui/REFERENCES.md",
  ".myui/inspo.md",
  "docs/design.md",
  "DESIGN.md",
];

const COMPONENT_DIRS = [
  "components",
  "src/components",
  "app/components",
  "src/app/components",
  "components/ui",
  "src/components/ui",
];

const COMPONENT_LIB_SIGNATURES = [
  { name: "shadcn", check: (pkg, root) => existsSync(join(root, "components.json")) || existsSync(join(root, "src/components/ui/button.tsx")) || existsSync(join(root, "components/ui/button.tsx")) },
  { name: "radix", check: (pkg) => Object.keys(pkg.dependencies ?? {}).some((d) => d.startsWith("@radix-ui/")) },
  { name: "mui", check: (pkg) => !!pkg.dependencies?.["@mui/material"] },
  { name: "chakra", check: (pkg) => !!pkg.dependencies?.["@chakra-ui/react"] },
  { name: "mantine", check: (pkg) => !!pkg.dependencies?.["@mantine/core"] },
  { name: "headlessui", check: (pkg) => !!pkg.dependencies?.["@headlessui/react"] },
];

const ICON_LIB_SIGNATURES = [
  { name: "@phosphor-icons/react", key: "@phosphor-icons/react" },
  { name: "lucide-react", key: "lucide-react" },
  { name: "hugeicons-react", key: "hugeicons-react" },
  { name: "react-icons", key: "react-icons" },
  { name: "@heroicons/react", key: "@heroicons/react" },
];

function cacheFilePath(root) {
  return join(root, ".myui", "cache", "preflight.json");
}

async function fileFingerprint(p) {
  try {
    const s = await stat(p);
    if (!s.isFile()) return null;
    return `${relative(dirname(p), p)}:${s.mtimeMs}:${s.size}`;
  } catch {
    return null;
  }
}

async function dirFingerprint(p) {
  try {
    const s = await stat(p);
    if (!s.isDirectory()) return null;
    return `${p}:${s.mtimeMs}`;
  } catch {
    return null;
  }
}

async function buildCacheKey(root, nearRel, maxComponents, promptHint) {
  const files = [
    "package.json",
    ".myui/config.json",
    ".myui/slots.json",
    ...TOKEN_CANDIDATES,
    ...REFERENCE_CANDIDATES,
  ];
  const dirs = [...COMPONENT_DIRS, ".myui/inspo", ".myui/inspo/screenshots"];

  if (nearRel) {
    files.push(nearRel);
    dirs.push(dirname(nearRel));
  }

  const parts = [
    `v=2`,
    `hint=${promptHint}`,
    `near=${nearRel ?? ""}`,
    `max=${maxComponents}`,
  ];

  for (const rel of files) {
    const abs = join(root, rel);
    const fp = await fileFingerprint(abs);
    if (fp) parts.push(`f:${rel}:${fp}`);
  }

  for (const rel of dirs) {
    const abs = join(root, rel);
    const fp = await dirFingerprint(abs);
    if (fp) parts.push(`d:${rel}:${fp}`);
  }

  return parts.sort().join("|");
}

async function readCache(root) {
  const p = cacheFilePath(root);
  try {
    return JSON.parse(await readFile(p, "utf8"));
  } catch {
    return null;
  }
}

async function writeCache(root, payload) {
  const p = cacheFilePath(root);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

async function readJsonSafe(p) {
  try {
    return JSON.parse(await readFile(p, "utf8"));
  } catch {
    return null;
  }
}

async function readTextCapped(p, cap = MAX_FILE_BYTES) {
  try {
    const s = await stat(p);
    if (!s.isFile()) return null;
    const buf = await readFile(p, "utf8");
    if (buf.length <= cap) return { content: buf, truncated: false, bytes: buf.length };
    return { content: buf.slice(0, cap), truncated: true, bytes: buf.length };
  } catch {
    return null;
  }
}

function scoreComponentFile(name) {
  const base = basename(name).toLowerCase();
  if (/^(button|card|input|dialog|modal|form|header|nav|sidebar|table|tabs)\b/.test(base)) return 10;
  if (/\.(tsx|jsx)$/.test(name)) return 5;
  return 1;
}

async function collectComponents(root, nearDir, max) {
  const found = new Map();
  const searchDirs = [];
  if (nearDir) searchDirs.push(nearDir);
  for (const d of COMPONENT_DIRS) {
    const full = join(root, d);
    if (existsSync(full)) searchDirs.push(full);
  }
  for (const dir of searchDirs) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isFile()) continue;
        if (!/\.(tsx|jsx)$/.test(e.name)) continue;
        const full = join(dir, e.name);
        if (found.has(full)) continue;
        found.set(full, scoreComponentFile(e.name));
      }
    } catch {}
    if (found.size >= max * 4) break;
  }
  const ranked = [...found.entries()].sort((a, b) => b[1] - a[1]).slice(0, max);
  const out = [];
  for (const [p] of ranked) {
    const r = await readTextCapped(p, MAX_COMPONENT_BYTES);
    if (!r) continue;
    out.push({ path: relative(root, p), truncated: r.truncated, bytes: r.bytes, content: r.content });
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const root = resolve(args[0] ?? ".");
  let nearRel;
  let maxComponents = 3;
  let promptHint = "";
  let useCache = true;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--near" && args[i + 1]) { nearRel = args[i + 1]; i++; }
    else if (args[i] === "--max-components" && args[i + 1]) { maxComponents = Math.max(1, Math.min(8, Number(args[i + 1]) || 3)); i++; }
    else if (args[i] === "--prompt-hint" && args[i + 1]) { promptHint = args[i + 1].toLowerCase(); i++; }
    else if (args[i] === "--no-cache") { useCache = false; }
  }

  const key = await buildCacheKey(root, nearRel, maxComponents, promptHint);
  if (useCache) {
    const cached = await readCache(root);
    if (cached?.key === key && cached?.report) {
      const report = {
        ...cached.report,
        cacheHit: true,
        cachePath: relative(root, cacheFilePath(root)),
      };
      process.stdout.write(JSON.stringify(report, null, 2));
      process.exit(0);
    }
  }

  const report = {
    ok: true,
    root,
    framework: null,
    componentLibs: [],
    iconLibs: [],
    tokens: [],
    references: [],
    screenshots: [],
    components: [],
    config: null,
    slots: null,
    notes: [],
    cacheHit: false,
    cachePath: relative(root, cacheFilePath(root)),
  };

  const pkgPath = join(root, "package.json");
  if (!existsSync(pkgPath)) {
    report.ok = false;
    report.notes.push("no package.json at root");
    process.stdout.write(JSON.stringify(report, null, 2));
    process.exit(0);
  }
  const pkg = (await readJsonSafe(pkgPath)) ?? {};

  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  if (deps.next) report.framework = "nextjs";
  else if (deps["react-router"] || deps["@remix-run/react"]) report.framework = "remix";
  else if (deps.vite) report.framework = "vite";
  else if (deps.react) report.framework = "react";

  for (const s of COMPONENT_LIB_SIGNATURES) {
    try { if (s.check(pkg, root)) report.componentLibs.push(s.name); } catch {}
  }
  for (const s of ICON_LIB_SIGNATURES) {
    if (deps[s.key]) report.iconLibs.push(s.name);
  }

  // Report installed version for each detected icon lib; for lucide also check icon count as a node_modules integrity signal
  for (const libName of report.iconLibs) {
    const version = deps[libName];
    if (!version) continue;
    if (libName === "lucide-react") {
      try {
        const iconsDir = join(root, "node_modules", "lucide-react", "dist", "esm", "icons");
        if (existsSync(iconsDir)) {
          const entries = await readdir(iconsDir);
          const count = entries.filter((e) => e.endsWith(".js")).length;
          report.lucideIcons = { version, count };
          if (count === 0) report.notes.push("lucide-react installed but icon inventory empty — check node_modules integrity");
        }
      } catch {}
    } else {
      // For other icon libs just surface the installed version
      const key = libName.replace(/[@/]/g, "_").replace(/^_/, "");
      report[key + "Version"] = version;
    }
  }

  const cfg = await readJsonSafe(join(root, ".myui", "config.json"));
  if (cfg) {
    report.config = cfg;
    report.design = cfg.design ?? null;
    if (!cfg.design) {
      report.notes.push("config.design missing — rerun scaffold-runtime or set .myui/config.json design block (aesthetic, density, motion, hierarchy)");
    } else {
      if (!cfg.design.aesthetic) {
        report.notes.push("config.design.aesthetic is empty — ask user to set it (e.g. 'Vercel-minimal', 'Linear-dense')");
      }
      if (cfg.design.iconSet) {
        report.notes.push(`Preferred icon set: ${cfg.design.iconSet} — use this library for all icons unless user overrides`);
      }
      if (cfg.design.sectionSpacing) {
        report.notes.push(`Section spacing anchor: ${cfg.design.sectionSpacing} — use consistently across all variants`);
      }
    }
  } else {
    report.notes.push(".myui/config.json not found — run scaffold-runtime.mjs first");
  }
  const slots = await readJsonSafe(join(root, ".myui", "slots.json"));
  if (slots) report.slots = slots;

  for (const rel of TOKEN_CANDIDATES) {
    const p = join(root, rel);
    if (!existsSync(p)) continue;
    const r = await readTextCapped(p);
    if (r) report.tokens.push({ path: rel, truncated: r.truncated, bytes: r.bytes, content: r.content });
  }

  for (const rel of REFERENCE_CANDIDATES) {
    const p = join(root, rel);
    if (!existsSync(p)) continue;
    const r = await readTextCapped(p);
    if (r) report.references.push({ path: rel, truncated: r.truncated, bytes: r.bytes, content: r.content });
  }
  const inspoDir = join(root, ".myui", "inspo");
  if (existsSync(inspoDir)) {
    try {
      const entries = await readdir(inspoDir);
      for (const e of entries) {
        if (!/\.(md|txt)$/i.test(e)) continue;
        const r = await readTextCapped(join(inspoDir, e));
        if (r) report.references.push({ path: relative(root, join(inspoDir, e)), truncated: r.truncated, bytes: r.bytes, content: r.content });
      }
    } catch {}
  }

  // Scan .myui/inspo/screenshots/ — report absolute paths so Claude can view them directly
  const screenshotsDir = join(root, ".myui", "inspo", "screenshots");
  if (existsSync(screenshotsDir)) {
    try {
      const entries = await readdir(screenshotsDir);
      for (const e of entries) {
        if (!/\.(png|jpg|jpeg|webp|gif)$/i.test(e)) continue;
        // Infer category from filename prefix (e.g. "hero-1.png" → "hero")
        const category = e.replace(/[-_]\d+\..*$/, "").replace(/\..*$/, "").toLowerCase();
        report.screenshots.push({
          file: e,
          absolutePath: join(screenshotsDir, e),
          category,
        });
      }
      report.screenshots.sort((a, b) => a.file.localeCompare(b.file));

      // Filter to categories matching the prompt hint, then cap at 3
      if (promptHint) {
        // Extract candidate category keywords from the hint
        const hintWords = promptHint.split(/\W+/).filter(Boolean);
        const matched = report.screenshots.filter((s) =>
          hintWords.some((w) => s.category.includes(w) || w.includes(s.category))
        );
        // Fall back to all if nothing matched, still cap at 3
        report.screenshots = (matched.length > 0 ? matched : report.screenshots).slice(0, 3);
      } else {
        // No hint: return at most 3 to avoid context bloat
        report.screenshots = report.screenshots.slice(0, 3);
      }
    } catch {}
  }

  let nearDir;
  if (nearRel) {
    const abs = resolve(root, nearRel);
    nearDir = existsSync(abs) && (await stat(abs)).isDirectory() ? abs : dirname(abs);
  }
  report.components = await collectComponents(root, nearDir, maxComponents);

  if (report.tokens.length === 0) report.notes.push("no design tokens found — ask user for aesthetic direction");
  if (report.componentLibs.length === 0) report.notes.push("no known component library detected — prefer custom primitives, match existing style");
  if (report.references.length === 0) report.notes.push("no REFERENCES.md or .myui/inspo/ — consider asking user for inspiration links");
  if (report.components.length === 0) report.notes.push("no sample components found — style fingerprint unclear");
  if (report.screenshots.length > 0) report.notes.push(`${report.screenshots.length} reference screenshot(s) returned (filtered to prompt category, capped at 3) — view each absolutePath before generating; they define layout density and visual language`);

  if (useCache) {
    try {
      await writeCache(root, { key, report, savedAt: new Date().toISOString() });
    } catch {}
  }

  process.stdout.write(JSON.stringify(report, null, 2));
  process.exit(0);
}

main().catch((err) => {
  process.stdout.write(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
  process.exit(0);
});
