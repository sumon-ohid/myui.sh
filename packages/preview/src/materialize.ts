import {
  cp,
  mkdir,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { previewPaths, SHELL_TEMPLATE_DIR } from "./paths.js";

export interface VariantInput {
  readonly id: 1 | 2 | 3;
  readonly code: string;
}

export interface MaterializeArgs {
  readonly projectRoot: string;
  readonly componentName: string;
  readonly variants: readonly VariantInput[];
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureShellCopied(previewDir: string): Promise<void> {
  const sentinel = resolve(previewDir, "main.tsx");
  if (await pathExists(sentinel)) return;
  await mkdir(previewDir, { recursive: true });
  await cp(SHELL_TEMPLATE_DIR, previewDir, {
    recursive: true,
    filter: (src) =>
      !src.endsWith(".gitkeep") && !src.endsWith("vite.config.template.mjs"),
  });
}

async function clearVariants(variantsDir: string): Promise<void> {
  if (!(await pathExists(variantsDir))) {
    await mkdir(variantsDir, { recursive: true });
    return;
  }
  const entries = await readdir(variantsDir);
  await Promise.all(
    entries
      .filter((f) => f.startsWith("Variant") && f.endsWith(".tsx"))
      .map((f) => rm(resolve(variantsDir, f), { force: true })),
  );
}

export interface MaterializeResult {
  readonly previewDir: string;
  readonly variantFiles: readonly string[];
}

export async function materializeVariants(
  args: MaterializeArgs,
): Promise<MaterializeResult> {
  const paths = previewPaths(args.projectRoot);
  await ensureShellCopied(paths.previewDir);
  await clearVariants(paths.variantsDir);

  const written: string[] = [];
  for (const v of args.variants) {
    const file = resolve(paths.variantsDir, `Variant${v.id}.tsx`);
    await writeFile(file, v.code, "utf8");
    written.push(file);
  }

  await writeFile(
    resolve(paths.previewDir, "manifest.json"),
    JSON.stringify(
      {
        componentName: args.componentName,
        variantIds: args.variants.map((v) => v.id),
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );

  return { previewDir: paths.previewDir, variantFiles: written };
}

export async function clearPreview(projectRoot: string): Promise<void> {
  const paths = previewPaths(projectRoot);
  if (!(await pathExists(paths.previewDir))) return;
  await rm(paths.previewDir, { recursive: true, force: true });
}
