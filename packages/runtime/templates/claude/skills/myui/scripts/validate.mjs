#!/usr/bin/env node
// Validate myui variant files. Pure Node, no deps.
// Usage: node validate.mjs <project-root> <slot-id>
// Output: JSON to stdout. Exit 0 always (even with errors). Caller inspects ok.

import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ALLOWED_PACKAGES = new Set([
  "react",
  "react-dom",
  "react/jsx-runtime",
  "lucide-react",
  "clsx",
  "tailwind-merge",
  "class-variance-authority",
  "@myui/runtime",
]);

const FORBIDDEN_PACKAGES = [
  "styled-components",
  "@emotion/react",
  "@emotion/styled",
  "jquery",
];

const INTERNAL_PREFIXES = ["./", "../", "@/", "~/"];

function isInternal(spec) {
  return INTERNAL_PREFIXES.some((p) => spec.startsWith(p));
}

function packageName(spec) {
  if (spec.startsWith("@")) {
    const parts = spec.split("/");
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
    return spec;
  }
  return spec.split("/")[0] ?? spec;
}

function extractImports(code) {
  const out = [];
  const re = /(?:^|\n)\s*import\s+(?:[^"';]+\s+from\s+)?["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const beforeIdx = m.index;
    const lineNum = code.slice(0, beforeIdx).split("\n").length;
    out.push({ spec: m[1], line: lineNum });
  }
  return out;
}

function validateOne(filename, code) {
  const issues = [];
  const lines = code.split("\n");

  for (const { spec, line } of extractImports(code)) {
    if (isInternal(spec)) continue;
    if (FORBIDDEN_PACKAGES.some((f) => spec === f || spec.startsWith(`${f}/`))) {
      issues.push({
        rule: "forbidden-import",
        severity: "error",
        message: `Import of forbidden package "${spec}".`,
        line,
      });
      continue;
    }
    const pkg = packageName(spec);
    if (!ALLOWED_PACKAGES.has(pkg)) {
      issues.push({
        rule: "non-allowlisted-import",
        severity: "error",
        message: `Import of "${spec}" is not on the allowlist.`,
        line,
      });
    }
  }

  lines.forEach((line, idx) => {
    const ln = idx + 1;
    if (/@ts-ignore|@ts-nocheck|@ts-expect-error/.test(line)) {
      issues.push({
        rule: "no-ts-suppression",
        severity: "error",
        message: "TypeScript suppression comments are forbidden.",
        line: ln,
      });
    }
    if (/\bdangerouslySetInnerHTML\b/.test(line)) {
      issues.push({
        rule: "no-dangerous-html",
        severity: "error",
        message: "dangerouslySetInnerHTML is forbidden.",
        line: ln,
      });
    }
    if (/\bstyle\s*=\s*\{/.test(line)) {
      issues.push({
        rule: "no-inline-style",
        severity: "warning",
        message: "Inline style prop; prefer Tailwind utilities.",
        line: ln,
      });
    }
    if (/:\s*any(\b|[\s,;>)\]])/.test(line) && !/\/\//.test(line.split("any")[0] ?? "")) {
      issues.push({
        rule: "no-any",
        severity: "error",
        message: "any type is forbidden.",
        line: ln,
      });
    }
  });

  const imgRe = /<img\b([^>]*)\/?>/g;
  let im;
  while ((im = imgRe.exec(code)) !== null) {
    const attrs = im[1] ?? "";
    if (!/\balt\s*=/.test(attrs)) {
      const ln = code.slice(0, im.index).split("\n").length;
      issues.push({
        rule: "img-alt",
        severity: "error",
        message: "<img> requires an alt attribute.",
        line: ln,
      });
    }
  }

  const buttonRe = /<button\b([^>]*)>([\s\S]*?)<\/button>/g;
  let bm;
  while ((bm = buttonRe.exec(code)) !== null) {
    const attrs = bm[1] ?? "";
    const inner = (bm[2] ?? "").trim();
    const hasAriaLabel = /\baria-label\s*=/.test(attrs);
    const hasAriaLabelledBy = /\baria-labelledby\s*=/.test(attrs);
    const hasVisibleText =
      inner.length > 0 && !/^<[^>]+>\s*<\/[^>]+>$/.test(inner) && !/^\{[\s]*\}$/.test(inner);
    if (!hasAriaLabel && !hasAriaLabelledBy && !hasVisibleText) {
      const ln = code.slice(0, bm.index).split("\n").length;
      issues.push({
        rule: "button-name",
        severity: "error",
        message: "<button> needs visible text, aria-label, or aria-labelledby.",
        line: ln,
      });
    }
  }

  const ok = !issues.some((i) => i.severity === "error");
  return { filename, ok, issues };
}

