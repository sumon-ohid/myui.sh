#!/usr/bin/env node
// One-time installer. Wires @myui/runtime into a project.
// Usage: node scaffold-runtime.mjs <project-root>
// Output: JSON report on stdout. Always exits 0 unless project root invalid.

import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(process.argv[2] ?? ".");
const report = { root, steps: [], ok: true };
const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const RUNTIME_PKG = resolve(SKILL_DIR, "../../../packages/runtime");

function step(name, status, detail) {
  report.steps.push({ name, status, detail });
}

if (!existsSync(join(root, "package.json"))) {
  report.ok = false;
  step("validate-root", "error", "no package.json at " + root);
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const frameworkCandidates = [
  {
    check: () => existsSync(join(root, "src", "app", "layout.tsx")) || existsSync(join(root, "src", "app", "layout.jsx")),
    appDir: join(root, "src", "app"),
    layoutPatterns: ["src/app/layout.tsx", "src/app/layout.jsx"],
    aliasRoot: "src",
    framework: "nextjs-src",
  },
  {
    check: () => existsSync(join(root, "app", "layout.tsx")) || existsSync(join(root, "app", "layout.jsx")),
    appDir: join(root, "app"),
    layoutPatterns: ["app/layout.tsx", "app/layout.jsx"],
    aliasRoot: "",
    framework: "nextjs",
  },
  {
    check: () => existsSync(join(root, "pages")),
    appDir: join(root, "pages"),
    layoutPatterns: ["pages/_app.tsx", "pages/_app.jsx"],
    aliasRoot: "",
    framework: "nextjs-pages",
  },
  {
    check: () => existsSync(join(root, "src", "main.tsx")) || existsSync(join(root, "src", "main.jsx")),
    appDir: join(root, "src"),
    layoutPatterns: ["src/App.tsx", "src/App.jsx"],
    aliasRoot: "src",
    framework: "vite",
  },
  {
    check: () => existsSync(join(root, "app", "root.tsx")) || existsSync(join(root, "app", "root.jsx")),
    appDir: join(root, "app"),
    layoutPatterns: ["app/root.tsx", "app/root.jsx"],
    aliasRoot: "",
    framework: "remix",
  },
  {
    check: () => existsSync(join(root, "src")),
    appDir: join(root, "src"),
    layoutPatterns: [],
    aliasRoot: "src",
    framework: "unknown-src",
  },
];

const detected = frameworkCandidates.find((c) => c.check()) ?? {
  appDir: root,
  layoutPatterns: [],
  aliasRoot: "",
  framework: "unknown",
};

const { appDir, layoutPatterns, aliasRoot, framework } = detected;
const layoutPath = layoutPatterns.map((p) => join(root, p)).find((p) => existsSync(p));
const variantsDir = join(appDir, ".myui-variants");
const variantsDirRel = relative(root, variantsDir) + "/";
const aliasPath = aliasRoot
  ? `@/${aliasRoot.replace(/\/$/, "")}/${relative(join(root, aliasRoot), variantsDir).replace(/\\/g, "/")}`
  : `@/${relative(root, variantsDir).replace(/\\/g, "/")}`;

step("detect", "ok", `framework: ${framework}, appDir: ${relative(root, appDir)}, alias: ${aliasPath}`);

const pkgPath = join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.dependencies ??= {};
if (!pkg.dependencies["@myui/runtime"]) {
  pkg.dependencies["@myui/runtime"] = "^0.1.0";
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  step("package.json", "added", "@myui/runtime ^0.1.0");
} else {
  step("package.json", "skip", "@myui/runtime already present");
}

const myuiDir = join(root, ".myui");
mkdirSync(myuiDir, { recursive: true });
const configPath = join(myuiDir, "config.json");
const config = {
  framework,
  appDir: relative(root, appDir),
  variantsDir: relative(root, variantsDir),
  aliasPath,
};
writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
step("config.json", "written", configPath);

if (!layoutPath) {
  step("layout", "warn", "no layout found - add <MyuiOverlay /> manually");
} else {
  let src = readFileSync(layoutPath, "utf8");
  let changed = false;

  if (!src.includes("@myui/runtime/styles.css")) {
    src = `import "@myui/runtime/styles.css";\n` + src;
    changed = true;
  }
  if (!src.includes("MyuiOverlay")) {
    const importLine = `import { MyuiOverlay } from "@myui/runtime";\n`;
    const lastImport = src.match(/^(import[^\n]*\n)+/m);
    src = lastImport
      ? src.replace(lastImport[0], lastImport[0] + importLine)
      : importLine + src;
    if (src.includes("</body>")) {
      src = src.replace(/(\s*)<\/body>/, "$1  <MyuiOverlay />$1</body>");
    } else {
      step("layout", "warn", "no </body> - add <MyuiOverlay /> manually");
    }
    changed = true;
  }
  if (changed) {
    writeFileSync(layoutPath, src);
    step("layout", "patched", layoutPath);
  } else {
    step("layout", "skip", "already wired");
  }
}

if (!existsSync(variantsDir)) {
  mkdirSync(variantsDir, { recursive: true });
  step("variants-dir", "created", variantsDirRel);
} else {
  step("variants-dir", "skip", "exists");
}

const indexPath = join(variantsDir, "_index.ts");
if (!existsSync(indexPath)) {
  writeFileSync(
    indexPath,
    `// Auto-maintained by the myui skill. Do not edit by hand.\nimport { registerSlots } from "@myui/runtime";\n\nregisterSlots({\n  // "slot-id": () => import("./slot-id/manifest.js"),\n});\n`,
  );
  step("_index.ts", "created", indexPath);
} else {
  step("_index.ts", "skip", "exists");
}

if (layoutPath) {
  let src = readFileSync(layoutPath, "utf8");
  if (!src.includes(".myui-variants/_index")) {
    const importLine = `import "${aliasPath}/_index";\n`;
    const lastImport = src.match(/^(import[^\n]*\n)+/m);
    src = lastImport
      ? src.replace(lastImport[0], lastImport[0] + importLine)
      : importLine + src;
    writeFileSync(layoutPath, src);
    step("layout-index-import", "added", `${aliasPath}/_index`);
  }
}

if (framework === "nextjs" || framework === "nextjs-src") {
  const apiDir = join(appDir, "api", "myui", "apply");
  const apiDest = join(apiDir, "route.ts");
  if (!existsSync(apiDest)) {
    const templateCandidates = [
      join(RUNTIME_PKG, "templates", "api-apply-route.ts"),
      join(root, "node_modules", "@myui", "runtime", "templates", "api-apply-route.ts"),
    ];
    const templateSrc = templateCandidates.find((p) => existsSync(p));
    if (templateSrc) {
      mkdirSync(apiDir, { recursive: true });
      copyFileSync(templateSrc, apiDest);
      step("api-route", "created", relative(root, apiDest));
    } else {
      step("api-route", "warn", "template not found - copy api-apply-route.ts manually");
    }
  } else {
    step("api-route", "skip", "exists");
  }
} else {
  step("api-route", "skip", `not applicable for ${framework}`);
}

const giPath = join(root, ".gitignore");
const giEntries = [variantsDirRel, ".myui/"];
const giLines = existsSync(giPath) ? readFileSync(giPath, "utf8") : "";
const missing = giEntries.filter((e) => !giLines.split("\n").some((l) => l.trim() === e));
if (missing.length > 0) {
  writeFileSync(giPath, giLines.replace(/\n?$/, "\n") + missing.join("\n") + "\n");
  step(".gitignore", "added", missing.join(", "));
} else {
  step(".gitignore", "skip", "entries exist");
}

console.log(JSON.stringify(report, null, 2));
