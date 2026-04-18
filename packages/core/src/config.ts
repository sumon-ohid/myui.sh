import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { ProjectContext } from "./context.js";

const ConfigSchema = z.object({
  version: z.literal(1),
  componentsDir: z.string().optional(),
  allowedDependencies: z.array(z.string()),
  forbiddenImports: z.array(z.string()),
});

export type MyUiConfig = z.infer<typeof ConfigSchema>;

export const DEFAULT_ALLOWED = [
  "react",
  "react-dom",
  "lucide-react",
  "clsx",
  "tailwind-merge",
  "class-variance-authority",
];

export const DEFAULT_FORBIDDEN = [
  "styled-components",
  "@emotion/react",
  "@emotion/styled",
  "jquery",
];

export function defaultConfig(): MyUiConfig {
  return {
    version: 1,
    allowedDependencies: DEFAULT_ALLOWED,
    forbiddenImports: DEFAULT_FORBIDDEN,
  };
}

export async function loadConfig(
  context: ProjectContext,
): Promise<MyUiConfig> {
  const path = join(context.root, "myui.config.json");
  try {
    const raw = await readFile(path, "utf8");
    const parsed = ConfigSchema.parse(JSON.parse(raw));
    return parsed;
  } catch {
    return defaultConfig();
  }
}
