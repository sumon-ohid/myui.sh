#!/usr/bin/env node
// One-time installer. Wires myui-sh into a project.
// Usage: node scaffold-runtime.mjs <project-root>
// Output: JSON report on stdout. Always exits 0 unless project root invalid.

import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(process.argv[2] ?? ".");
const report = { root, steps: [], ok: true };
const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
// SKILL_DIR = <runtime>/templates/copilot/skills/myui/scripts
// Up 5 = <runtime>
const RUNTIME_PKG = resolve(SKILL_DIR, "../../../../..");

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
const layoutDir = layoutPath ? dirname(layoutPath) : appDir;
const relPath = relative(layoutDir, variantsDir).replace(/\\/g, "/");
const variantsImportPath = relPath.startsWith(".") ? relPath : `./${relPath}`;

step("detect", "ok", `framework: ${framework}, appDir: ${relative(root, appDir)}, variantsImport: ${variantsImportPath}`);

const pkgPath = join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.dependencies ??= {};
if (!pkg.dependencies["myui-sh"]) {
  pkg.dependencies["myui-sh"] = "^0.1.0";
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  step("package.json", "added", "myui-sh ^0.1.0");
} else {
  step("package.json", "skip", "myui-sh already present");
}

const myuiDir = join(root, ".myui");
mkdirSync(myuiDir, { recursive: true });
const configPath = join(myuiDir, "config.json");
const slotsPath = join(myuiDir, "slots.json");
const existingConfig = existsSync(configPath)
  ? JSON.parse(readFileSync(configPath, "utf8"))
  : {};
