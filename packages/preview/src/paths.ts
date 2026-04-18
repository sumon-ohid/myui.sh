import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

export const SHELL_TEMPLATE_DIR = resolve(here, "..", "shell");

export interface PreviewPaths {
  readonly previewDir: string;
  readonly variantsDir: string;
  readonly pidFile: string;
  readonly portFile: string;
  readonly logFile: string;
}

export function previewPaths(projectRoot: string): PreviewPaths {
  const previewDir = resolve(projectRoot, ".myui", "preview");
  return {
    previewDir,
    variantsDir: resolve(previewDir, "variants"),
    pidFile: resolve(previewDir, "daemon.pid"),
    portFile: resolve(previewDir, "daemon.port"),
    logFile: resolve(previewDir, "daemon.log"),
  };
}
