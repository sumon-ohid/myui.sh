#!/usr/bin/env node
// Reverses scaffold-runtime.mjs — removes all myui wiring from a project.
// Usage: node cleanup-runtime.mjs <project-root>
// Output: JSON report on stdout. Always exits 0 unless project root invalid.

import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve, relative } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const report = { root, steps: [], ok: true };

function step(name, status, detail) {
  report.steps.push({ name, status, detail });
}

if (!existsSync(join(root, "package.json"))) {
  report.ok = false;
  step("validate-root", "error", "no package.json at " + root);
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

// ── Read stored config so we know exactly what was installed ─────────────────
const configPath = join(root, ".myui", "config.json");
let config = {};
if (existsSync(configPath)) {
  try { config = JSON.parse(readFileSync(configPath, "utf8")); } catch {}
}

const framework          = config.framework        ?? "unknown";
const appDirRel          = config.appDir           ?? "app";
const appDir             = join(root, appDirRel);
const variantsDirRel     = config.variantsDir      ?? join(appDirRel, "myui-variants");
const variantsDir        = join(root, variantsDirRel);
const variantsImportPath = config.variantsImportPath ?? "./myui-variants";

// ── 1. Remove myui-sh from package.json dependencies ────────────────────────
const pkgPath = join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
if (pkg.dependencies?.["myui-sh"]) {
  delete pkg.dependencies["myui-sh"];
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  step("package.json", "removed", "myui-sh dependency");
} else {
  step("package.json", "skip", "myui-sh not in dependencies");
}

// ── 2. Revert layout file ────────────────────────────────────────────────────
const layoutCandidates = {
  "nextjs-src":  ["src/app/layout.tsx", "src/app/layout.jsx"],
  "nextjs":      ["app/layout.tsx",     "app/layout.jsx"],
  "nextjs-pages":["pages/_app.tsx",     "pages/_app.jsx"],
  "vite":        ["src/App.tsx",         "src/App.jsx"],
  "remix":       ["app/root.tsx",        "app/root.jsx"],
};
const patterns    = layoutCandidates[framework] ?? Object.values(layoutCandidates).flat();
const layoutPath  = patterns.map((p) => join(root, p)).find((p) => existsSync(p));

if (!layoutPath) {
  step("layout", "skip", "no layout file found");
} else {
  let src     = readFileSync(layoutPath, "utf8");
  const orig  = src;

  // Remove CSS import
  src = src.replace(/^import "myui-sh\/styles\.css";\n/m, "");

  // Remove myui-sh named imports (handles any combination of MyuiOverlay / MyuiRegistryProvider)
  src = src.replace(/^import \{[^}]*\} from "myui-sh";\n/gm, "");

  // Remove _index imports (side-effect and named)
  src = src.replace(/^import ".*?\/_index";\n/gm, "");
  src = src.replace(/^import \{ MyuiSlotBootstrap \} from ".*?\/_index";\n/gm, "");

  // Remove JSX components (with surrounding whitespace)
  src = src.replace(/[ \t]*<MyuiOverlay\s*\/>[ \t]*\n?/g, "");
  src = src.replace(/[ \t]*<MyuiSlotBootstrap\s*\/>[ \t]*\n?/g, "");

  // Remove <MyuiRegistryProvider> opening line
  src = src.replace(/[ \t]*<MyuiRegistryProvider>[ \t]*\n?/g, "");
  // Remove </MyuiRegistryProvider> closing line
  src = src.replace(/[ \t]*<\/MyuiRegistryProvider>[ \t]*\n?/g, "");

  if (src !== orig) {
    writeFileSync(layoutPath, src);
    step("layout", "cleaned", relative(root, layoutPath));
  } else {
    step("layout", "skip", "no myui wiring found");
  }
}

// ── 3. Remove Next.js API route ──────────────────────────────────────────────
if (framework === "nextjs" || framework === "nextjs-src") {
  const myuiApiDir = join(appDir, "api", "myui");
  if (existsSync(myuiApiDir)) {
    rmSync(myuiApiDir, { recursive: true, force: true });
    step("api-route", "removed", relative(root, myuiApiDir));
  } else {
    step("api-route", "skip", "not found");
  }
} else {
  step("api-route", "skip", `not applicable for ${framework}`);
}

// ── 4. Remove myui-variants/ ─────────────────────────────────────────────────
if (existsSync(variantsDir)) {
  rmSync(variantsDir, { recursive: true, force: true });
  step("variants-dir", "removed", variantsDirRel + "/");
} else {
  step("variants-dir", "skip", "not found");
}

// ── 5. Remove .myui/ ─────────────────────────────────────────────────────────
const myuiDir = join(root, ".myui");
if (existsSync(myuiDir)) {
  rmSync(myuiDir, { recursive: true, force: true });
  step(".myui", "removed", ".myui/");
} else {
  step(".myui", "skip", "not found");
}

// ── 6. Clean .gitignore ──────────────────────────────────────────────────────
const giPath = join(root, ".gitignore");
if (existsSync(giPath)) {
  const before = readFileSync(giPath, "utf8");
  const after  = before.split("\n").filter((l) => l.trim() !== ".myui/").join("\n");
  if (after !== before) {
    writeFileSync(giPath, after);
    step(".gitignore", "cleaned", "removed .myui/ entry");
  } else {
    step(".gitignore", "skip", "no myui entries");
  }
}

// ── 7. Clean tailwind.config ─────────────────────────────────────────────────
const tailwindCandidates = [
  "tailwind.config.js", "tailwind.config.ts",
  "tailwind.config.mjs", "tailwind.config.cjs",
];
const tailwindPath = tailwindCandidates.map((p) => join(root, p)).find((p) => existsSync(p));
if (tailwindPath) {
  const before = readFileSync(tailwindPath, "utf8");
  // Remove the line that scaffold-runtime added (myui-variants glob)
  const after = before.replace(/\n?\s*"\.\/.*?myui-variants\/\*\*\/\*\.\{js,ts,jsx,tsx,mdx\}",?/g, "");
  if (after !== before) {
    writeFileSync(tailwindPath, after);
    step("tailwind.config", "cleaned", "removed myui-variants content glob");
  } else {
    step("tailwind.config", "skip", "no myui entries");
  }
} else {
  step("tailwind.config", "skip", "no config found");
}

// ── 8. REFERENCES.md — kept intentionally ────────────────────────────────────
step("REFERENCES.md", "kept", "remove manually if desired");

console.log(JSON.stringify(report, null, 2));
