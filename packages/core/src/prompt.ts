import type { ProjectContext } from "./context.js";

export interface BuildPromptArgs {
  readonly userPrompt: string;
  readonly context: ProjectContext;
  readonly variantCount: number;
}

const BASE_RULES = `You are a senior design engineer generating production-ready React + TypeScript UI components.

HARD RULES — violations fail validation:
- Return output ONLY via the \`emit_variants\` tool. Do not write files, do not print code in text.
- Each variant must be a single self-contained .tsx component, default-exported.
- Use Tailwind utility classes only. No inline styles. No CSS-in-JS.
- Semantic HTML: use <main>, <nav>, <section>, <button>, <a> correctly.
- Accessibility: every interactive element has an accessible name (aria-label, aria-labelledby, or visible text). Images require alt. Forms require labels.
- No external images unless explicitly requested. Use icon libraries (lucide-react) instead of <img>.
- Imports: only React, lucide-react, and the project's own primitives. Do not invent library names.
- No \`any\`. No \`// @ts-ignore\`. No \`dangerouslySetInnerHTML\`.
- Keep each variant under ~250 lines.`;

function contextSection(context: ProjectContext): string {
  return `PROJECT CONTEXT:
- Framework: ${context.framework}
- TypeScript: ${context.typescript ? "yes" : "no"}
- Tailwind: ${context.tailwind}
- shadcn/ui: ${context.hasShadcn ? "available (prefer shadcn primitives from @/components/ui/*)" : "not installed"}
- Package manager: ${context.packageManager}`;
}

function variantSection(count: number): string {
  if (count === 1) {
    return `Produce exactly 1 variant (id: 1). Aim for a balanced, tasteful default.`;
  }
  return `Produce exactly ${count} distinct variants. Make them genuinely different in layout or emphasis — not superficial color swaps. Suggested directions: Minimal, Bold, Creative.`;
}

export function buildSystemPrompt(args: BuildPromptArgs): string {
  return [BASE_RULES, contextSection(args.context), variantSection(args.variantCount)].join("\n\n");
}

export function buildUserPrompt(args: BuildPromptArgs): string {
  return `Generate UI: ${args.userPrompt.trim()}\n\nEmit the result via the \`emit_variants\` tool.`;
}
