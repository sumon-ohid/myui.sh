import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { FileWriteError } from "./errors.js";

export interface WriteVariantArgs {
  readonly projectRoot: string;
  readonly componentsDir: string;
  readonly componentName: string;
  readonly code: string;
  readonly extension: "tsx" | "jsx";
}

export interface WriteVariantResult {
  readonly path: string;
  readonly relPath: string;
  readonly overwrote: boolean;
}

const MAX_COLLISION_SUFFIX = 99;

function assertInsideRoot(target: string, root: string): void {
  const rel = relative(root, target);
  if (rel.startsWith("..") || resolve(root, rel) !== target) {
    throw new FileWriteError(
      `Refusing to write outside project root: ${target}`,
    );
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await readFile(p);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
    return true;
  }
}

async function resolveNonCollidingPath(
  baseDir: string,
  name: string,
  ext: string,
): Promise<{ path: string; suffix: number }> {
  const first = resolve(baseDir, `${name}.${ext}`);
  if (!(await pathExists(first))) return { path: first, suffix: 0 };
  for (let i = 2; i <= MAX_COLLISION_SUFFIX; i++) {
    const candidate = resolve(baseDir, `${name}${i}.${ext}`);
    if (!(await pathExists(candidate))) return { path: candidate, suffix: i };
  }
  throw new FileWriteError(
    `Exhausted collision suffixes for ${name}.${ext} in ${baseDir}`,
  );
}

export async function writeVariant(
  args: WriteVariantArgs,
): Promise<WriteVariantResult> {
  const root = resolve(args.projectRoot);
  const dir = resolve(args.componentsDir);
  assertInsideRoot(dir, root);

  const { path: target } = await resolveNonCollidingPath(
    dir,
    args.componentName,
    args.extension,
  );
  assertInsideRoot(target, root);

  try {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, args.code, { encoding: "utf8", flag: "wx" });
  } catch (cause) {
    throw new FileWriteError(`Failed to write ${target}`, cause);
  }

  return {
    path: target,
    relPath: relative(root, target),
    overwrote: false,
  };
}
