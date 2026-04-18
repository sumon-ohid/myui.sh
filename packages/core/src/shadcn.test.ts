import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { scanShadcnPrimitives } from "./shadcn.js";
import type { ProjectContext } from "./context.js";

describe("scanShadcnPrimitives", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "myui-shadcn-"));
  });

  function ctx(overrides: Partial<ProjectContext> = {}): ProjectContext {
    return {
      root,
      packageManager: "pnpm",
      framework: "next",
      typescript: true,
      tailwind: "v3",
      hasShadcn: true,
      componentsDir: join(root, "src/components"),
      ...overrides,
    };
  }

  it("returns empty when shadcn absent", async () => {
    const res = await scanShadcnPrimitives(ctx({ hasShadcn: false }));
    expect(res).toEqual([]);
  });

  it("returns empty when ui dir missing", async () => {
    const res = await scanShadcnPrimitives(ctx());
    expect(res).toEqual([]);
  });

  it("parses exports from ui dir", async () => {
    const uiDir = join(root, "src/components/ui");
    await mkdir(uiDir, { recursive: true });
    await writeFile(
      join(uiDir, "button.tsx"),
      "export const Button = () => null;\nexport const buttonVariants = () => '';",
      "utf8",
    );
    await writeFile(
      join(uiDir, "card.tsx"),
      "export { Card, CardHeader, CardContent };",
      "utf8",
    );
    const res = await scanShadcnPrimitives(ctx());
    expect(res.length).toBe(2);
    const btn = res.find((p) => p.name === "Button");
    expect(btn?.exports).toContain("Button");
    const card = res.find((p) => p.name === "Card");
    expect(card?.exports).toEqual(
      expect.arrayContaining(["Card", "CardHeader", "CardContent"]),
    );
  });
});