async function readJson(p) {
  try {
    return JSON.parse(await readFile(p, "utf8"));
  } catch {
    return null;
  }
}

async function registerSlot(projectRoot, slotId, slotFile) {
  const slotsPath = resolve(projectRoot, ".myui", "slots.json");
  const current = (await readJson(slotsPath)) ?? { slots: {} };
  const slots = current.slots && typeof current.slots === "object" ? current.slots : {};
  slots[slotId] = { file: slotFile };
  await writeFile(slotsPath, JSON.stringify({ slots }, null, 2) + "\n", "utf8");
}

async function resolveVariantsDir(projectRoot) {
  const cfg = await readJson(resolve(projectRoot, ".myui", "config.json"));
  if (cfg?.variantsDir) return resolve(projectRoot, cfg.variantsDir);
  const candidates = [
    resolve(projectRoot, "app", "myui-variants"),
    resolve(projectRoot, "src", "myui-variants"),
    resolve(projectRoot, "src", "app", "myui-variants"),
  ];
  for (const c of candidates) {
    try {
      const s = await stat(c);
      if (s.isDirectory()) return c;
    } catch {}
  }
  return candidates[0];
}

async function main() {
  const args = process.argv.slice(2);
  const projectRoot = args[0];
  const slotId = args[1];
  let slotFile;
  for (let i = 2; i < args.length; i++) {
    if (args[i] === "--file" && args[i + 1]) {
      slotFile = args[i + 1];
      i++;
    }
  }
  if (!projectRoot || !slotId) {
    process.stdout.write(
      JSON.stringify({
        ok: false,
        error: "Usage: validate.mjs <project-root> <slot-id> [--file <relative-path-to-wrapped-file>]",
      }),
    );
    process.exit(0);
  }

  const variantsRoot = await resolveVariantsDir(projectRoot);
  const slotDir = resolve(variantsRoot, slotId);
  let entries;
  try {
    const s = await stat(slotDir);
    if (!s.isDirectory()) throw new Error("not a directory");
    entries = await readdir(slotDir);
  } catch {
    process.stdout.write(
      JSON.stringify({
        ok: false,
        error: `Slot directory not found: ${slotDir}`,
      }),
    );
    process.exit(0);
  }

  const variantFiles = entries.filter((f) => /^Variant\d+\.tsx$/.test(f)).sort();

  if (variantFiles.length === 0) {
    process.stdout.write(
      JSON.stringify({
        ok: false,
        error: `No Variant*.tsx files found in ${slotDir}`,
      }),
    );
    process.exit(0);
  }

  const reports = [];
  for (const f of variantFiles) {
    const code = await readFile(resolve(slotDir, f), "utf8");
    const variantId = Number.parseInt(f.match(/Variant(\d+)/)?.[1] ?? "0", 10);
    const r = validateOne(f, code);
    reports.push({ variantId, file: f, ok: r.ok, issues: r.issues });
  }

  const ok = reports.every((r) => r.ok);

  let registered = false;
  let registerError;
  if (ok && slotFile) {
    try {
      await registerSlot(projectRoot, slotId, slotFile);
      registered = true;
    } catch (err) {
      registerError = err instanceof Error ? err.message : String(err);
    }
  }

  process.stdout.write(
    JSON.stringify({ ok, slotId, reports, registered, registerError }, null, 2),
  );
  process.exit(0);
}

main().catch((err) => {
  process.stdout.write(
    JSON.stringify({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exit(0);
});
