import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ContextDetectionError } from "./errors.js";

export type Framework =
  | "next"
  | "vite-react"
  | "remix"
  | "astro"
  | "cra"
  | "unknown";

export type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

export type TailwindVersion = "v3" | "v4" | "none";

export interface ProjectContext {
  readonly root: string;
  readonly packageManager: PackageManager;
  readonly framework: Framework;
  readonly typescript: boolean;
  readonly tailwind: TailwindVersion;
  readonly hasShadcn: boolean;
  readonly componentsDir: string;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

async function detectPackageManager(root: string): Promise<PackageManager> {
  if (await fileExists(join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (await fileExists(join(root, "bun.lockb"))) return "bun";
  if (await fileExists(join(root, "yarn.lock"))) return "yarn";
  return "npm";
}

async function detectFramework(
  deps: Record<string, string>,
): Promise<Framework> {
  if (deps["next"]) return "next";
  if (deps["@remix-run/react"]) return "remix";
  if (deps["astro"]) return "astro";
  if (deps["react-scripts"]) return "cra";
  if (deps["vite"] && deps["react"]) return "vite-react";
  return "unknown";
}

async function detectTailwind(
  root: string,
  deps: Record<string, string>,
): Promise<TailwindVersion> {
  const tw = deps["tailwindcss"];
  if (!tw) return "none";
  const major = tw.replace(/[^\d]/g, "").charAt(0);
  if (major === "4") return "v4";
  if (major === "3") return "v3";
  const configExists =
    (await fileExists(join(root, "tailwind.config.js"))) ||
    (await fileExists(join(root, "tailwind.config.ts")));
  return configExists ? "v3" : "none";
}

function mergeDeps(pkg: Record<string, unknown>): Record<string, string> {
  const d = (pkg["dependencies"] ?? {}) as Record<string, string>;
  const dd = (pkg["devDependencies"] ?? {}) as Record<string, string>;
  return { ...dd, ...d };
}

export async function detectProjectContext(
  rootInput: string,
): Promise<ProjectContext> {
  const root = resolve(rootInput);
  const pkgPath = join(root, "package.json");

  if (!(await fileExists(pkgPath))) {
    throw new ContextDetectionError(
      `No package.json found at ${root}. Run \`myui init\` inside a project root.`,
    );
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = await readJson(pkgPath);
  } catch (cause) {
    throw new ContextDetectionError(
      `Failed to parse package.json at ${pkgPath}`,
      cause,
    );
  }

  const deps = mergeDeps(pkg);
  const [pm, framework, tailwind] = await Promise.all([
    detectPackageManager(root),
    detectFramework(deps),
    detectTailwind(root, deps),
  ]);

  const typescript = await fileExists(join(root, "tsconfig.json"));
  const hasShadcn = await fileExists(join(root, "components.json"));

  const componentsDir = hasShadcn
    ? join(root, "src", "components")
    : framework === "next"
      ? join(root, "components")
      : join(root, "src", "components");

  return {
    root,
    packageManager: pm,
    framework,
    typescript,
    tailwind,
    hasShadcn,
    componentsDir,
  };
}
