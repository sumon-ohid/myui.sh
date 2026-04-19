import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";

const ROOT = process.cwd();

function getVariantsDir(): string {
  try {
    const config = JSON.parse(readFileSync(join(ROOT, ".myui", "config.json"), "utf8"));
    if (config.variantsDir) return join(ROOT, config.variantsDir);
  } catch {
    // fall through to default
  }
  return join(ROOT, "app", ".myui-variants");
}

const VARIANTS_DIR = getVariantsDir();

function readSlotsMeta(): { slots: Record<string, { file: string }> } | null {
  const slotsPath = join(ROOT, ".myui", "slots.json");
  try {
    const parsed = JSON.parse(readFileSync(slotsPath, "utf8"));
    if (parsed?.slots && typeof parsed.slots === "object") {
      return { slots: parsed.slots };
    }
  } catch {
    // fall through
  }

  try {
    const config = JSON.parse(readFileSync(join(ROOT, ".myui", "config.json"), "utf8"));
    if (config?.slots && typeof config.slots === "object") {
      return { slots: config.slots };
    }
  } catch {
    // no legacy config slots
  }

  return null;
}

function stripMyuiSlot(src: string): string {
  let out = src;
  out = out.replace(/^import\s+\{[^}]*MyuiSlot[^}]*\}\s+from\s+["']@myui\/runtime["'];\n?/m, "");
  out = out.replace(/^import\s+["'][^"']*\.myui-variants\/_index["'];\n?/m, "");
  out = out.replace(/<MyuiSlot[^>]*>\n?([\s\S]*?)<\/MyuiSlot>/g, (_, inner) =>
    inner.replace(/^\n/, "").replace(/\n?$/, ""),
  );
  return out;
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available in production" }, { status: 403 });
  }

  const body = (await req.json()) as { slotId?: string; variantIndex?: number };
  const { slotId, variantIndex } = body;

  if (!slotId || variantIndex == null) {
    return NextResponse.json({ error: "slotId and variantIndex required" }, { status: 400 });
  }

  const slotsPath = join(ROOT, ".myui", "slots.json");
  const slotsJson = readSlotsMeta();
  if (!slotsJson) {
    return NextResponse.json(
      { error: "could not read slot metadata (.myui/slots.json or legacy .myui/config.json slots)" },
      { status: 500 },
    );
  }

  const slot = slotsJson.slots?.[slotId];
  if (!slot) {
    return NextResponse.json({ error: `slot "${slotId}" not found` }, { status: 404 });
  }

  const variantPath = join(VARIANTS_DIR, slotId, `Variant${variantIndex}.tsx`);
  let variantSrc: string;
  try {
    variantSrc = readFileSync(variantPath, "utf8");
  } catch {
    return NextResponse.json({ error: `variant file not found: ${variantPath}` }, { status: 404 });
  }

  const originalPath = join(ROOT, slot.file);
  let originalSrc: string;
  try {
    originalSrc = readFileSync(originalPath, "utf8");
  } catch {
    return NextResponse.json({ error: `original file not found: ${slot.file}` }, { status: 404 });
  }

  const exportMatch = originalSrc.match(/export\s+default\s+function\s+(\w+)/);
  const originalName = exportMatch?.[1];

  let newSrc = variantSrc;
  if (originalName) {
    newSrc = newSrc.replace(
      new RegExp(`export\\s+default\\s+function\\s+Variant${variantIndex}\\b`),
      `export default function ${originalName}`,
    );
  }

  writeFileSync(originalPath, stripMyuiSlot(newSrc));

  rmSync(join(VARIANTS_DIR, slotId), { recursive: true, force: true });

  delete slotsJson.slots[slotId];
  writeFileSync(slotsPath, JSON.stringify(slotsJson, null, 2) + "\n");

  const indexPath = join(VARIANTS_DIR, "_index.ts");
  try {
    const idx = readFileSync(indexPath, "utf8");
    const cleaned = idx
      .replace(new RegExp(`\\s*["']${slotId}["']\\s*:\\s*\\(\\)\\s*=>\\s*import\\([^)]+\\),?\\n?`), "\n")
      .replace(/,(\s*\})/g, "$1");
    writeFileSync(indexPath, cleaned);
  } catch {
    // non-fatal
  }

  return NextResponse.json({ ok: true, file: slot.file });
}
