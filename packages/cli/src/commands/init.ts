import { detectProjectContext } from "@myui/core";
import type { Command } from "commander";
import { writeFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import pc from "picocolors";

interface MyUiConfig {
  readonly version: 1;
  readonly componentsDir: string;
  readonly allowedDependencies: readonly string[];
  readonly forbiddenImports: readonly string[];
}

const DEFAULT_ALLOWED = [
  "react",
  "react-dom",
  "lucide-react",
  "clsx",
  "tailwind-merge",
  "class-variance-authority",
];

const DEFAULT_FORBIDDEN = [
  "styled-components",
  "@emotion/react",
  "@emotion/styled",
];

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export function registerInit(program: Command): void {
  program
    .command("init")
    .description("Scaffold myui.config.json in the current project")
    .action(async () => {
      const cwd = process.cwd();
      const ctx = await detectProjectContext(cwd);

      const configPath = join(cwd, "myui.config.json");
      if (await fileExists(configPath)) {
        process.stdout.write(
          pc.yellow(`myui.config.json already exists. Skipping.\n`),
        );
        return;
      }

      const config: MyUiConfig = {
        version: 1,
        componentsDir: ctx.componentsDir.replace(`${cwd}/`, ""),
        allowedDependencies: DEFAULT_ALLOWED,
        forbiddenImports: DEFAULT_FORBIDDEN,
      };

      await mkdir(ctx.componentsDir, { recursive: true });
      await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");

      process.stdout.write(
        pc.green(`✓ Wrote ${configPath}\n`) +
          `  framework:     ${ctx.framework}\n` +
          `  typescript:    ${ctx.typescript}\n` +
          `  tailwind:      ${ctx.tailwind}\n` +
          `  shadcn:        ${ctx.hasShadcn}\n` +
          `  components:    ${config.componentsDir}\n`,
      );
    });
}
