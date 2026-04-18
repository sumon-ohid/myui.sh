import type { ProjectContext } from "./context.js";
import type { ScopeHint } from "./scope.js";
import type { ShadcnPrimitive } from "./shadcn.js";

export interface BuildPromptArgs {
  readonly userPrompt: string;
  readonly context: ProjectContext;
  readonly variantCount: number;
  readonly scope: ScopeHint;
  readonly primitives: readonly ShadcnPrimitive[];
}

const BASE_RULES = `You are a senior design engineer generating production-ready React + TypeScript UI components.

HARD RULES — violations fail validation:
- Return output ONLY via the \`emit_variants\` tool. Do not write files, do not print code as text.
- Each variant is one self-contained .tsx file, default-exported.
- Tailwind utility classes only. No inline styles. No CSS-in-JS. No global CSS.
- Semantic HTML: <main>, <nav>, <section>, <header>, <footer>, <button>, <a>, <label>.
- Accessibility: every interactive element has an accessible name (visible text, aria-label, or aria-labelledby). Images require alt. Form controls require labels. Use aria-describedby for error messages. Keyboard navigable (no click-only handlers on divs).
- Icons: use lucide-react, not inline <svg> unless a spinner or decorative shape.
- Imports: React, lucide-react, clsx/tailwind-merge, and the project's own primitives. Never invent library names or import from packages that clearly do not exist.
- No \`any\`. No \`// @ts-ignore\`. No \`dangerouslySetInnerHTML\`.
- Mock data inline if needed (typed, small, realistic — not "lorem ipsum" unless asked).
- Export a named TypeScript interface for props. No single-letter prop names.

COMPLEXITY RULE:
- Match output complexity to the prompt. A "button" should be small; a "pricing page" should be rich. Do not pad a simple request with irrelevant features, and do not under-deliver on a complex one.`;

function contextSection(context: ProjectContext): string {
  return `PROJECT CONTEXT:
- Framework: ${context.framework}
- TypeScript: ${context.typescript ? "yes" : "no"}
- Tailwind: ${context.tailwind}
- shadcn/ui: ${context.hasShadcn ? "installed — prefer existing primitives" : "not installed"}
- Package manager: ${context.packageManager}`;
}

function scopeSection(scope: ScopeHint): string {
  const lines = [
    `SCOPE: ${scope.scope} (target ≤${scope.lineBudget} lines per variant)`,
    scope.guidance,
  ];
  if (scope.patternRef) {
    lines.push(`Reference pattern — ${scope.patternRef}`);
  }
  return lines.join("\n");
}

function primitivesSection(primitives: readonly ShadcnPrimitive[]): string {
  if (primitives.length === 0) {
    return `AVAILABLE PRIMITIVES: none detected. Build from Tailwind + HTML.`;
  }
  const lines = primitives.map(
    (p) => `- \`@/components/ui/${p.file}\` — ${p.exports.join(", ")}`,
  );
  return [
    `AVAILABLE PRIMITIVES (prefer these over raw HTML where they fit):`,
    ...lines,
    `Import like: import { Button } from "@/components/ui/button";`,
  ].join("\n");
}

function variantSection(count: number): string {
  if (count === 1) {
    return `Produce exactly 1 variant (id: 1). Balanced, tasteful default.`;
  }
  return `Produce exactly ${count} DISTINCT variants.
- id 1: Minimal — restrained, lots of whitespace, neutral palette.
- id 2: Bold — confident typography, saturated accent, stronger contrast.
- id 3: Creative — unexpected layout or visual hook, still accessible.
Do not return near-duplicates. Each variant must differ in layout or visual direction, not just colors.`.slice(
    0,
    count === 2 ? 400 : undefined,
  );
}

export function buildSystemPrompt(args: BuildPromptArgs): string {
  return [
    BASE_RULES,
    contextSection(args.context),
    scopeSection(args.scope),
    primitivesSection(args.primitives),
    variantSection(args.variantCount),
  ].join("\n\n");
}

export function buildUserPrompt(args: BuildPromptArgs): string {
  return `Generate UI: ${args.userPrompt.trim()}

Emit the result via the \`emit_variants\` tool with a PascalCase componentName, ${args.variantCount} variant(s), and any missing dependencies listed.`;
}
