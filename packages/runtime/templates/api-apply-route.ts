import { readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
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
  return join(ROOT, "app", "myui-variants");
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

interface ParsedImport {
  readonly raw: string;
  readonly source: string;
  readonly defaults: Set<string>;
  readonly named: Set<string>;
  readonly namespaces: Set<string>;
  readonly sideEffect: boolean;
}

function parseImports(src: string): { imports: ParsedImport[]; end: number } {
  const imports: ParsedImport[] = [];
  const re = /^import\s+(?:([^"';]+?)\s+from\s+)?["']([^"']+)["'];?\s*\n/gm;
  let m: RegExpExecArray | null;
  let end = 0;
  while ((m = re.exec(src)) !== null) {
    const clause = m[1]?.trim();
    const source = m[2];
    const parsed: ParsedImport = {
      raw: m[0],
      source,
      defaults: new Set(),
      named: new Set(),
      namespaces: new Set(),
      sideEffect: !clause,
    };
    if (clause) {
      const namedMatch = clause.match(/\{([^}]*)\}/);
      const namedPart = namedMatch?.[1] ?? "";
      const rest = clause.replace(/\{[^}]*\}/, "").replace(/,\s*,/g, ",").trim();
      for (const tok of rest.split(",").map((t) => t.trim()).filter(Boolean)) {
        if (tok.startsWith("*")) {
          const nm = tok.split(/\s+as\s+/)[1]?.trim();
          if (nm) parsed.namespaces.add(nm);
        } else {
          parsed.defaults.add(tok);
        }
      }
      for (const tok of namedPart.split(",").map((t) => t.trim()).filter(Boolean)) {
        parsed.named.add(tok);
      }
    }
    imports.push(parsed);
    end = m.index + m[0].length;
  }
  return { imports, end };
}

function formatImport(p: ParsedImport): string {
  if (p.sideEffect) return `import "${p.source}";\n`;
  const parts: string[] = [];
  if (p.defaults.size) parts.push(Array.from(p.defaults)[0]);
  if (p.namespaces.size) parts.push(`* as ${Array.from(p.namespaces)[0]}`);
  if (p.named.size) parts.push(`{ ${Array.from(p.named).join(", ")} }`);
  return `import ${parts.join(", ")} from "${p.source}";\n`;
}

function mergeImports(originalSrc: string, variantSrc: string): string {
  const orig = parseImports(originalSrc);
  const varn = parseImports(variantSrc);

  const bySource = new Map<string, ParsedImport>();
  for (const imp of orig.imports) bySource.set(imp.source, { ...imp, defaults: new Set(imp.defaults), named: new Set(imp.named), namespaces: new Set(imp.namespaces) });

  for (const imp of varn.imports) {
    if (imp.source === "@myui-sh/runtime") continue;
    if (/myui-variants\/_index/.test(imp.source)) continue;
    const existing = bySource.get(imp.source);
    if (!existing) {
      bySource.set(imp.source, { ...imp, defaults: new Set(imp.defaults), named: new Set(imp.named), namespaces: new Set(imp.namespaces) });
    } else {
      for (const d of imp.defaults) existing.defaults.add(d);
      for (const n of imp.named) existing.named.add(n);
      for (const ns of imp.namespaces) existing.namespaces.add(ns);
    }
  }

  const rebuilt = Array.from(bySource.values()).map(formatImport).join("");
  const bodyAfterOriginalImports = originalSrc.slice(orig.end);
  return rebuilt + bodyAfterOriginalImports;
}

function removeRuntimeImports(src: string, { keepSlotImport }: { keepSlotImport: boolean }): string {
  let out = src;
  if (!keepSlotImport) {
    out = out.replace(
      /^import\s+\{([^}]*)\}\s+from\s+["']@myui\/runtime["'];\s*\n/m,
      (full, inner: string) => {
        const remaining = inner
          .split(",")
          .map((s: string) => s.trim())
          .filter((s: string) => s && s !== "MyuiSlot");
        if (remaining.length === 0) return "";
        return `import { ${remaining.join(", ")} } from "@myui-sh/runtime";\n`;
      },
    );
  }
  return out;
}

function extractReturnJsx(variantSrc: string): string | null {
  const fnRe = /export\s+default\s+function\s+\w+\s*\([^)]*\)\s*\{/;
  const match = fnRe.exec(variantSrc);
  if (!match) return null;
  let i = match.index + match[0].length;
  const retIdx = variantSrc.indexOf("return", i);
  if (retIdx === -1) return null;
  let j = retIdx + "return".length;
  while (j < variantSrc.length && /\s/.test(variantSrc[j])) j++;

  const open = variantSrc[j];
  if (open === "(") {
    let depth = 1;
    let k = j + 1;
    while (k < variantSrc.length && depth > 0) {
      const c = variantSrc[k];
      if (c === "(") depth++;
      else if (c === ")") depth--;
      if (depth === 0) break;
      k++;
    }
    if (depth !== 0) return null;
    return variantSrc.slice(j + 1, k).trim();
  }
  if (open === "<") {
    let k = j;
    let depth = 0;
    while (k < variantSrc.length) {
      if (variantSrc[k] === "<") {
        if (variantSrc[k + 1] === "/") depth--;
        else if (variantSrc[k + 1] !== "!") depth++;
      } else if (variantSrc[k] === ">" && variantSrc[k - 1] !== "=") {
        if (variantSrc[k - 1] === "/") depth--;
        if (depth === 0) {
          return variantSrc.slice(j, k + 1).trim();
        }
      }
      k++;
    }
  }
  return null;
}

function findSlotBlock(src: string, slotId: string): { start: number; end: number } | null {
  const openRe = new RegExp(`<MyuiSlot\\s+id=["']${slotId}["'][^>]*>`, "g");
  const openMatch = openRe.exec(src);
  if (!openMatch) return null;
  const blockStart = openMatch.index;
  let depth = 1;
  let i = openMatch.index + openMatch[0].length;
  while (i < src.length && depth > 0) {
    const openNext = src.indexOf("<MyuiSlot", i);
    const closeNext = src.indexOf("</MyuiSlot>", i);
    if (closeNext === -1) return null;
    if (openNext !== -1 && openNext < closeNext) {
      depth++;
      i = openNext + "<MyuiSlot".length;
    } else {
      depth--;
      i = closeNext + "</MyuiSlot>".length;
      if (depth === 0) {
        return { start: blockStart, end: i };
      }
    }
  }
  return null;
}

function reindent(jsx: string, indent: string): string {
  const lines = jsx.split("\n");
  if (lines.length === 1) return jsx;
  const nonEmpty = lines.slice(1).filter((l) => l.trim().length > 0);
  const minIndent = nonEmpty.reduce((min, l) => {
    const m = /^(\s*)/.exec(l);
    const lead = m?.[1].length ?? 0;
    return lead < min ? lead : min;
  }, Number.POSITIVE_INFINITY);
  const strip = Number.isFinite(minIndent) ? (minIndent as number) : 0;
  return lines
    .map((l, idx) => {
      if (idx === 0) return l;
      const stripped = l.startsWith(" ".repeat(strip)) ? l.slice(strip) : l.replace(/^\s+/, "");
      return stripped.length ? indent + stripped : stripped;
    })
    .join("\n");
}

function countRemainingSlots(src: string): number {
  const matches = src.match(/<MyuiSlot\b/g);
  return matches ? matches.length : 0;
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

  const slotBlock = findSlotBlock(originalSrc, slotId);
  if (!slotBlock) {
    return NextResponse.json(
      { error: `<MyuiSlot id="${slotId}"> block not found in ${slot.file}` },
      { status: 404 },
    );
  }

  const variantJsx = extractReturnJsx(variantSrc);
  if (!variantJsx) {
    return NextResponse.json(
      { error: `could not extract JSX from Variant${variantIndex}` },
      { status: 500 },
    );
  }

  const lineStart = originalSrc.lastIndexOf("\n", slotBlock.start - 1) + 1;
  const indent = originalSrc.slice(lineStart, slotBlock.start).match(/^\s*/)?.[0] ?? "";
  const reindented = reindent(variantJsx, indent);

  const replaced =
    originalSrc.slice(0, slotBlock.start) +
    reindented +
    originalSrc.slice(slotBlock.end);

  const remainingSlots = countRemainingSlots(replaced);
  let merged = mergeImports(replaced, variantSrc);
  merged = removeRuntimeImports(merged, { keepSlotImport: remainingSlots > 0 });

  if (remainingSlots === 0) {
    merged = merged.replace(/^import\s+["'][^"']*\.?myui-variants\/_index["'];\s*\n/m, "");
    merged = merged.replace(
      /^import\s+\{\s*MyuiSlotBootstrap\s*\}\s+from\s+["'][^"']+["'];\s*\n/m,
      "",
    );
  }

  writeFileSync(originalPath, merged);

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

  // If no slots remain, remove empty variant subdirectories untouched; leave _index for future use.
  try {
    const leftover = readdirSync(VARIANTS_DIR).filter((f) => f !== "_index.ts" && !f.startsWith("."));
    void leftover;
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true, file: slot.file });
}