const DESIGN_DEFAULTS = {
  aesthetic: "",
  density: "comfortable",
  motion: "subtle",
  hierarchy: "typography-led",
  designSystem: "",
  iconSet: "",
  sectionSpacing: "py-24 lg:py-32",
  borderRadius: "rounded-xl",
  variantCount: 3,
  referencesPath: "REFERENCES.md",
  inspoDir: ".myui/inspo",
};
const existingDesign = (existingConfig && typeof existingConfig.design === "object" && existingConfig.design) || {};
const config = {
  ...existingConfig,
  framework,
  appDir: relative(root, appDir),
  variantsDir: relative(root, variantsDir),
  variantsImportPath,
  design: { ...DESIGN_DEFAULTS, ...existingDesign },
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

  if (!src.includes("myui-sh/styles.css")) {
    src = `import "myui-sh/styles.css";\n` + src;
    changed = true;
  }
  if (!src.includes("MyuiOverlay") || !src.includes("MyuiRegistryProvider")) {
    const runtimeImports = [];
    if (!src.includes("MyuiOverlay")) runtimeImports.push("MyuiOverlay");
    if (!src.includes("MyuiRegistryProvider")) runtimeImports.push("MyuiRegistryProvider");
    const importLine = `import { ${runtimeImports.join(", ")} } from "myui-sh";\n`;
    const lastImport = src.match(/^(import[^\n]*\n)+/m);
    src = lastImport
      ? src.replace(lastImport[0], lastImport[0] + importLine)
      : importLine + src;
    changed = true;
  }

  if (!src.includes("<MyuiOverlay")) {
    if (src.includes("</MyuiRegistryProvider>")) {
      src = src.replace(/(\s*)<\/MyuiRegistryProvider>/, "$1  <MyuiOverlay />$1</MyuiRegistryProvider>");
    } else if (src.includes("</body>")) {
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
    `// Auto-maintained by the myui skill. Do not edit by hand.\n"use client";\n\nimport { registerSlots, type SlotIndex } from "myui-sh";\n\nconst SLOT_LOADERS: SlotIndex = {\n  // "slot-id": () => import("./slot-id/manifest.js"),\n};\n\nregisterSlots(SLOT_LOADERS);\n\nexport function MyuiSlotBootstrap() {\n  return null;\n}\n`,
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
      `// Auto-maintained by the myui skill. Do not edit by hand.\n"use client";\n\nimport { registerSlots, type SlotIndex } from "myui-sh";\n\nconst SLOT_LOADERS: SlotIndex = ${slotsObject};\n\nregisterSlots(SLOT_LOADERS);\n\nexport function MyuiSlotBootstrap() {\n  return null;\n}\n`,
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
    const importLine1 = `import "${variantsImportPath}/_index";\n`;
    const importLine2 = `import { MyuiSlotBootstrap } from "${variantsImportPath}/_index";\n`;
    const lastImport = src.match(/^(import[^\n]*\n)+/m);
    
    if (lastImport) {
        if (!src.includes(importLine1)) {
            src = src.replace(lastImport[0], lastImport[0] + importLine1);
        }
        if (!src.includes(importLine2)) {
            src = src.replace(lastImport[0], lastImport[0] + importLine2);
        }
    } else {
        src = importLine1 + importLine2 + src;
    }
    changed = true;
  }

  if (!src.includes("<MyuiSlotBootstrap")) {
    if (src.includes("<MyuiOverlay />")) {
      src = src.replace(/(\s*)<MyuiOverlay\s*\/>/, "$1<MyuiOverlay />$1<MyuiSlotBootstrap />");
      changed = true;
    } else if (src.includes("</MyuiRegistryProvider>")) {
      src = src.replace(/(\s*)<\/MyuiRegistryProvider>/, "$1  <MyuiSlotBootstrap />$1</MyuiRegistryProvider>");
      changed = true;
    } else if (src.includes("</body>")) {
      src = src.replace(/(\s*)<\/body>/, "$1  <MyuiSlotBootstrap />$1</body>");
      changed = true;
    } else {
      step("layout-slot-bootstrap", "warn", "no </body> - add <MyuiSlotBootstrap /> manually");
    }
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
      join(root, "node_modules", "myui-sh", "templates", "api-apply-route.ts"),
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

const referencesDest = join(root, "REFERENCES.md");
if (!existsSync(referencesDest)) {
  const referencesCandidates = [
    join(RUNTIME_PKG, "templates", "REFERENCES.md"),
    join(root, "node_modules", "myui-sh", "templates", "REFERENCES.md"),
  ];
  const referencesSrc = referencesCandidates.find((p) => existsSync(p));
  if (referencesSrc) {
    copyFileSync(referencesSrc, referencesDest);
    step("REFERENCES.md", "created", relative(root, referencesDest));
  } else {
    step("REFERENCES.md", "warn", "template not found - skipped");
  }
} else {
  step("REFERENCES.md", "skip", "exists");
}

const inspoDirPath = join(myuiDir, "inspo");
const inspoScreenshotsDest = join(inspoDirPath, "screenshots");
mkdirSync(inspoScreenshotsDest, { recursive: true });

// Copy bundled inspo screenshots into user project (never overwrite existing files)
const inspoScreenshotsSrcCandidates = [
  join(RUNTIME_PKG, "templates", "inspo", "screenshots"),
  join(root, "node_modules", "myui-sh", "templates", "inspo", "screenshots"),
];
const inspoScreenshotsSrc = inspoScreenshotsSrcCandidates.find((p) => existsSync(p));
if (inspoScreenshotsSrc) {
  const files = readdirSync(inspoScreenshotsSrc).filter((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f));
  let copied = 0;
  for (const f of files) {
    const dest = join(inspoScreenshotsDest, f);
    if (!existsSync(dest)) {
      copyFileSync(join(inspoScreenshotsSrc, f), dest);
      copied++;
    }
  }
  step(".myui/inspo/screenshots", copied > 0 ? "created" : "skip", `${copied} screenshot(s) copied`);
} else {
  step(".myui/inspo/screenshots", "warn", "bundled screenshots not found — skipped");
}

if (!existsSync(join(inspoDirPath, ".gitkeep"))) {
  writeFileSync(
    join(inspoDirPath, ".gitkeep"),
    "# Drop screenshots, notes, or .md files here. Preflight scans this folder.\n",
  );
}
step(".myui/inspo", "ok", relative(root, inspoDirPath));

const giPath = join(root, ".gitignore");
const giEntries = [".myui/"]; // We purposely no longer gitignore variantsDirRel so Tailwind v4 scans it
const giLines = existsSync(giPath) ? readFileSync(giPath, "utf8") : "";
const missing = giEntries.filter((e) => !giLines.split("\n").some((l) => l.trim() === e));
if (missing.length > 0) {
  writeFileSync(giPath, giLines.replace(/\n?$/, "\n") + missing.join("\n") + "\n");
  step(".gitignore", "added", missing.join(", "));
} else {
  step(".gitignore", "skip", "entries exist");
}

// Remove previously injected gitignore variant path if we put it there in old versions
if (giLines.includes(variantsDirRel)) {
  const cleaned = giLines.split("\n").filter(l => l.trim() !== variantsDirRel).join("\n");
  writeFileSync(giPath, cleaned);
  step(".gitignore", "cleaned", `removed ${variantsDirRel} rule for Tailwind v4 support`);
}

const tailwindCandidates = [
  "tailwind.config.js",
  "tailwind.config.ts",
  "tailwind.config.mjs",
  "tailwind.config.cjs"
];
const tailwindPath = tailwindCandidates.map(p => join(root, p)).find(p => existsSync(p));

if (tailwindPath) {
  const twConfig = readFileSync(tailwindPath, "utf8");
  const globPattern = `./${variantsDirRel.replace(/\\/g, '/')}**/*.{js,ts,jsx,tsx,mdx}`;
  if (!twConfig.includes(variantsDirRel) && !twConfig.includes(globPattern)) {
    const contentRegex = /(content\s*:\s*\[)/;
    if (contentRegex.test(twConfig)) {
      const updated = twConfig.replace(contentRegex, `$1\n    "${globPattern}",`);
      writeFileSync(tailwindPath, updated);
      step("tailwind.config", "patched", `added ${globPattern} to content`);
    } else {
      step("tailwind.config", "warn", "could not find 'content: [' array to patch");
    }
  } else {
    step("tailwind.config", "skip", "already configured");
  }
} else {
  step("tailwind.config", "skip", "no config found");
}

console.log(JSON.stringify(report, null, 2));
