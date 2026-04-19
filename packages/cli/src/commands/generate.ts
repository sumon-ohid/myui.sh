import {
  detectProjectContext,
  formatReport,
  generate,
  inferComponentName,
  loadConfig,
  writeSession,
  writeVariant,
  type GenerationResult,
  type ModelId,
  type Variant,
  type VariantReport,
} from "@myui/core";
import { getStatus, materializeVariants, startDaemon } from "@myui/preview";
import * as p from "@clack/prompts";
import type { Command } from "commander";
import { spawn } from "node:child_process";
import pc from "picocolors";

function runInstall(
  pm: string,
  deps: readonly string[],
  cwd: string,
): Promise<void> {
  return new Promise((resolveProm) => {
    const spinner = p.spinner();
    spinner.start(`${pm} add ${deps.join(" ")}`);
    const child = spawn(pm, ["add", ...deps], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (b: Buffer) => {
      stderr += b.toString();
    });
    child.on("close", (code) => {
      if (code === 0) {
        spinner.stop(pc.green(`✓ Installed ${deps.length} dependency(ies)`));
      } else {
        spinner.stop(pc.red(`✗ ${pm} add exited ${code}`));
        if (stderr.trim()) p.note(stderr.trim().slice(0, 500), pc.red("stderr"));
      }
      resolveProm();
    });
    child.on("error", (err) => {
      spinner.stop(pc.red(`✗ ${err.message}`));
      resolveProm();
    });
  });
}

interface GenerateCliOptions {
  readonly variants?: string;
  readonly model?: string;
  readonly out?: string;
  readonly mock?: boolean;
  readonly autoInstall?: boolean;
  readonly figma?: string;
}

function buildFigmaInstruction(url: string): string {
  return [
    ``,
    `**Design reference (Figma):** ${url}`,
    ``,
    `Use the Figma MCP tools (mcp__claude_ai_Figma__get_design_context with the fileKey + nodeId parsed from the URL) to read the design before emitting variants. Mirror layout, spacing, typography, and color intent from the design. Do not invent UI not present in the design unless the user prompt asks for it.`,
  ].join("\n");
}

function renderReports(reports: readonly VariantReport[]): void {
  for (const r of reports) {
    if (r.report.issues.length === 0) continue;
    p.note(formatReport(r.report), pc.red(`Variant ${r.variantId}`));
  }
}

function parseVariantCount(raw: string | undefined): 1 | 2 | 3 {
  if (!raw) return 1;
  const n = Number.parseInt(raw, 10);
  if (n === 1 || n === 2 || n === 3) return n;
  throw new Error(`--variants must be 1, 2, or 3 (got "${raw}")`);
}

function parseModel(raw: string | undefined): ModelId {
  if (!raw || raw === "sonnet") return "claude-sonnet-4-6";
  if (raw === "opus") return "claude-opus-4-7";
  if (raw === "claude-sonnet-4-6" || raw === "claude-opus-4-7") return raw;
  throw new Error(`--model must be sonnet or opus (got "${raw}")`);
}

function buildMockVariantCode(id: 1 | 2 | 3, prompt: string): string {
  if (id === 1) {
    return `export default function Variant1() {
  return (
    <section style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 24, background: "#ffffff" }}>
      <h2 style={{ marginTop: 0 }}>Variant 1</h2>
      <p style={{ color: "#4b5563", lineHeight: 1.6 }}>
        Mock preview for: ${prompt.replace(/"/g, "\\\"")}
      </p>
      <button
        type="button"
        style={{
          cursor: "pointer",
          border: "1px solid #111827",
          background: "#111827",
          color: "#ffffff",
          borderRadius: 10,
          padding: "10px 14px",
          fontWeight: 600,
        }}
      >
        Primary Action
      </button>
    </section>
  );
}
`;
  }

  if (id === 2) {
    return `export default function Variant2() {
  return (
    <section style={{ borderRadius: 18, padding: 26, background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "#f8fafc" }}>
      <h2 style={{ marginTop: 0 }}>Variant 2</h2>
      <p style={{ color: "#cbd5e1", lineHeight: 1.6 }}>
        Mock preview for: ${prompt.replace(/"/g, "\\\"")}
      </p>
      <button
        type="button"
        style={{
          cursor: "pointer",
          border: "1px solid #38bdf8",
          background: "#38bdf8",
          color: "#082f49",
          borderRadius: 10,
          padding: "10px 14px",
          fontWeight: 700,
        }}
      >
        Explore
      </button>
    </section>
  );
}
`;
  }

  return `export default function Variant3() {
  return (
    <section style={{ borderRadius: 16, padding: 24, background: "#f8fafc", border: "1px dashed #94a3b8" }}>
      <h2 style={{ marginTop: 0 }}>Variant 3</h2>
      <p style={{ color: "#334155", lineHeight: 1.6 }}>
        Mock preview for: ${prompt.replace(/"/g, "\\\"")}
      </p>
      <button
        type="button"
        style={{
          cursor: "pointer",
          border: "1px solid #475569",
          background: "transparent",
          color: "#0f172a",
          borderRadius: 10,
          padding: "10px 14px",
          fontWeight: 600,
        }}
      >
        Secondary
      </button>
    </section>
  );
}
`;
}

function buildMockResult(prompt: string, variantCount: 1 | 2 | 3): GenerationResult {
  const variants: Variant[] = [];
  for (let id = 1 as 1 | 2 | 3; id <= variantCount; id = (id + 1) as 1 | 2 | 3) {
    variants.push({
      id,
      description: `Mock variant ${id}`,
      code: buildMockVariantCode(id, prompt),
    });
  }

  return {
    componentName: inferComponentName(prompt),
    variants,
    dependencies: [],
  };
}

