import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileWriteError } from "./errors.js";
import { writeVariant } from "./write.js";

describe("writeVariant", () => {
  let root: string;
  let compDir: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "myui-test-"));
    compDir = join(root, "src", "components");
    await mkdir(compDir, { recursive: true });
  });

  afterEach(() => {});

  it("writes a new component file", async () => {
    const res = await writeVariant({
      projectRoot: root,
      componentsDir: compDir,
      componentName: "Button",
      code: "export const Button = () => null;",
      extension: "tsx",
    });
    expect(res.path).toBe(join(compDir, "Button.tsx"));
    const content = await readFile(res.path, "utf8");
    expect(content).toMatch(/export const Button/);
  });

  it("appends numeric suffix on collision", async () => {
    await writeFile(join(compDir, "Card.tsx"), "existing", "utf8");
    const res = await writeVariant({
      projectRoot: root,
      componentsDir: compDir,
      componentName: "Card",
      code: "export const Card = () => null;",
      extension: "tsx",
    });
    expect(res.path).toBe(join(compDir, "Card2.tsx"));
  });

  it("rejects path traversal via componentsDir outside root", async () => {
    const outside = join(root, "..", "evil");
    await expect(
      writeVariant({
        projectRoot: root,
        componentsDir: outside,
        componentName: "X",
        code: "x",
        extension: "tsx",
      }),
    ).rejects.toBeInstanceOf(FileWriteError);
  });
});
