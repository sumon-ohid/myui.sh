import {
  Project,
  ScriptTarget,
  SyntaxKind,
  type JsxAttribute,
  type JsxOpeningElement,
  type JsxSelfClosingElement,
  type SourceFile,
} from "ts-morph";
import type { ShadcnPrimitive } from "./shadcn.js";

export type Severity = "error" | "warning";

export interface ValidationIssue {
  readonly rule: string;
  readonly severity: Severity;
  readonly message: string;
  readonly line?: number;
}

export interface ValidationReport {
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
}

export interface ValidateArgs {
  readonly code: string;
  readonly allowedDependencies: readonly string[];
  readonly forbiddenImports: readonly string[];
  readonly availablePrimitives: readonly ShadcnPrimitive[];
  readonly typescript: boolean;
}

const INTERNAL_PREFIXES = ["./", "../", "@/", "~/"];
const ALWAYS_ALLOWED = new Set(["react", "react-dom", "react/jsx-runtime"]);

function isInternalImport(spec: string): boolean {
  return INTERNAL_PREFIXES.some((p) => spec.startsWith(p));
}

function matchesPattern(spec: string, pattern: string): boolean {
  if (pattern.endsWith("/*")) {
    return spec.startsWith(pattern.slice(0, -1));
  }
  return spec === pattern || spec.startsWith(`${pattern}/`);
}

function packageName(spec: string): string {
  if (spec.startsWith("@")) {
    const [scope, name] = spec.split("/");
    return scope && name ? `${scope}/${name}` : spec;
  }
  return spec.split("/")[0] ?? spec;
}

function hasTextChild(el: JsxOpeningElement | JsxSelfClosingElement): boolean {
  if (el.getKind() === SyntaxKind.JsxSelfClosingElement) return false;
  const parent = el.getParent();
  if (!parent) return false;
  const text = parent.getText();
  const inner = text
    .replace(/^<[^>]*>/, "")
    .replace(/<\/[^>]*>$/, "")
    .trim();
  return inner.length > 0 && !/^<[^>]/.test(inner);
}

function getAttr(
  el: JsxOpeningElement | JsxSelfClosingElement,
  name: string,
): JsxAttribute | undefined {
  return el
    .getAttributes()
    .find(
      (a): a is JsxAttribute =>
        a.getKind() === SyntaxKind.JsxAttribute &&
        (a as JsxAttribute).getNameNode().getText() === name,
    );
}

function elementName(el: JsxOpeningElement | JsxSelfClosingElement): string {
  return el.getTagNameNode().getText();
}

function lineOf(node: { getStartLineNumber: () => number }): number {
  try {
    return node.getStartLineNumber();
  } catch {
    return 0;
  }
}

function checkImports(
  source: SourceFile,
  allowed: readonly string[],
  forbidden: readonly string[],
  issues: ValidationIssue[],
): void {
  const allowSet = new Set<string>([...allowed, ...ALWAYS_ALLOWED]);

  for (const imp of source.getImportDeclarations()) {
    const spec = imp.getModuleSpecifierValue();
    if (!spec) continue;
    if (isInternalImport(spec)) continue;

    if (forbidden.some((f) => matchesPattern(spec, f))) {
      issues.push({
        rule: "forbidden-import",
        severity: "error",
        message: `Import of forbidden package "${spec}".`,
        line: lineOf(imp),
      });
      continue;
    }

    const pkg = packageName(spec);
    if (!allowSet.has(pkg)) {
      issues.push({
        rule: "non-allowlisted-import",
        severity: "error",
        message: `Import of "${spec}" is not on the dependency allowlist. Add "${pkg}" to myui.config.json allowedDependencies or remove the import.`,
        line: lineOf(imp),
      });
    }
  }
}

function checkForbiddenSyntax(
  source: SourceFile,
  issues: ValidationIssue[],
): void {
  const text = source.getFullText();
  const lines = text.split("\n");

  lines.forEach((line, idx) => {
    const ln = idx + 1;
    if (/@ts-ignore|@ts-nocheck/.test(line)) {
      issues.push({
        rule: "no-ts-suppression",
        severity: "error",
        message: "TypeScript suppression comments are forbidden.",
        line: ln,
      });
    }
    if (/\bdangerouslySetInnerHTML\b/.test(line)) {
      issues.push({
        rule: "no-dangerous-html",
        severity: "error",
        message: "dangerouslySetInnerHTML is forbidden.",
        line: ln,
      });
    }
    if (/\bstyle\s*=\s*\{/.test(line)) {
      issues.push({
        rule: "no-inline-style",
        severity: "warning",
        message: "Inline style prop; prefer Tailwind utilities.",
        line: ln,
      });
    }
  });

  for (const node of source.getDescendantsOfKind(SyntaxKind.AnyKeyword)) {
    issues.push({
      rule: "no-any",
      severity: "error",
      message: "`any` type is forbidden.",
      line: lineOf(node),
    });
  }
}

function checkAccessibility(
  source: SourceFile,
  primitives: readonly ShadcnPrimitive[],
  issues: ValidationIssue[],
): void {
  const hasButtonPrimitive = primitives.some((p) => p.name === "Button");

  const elements: (JsxOpeningElement | JsxSelfClosingElement)[] = [
    ...source.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...source.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ];

  for (const el of elements) {
    const name = elementName(el);

    if (name === "img" && !getAttr(el, "alt")) {
      issues.push({
        rule: "img-alt",
        severity: "error",
        message: "<img> requires an `alt` attribute.",
        line: lineOf(el),
      });
    }

    if (name === "button") {
      if (hasButtonPrimitive) {
        issues.push({
          rule: "prefer-button-primitive",
          severity: "warning",
          message:
            "Project has a Button primitive — prefer it over raw <button>.",
          line: lineOf(el),
        });
      }
      const ariaLabel = getAttr(el, "aria-label");
      const ariaLabelledBy = getAttr(el, "aria-labelledby");
      if (!ariaLabel && !ariaLabelledBy && !hasTextChild(el)) {
        issues.push({
          rule: "button-name",
          severity: "error",
          message:
            "<button> needs visible text, aria-label, or aria-labelledby.",
          line: lineOf(el),
        });
      }
    }

    if (name === "a") {
      const href = getAttr(el, "href");
      if (!href) {
        issues.push({
          rule: "anchor-href",
          severity: "warning",
          message: "<a> should have an href. Use <button> if this is an action.",
          line: lineOf(el),
        });
      }
    }
  }
}

export function validateVariant(args: ValidateArgs): ValidationReport {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      target: ScriptTarget.ES2022,
      jsx: 1,
      allowJs: true,
      noEmit: true,
    },
  });

  const filename = `variant.${args.typescript ? "tsx" : "jsx"}`;
  const source = project.createSourceFile(filename, args.code, {
    overwrite: true,
  });

  const issues: ValidationIssue[] = [];
  checkImports(
    source,
    args.allowedDependencies,
    args.forbiddenImports,
    issues,
  );
  checkForbiddenSyntax(source, issues);
  checkAccessibility(source, args.availablePrimitives, issues);

  const hasError = issues.some((i) => i.severity === "error");
  return { ok: !hasError, issues };
}

export function formatReport(report: ValidationReport): string {
  if (report.issues.length === 0) return "No issues.";
  return report.issues
    .map((i) => {
      const loc = i.line ? `:${i.line}` : "";
      return `[${i.severity}] ${i.rule}${loc} — ${i.message}`;
    })
    .join("\n");
}
