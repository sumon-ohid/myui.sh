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
const variantsDir = join(appDir, "myui-variants");
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
const slotsPath = join(myuiDir, "slots.json");
const existingConfig = existsSync(configPath)
  ? JSON.parse(readFileSync(configPath, "utf8"))
  : {};
const config = {
  ...existingConfig,
  framework,
  appDir: relative(root, appDir),
  variantsDir: relative(root, variantsDir),
  aliasPath,
};
writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
step("config.json", "written", configPath);

const configSlots =
  existingConfig &&
  typeof existingConfig === "object" &&
  existingConfig.slots &&
  typeof existingConfig.slots === "object"
    ? existingConfig.slots
    : undefined;

if (!existsSync(slotsPath)) {
  writeFileSync(
    slotsPath,
    JSON.stringify({ slots: configSlots ?? {} }, null, 2) + "\n",
  );
  step("slots.json", "created", slotsPath);
} else {
  step("slots.json", "skip", "exists");
}

if (!layoutPath) {
  step("layout", "warn", "no layout found - add <MyuiOverlay /> manually");
} else {
  let src = readFileSync(layoutPath, "utf8");
  let changed = false;

  if (!src.includes("@myui/runtime/styles.css")) {
    src = `import "@myui/runtime/styles.css";\n` + src;
    changed = true;
  }
  if (!src.includes("MyuiOverlay") || !src.includes("MyuiRegistryProvider")) {
    const runtimeImports = [];
    if (!src.includes("MyuiOverlay")) runtimeImports.push("MyuiOverlay");
    if (!src.includes("MyuiRegistryProvider")) runtimeImports.push("MyuiRegistryProvider");
    const importLine = `import { ${runtimeImports.join(", ")} } from "@myui/runtime";\n`;
    const lastImport = src.match(/^(import[^\n]*\n)+/m);
    src = lastImport
      ? src.replace(lastImport[0], lastImport[0] + importLine)
      : importLine + src;
    changed = true;
  }

  if (!src.includes("MyuiOverlay")) {
    if (src.includes("</body>")) {
      src = src.replace(/(\s*)<\/body>/, "$1  <MyuiOverlay />$1</body>");
    } else {
      step("layout", "warn", "no </body> - add <MyuiOverlay /> manually");
    }
    changed = true;
  }

  if (!src.includes("<MyuiRegistryProvider")) {
    if (src.includes("<body") && src.includes("</body>")) {
      src = src.replace(/(<body[^>]*>)/, "$1\n        <MyuiRegistryProvider>");
      src = src.replace(/(\s*)<\/body>/, "$1  </MyuiRegistryProvider>\n$1</body>");
      changed = true;
    } else {
      step("layout-provider", "warn", "no <body>...</body> - wrap with <MyuiRegistryProvider> manually");
    }
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
    `// Auto-maintained by the myui skill. Do not edit by hand.\n"use client";\n\nimport { registerSlots, type SlotIndex } from "@myui/runtime";\n\nconst SLOT_LOADERS: SlotIndex = {\n  // "slot-id": () => import("./slot-id/manifest.js"),\n};\n\nregisterSlots(SLOT_LOADERS);\n\nexport function MyuiSlotBootstrap() {\n  return null;\n}\n`,
  );
  step("_index.ts", "created", indexPath);
} else {
  const existing = readFileSync(indexPath, "utf8");
  if (!existing.includes("MyuiSlotBootstrap")) {
    const legacyMatch = existing.match(/registerSlots\(\s*(\{[\s\S]*?\})\s*\);?/m);
    const slotsObject = legacyMatch?.[1] ?? `{
  // "slot-id": () => import("./slot-id/manifest.js"),
}`;
    writeFileSync(
      indexPath,
      `// Auto-maintained by the myui skill. Do not edit by hand.\n"use client";\n\nimport { registerSlots, type SlotIndex } from "@myui/runtime";\n\nconst SLOT_LOADERS: SlotIndex = ${slotsObject};\n\nregisterSlots(SLOT_LOADERS);\n\nexport function MyuiSlotBootstrap() {\n  return null;\n}\n`,
    );
    step("_index.ts", "migrated", "converted legacy server-side registerSlots");
  } else if (existing.includes("useEffect") && existing.includes("registerSlots(SLOT_LOADERS)")) {
    const updated = existing
      .replace(/import\s+\{\s*useEffect\s*\}\s+from\s+"react";\n?/m, "")
      .replace(
        /export function MyuiSlotBootstrap\(\) \{\s*useEffect\(\(\) => \{\s*registerSlots\(SLOT_LOADERS\);\s*\}, \[\]\);\s*\n\s*return null;\s*\}/m,
        `registerSlots(SLOT_LOADERS);\n\nexport function MyuiSlotBootstrap() {\n  return null;\n}`,
      );
    if (updated !== existing) {
      writeFileSync(indexPath, updated);
      step("_index.ts", "updated", "moved registerSlots to module scope");
    } else {
      step("_index.ts", "skip", "exists");
    }
  } else {
    step("_index.ts", "skip", "exists");
  }
}

if (layoutPath) {
  let src = readFileSync(layoutPath, "utf8");
  let changed = false;

  if (!src.includes("MyuiSlotBootstrap")) {
    const importLine = `import { MyuiSlotBootstrap } from "${aliasPath}/_index";\n`;
    const lastImport = src.match(/^(import[^\n]*\n)+/m);
    src = lastImport
      ? src.replace(lastImport[0], lastImport[0] + importLine)
      : importLine + src;
    changed = true;
  }

  if (!src.includes("<MyuiSlotBootstrap")) {
    if (src.includes("<MyuiOverlay />")) {
      src = src.replace(/(\s*)<MyuiOverlay\s*\/>/, "$1<MyuiSlotBootstrap />\n$1<MyuiOverlay />");
    } else if (src.includes("</body>")) {
      src = src.replace(/(\s*)<\/body>/, "$1  <MyuiSlotBootstrap />$1</body>");
    } else {
      step("layout-slot-bootstrap", "warn", "no </body> - add <MyuiSlotBootstrap /> manually");
    }
    changed = true;
  }

  if (changed) {
    writeFileSync(layoutPath, src);
    step("layout-slot-bootstrap", "added", "MyuiSlotBootstrap in layout");
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
