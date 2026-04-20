#!/usr/bin/env node
// Validate myui variant files. Pure Node, no deps.
// Usage: node validate.mjs <project-root> <slot-id>
// Output: JSON to stdout. Exit 0 always (even with errors). Caller inspects ok.

import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";

const ALLOWED_PACKAGES = new Set([
  "react",
  "react-dom",
  "react/jsx-runtime",
  "lucide-react",
  "clsx",
  "tailwind-merge",
  "class-variance-authority",
  "@myui-sh/runtime",
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

function validateOne(filename, code, ctx = {}) {
  const issues = [];
  const lines = code.split("\n");
  const { lucideIcons } = ctx;

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

  // Named-export check for lucide-react against the project's installed inventory.
  if (lucideIcons && lucideIcons.size > 0) {
    const re = /import\s*\{([^}]+)\}\s*from\s*["']lucide-react["']/g;
    let mm;
    while ((mm = re.exec(code)) !== null) {
      const ln = code.slice(0, mm.index).split("\n").length;
      const names = mm[1]
        .split(",")
        .map((s) => s.replace(/\s+as\s+\w+/, "").trim())
        .filter(Boolean);
      for (const n of names) {
        if (!lucideIcons.has(n)) {
          issues.push({
            rule: "invalid-lucide-icon",
            severity: "error",
            message: `"${n}" is not exported by the installed lucide-react. Check spelling or pick a different icon.`,
            line: ln,
          });
        }
      }
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

  // ------- Apply-safety + client-directive checks (Stage 1 guards) -------

  const HOOK_RE = /\b(useState|useEffect|useReducer|useRef|useCallback|useMemo|useContext|useLayoutEffect|useTransition|useDeferredValue|useId|useSyncExternalStore|useInsertionEffect|useOptimistic|useActionState|useFormStatus|useFormState|useSWR|useQuery|useMutation|useInfiniteQuery|useAtom|useStore)\b/;
  const CLIENT_LIB_IMPORTS = new Set(["lucide-react", "@phosphor-icons/react"]);
  const EVENT_HANDLER_RE = /\bon(Click|Change|Submit|KeyDown|KeyUp|MouseEnter|MouseLeave|Focus|Blur|Input|Scroll|Toggle)\s*=\s*\{/;

  const firstNonEmpty = lines.find((l) => l.trim().length > 0) ?? "";
  const hasUseClient = /^\s*["']use client["']\s*;?\s*$/.test(firstNonEmpty);

  const usesHooks = HOOK_RE.test(code);
  const hasEventHandler = EVENT_HANDLER_RE.test(code);
  const importsClientLib = [...extractImports(code)].some(({ spec }) =>
    CLIENT_LIB_IMPORTS.has(packageName(spec)),
  );
  const needsClient = usesHooks || hasEventHandler || importsClientLib;

  if (needsClient && !hasUseClient) {
    const reason = usesHooks
      ? "uses React hooks"
      : hasEventHandler
        ? "has event handlers"
        : "imports a client-only library";
    issues.push({
      rule: "missing-use-client",
      severity: "error",
      message: `Variant ${reason} but is missing \"use client\" directive on line 1.`,
      line: 1,
    });
  }

  // Detect the exported component function and check its body for apply-safety.
  const defaultFnRe =
    /export\s+default\s+function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*[^\{]+)?\{/;
  const defaultFnMatch = defaultFnRe.exec(code);
  const namedDefaultRe = /export\s+default\s+(\w+)\s*;?\s*$/m;
  const arrowDefaultRe =
    /export\s+default\s+(?:\(?\s*\)?\s*=>|function\s*\()/;

  if (!defaultFnMatch) {
    if (arrowDefaultRe.test(code) || namedDefaultRe.test(code)) {
      issues.push({
        rule: "apply-unsupported-default-export",
        severity: "error",
        message:
          "Use `export default function Variant<N>(...) { ... }`. Arrow-function or assigned default exports are not apply-safe.",
        line: 1,
      });
    } else {
      issues.push({
        rule: "missing-default-export",
        severity: "error",
        message: "Variant must have `export default function Variant<N>(...) { ... }`.",
        line: 1,
      });
    }
  } else {
    // Walk the function body with the same depth logic the apply-route uses.
    const bodyStart = defaultFnMatch.index + defaultFnMatch[0].length;
    let depth = 1;
    let bodyEnd = -1;
    let inString = null;
    let inLine = false;
    let inBlock = false;
    for (let k = bodyStart; k < code.length; k++) {
      const c = code[k];
      const prev = code[k - 1] ?? "";
      const next = code[k + 1] ?? "";
      if (inString) {
        if (c === inString && prev !== "\\") inString = null;
        continue;
      }
      if (inLine) {
        if (c === "\n") inLine = false;
        continue;
      }
      if (inBlock) {
        if (c === "/" && prev === "*") inBlock = false;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") { inString = c; continue; }
      if (c === "/" && next === "/") { inLine = true; continue; }
      if (c === "/" && next === "*") { inBlock = true; continue; }
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) { bodyEnd = k; break; }
      }
    }

    if (bodyEnd === -1) {
      issues.push({
        rule: "unclosed-component-body",
        severity: "error",
        message: "Component body braces unbalanced.",
        line: lines.length,
      });
    } else {
      const body = code.slice(bodyStart, bodyEnd);
      const bodyStartLine = code.slice(0, bodyStart).split("\n").length;

      // Early-return heuristic: a `return` at depth 1 that appears before a later `return`.
      // Apply-route picks the first top-level `return` — if there are multiple, variant
      // may be mis-applied depending on branch.
      const topReturns = [];
      {
        let d = 0;
        let s = null;
        let lc = false;
        let bc = false;
        for (let k = 0; k < body.length; k++) {
          const c = body[k];
          const prev = body[k - 1] ?? "";
          const next = body[k + 1] ?? "";
          if (s) { if (c === s && prev !== "\\") s = null; continue; }
          if (lc) { if (c === "\n") lc = false; continue; }
          if (bc) { if (c === "/" && prev === "*") bc = false; continue; }
          if (c === '"' || c === "'" || c === "`") { s = c; continue; }
          if (c === "/" && next === "/") { lc = true; continue; }
          if (c === "/" && next === "*") { bc = true; continue; }
          if (c === "{") d++;
          else if (c === "}") d--;
          if (d === 0 && body.startsWith("return", k)) {
            const after = body[k + 6] ?? "";
            const before = body[k - 1] ?? "";
            if ((!after || /[\s\(\<]/.test(after)) && (!before || /[\s\}\;]/.test(before))) {
              topReturns.push(k);
            }
          }
        }
      }
      if (topReturns.length > 1) {
        const ln = bodyStartLine + body.slice(0, topReturns[0]).split("\n").length - 1;
        issues.push({
          rule: "apply-multiple-top-level-returns",
          severity: "warning",
          message:
            `Multiple top-level returns (${topReturns.length}). Apply picks the first — move loading/error states into JSX (conditional rendering) so the single main return is always reached.`,
          line: ln,
        });
      }

      // Ternary return at top level: `return cond ? <A/> : <B/>` — apply-route
      // currently grabs the parenthesized/JSX form starting at `return`; ternaries
      // may truncate.
      const ternaryReturn = /\breturn\s+[^(<;{}]+\?\s*</m.exec(body);
      if (ternaryReturn) {
        const ln = bodyStartLine + body.slice(0, ternaryReturn.index).split("\n").length - 1;
        issues.push({
          rule: "apply-ternary-return",
          severity: "warning",
          message:
            "Top-level `return cond ? <A/> : <B/>` may not apply cleanly. Wrap both branches: `return (cond ? <A/> : <B/>)` or use `if (cond) return <A/>; return <B/>;`.",
          line: ln,
        });
      }
    }

    // Top-level (module scope) declarations outside the component — apply currently
    // drops these. Detect `const|let|function|type|interface` at column 0 that are
    // NOT inside the default-export function.
    const beforeFn = code.slice(0, defaultFnMatch.index);
    const afterFn = bodyEnd > 0 ? code.slice(bodyEnd + 1) : "";
    const TOP_DECL_RE = /^(export\s+)?(const|let|var|function|type|interface|enum)\s+(\w+)/gm;
    const topDecls = [];
    let d;
    TOP_DECL_RE.lastIndex = 0;
    while ((d = TOP_DECL_RE.exec(beforeFn)) !== null) {
      topDecls.push({ name: d[3], offset: d.index, where: "before" });
    }
    TOP_DECL_RE.lastIndex = 0;
    while ((d = TOP_DECL_RE.exec(afterFn)) !== null) {
      topDecls.push({ name: d[3], offset: d.index + (bodyEnd + 1), where: "after" });
    }
    if (topDecls.length > 0) {
      const ln = code.slice(0, topDecls[0].offset).split("\n").length;
      issues.push({
        rule: "apply-top-level-declarations",
        severity: "warning",
        message:
          `Top-level declarations outside the component (${topDecls.map((d) => d.name).join(", ")}) are NOT preserved on apply. Move them inside the component body.`,
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

async function writeManifest(slotDir, variantNumbers) {
  const lines = [`"use client";`, ""];
  for (const n of variantNumbers) {
    lines.push(`export { default as Variant${n} } from "./Variant${n}";`);
  }
  lines.push("");
  await writeFile(resolve(slotDir, "manifest.ts"), lines.join("\n"), "utf8");
}

async function updateIndex(variantsRoot, slotId) {
  const indexPath = resolve(variantsRoot, "_index.ts");
  let src;
  try {
    src = await readFile(indexPath, "utf8");
  } catch {
    src =
      `// Auto-maintained by the myui skill. Do not edit by hand.\n"use client";\n\nimport { registerSlots, type SlotIndex } from "@myui-sh/runtime";\n\nconst SLOT_LOADERS: SlotIndex = {\n};\n\nregisterSlots(SLOT_LOADERS);\n\nexport function MyuiSlotBootstrap() {\n  return null;\n}\n`;
  }

  const entry = `  "${slotId}": () => import("./${slotId}/manifest"),`;
  const slotRe = new RegExp(
    `^\\s*["']${slotId}["']\\s*:\\s*\\(\\)\\s*=>\\s*import\\([^)]+\\),?\\s*$`,
    "m",
  );
  if (slotRe.test(src)) {
    src = src.replace(slotRe, entry);
  } else {
    const blockRe = /(const\s+SLOT_LOADERS\s*:\s*SlotIndex\s*=\s*\{)([\s\S]*?)(\n\};)/m;
    const m = blockRe.exec(src);
    if (!m) throw new Error("SLOT_LOADERS block not found in _index.ts");
    const body = m[2].replace(/\s*\/\/[^\n]*$/gm, "").trimEnd();
    const newBody = body.length ? `${body}\n${entry}` : `\n${entry}`;
    src = src.replace(blockRe, `$1${newBody}$3`);
  }

  await writeFile(indexPath, src, "utf8");
}

async function loadLucideIcons(projectRoot) {
  const candidates = [
    join(projectRoot, "node_modules", "lucide-react", "dist", "lucide-react.d.ts"),
    join(projectRoot, "node_modules", "lucide-react", "dist", "lucide-react.js"),
    join(projectRoot, "node_modules", "lucide-react", "dist", "esm", "lucide-react.js"),
    join(projectRoot, "node_modules", "lucide-react", "dynamicIconImports.js"),
  ];
  const iconsDir = join(projectRoot, "node_modules", "lucide-react", "dist", "esm", "icons");
  const set = new Set();
  try {
    if (existsSync(iconsDir)) {
      const entries = await readdir(iconsDir);
      for (const e of entries) {
        if (!e.endsWith(".js")) continue;
        const base = e.replace(/\.js$/, "");
        const pascal = base
          .split("-")
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
          .join("");
        set.add(pascal);
        set.add(`${pascal}Icon`);
      }
    }
  } catch {}

  if (set.size === 0) {
    for (const p of candidates) {
      if (!existsSync(p)) continue;
      try {
        const src = await readFile(p, "utf8");
        const re = /export\s*\{\s*([^}]+)\s*\}/g;
        let m;
        while ((m = re.exec(src)) !== null) {
          for (const tok of m[1].split(",")) {
            const n = tok.split(/\s+as\s+/)[0].trim();
            if (/^[A-Z]\w*$/.test(n)) set.add(n);
          }
        }
        const reDecl = /export\s+(?:const|function|class)\s+([A-Z]\w*)/g;
        while ((m = reDecl.exec(src)) !== null) set.add(m[1]);
        if (set.size > 0) break;
      } catch {}
    }
  }
  return set;
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

  const lucideIcons = await loadLucideIcons(projectRoot);

  const reports = [];
  for (const f of variantFiles) {
    const code = await readFile(resolve(slotDir, f), "utf8");
    const variantId = Number.parseInt(f.match(/Variant(\d+)/)?.[1] ?? "0", 10);
    const r = validateOne(f, code, { lucideIcons });
    reports.push({ variantId, file: f, ok: r.ok, issues: r.issues });
  }

  const ok = reports.every((r) => r.ok);

  let registered = false;
  let manifestWritten = false;
  let indexUpdated = false;
  const registrationErrors = [];
  if (ok) {
    const variantNumbers = reports.map((r) => r.variantId).sort((a, b) => a - b);
    try {
      await writeManifest(slotDir, variantNumbers);
      manifestWritten = true;
    } catch (err) {
      registrationErrors.push(`manifest: ${err instanceof Error ? err.message : String(err)}`);
    }
    try {
      await updateIndex(variantsRoot, slotId);
      indexUpdated = true;
    } catch (err) {
      registrationErrors.push(`_index: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (slotFile) {
      try {
        await registerSlot(projectRoot, slotId, slotFile);
        registered = true;
      } catch (err) {
        registrationErrors.push(`slots.json: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  process.stdout.write(
    JSON.stringify(
      { ok, slotId, reports, registered, manifestWritten, indexUpdated, registrationErrors },
      null,
      2,
    ),
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