async function pickVariant(
  result: GenerationResult,
): Promise<Variant | null> {
  if (result.variants.length === 1) {
    const only = result.variants[0];
    if (!only) return null;
    return only;
  }

  const choice = await p.select({
    message: "Which variant would you like to keep?",
    options: [
      ...result.variants.map((v) => ({
        value: String(v.id),
        label: `Variant ${v.id}`,
        hint: v.description,
      })),
      { value: "cancel", label: "Cancel — discard all" },
    ],
  });

  if (p.isCancel(choice) || choice === "cancel") return null;
  const picked = result.variants.find((v) => String(v.id) === choice);
  return picked ?? null;
}

export function registerGenerate(program: Command): void {
  program
    .command("generate <prompt>")
    .alias("gen")
    .description("Generate a UI component from a prompt")
    .option("-v, --variants <n>", "Number of variants (1-3)", "1")
    .option("-m, --model <id>", "sonnet | opus", "sonnet")
    .option("-o, --out <dir>", "Override components directory")
    .option("--mock", "Use local mock variants (no Claude API call)")
    .option("--auto-install", "Run package manager install for new dependencies")
    .option("--figma <url>", "Use Figma node as design reference")
    .action(async (prompt: string, opts: GenerateCliOptions) => {
      const variantCount = parseVariantCount(opts.variants);
      const model = parseModel(opts.model);

      const cwd = process.cwd();
      p.intro(pc.bgCyan(pc.black(" myui ")));

      const ctx = await detectProjectContext(cwd);
      const config = await loadConfig(ctx);
      const componentsDir = opts.out
        ? opts.out.startsWith("/")
          ? opts.out
          : `${cwd}/${opts.out}`
        : ctx.componentsDir;

      const spinner = p.spinner();
      let result: GenerationResult;
      let reports: readonly VariantReport[] = [];
      let sessionId = "";

      if (opts.mock) {
        spinner.start(`Generating ${variantCount} mock variant(s)…`);
        result = buildMockResult(prompt, variantCount);
        sessionId = `mock-${Date.now()}`;
        spinner.stop(
          pc.green(`✓ Generated ${result.variants.length} mock variant(s) (no model call)`),
        );
      } else {
        spinner.start(
          `Generating ${variantCount} variant(s) with ${model}…`,
        );

        const userPrompt = opts.figma
          ? `${prompt}\n${buildFigmaInstruction(opts.figma)}`
          : prompt;

        const outcome = await generate({
          userPrompt,
          context: ctx,
          variantCount,
          model,
          cwd,
          config,
          ...(opts.figma
            ? {
                extraAllowedTools: [
                  "mcp__claude_ai_Figma__get_design_context",
                  "mcp__claude_ai_Figma__get_screenshot",
                  "mcp__claude_ai_Figma__get_metadata",
                ],
              }
            : {}),
        });

        if (!outcome.ok) {
          spinner.stop(pc.red(`✗ ${outcome.error.message}`));
          if (outcome.reports) renderReports(outcome.reports);
          process.exitCode = 1;
          return;
        }

        const repairNote =
          outcome.repairsUsed > 0
            ? ` after ${outcome.repairsUsed} repair${outcome.repairsUsed === 1 ? "" : "s"}`
            : "";
        spinner.stop(
          pc.green(
            `✓ Generated ${outcome.result.variants.length} variant(s)${repairNote} ` +
              `(${outcome.inputTokens + outcome.outputTokens} tokens, ` +
              `$${outcome.costUsd.toFixed(4)})`,
          ),
        );

        result = outcome.result;
        reports = outcome.reports;
        sessionId = outcome.sessionId;
      }

      const warnings = reports.flatMap((r) =>
        r.report.issues.filter((i) => i.severity === "warning"),
      );
      if (warnings.length > 0) {
        p.note(
          warnings
            .slice(0, 8)
            .map((w) => `• ${w.rule}: ${w.message}`)
            .join("\n"),
          pc.yellow("Warnings"),
        );
      }

      const name =
        result.componentName ||
        inferComponentName(prompt);

      try {
        await materializeVariants({
          projectRoot: cwd,
          componentName: name,
          variants: result.variants.map((v) => ({
            id: v.id,
            code: v.code,
          })),
        });
        const status = await getStatus(cwd);
        const running = status.running
          ? status
          : await startDaemon({ projectRoot: cwd });
        p.note(running.url ?? "(no url)", "Preview");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        p.note(msg, pc.yellow("Preview unavailable"));
      }

      const picked = await pickVariant(result);
      if (!picked) {
        p.cancel("Cancelled.");
        return;
      }

      const written = await writeVariant({
        projectRoot: cwd,
        componentsDir,
        componentName: name,
        code: picked.code,
        extension: ctx.typescript ? "tsx" : "jsx",
      });

      p.note(written.relPath, "Wrote component");

      if (sessionId && !sessionId.startsWith("mock-")) {
        try {
          await writeSession(cwd, {
            sessionId,
            componentName: name,
            prompt,
            scope: "component",
            model,
            variantCount,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          p.note(msg, pc.yellow("Failed to persist session"));
        }
      }

      if (result.dependencies.length > 0) {
        if (opts.autoInstall) {
          await runInstall(ctx.packageManager, result.dependencies, cwd);
        } else {
          p.note(
            `${ctx.packageManager} add ${result.dependencies.join(" ")}`,
            "Install dependencies",
          );
        }
      }

      p.outro(pc.dim(`session: ${sessionId}`));
    });
}
